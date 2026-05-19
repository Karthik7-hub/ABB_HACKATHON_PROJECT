import { MACHINE_META, MACHINE_TYPES } from './constants';

// UPDATE THIS with your backend URL from Render (no trailing slash)
const RENDER_BACKEND_URL = 'https://abb-hackathon-project.onrender.com/';

export function resolveBackendUrl() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:4000';
  }
  return RENDER_BACKEND_URL;
}

export function toNumber(val, fallback = 0) {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

export function formatMetric(val, decimals = 1) {
  return toNumber(val).toFixed(decimals);
}

export function formatTime(timestamp) {
  if (!timestamp) return '--:--:--';
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? '--:--:--' : d.toLocaleTimeString([], { hour12: false });
}

export function getMeta(id, registry, telemetryMachine = null) {
  if (registry[id]) return registry[id];
  if (telemetryMachine) {
    return { label: `${telemetryMachine.type} Unit`, type: telemetryMachine.type, zone: telemetryMachine.zone || 'A', criticality: 'Medium' };
  }
  return { label: 'Unknown Asset', type: 'Pump', zone: 'A', criticality: 'Medium' };
}

export function getStatusTone(machine) {
  if (machine?.isShutdown) return 'offline';
  if (machine?.ai_status === 'Critical') return 'critical';
  if (machine?.ai_status === 'Warning') return 'warning';
  return 'normal';
}

export function appendTelemetryHistory(historyObj, incomingData) {
  const next = { ...historyObj };
  const arr = Array.isArray(incomingData) ? incomingData : [incomingData];
  arr.forEach((m) => {
    if (!next[m.id]) next[m.id] = [];
    next[m.id] = [...next[m.id], {
      time: new Date(m.timestamp).getTime(),
      temp: toNumber(m.temperature),
      pressure: toNumber(m.pressure),
      vibration: toNumber(m.vibration)
    }].slice(-60); 
  });
  return next;
}

export function buildSystemAnalysis(machine, meta) { return { recommendation: "Inspect unit." }; }

export function buildCopilotNarrative(machine, meta) {
  if (!machine || machine.ai_status === 'Normal') return null;

  const signal = machine.anomaly_source || 'unknown';
  let problem, reason, fix;

  if (signal === 'vibration') {
    problem = `High rotor vibration detected (${formatMetric(machine.vibration, 2)} mm/s).`;
    reason = "Possible bearing degradation, rotor imbalance, or structural misalignment.";
    fix = "Perform vibration analysis, inspect bearings, and check mounting alignments.";
  } else if (signal === 'temperature') {
    problem = `Elevated internal temperature (${formatMetric(machine.temperature, 1)} °C).`;
    reason = "Cooling system inefficiency, excess friction, or overload conditions.";
    fix = "Check cooling fluid levels, inspect for blockages, and verify load limits.";
  } else if (signal === 'pressure') {
    problem = `Abnormal internal pressure (${formatMetric(machine.pressure, 1)} bar).`;
    reason = "Valve blockage, seal leakage, or fluid flow disruption.";
    fix = "Inspect seals for leaks, verify valve operation, and check line pressure.";
  } else {
    problem = "Unidentified anomaly.";
    reason = "System drifting outside standard operating bounds.";
    fix = "Conduct standard diagnostic protocol.";
  }

  return { headline: `${meta.type} Critical Analysis`, problem, reason, fix };
}

export function createVirtualMachine(index, type) {
  const id = `SIM_${type.substring(0, 3).toUpperCase()}_0${index + 1}`;
  return { id, type, zone: ['A', 'B', 'C', 'D'][index % 4], synthetic: true };
}

const machineLifecycles = {};
const machineThresholds = {}; 
const activeVirtualWarnings = new Set();

export function resetVirtualMachineState(id) {
  delete machineLifecycles[id];
  delete machineThresholds[id];
  activeVirtualWarnings.delete(id);
}

export function generateVirtualTelemetry(asset) {
  const now = Date.now();
  if (!machineLifecycles[asset.id] || !machineThresholds[asset.id]) { 
    machineLifecycles[asset.id] = now; 
    machineThresholds[asset.id] = {
      warningStart: 20 + Math.random() * 80, 
      rampDuration: 15 + Math.random() * 15   
    };
  }

  const thresholds = machineThresholds[asset.id];
  const runTimeSec = Math.max(0, (now - machineLifecycles[asset.id]) / 1000);
  
  // FAILURE CAP: Max 1 virtual machine can fail at once
  if (runTimeSec > thresholds.warningStart && !activeVirtualWarnings.has(asset.id)) {
      if (activeVirtualWarnings.size >= 1) {
          thresholds.warningStart += 20; 
      } else {
          activeVirtualWarnings.add(asset.id);
      }
  }

  const meta = getMeta(asset.id, { ...MACHINE_META, [asset.id]: asset });
  const type = meta.type || 'Pump';
  const profile = MACHINE_TYPES[type] || { baseTemp: 50, basePressure: 100, baseVibration: 2.0 };
  const basePressure = profile.basePressure === 0 ? 45 : profile.basePressure;

  let status = 'Normal';
  let score = Math.round(5 + Math.random() * 5);
  let degradationOffset = 0;
  let noiseMultiplier = 1;

  if (runTimeSec <= thresholds.warningStart) {
    status = 'Normal';
    degradationOffset = 0;
    noiseMultiplier = 1;
    activeVirtualWarnings.delete(asset.id);
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
  const finalPressure = basePressure + (basePressure * 0.25 * degradationOffset) + pressureNoise;
  const finalVib = profile.baseVibration + (profile.baseVibration * 0.80 * degradationOffset) + vibNoise;

  let anomaly_source = 'none';
  if (status !== 'Normal') {
      if (type === 'Compressor' || type === 'Motor') anomaly_source = 'vibration';
      else if (type === 'Pump') anomaly_source = 'temperature';
      else anomaly_source = 'pressure';
  }

  return { id: asset.id, timestamp: new Date().toISOString(), temperature: finalTemp, pressure: finalPressure, vibration: finalVib, ai_status: status, severity_score: score, anomaly_source, synthetic: true };
}

const STATUS_PRIORITY = {
  Critical: 100,
  Warning: 60,
  Normal: 20,
  Unknown: 10,
};

const CRITICALITY_WEIGHT = {
  High: 35,
  Medium: 20,
  Low: 10,
};

export function buildSmartAlarm(machine, meta) {
  const severity = Number(machine.severity_score || 0);

  const statusWeight = STATUS_PRIORITY[machine.ai_status] || 0;
  const criticalityWeight = CRITICALITY_WEIGHT[meta.criticality] || 0;

  const anomalyBoost = machine.anomaly_detected ? 25 : 0;

  const vibrationRisk = Number(machine.vibration || 0) > 5 ? 15 : 0;
  const thermalRisk = Number(machine.temperature || 0) > 85 ? 15 : 0;

  const escalationProbability = Math.min(
    100,
    Math.round(
      severity * 0.45 +
      vibrationRisk +
      thermalRisk +
      anomalyBoost
    )
  );
  const priorityScore = Math.min(
    100,
    Math.round(
      severity * 0.5 +
      statusWeight * 0.2 +
      criticalityWeight * 0.2 +
      escalationProbability * 0.1
    )
  );

  let urgency = 'Informational';

  if (priorityScore >= 85) urgency = 'Immediate';
  else if (priorityScore >= 70) urgency = 'Escalating';
  else if (priorityScore >= 45) urgency = 'Warning';

  const estimatedFailureWindow =
    priorityScore >= 90
      ? '5-10 minutes'
      : priorityScore >= 75
      ? '10-20 minutes'
      : priorityScore >= 60
      ? '20-45 minutes'
      : 'Stable';
  const rootCause =
    machine.copilot?.failure_mode ||
    machine.anomaly_source ||
    'Unknown anomaly source';

  return {
    ...machine,
    priorityScore,
    escalationProbability,
    urgency,
    estimatedFailureWindow,
    rootCause,
    aiConfidence: Math.min(99, escalationProbability + 5),
  };
}