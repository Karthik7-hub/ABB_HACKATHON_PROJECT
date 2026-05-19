const { PHYSICAL_MACHINES, MACHINE_TYPES } = require('../config/machines');

class SimulatorService {
  constructor() {
    this.virtualMachines = [];
    this.shutdownState = {};
    this.activeAnomalies = {};

    PHYSICAL_MACHINES.forEach(m => {
      this.shutdownState[m.id] = false;
    });
  }

  setSensorData(data) { this.externalSensorData = data; }
  getSensorData() { return this.externalSensorData; }

  toggleShutdown(id, state) {
    this.shutdownState[id] = state;
    if (state === true) {
      delete this.activeAnomalies[id]; // The Engineer's repair trigger
    }
  }

  getVirtualMachines() { return this.virtualMachines; }

  addVirtualMachine(type, zone) {
    const serial = String(this.virtualMachines.length + 1).padStart(2, '0');
    const id = `SIM_${type.toUpperCase().slice(0, 3)}_${serial}`;
    this.virtualMachines.push({ id, type, zone, createdAt: Date.now(), phase: Math.random() * 6, drift: Math.random(), riskBias: Math.random() });
    return this.virtualMachines;
  }

  removeVirtualMachine(id) {
    this.virtualMachines = this.virtualMachines.filter(m => m.id !== id);
    delete this.shutdownState[id];
    delete this.activeAnomalies[id];
    return this.virtualMachines;
  }

  resetVirtualMachines() {
    this.virtualMachines.forEach(m => {
      delete this.shutdownState[m.id];
      delete this.activeAnomalies[m.id];
    });
    this.virtualMachines = [];
    return this.virtualMachines;
  }

  generatePhysicalTelemetry() {
    const now = Date.now();
    return PHYSICAL_MACHINES.map(machine => {
      if (this.shutdownState[machine.id]) {
        return { id: machine.id, timestamp: new Date(now).toISOString(), temperature: machine.baseTemp * 0.5, pressure: machine.basePressure * 0.1, vibration: 0.1 };
      }

      if (this.externalSensorData && this.externalSensorData.targetMachine === machine.id) {
        const ext = this.externalSensorData;
        return { id: machine.id, timestamp: new Date(now).toISOString(), temperature: machine.baseTemp + (ext.acceleration * 2), pressure: machine.basePressure * (1 + ext.acceleration * 0.05), vibration: ext.acceleration };
      }

      if (!this.activeAnomalies[machine.id]) {
        const isAnomaly = Math.random() < 0.025; // 2.5% chance to break (about once every 20-30 seconds)
        if (isAnomaly) {
          this.activeAnomalies[machine.id] = {
            multiplier: Math.random() > 0.5 ? (1.3 + Math.random() * 0.2) : (0.6 + Math.random() * 0.2)
          };
        }
      }

      const multiplier = this.activeAnomalies[machine.id] ? this.activeAnomalies[machine.id].multiplier : 1;

      // THE FIX: We removed Math.random() and replaced it with a gentle, slow-rolling Sine Wave.
      // This creates beautiful graphs and prevents the AI from falsely triggering warnings!
      const timeFactor = now / 3000; // Controls the speed of the wave
      const idOffset = machine.id.length; // Staggers the waves so machines don't look identical
      const wave = Math.sin(timeFactor + idOffset) * 0.005; // 0.5% smooth fluctuation
      
      const fluctuate = (val) => val * (1 + wave);

      return {
        id: machine.id,
        timestamp: new Date(now).toISOString(),
        temperature: fluctuate(machine.baseTemp) * multiplier,
        pressure: fluctuate(machine.basePressure) * multiplier,
        vibration: fluctuate(machine.baseVibration) * multiplier,
      };
    });
  }

  generateVirtualTelemetry(now = Date.now()) {
    return this.virtualMachines.map(asset => {
      if (this.shutdownState[asset.id]) {
         return { id: asset.id, timestamp: new Date(now).toISOString(), temperature: 30, pressure: 0.1, vibration: 0.08, ai_status: 'Normal', severity_score: 2, anomaly_source: 'none', isShutdown: true, synthetic: true, copilot: null };
      }

      const profile = MACHINE_TYPES[asset.type] || MACHINE_TYPES.Pump;
      const age = Math.max((now - asset.createdAt) / 1000, 0);
      const wave = Math.sin(age / profile.period + asset.phase);
      const riskPulse = Math.max(0, Math.sin(age / 31 + asset.phase * 2.4) - 0.72) * asset.riskBias;

      const temperature = profile.baseTemp * (1 + wave * 0.02 + riskPulse * 0.34);
      const pressure = Math.max(0.1, profile.basePressure * (1 + wave * 0.01 + riskPulse * 0.28));
      const vibration = Math.max(0.05, profile.baseVibration * (1 + wave * 0.04 + riskPulse * 0.95));

      const maxDev = Math.max(Math.abs(temperature - profile.baseTemp) / profile.baseTemp, Math.abs(vibration - profile.baseVibration) / profile.baseVibration);
      const severityScore = Math.max(4, Math.min(96, Math.round(maxDev * 175 + riskPulse * 52 + asset.drift * 8)));
      const aiStatus = severityScore > 72 ? 'Critical' : severityScore > 42 ? 'Warning' : 'Normal';

      return {
        id: asset.id, timestamp: new Date(now).toISOString(), temperature, pressure, vibration,
        ai_status: aiStatus, severity_score: severityScore,
        anomaly_source: aiStatus === 'Normal' ? 'none' : (maxDev === Math.abs(temperature - profile.baseTemp) / profile.baseTemp ? 'temperature' : 'vibration'),
        isShutdown: false, synthetic: true,
        copilot: aiStatus === 'Normal' ? null : { probability: Math.min(94, Math.max(58, Math.round(54 + severityScore * 0.42))), failure_mode: 'Simulated wear', recommendation: 'Engineer virtual inspection required.' }
      };
    });
  }
}

module.exports = new SimulatorService();