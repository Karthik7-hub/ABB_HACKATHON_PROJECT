const mongoose = require('mongoose');

const AIInferenceSchema = new mongoose.Schema({
  machineId: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  
  // AI-inferred analysis
  inferredCause: String,
  confidence: Number, // 0-100
  severity: { type: String, enum: ['NORMAL','WARNING','CRITICAL'] },
  
  // Causal chain across machines
  causalChain: [{
    machineId: String,
    contribution: String,
    confidence: Number
  }],
  
  // Predicted time to failure
  predictedFailureTime: Date,
  
  // Actionable recommendations
  recommendedActions: [{
    action: String,
    urgency: { type: String, enum: ['LOW','MEDIUM','HIGH','IMMEDIATE'] },
    estimatedImpact: String
  }],

  // Which sensor triggered the inference
  triggerSensors: [String]
});

AIInferenceSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30-day TTL
AIInferenceSchema.index({ machineId: 1, timestamp: -1 });

module.exports = mongoose.model('AIInference', AIInferenceSchema);
