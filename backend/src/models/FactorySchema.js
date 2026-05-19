const mongoose = require('mongoose');

const SensorSchema = new mongoose.Schema({
  name: String,
  value: Number,
  unit: String,
  noiseLevel: { type: Number, default: 0.02 },
  confidence: { type: Number, default: 1.0 },
  sensorHealth: { type: Number, default: 1.0 },
  status: { type: String, default: 'NORMAL' }
}, { _id: false });

const ConnectionSchema = new mongoose.Schema({
  targetMachineId: String,
  relation: { type: String, enum: ['POWERS','SUPPLIES_COOLANT','CONNECTED_TO','ADJACENT_TO','SHARES_TRANSFORMER','DOWNSTREAM_OF','UPSTREAM_OF','SHARES_HYDRAULIC'] }
}, { _id: false });

const StateTransitionSchema = new mongoose.Schema({
  from: String,
  to: String,
  reason: String,
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const MachineSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  label: { type: String },

  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 },
    zone: { type: String },
    floor: { type: String, default: 'Ground' }
  },

  state: { type: String, default: 'OFFLINE' },

  physics: {
    maxRPM: Number,
    thermalMass: Number,
    heatDissipation: Number,
    vibrationSensitivity: Number,
    powerCapacity: Number,
    inertia: Number
  },

  customThresholds: {
    baseTemp: Number,
    basePressure: Number,
    baseVibration: Number,
    warnLimit: Number,
    critLimit: Number
  },

  sensors: [SensorSchema],

  operationalMetrics: {
    uptimeHours: { type: Number, default: 0 },
    efficiency: { type: Number, default: 1.0 },
    loadFactor: { type: Number, default: 0.75 },
    energyConsumption: { type: Number, default: 0 }
  },

  degradation: {
    wearLevel: { type: Number, default: 0 },
    bearingWear: { type: Number, default: 0 },
    lubricationLevel: { type: Number, default: 1.0 },
    thermalStress: { type: Number, default: 0 }
  },

  failureProgression: {
    type: String,
    severity: { type: Number, default: 0 },
    startedAt: Date,
    progressionRate: { type: Number, default: 0 }
  },

  connections: [ConnectionSchema],

  stateHistory: [StateTransitionSchema],

  environment: {
    ambientTemperature: { type: Number, default: 25 },
    humidity: { type: Number, default: 0.45 },
    airflow: { type: Number, default: 1.0 }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ZoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, default: '#38bdf8' },
  status: { type: String, default: 'normal' },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  width: { type: Number, default: 535 },
  height: { type: Number, default: 300 },
  machines: [MachineSchema]
});

const FactorySchema = new mongoose.Schema({
  id: { type: String, default: 'default', unique: true },
  name: { type: String, default: 'Nexus Command Factory' },
  description: { type: String, default: 'Advanced Industrial Operations Digital Twin' },
  zones: [ZoneSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Factory', FactorySchema, 'factories');
