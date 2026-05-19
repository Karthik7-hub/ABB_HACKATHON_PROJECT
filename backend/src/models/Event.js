const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  eventType: { type: String, required: true, index: true },
  sourceMachineId: String,
  affectedMachineIds: [String],
  severity: { type: String, enum: ['LOW','MEDIUM','HIGH','CRITICAL'], default: 'MEDIUM' },
  description: String,
  timestamp: { type: Date, default: Date.now, index: true },
  resolved: { type: Boolean, default: false },
  resolvedAt: Date
});

EventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Event', EventSchema);
