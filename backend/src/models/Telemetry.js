const mongoose = require('mongoose');

const TelemetrySensorSchema = new mongoose.Schema({
  name: String,
  value: Number,
  unit: String,
  confidence: Number,
  status: String
}, { _id: false });

const TelemetrySchema = new mongoose.Schema({
  machineId: { type: String, required: true, index: true },
  type: String,
  zone: String,
  timestamp: { type: Date, default: Date.now, index: true },

  // Structured sensor readings
  sensors: [TelemetrySensorSchema],

  // Canonical fields for fast queries
  temperature: Number,
  pressure: Number,
  vibration: Number,

  // Machine operational state
  machineState: String,
  wearLevel: Number,
  efficiency: Number,
  loadFactor: Number,

  // Ecosystem snapshot
  ecosystem_context: {
    zone_temp: Number,
    zone_vib: Number,
    coolant_temp: Number,
    power_stability: Number,
    flow_rate: Number
  },

  // AI inference will be stored in separate collection
  // but we include a reference score for quick dashboard queries
  ai_status: String,
  severity_score: Number
});

// 30-day TTL retention on telemetry
TelemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });
// Compound index for efficient machine-time queries
TelemetrySchema.index({ machineId: 1, timestamp: -1 });

module.exports = mongoose.model('Telemetry', TelemetrySchema);
