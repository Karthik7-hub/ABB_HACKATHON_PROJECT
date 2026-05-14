const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
// Open to everyone - no safety/CORS restrictions
app.use(cors({ origin: "*" }));

const server = http.createServer(app);
const io = new Server(server, { 
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    } 
});

const machineLifecycles = {};
const machineThresholds = {}; 
const shutdowns = new Set(); 
const activeWarnings = new Set(); 

const SERVER_MACHINES = [
  { id: 'PUMP_01', type: 'Pump', baseTemp: 40, basePressure: 120, baseVibration: 1.5 },
  { id: 'VALVE_A', type: 'Valve', baseTemp: 60, basePressure: 80, baseVibration: 0.8 },
  { id: 'COMPRESSOR_B', type: 'Compressor', baseTemp: 45, basePressure: 150, baseVibration: 3.2 },
  { id: 'MOTOR_02', type: 'Motor', baseTemp: 55, basePressure: 45, baseVibration: 2.5 }
];

function generateRealisticTelemetry() {
  const now = Date.now();

  return SERVER_MACHINES.map(profile => {
    if (shutdowns.has(profile.id)) {
      activeWarnings.delete(profile.id);
      return {
        id: profile.id, timestamp: new Date(now).toISOString(),
        temperature: profile.baseTemp * 0.48, pressure: Math.max(0.1, profile.basePressure * 0.08), vibration: 0.08,
        ai_status: 'Normal', severity_score: 2, anomaly_source: 'none', synthetic: false, isShutdown: true
      };
    }

    if (!machineLifecycles[profile.id] || !machineThresholds[profile.id]) { 
        machineLifecycles[profile.id] = now; 
        machineThresholds[profile.id] = {
            warningStart: 20 + Math.random() * 80, 
            rampDuration: 15 + Math.random() * 15   
        };
    }

    const thresholds = machineThresholds[profile.id];
    const runTimeSec = Math.max(0, (now - machineLifecycles[profile.id]) / 1000);

    // FAILURE CAP: Max 2 backend machines can fail at once
    if (runTimeSec > thresholds.warningStart && !activeWarnings.has(profile.id)) {
      if (activeWarnings.size >= 2) {
        thresholds.warningStart += 20; 
      } else {
        activeWarnings.add(profile.id);
      }
    }

    let status = 'Normal';
    let score = Math.round(5 + Math.random() * 5);
    let degradationOffset = 0;
    let noiseMultiplier = 1;

    if (runTimeSec <= thresholds.warningStart) {
      status = 'Normal';
      degradationOffset = 0;
      noiseMultiplier = 1;
      activeWarnings.delete(profile.id);
    } else if (runTimeSec <= thresholds.warningStart + thresholds.rampDuration) {
      status = 'Warning';
      score = Math.round(40 + (Math.random() * 10));
      degradationOffset = (runTimeSec - thresholds.warningStart) / thresholds.rampDuration; 
      noiseMultiplier = 1.5;
    } else {
      status = 'Warning';
      score = Math.round(65 + (Math.random() * 10));
      degradationOffset = 1; 
      noiseMultiplier = 2.5; 
    }

    const timeDrift = Math.sin(now / 2000) * 0.5;
    const tempNoise = timeDrift + ((Math.random() - 0.5) * 1.5 * noiseMultiplier);
    const pressureNoise = timeDrift + ((Math.random() - 0.5) * 3.0 * noiseMultiplier);
    const vibNoise = ((Math.random() - 0.5) * 0.4 * noiseMultiplier);

    const finalTemp = profile.baseTemp + (profile.baseTemp * 0.20 * degradationOffset) + tempNoise;
    const finalPressure = profile.basePressure + (profile.basePressure * 0.25 * degradationOffset) + pressureNoise;
    const finalVib = profile.baseVibration + (profile.baseVibration * 0.80 * degradationOffset) + vibNoise;

    let anomaly_source = 'none';
    if (status !== 'Normal') {
        if (profile.type === 'Compressor' || profile.type === 'Motor') anomaly_source = 'vibration';
        else if (profile.type === 'Pump') anomaly_source = 'temperature';
        else anomaly_source = 'pressure';
    }

    return {
      id: profile.id, timestamp: new Date(now).toISOString(),
      temperature: finalTemp, pressure: finalPressure, vibration: finalVib,
      ai_status: status, severity_score: score, anomaly_source, synthetic: false, isShutdown: false
    };
  });
}

io.on('connection', (socket) => {
  socket.on('command:shutdown', (data) => {
    shutdowns.add(data.machineId);
    activeWarnings.delete(data.machineId);
    socket.emit('command:ack', { machineId: data.machineId, action: 'shutdown' });
  });

  socket.on('command:restart', (data) => {
    shutdowns.delete(data.machineId);
    activeWarnings.delete(data.machineId);
    delete machineLifecycles[data.machineId]; 
    delete machineThresholds[data.machineId]; 
    socket.emit('command:ack', { machineId: data.machineId, action: 'restart' });
  });
});

setInterval(() => { io.emit('telemetry', generateRealisticTelemetry()); }, 2000);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => { console.log(`🚀 Backend Hub running on port ${PORT}`); });