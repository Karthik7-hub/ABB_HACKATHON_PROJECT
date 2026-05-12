const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
});

const PORT = Number(process.env.PORT || 4000);
const AI_LAYER_URL = process.env.AI_LAYER_URL || 'http://localhost:8000/evaluate';
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');

// ──────────────────────────────────────────────────────────────
// Machine Configuration & State
// ──────────────────────────────────────────────────────────────
const MACHINES = [
  { id: 'PUMP_01', type: 'pump', baseTemp: 65, basePressure: 120, baseVibration: 2.5 },
  { id: 'VALVE_A', type: 'valve', baseTemp: 45, basePressure: 80, baseVibration: 1.2 },
  { id: 'MOTOR_02', type: 'motor', baseTemp: 80, basePressure: 0, baseVibration: 5.0 },
  { id: 'COMPRESSOR_B', type: 'compressor', baseTemp: 70, basePressure: 200, baseVibration: 3.5 },
];

// Track shutdown state per machine
const shutdownState = {};
MACHINES.forEach(m => { shutdownState[m.id] = false; });

// External sensor override (from phone accelerometer)
let externalSensorData = null;

// ──────────────────────────────────────────────────────────────
// Telemetry Generation
// ──────────────────────────────────────────────────────────────
function generateTelemetry() {
  return MACHINES.map(machine => {
    // If machine is shut down, return safe baseline values
    if (shutdownState[machine.id]) {
      return {
        id: machine.id,
        timestamp: new Date().toISOString(),
        temperature: machine.baseTemp * 0.5,   // cooling down
        pressure: machine.basePressure * 0.1,   // depressurized
        vibration: 0.1,                          // minimal vibration
      };
    }

    // Check if external sensor is overriding this machine
    if (externalSensorData && externalSensorData.targetMachine === machine.id) {
      const ext = externalSensorData;
      return {
        id: machine.id,
        timestamp: new Date().toISOString(),
        temperature: machine.baseTemp + (ext.acceleration * 2),
        pressure: machine.basePressure * (1 + ext.acceleration * 0.05),
        vibration: ext.acceleration,
      };
    }

    // 8% chance of anomaly per tick
    const isAnomaly = Math.random() < 0.08;
    const multiplier = isAnomaly 
      ? (Math.random() > 0.5 ? (1.5 + Math.random() * 0.5) : (0.2 + Math.random() * 0.3)) 
      : 1;
    
    // Normal random fluctuations (+/- 5%)
    const fluctuate = (val) => val * (1 + (Math.random() * 0.1 - 0.05));

    return {
      id: machine.id,
      timestamp: new Date().toISOString(),
      temperature: fluctuate(machine.baseTemp) * multiplier,
      pressure: fluctuate(machine.basePressure) * multiplier,
      vibration: fluctuate(machine.baseVibration) * multiplier,
    };
  });
}

// ──────────────────────────────────────────────────────────────
// REST Endpoints
// ──────────────────────────────────────────────────────────────

// Phone sensor data intake
app.post('/api/sensor', (req, res) => {
  const { targetMachine, acceleration, source } = req.body;
  const accelerationValue = Number(acceleration);

  if (targetMachine && Number.isFinite(accelerationValue)) {
    externalSensorData = {
      targetMachine,
      acceleration: accelerationValue,
      source: source || 'unknown',
      receivedAt: Date.now(),
    };
    console.log(`[SENSOR] External data for ${targetMachine}: accel=${accelerationValue.toFixed(2)} source=${externalSensorData.source}`);
    res.json({ status: 'ok' });
  } else {
    res.status(400).json({ error: 'Missing targetMachine or valid acceleration' });
  }
});

app.get('/api/sensor/status', (req, res) => {
  res.json({
    active: Boolean(externalSensorData && Date.now() - externalSensorData.receivedAt <= 5000),
    data: externalSensorData,
  });
});

// Clear external sensor
app.post('/api/sensor/clear', (req, res) => {
  externalSensorData = null;
  res.json({ status: 'cleared' });
});

// ──────────────────────────────────────────────────────────────
// Telemetry Loop
// ──────────────────────────────────────────────────────────────
setInterval(async () => {
  // Auto-expire stale external sensor data (older than 5 seconds)
  if (externalSensorData && Date.now() - externalSensorData.receivedAt > 5000) {
    externalSensorData = null;
  }

  const telemetryData = generateTelemetry();
  
  try {
    const response = await axios.post(AI_LAYER_URL, telemetryData);
    const evaluatedData = response.data;
    
    // Attach shutdown state to each machine
    const enrichedData = evaluatedData.map(d => ({
      ...d,
      isShutdown: shutdownState[d.id] || false,
    }));

    io.emit('telemetry', enrichedData);
    console.log(`[${new Date().toISOString()}] Broadcasted ${enrichedData.length} evaluated records.`);
  } catch (error) {
    console.error('Error communicating with AI Layer:', error.message);
    const fallbackData = telemetryData.map(d => ({
      ...d,
      ai_status: 'Unknown',
      severity_score: 0,
      anomaly_source: 'none',
      copilot: null,
      isShutdown: shutdownState[d.id] || false,
    }));
    io.emit('telemetry', fallbackData);
  }
}, 2000);

// ──────────────────────────────────────────────────────────────
// Socket.io Connection & Commands
// ──────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Frontend client connected: ${socket.id}`);
  
  // Remote Shutdown Command from frontend
  socket.on('command:shutdown', (data) => {
    const { machineId } = data;
    if (shutdownState.hasOwnProperty(machineId)) {
      shutdownState[machineId] = true;
      console.log(`[COMMAND] Emergency shutdown initiated for ${machineId} by ${socket.id}`);
      io.emit('command:ack', { 
        machineId, 
        action: 'shutdown', 
        status: 'executed',
        timestamp: new Date().toISOString()
      });
      
    }
  });

  socket.on('command:restart', (data) => {
    const { machineId } = data;
    if (shutdownState.hasOwnProperty(machineId)) {
      shutdownState[machineId] = false;
      console.log(`[COMMAND] ${machineId} restarted by ${socket.id}`);
      io.emit('command:ack', {
        machineId,
        action: 'restart',
        status: 'executed',
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Frontend client disconnected: ${socket.id}`);
  });
});

// ──────────────────────────────────────────────────────────────
// Serve the Phone Sensor Page
// ──────────────────────────────────────────────────────────────
app.get('/sensor', (req, res) => {
  res.sendFile(path.join(__dirname, 'sensor.html'));
});

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^\/(?!api|socket\.io|sensor).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`Backend Factory Simulator running on http://localhost:${PORT}`);
  console.log(`Phone Sensor Page: http://localhost:${PORT}/sensor`);
});
