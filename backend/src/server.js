require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const ImageKit = require('imagekit');
const connectDB = require('./config/db');
const Factory = require('./models/FactorySchema');
const TelemetryModel = require('./models/Telemetry');
const WorkspaceSettings = require('./models/WorkspaceSettings');
const { FactorySimulator, MachineInstance } = require('./simulator');

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'public_WFeQX8UkftEzxi+FHlGACEOfj1k=',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'private_rj5r/x7luPhB2y5915FgN/m12nU=',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/LAzy/'
});

const upload = multer({ storage: multer.memoryStorage() });

// --- API ROUTES ---
app.post('/api/upload-map', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file provided' });
        const response = await imagekit.upload({
            file: req.file.buffer,
            fileName: req.file.originalname || 'map_background.png',
            folder: '/abb_digital_twin'
        });
        res.json({ url: response.url, name: response.name });
    } catch (error) {
        console.error('ImageKit Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

app.get('/api/workspace', async (req, res) => {
    try {
        let settings = await WorkspaceSettings.findOne({ id: 'default' });
        if (!settings) {
            settings = await WorkspaceSettings.create({ id: 'default' });
        }
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/workspace', async (req, res) => {
    try {
        let settings = await WorkspaceSettings.findOne({ id: 'default' });
        if (!settings) {
            settings = new WorkspaceSettings({ id: 'default' });
        }
        
        if (req.body.backgroundUrl !== undefined) settings.backgroundUrl = req.body.backgroundUrl;
        if (req.body.backgroundName !== undefined) settings.backgroundName = req.body.backgroundName;
        if (req.body.gridVisible !== undefined) settings.gridVisible = req.body.gridVisible;
        if (req.body.layoutLocked !== undefined) settings.layoutLocked = req.body.layoutLocked;
        if (req.body.zonesLocked !== undefined) settings.zonesLocked = req.body.zonesLocked;
        if (req.body.zoom !== undefined) settings.zoom = req.body.zoom;
        if (req.body.panX !== undefined) settings.panX = req.body.panX;
        if (req.body.panY !== undefined) settings.panY = req.body.panY;
        if (req.body.showZones !== undefined) settings.showZones = req.body.showZones;
        if (req.body.showFlow !== undefined) settings.showFlow = req.body.showFlow;
        if (req.body.showRisk !== undefined) settings.showRisk = req.body.showRisk;
        if (req.body.lastSavedTimestamp !== undefined) settings.lastSavedTimestamp = req.body.lastSavedTimestamp;
        
        if (req.body.zones !== undefined) {
            settings.zones = req.body.zones;
            settings.markModified('zones');
            
            // Synchronize with Factory schema
            const factoryDoc = await Factory.findOne({ id: 'default' });
            if (factoryDoc) {
                const workspaceZoneNames = Object.values(req.body.zones).map(z => z.name);
                
                const originalZones = [...factoryDoc.zones];
                const validZones = originalZones.filter(z => workspaceZoneNames.includes(z.name));
                const removedZones = originalZones.filter(z => !workspaceZoneNames.includes(z.name));
                
                if (removedZones.length > 0) {
                    console.log(`[DB] Save Sync: Deleting ${removedZones.length} zone(s) from Factory Schema...`);
                    let fallbackZone = validZones[0] || originalZones[0];
                    removedZones.forEach(ez => {
                        if (ez.machines && ez.machines.length > 0) {
                            ez.machines.forEach(m => {
                                if (fallbackZone) {
                                    m.position.zone = fallbackZone.name;
                                    fallbackZone.machines.push(m);
                                }
                            });
                        }
                    });
                    factoryDoc.zones = validZones;
                    await factoryDoc.save();
                }
                
                // Add any newly added zones from request into factory doc
                let added = false;
                for (let z of Object.values(req.body.zones)) {
                    if (!factoryDoc.zones.some(fz => fz.name === z.name)) {
                        factoryDoc.zones.push({
                            name: z.name,
                            color: z.color,
                            status: 'normal',
                            x: z.x,
                            y: z.y,
                            width: z.width,
                            height: z.height,
                            machines: []
                        });
                        added = true;
                    }
                }
                if (added) {
                    await factoryDoc.save();
                }
            }
        }
        
        if (req.body.connections !== undefined) {
            settings.connections = req.body.connections;
            settings.markModified('connections');
        }
        
        await settings.save();
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] } 
});

const simulator = new FactorySimulator();

// Boot sequence
const boot = async () => {
    await connectDB();
    
    // 1. Load or create WorkspaceSettings first (since it holds the spatial zone coordinate configuration)
    let settings;
    try {
        settings = await WorkspaceSettings.findOne({ id: 'default' });
        if (!settings) {
            const defaultZones = {
                A: { name: 'Cooling Zone', color: '#38bdf8', status: 'normal', x: 24, y: 24, width: 535, height: 300 },
                B: { name: 'High Heat Zone', color: '#ef4444', status: 'normal', x: 591, y: 24, width: 535, height: 300 },
                C: { name: 'Robotics Zone', color: '#8b5cf6', status: 'normal', x: 24, y: 356, width: 535, height: 300 },
                D: { name: 'Hydraulic Zone', color: '#f59e0b', status: 'normal', x: 591, y: 356, width: 535, height: 300 }
            };
            settings = await WorkspaceSettings.create({
                id: 'default',
                zones: defaultZones
            });
            console.log("[DB] Initialized default WorkspaceSettings.");
        } else {
            console.log("[DB] Verified existing WorkspaceSettings.");
        }
    } catch (err) {
        console.error("WorkspaceSettings initialization error:", err.message);
    }

    // 2. Load or create Factory, aligning its zones with settings.zones
    let factory;
    try {
        factory = await Factory.findOne({ id: 'default' });
        
        const activeZoneNames = settings && settings.zones ? Object.values(settings.zones).map(z => z.name) : [];
        
        if (!factory) {
            // Create with active zones from settings
            const factoryZones = settings && settings.zones ? Object.values(settings.zones).map(z => ({
                name: z.name,
                color: z.color,
                status: 'normal',
                x: z.x,
                y: z.y,
                width: z.width,
                height: z.height,
                machines: []
            })) : [];
            factory = await Factory.create({
                id: 'default',
                name: 'Nexus Command Factory',
                description: 'Advanced Industrial Operations Digital Twin',
                zones: factoryZones
            });
            console.log("[DB] Created default factory matching active workspace zones.");
        } else if (settings && settings.zones) {
            // Align factory zones with settings zones
            let updated = false;
            
            // Remove zones from factory that are not in settings.zones
            const originalZones = [...factory.zones];
            const validZones = originalZones.filter(z => activeZoneNames.includes(z.name));
            const removedZones = originalZones.filter(z => !activeZoneNames.includes(z.name));
            
            if (removedZones.length > 0) {
                console.log(`[DB] Boot Sync: Found ${removedZones.length} extra zones. Cleaning...`);
                let fallbackZone = validZones[0] || originalZones[0];
                removedZones.forEach(ez => {
                    if (ez.machines && ez.machines.length > 0) {
                        ez.machines.forEach(m => {
                            if (fallbackZone) {
                                m.position.zone = fallbackZone.name;
                                fallbackZone.machines.push(m);
                            }
                        });
                    }
                });
                factory.zones = validZones;
                updated = true;
            }
            
            // Add any missing zones from settings.zones into factory
            for (let z of Object.values(settings.zones)) {
                if (!factory.zones.some(fz => fz.name === z.name)) {
                    factory.zones.push({
                        name: z.name,
                        color: z.color,
                        status: 'normal',
                        x: z.x,
                        y: z.y,
                        width: z.width,
                        height: z.height,
                        machines: []
                    });
                    updated = true;
                }
            }
            
            if (updated) {
                await factory.save();
                console.log("[DB] Boot Sync: Synchronized factory zones with workspace settings.");
            }
        }
    } catch (err) {
        console.error("Factory initialization error:", err.message);
    }

    let savedMachines = [];
    if (factory) {
        savedMachines = factory.zones.reduce((acc, z) => acc.concat(z.machines.map(m => m.toObject ? m.toObject() : m)), []);
    }

    if (savedMachines.length > 0) {
        simulator.initialize(savedMachines.length, savedMachines);
        simulator.start(); // Auto-start physics simulation so they don't see zeros!
    } else {
        simulator.initialize(0); // empty floor plan by default
    }

    io.on('connection', (socket) => {
        console.log(`Frontend client connected: ${socket.id}`);

        socket.on('command:shutdown', async (data) => {
            const machine = simulator.getMachine(data.machineId);
            if (machine) {
                machine.shutdown();
                try {
                    const factoryDoc = await Factory.findOne({ id: 'default' });
                    if (factoryDoc) {
                        for (let zone of factoryDoc.zones) {
                            const match = zone.machines.find(m => m.id === data.machineId);
                            if (match) {
                                match.state = machine.state;
                                break;
                            }
                        }
                        await factoryDoc.save();
                    }
                } catch(e){}
            }
            socket.emit('command:ack', { machineId: data.machineId, action: 'shutdown', status: 'executed', timestamp: new Date().toISOString() });
        });

        socket.on('command:restart', async (data) => {
            const machine = simulator.getMachine(data.machineId);
            if (machine) {
                machine.restart();
                try {
                    const factoryDoc = await Factory.findOne({ id: 'default' });
                    if (factoryDoc) {
                        for (let zone of factoryDoc.zones) {
                            const match = zone.machines.find(m => m.id === data.machineId);
                            if (match) {
                                match.state = machine.state;
                                match.degradation.wearLevel = machine.wearLevel;
                                match.failureProgression = undefined;
                                break;
                            }
                        }
                        await factoryDoc.save();
                    }
                } catch(e){}
            }
            socket.emit('command:ack', { machineId: data.machineId, action: 'restart', status: 'executed', timestamp: new Date().toISOString() });
        });

        socket.on('command:delete', async (data) => {
            const existed = simulator.machines.has(data.machineId);
            if (existed) {
                simulator.machines.delete(data.machineId);
                
                // 1. Clean up references inside other simulated machines' connection registries
                for (let m of simulator.machines.values()) {
                    if (m.connections) {
                        m.connections = m.connections.filter(c => (c.target || c) !== data.machineId);
                    }
                }

                try {
                    // 2. Clean up from Factory schema (machines and their connection lists)
                    const factoryDoc = await Factory.findOne({ id: 'default' });
                    if (factoryDoc) {
                        for (let zone of factoryDoc.zones) {
                            // Filter connections inside existing machines in factory doc
                            for (let m of zone.machines) {
                                if (m.connections) {
                                    m.connections = m.connections.filter(c => (c.target || c) !== data.machineId);
                                }
                            }
                            
                            // Find and delete the machine from its zone
                            const idx = zone.machines.findIndex(m => m.id === data.machineId);
                            if (idx !== -1) {
                                zone.machines.splice(idx, 1);
                            }
                        }
                        await factoryDoc.save();
                    }

                    // 3. Clean up from WorkspaceSettings connection map
                    const workspace = await WorkspaceSettings.findOne({ id: 'default' });
                    if (workspace && workspace.connections) {
                        // Delete connection list originating from this machine
                        delete workspace.connections[data.machineId];
                        
                        // Filter out connections targeting this machine from other lists
                        for (let [srcId, conns] of Object.entries(workspace.connections)) {
                            if (Array.isArray(conns)) {
                                workspace.connections[srcId] = conns.filter(c => (c.target || c) !== data.machineId);
                            }
                        }
                        workspace.markModified('connections');
                        await workspace.save();
                    }
                } catch(e){
                    console.error('[DB] Error cleaning connections for deleted machine:', e.message);
                }
                console.log(`[COMMAND] Machine ${data.machineId} permanently deleted and connection graph purged.`);
            }
            io.emit('command:ack', { machineId: data.machineId, action: 'delete', status: existed ? 'executed' : 'not_found', timestamp: new Date().toISOString() });
        });

        socket.on('engineer:add_machine', async (config) => {
            const added = simulator.addMachines([config]);
            for (let m of added) {
                try {
                    const tel = m.generateTelemetry(simulator.ecosystem);
                    const factoryDoc = await Factory.findOne({ id: 'default' });
                    if (factoryDoc) {
                        const zoneName = m.zone || 'Cooling Zone';
                        let zone = factoryDoc.zones.find(z => z.name === zoneName);
                        if (!zone) zone = factoryDoc.zones[0];
                        zone.machines.push({
                            id: m.id,
                            type: m.type,
                            label: m.label,
                            position: { x: m.x, y: m.y, zone: m.zone, floor: 'Ground' },
                            state: m.state,
                            physics: m.physics,
                            environment: tel.environment,
                            sensors: tel.sensors,
                            operationalMetrics: m.operationalMetrics,
                            degradation: { ...m.degradation, wearLevel: m.wearLevel },
                            connections: m.connections,
                            stateHistory: m.stateHistory
                        });
                        await factoryDoc.save();
                    }
                } catch(e) {
                    console.error('[DB] Failed to create machine doc:', e.message);
                }
            }
            io.emit('command:ack', { action: 'add_machine', count: added.length, machineId: added[0]?.id });
        });

        socket.on('engineer:ai_generate', async ({ newAssets }) => {
            const prevSize = simulator.machines.size;
            simulator.addMachines(newAssets);
            const added = Array.from(simulator.machines.values()).slice(prevSize);
            try {
                const factoryDoc = await Factory.findOne({ id: 'default' });
                if (factoryDoc) {
                    for (let m of added) {
                        const tel = m.generateTelemetry(simulator.ecosystem);
                        const zoneName = m.zone || 'Cooling Zone';
                        let zone = factoryDoc.zones.find(z => z.name === zoneName);
                        if (!zone) zone = factoryDoc.zones[0];
                        zone.machines.push({
                            id: m.id,
                            type: m.type,
                            label: m.label,
                            position: { x: m.x, y: m.y, zone: m.zone, floor: 'Ground' },
                            state: m.state,
                            physics: m.physics,
                            environment: tel.environment,
                            sensors: tel.sensors,
                            operationalMetrics: m.operationalMetrics,
                            degradation: { ...m.degradation, wearLevel: m.wearLevel },
                            connections: m.connections,
                            stateHistory: m.stateHistory
                        });
                    }
                    await factoryDoc.save();
                }
            } catch(e) {
                console.error('[DB] Failed to insert AI machines:', e.message);
            }
            io.emit('command:ack', { action: 'ai_generate' });
        });

        // Save map node positions from frontend drag-and-drop
        socket.on('map:save_layout', async ({ nodes }) => {
            if (!Array.isArray(nodes)) return;
            try {
                const factoryDoc = await Factory.findOne({ id: 'default' });
                if (factoryDoc) {
                    for (let { id, x, y } of nodes) {
                        const machine = simulator.getMachine(id);
                        if (machine) machine.updatePosition(x, y);
                        for (let zone of factoryDoc.zones) {
                            const match = zone.machines.find(m => m.id === id);
                            if (match) {
                                match.position.x = x;
                                match.position.y = y;
                                break;
                            }
                        }
                    }
                    await factoryDoc.save();
                }
            } catch(e) {}
            console.log(`[MAP] Layout saved: ${nodes.length} nodes repositioned.`);
            socket.emit('map:layout_saved', { count: nodes.length, timestamp: new Date().toISOString() });
        });

        socket.on('engineer:update_thresholds', async (data) => {
            const { machineId, customThresholds } = data;
            const machine = simulator.getMachine(machineId);
            if (machine) {
                machine.customThresholds = {
                    baseTemp: customThresholds.baseTemp,
                    basePressure: customThresholds.basePressure,
                    baseVibration: customThresholds.baseVibration,
                    warnLimit: customThresholds.warnLimit,
                    critLimit: customThresholds.critLimit
                };
                try {
                    const factoryDoc = await Factory.findOne({ id: 'default' });
                    if (factoryDoc) {
                        for (let zone of factoryDoc.zones) {
                            const match = zone.machines.find(m => m.id === machineId);
                            if (match) {
                                match.customThresholds = machine.customThresholds;
                                break;
                            }
                        }
                        await factoryDoc.save();
                    }
                } catch(e) {
                    console.error('[DB] Failed to update customThresholds:', e.message);
                }
            }
            io.emit('command:ack', { action: 'update_thresholds', machineId, status: 'executed' });
        });

        socket.on('engineer:reset_sim', async () => {
            try {
                const factoryDoc = await Factory.findOne({ id: 'default' });
                if (factoryDoc) {
                    const defaultZoneNames = ['Cooling Zone', 'High Heat Zone', 'Robotics Zone', 'Hydraulic Zone'];
                    const defaultZones = factoryDoc.zones.filter(z => defaultZoneNames.includes(z.name));
                    for (let zone of defaultZones) {
                        zone.machines = [];
                    }
                    factoryDoc.zones = defaultZones;
                    await factoryDoc.save();
                }
                const defaultZones = {
                    A: { name: 'Cooling Zone', color: '#38bdf8', status: 'normal', x: 24, y: 24, width: 535, height: 300 },
                    B: { name: 'High Heat Zone', color: '#ef4444', status: 'normal', x: 591, y: 24, width: 535, height: 300 },
                    C: { name: 'Robotics Zone', color: '#8b5cf6', status: 'normal', x: 24, y: 356, width: 535, height: 300 },
                    D: { name: 'Hydraulic Zone', color: '#f59e0b', status: 'normal', x: 591, y: 356, width: 535, height: 300 }
                };
                await WorkspaceSettings.findOneAndUpdate(
                    { id: 'default' },
                    { $set: { zones: defaultZones, connections: {} } }
                );
            } catch(e) {}
            simulator.initialize(0);
            simulator.stop();
            io.emit('command:ack', { action: 'reset' });
        });

        socket.on('engineer:start_sim', () => {
            simulator.start();
            io.emit('sim:status', { isRunning: simulator.isRunning });
        });

        socket.on('engineer:stop_sim', () => {
            simulator.stop();
            io.emit('sim:status', { isRunning: simulator.isRunning });
        });

        socket.on('mobile:sensor_data', (data) => {
            if (data.machineId && data.vibration !== undefined) {
                simulator.setMobileOverride(data.machineId, data.vibration);
            }
        });

        socket.on('engineer:update_machine_zone', async ({ machineId, zone }) => {
            const machine = simulator.getMachine(machineId);
            if (machine) {
                machine.zone = zone;
                try {
                    const factoryDoc = await Factory.findOne({ id: 'default' });
                    if (factoryDoc) {
                        let machineToMove = null;
                        for (let z of factoryDoc.zones) {
                            const idx = z.machines.findIndex(m => m.id === machineId);
                            if (idx !== -1) {
                                machineToMove = z.machines[idx];
                                z.machines.splice(idx, 1);
                                break;
                            }
                        }
                        if (machineToMove) {
                            machineToMove.position.zone = zone;
                            let targetZone = factoryDoc.zones.find(z => z.name === zone);
                            if (!targetZone) {
                                targetZone = factoryDoc.zones.find(z => z.name.startsWith(zone) || z.name.endsWith(zone));
                            }
                            if (!targetZone) targetZone = factoryDoc.zones[0];
                            targetZone.machines.push(machineToMove);
                            await factoryDoc.save();
                        }
                    }
                    console.log(`[SIMULATOR] Reassigned ${machineId} to zone ${zone}`);
                } catch(e) {
                    console.error('[DB] Failed to update machine zone:', e.message);
                }
            }
        });
    });

    let tickCount = 0;
    setInterval(async () => { 
        const telemetry = simulator.tick();
        tickCount++;
        
        let finalTelemetry = telemetry;
        let aiLive = false;
        try {
            // Inject graph connections from WorkspaceSettings
            try {
                const workspace = await WorkspaceSettings.findOne({ id: 'default' });
                if (workspace && workspace.connections) {
                    finalTelemetry = finalTelemetry.map(t => {
                        const conns = workspace.connections[t.id] || [];
                        return { ...t, connections: conns };
                    });
                }
            } catch (err) {
                console.error("[SERVER] Failed to load workspace connections:", err.message);
            }

            // Only evaluate AI if the simulator is actually generating physics/running
            if (simulator.isRunning && telemetry.length > 0) {
                const response = await axios.post('http://127.0.0.1:8000/evaluate', finalTelemetry);
                if (response.data && Array.isArray(response.data.machines)) {
                    finalTelemetry = response.data.machines;
                    const zonalInsights = response.data.zonal_insights || [];
                    io.emit('ai:zonal_insights', zonalInsights);
                } else if (response.data && Array.isArray(response.data)) {
                    finalTelemetry = response.data;
                } else {
                    console.error("[SERVER] Unexpected AI response format:", response.data);
                    finalTelemetry = telemetry.map(t => ({...t, ai_status: 'Unknown', severity_score: 0, anomaly_source: 'none', copilot: null}));
                }
                aiLive = true;
            } else {
                // If simulator is not running, we can still ping the AI model to check if it is live!
                if (telemetry.length > 0) {
                    await axios.post('http://127.0.0.1:8000/evaluate', telemetry.slice(0, 1));
                    aiLive = true;
                } else {
                    await axios.post('http://127.0.0.1:8000/evaluate', []);
                    aiLive = true;
                }
                finalTelemetry = telemetry.map(t => ({...t, ai_status: 'Normal', severity_score: 0, anomaly_source: 'none', copilot: null}));
                
                // Emit default zonal insights when offline
                const defaultZonalInsights = [
                    { zone: 'Cooling Zone', status: 'Normal', severity: 0, count: 0, message: 'All assets in cooling loop operating within safe operating limits.' },
                    { zone: 'High Heat Zone', status: 'Normal', severity: 0, count: 0, message: 'Furnace and thermodynamic assets at nominal thermal threshold.' },
                    { zone: 'Robotics Zone', status: 'Normal', severity: 0, count: 0, message: 'Robotic joints and assembly paths performing at peak synchronization.' },
                    { zone: 'Hydraulic Zone', status: 'Normal', severity: 0, count: 0, message: 'Pneumatic loops and pressure valves show 100% flow consistency.' }
                ];
                io.emit('ai:zonal_insights', defaultZonalInsights);
            }
        } catch (err) {
            aiLive = false;
            console.error(`[AI] Inference failed (tick ${tickCount}):`, err.message);
            finalTelemetry = telemetry.map(t => ({...t, ai_status: 'Unknown', severity_score: 0, anomaly_source: 'none', copilot: null}));
        }

        // ── AI Alert Generation Pipeline ──
        const alerts = [];
        for (const machine of finalTelemetry) {
            if (machine.isShutdown) continue;
            
            // High temperature alert
            if (machine.temperature > 90) {
                alerts.push({
                    id: `alert-temp-${machine.id}-${tickCount}`,
                    machineId: machine.id,
                    type: 'high_temperature',
                    severity: machine.temperature > 110 ? 'critical' : 'warning',
                    message: `${machine.label || machine.id}: Temperature ${machine.temperature.toFixed(1)}°C exceeds safe threshold`,
                    value: machine.temperature,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Abnormal readings (AI-detected anomalies)
            if (machine.ai_status === 'Critical' || machine.ai_status === 'Warning') {
                alerts.push({
                    id: `alert-ai-${machine.id}-${tickCount}`,
                    machineId: machine.id,
                    type: 'abnormal_reading',
                    severity: machine.ai_status.toLowerCase(),
                    message: machine.copilot?.smart_alarm || `${machine.label || machine.id}: ${machine.ai_status} - ${machine.anomaly_source} anomaly detected`,
                    value: machine.severity_score,
                    source: machine.anomaly_source,
                    copilot: machine.copilot,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Threshold breach detection
            if (machine.severity_score > 80) {
                alerts.push({
                    id: `alert-threshold-${machine.id}-${tickCount}`,
                    machineId: machine.id,
                    type: 'threshold_breach',
                    severity: 'critical',
                    message: `${machine.label || machine.id}: Severity score ${machine.severity_score}/100 - imminent failure risk`,
                    value: machine.severity_score,
                    timestamp: new Date().toISOString()
                });
            }

            // Disconnected sensor detection (Unknown AI status means AI layer couldn't reach)
            if (machine.ai_status === 'Unknown') {
                alerts.push({
                    id: `alert-sensor-${machine.id}-${tickCount}`,
                    machineId: machine.id,
                    type: 'disconnected_sensor',
                    severity: 'warning',
                    message: `${machine.label || machine.id}: AI analysis unavailable - sensor feed may be disconnected`,
                    timestamp: new Date().toISOString()
                });
            }
        }

        if (alerts.length > 0) {
            io.emit('ai:alerts', alerts);
            if (tickCount % 10 === 0) {
                console.log(`[AI ALERTS] Tick ${tickCount}: ${alerts.length} alerts generated (${alerts.filter(a => a.severity === 'critical').length} critical)`);
            }
        }

        io.emit('telemetry', finalTelemetry); 
        io.emit('sim:status', { isRunning: simulator.isRunning });
        io.emit('ai:status', { live: aiLive });

        // Batch save to MongoDB every 5 ticks (10 seconds) to avoid overloading
        if (tickCount % 5 === 0) {
            try {
                const dbRecords = finalTelemetry.map(t => ({
                    machineId: t.id,
                    timestamp: t.timestamp,
                    temperature: t.temperature,
                    pressure: t.pressure,
                    vibration: t.vibration,
                    ai_status: t.ai_status,
                    severity_score: t.severity_score,
                    anomaly_source: t.anomaly_source,
                    ecosystem_context: t.ecosystem_context
                }));
                await TelemetryModel.insertMany(dbRecords);
                
                // Update Machine states in background inside default Factory
                const factoryDoc = await Factory.findOne({ id: 'default' });
                if (factoryDoc) {
                    let updated = false;
                    for (let m of simulator.machines.values()) {
                        for (let zone of factoryDoc.zones) {
                            const match = zone.machines.find(doc => doc.id === m.id);
                            if (match) {
                                match.state = m.state;
                                match.degradation.wearLevel = m.wearLevel;
                                match.degradation.bearingWear = m.degradation.bearingWear;
                                match.degradation.lubricationLevel = m.degradation.lubricationLevel;
                                match.degradation.thermalStress = m.degradation.thermalStress;
                                if (m.currentValues) {
                                    for (let [sName, sVal] of Object.entries(m.currentValues)) {
                                        const sDoc = match.sensors.find(s => s.name === sName);
                                        if (sDoc) sDoc.value = sVal;
                                    }
                                }
                                updated = true;
                                break;
                            }
                        }
                    }
                    if (updated) {
                        await factoryDoc.save();
                    }
                }
            } catch (e) {
                console.error("[DB] Failed to save telemetry batch", e.message);
            }
        }
    }, 2000);

    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => { 
        console.log(`🚀 Advanced Factory Digital Twin running on port ${PORT}`); 
    });
};

boot();