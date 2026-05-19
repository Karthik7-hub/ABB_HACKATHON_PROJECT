
const MACHINE_CATEGORIES = {
  ROTATIONAL: 'rotational',
  MANUFACTURING: 'manufacturing',
  THERMAL: 'thermal',
  ELECTRICAL: 'electrical',
  FLUID: 'fluid',
  ROBOTICS: 'robotics'
};

const MACHINE_TYPES = {
  Pump: {
    category: MACHINE_CATEGORIES.ROTATIONAL,
    baseParams: { temperature: 60, pressure: 120, vibration: 2.0, rpm: 1450, flow_rate: 500 },
    physics: { heatRate: 0.05, coolingRate: 0.015, inertia: 0.8 },
    thresholds: {
      temperature: { warning: 80, critical: 95 },
      vibration: { warning: 4.5, critical: 6.5 },
      pressure: { warning: 150, critical: 180 }
    }
  },
  Motor: {
    category: MACHINE_CATEGORIES.ROTATIONAL,
    baseParams: { temperature: 70, rpm: 3600, vibration: 1.5, current: 25, torque: 150 },
    physics: { heatRate: 0.08, coolingRate: 0.02, inertia: 0.9 },
    thresholds: {
      temperature: { warning: 90, critical: 105 },
      vibration: { warning: 5.0, critical: 7.0 },
      current: { warning: 35, critical: 45 }
    }
  },
  Compressor: {
    category: MACHINE_CATEGORIES.ROTATIONAL,
    baseParams: { temperature: 75, pressure: 250, vibration: 3.0, rpm: 2800 },
    physics: { heatRate: 0.06, coolingRate: 0.02, inertia: 0.85 },
    thresholds: {
      temperature: { warning: 95, critical: 110 },
      pressure: { warning: 280, critical: 320 },
      vibration: { warning: 5.5, critical: 8.0 }
    }
  },
  Conveyor: {
    category: MACHINE_CATEGORIES.MANUFACTURING,
    baseParams: { speed: 2.5, load: 500, motor_temp: 55, belt_tension: 800 },
    physics: { heatRate: 0.03, coolingRate: 0.015, inertia: 0.95 },
    thresholds: {
      motor_temp: { warning: 75, critical: 90 },
      belt_tension: { warning: 950, critical: 1100 }
    }
  },
  Boiler: {
    category: MACHINE_CATEGORIES.THERMAL,
    baseParams: { temperature: 250, pressure: 400, fuel_flow: 50, water_level: 65 },
    physics: { heatRate: 0.1, coolingRate: 0.005, inertia: 0.98 },
    thresholds: {
      temperature: { warning: 280, critical: 310 },
      pressure: { warning: 450, critical: 500 },
      water_level: { warning: 40, critical: 20 }
    }
  },
  Valve: {
    category: MACHINE_CATEGORIES.FLUID,
    baseParams: { pressure: 100, flow_rate: 300, position: 100 },
    physics: { heatRate: 0.01, coolingRate: 0.05, inertia: 0.5 },
    thresholds: {
      pressure: { warning: 140, critical: 180 }
    }
  },
  RoboticArm: {
    category: MACHINE_CATEGORIES.ROBOTICS,
    baseParams: { joint_temp: 45, torque: 80, error_margin: 0.01, latency: 15 },
    physics: { heatRate: 0.04, coolingRate: 0.03, inertia: 0.6 },
    thresholds: {
      joint_temp: { warning: 65, critical: 80 },
      error_margin: { warning: 0.05, critical: 0.1 },
      latency: { warning: 50, critical: 100 }
    }
  },
  Reactor: {
    category: MACHINE_CATEGORIES.THERMAL,
    baseParams: { temperature: 92, pressure: 142, vibration: 1.8 },
    physics: { heatRate: 0.15, coolingRate: 0.01, inertia: 0.99 },
    thresholds: {
      temperature: { warning: 120, critical: 150 },
      pressure: { warning: 180, critical: 220 },
      vibration: { warning: 3.5, critical: 5.0 }
    }
  },
  Chiller: {
    category: MACHINE_CATEGORIES.FLUID,
    baseParams: { temperature: 28, pressure: 64, vibration: 1.6 },
    physics: { heatRate: 0.02, coolingRate: 0.1, inertia: 0.7 },
    thresholds: {
      temperature: { warning: 45, critical: 60 },
      pressure: { warning: 90, critical: 120 },
      vibration: { warning: 3.0, critical: 4.5 }
    }
  }
};

const ZONES = [
  'Cooling Zone',
  'High Heat Zone',
  'Robotics Zone',
  'Hydraulic Zone'
];

const ZONE_BOUNDS = {
  'Cooling Zone':   { xMin: 50, xMax: 480, yMin: 60, yMax: 270 },
  'High Heat Zone': { xMin: 620, xMax: 1050, yMin: 60, yMax: 270 },
  'Robotics Zone':  { xMin: 50, xMax: 480, yMin: 380, yMax: 600 },
  'Hydraulic Zone': { xMin: 620, xMax: 1050, yMin: 380, yMax: 600 }
};

function getRandomCoordsInZone(zoneName) {
  const bounds = ZONE_BOUNDS[zoneName] || ZONE_BOUNDS['Cooling Zone'];
  const x = Math.floor(Math.random() * (bounds.xMax - bounds.xMin + 1)) + bounds.xMin;
  const y = Math.floor(Math.random() * (bounds.yMax - bounds.yMin + 1)) + bounds.yMin;
  return { x, y };
}

class MachineInstance {
  /**
   * @param {string} id
   * @param {string} type
   * @param {string} zone
   * @param {number} x
   * @param {number} y
   * @param {object} overrides - Optional initial sensor/physics overrides from the Add Machine form
   */
  constructor(id, type, zone, x, y, overrides = {}) {
    this.id = id;
    this.type = type;
    this.zone = zone;
    this.x = x;
    this.y = y;
    this.label = overrides.label || `${type} ${id}`;
    this.profile = MACHINE_TYPES[type] || MACHINE_TYPES['Pump'];

    // Physics properties (can be overridden per machine)
    this.physics = {
      maxRPM: overrides.maxRPM || this.profile.baseParams.rpm || 3000,
      thermalMass: overrides.thermalMass || 100,
      heatDissipation: overrides.heatDissipation || 0.7,
      vibrationSensitivity: overrides.vibrationSensitivity || 0.5,
      powerCapacity: overrides.powerCapacity || 500,
      ...this.profile.physics
    };

    // Topology connections for causal graph
    this.connections = overrides.connections || [];

    // States
    this.state = 'OFFLINE'; 
    this.wearLevel = 0.0;
    this.degradation = { bearingWear: 0, lubricationLevel: 1.0, thermalStress: 0 };
    this.activeAnomaly = null;
    this.mobileOverride = null; // { vibration: number, expiresAt: number }
    this.stateHistory = [];
    this.initialConfig = JSON.parse(JSON.stringify(overrides));
    this.noiseOffset = Math.random() * 100; // Initialize noise offset to prevent NaN noise propagation
    this.operationalMetrics = {
      uptimeHours: 0,
      efficiency: 1.0,
      loadFactor: overrides.loadFactor || 0.75,
      energyConsumption: 0
    };

    // Accept sensor value overrides from the Add Machine form
    this.currentValues = { ...this.profile.baseParams };
    if (overrides.sensors) {
      Object.assign(this.currentValues, overrides.sensors);
    }
    // Initialize cold start temps
    for (let key in this.currentValues) {
      if (key.includes('temp')) this.currentValues[key] = overrides.sensors?.[key] || 25;
      else if (!overrides.sensors?.[key]) this.currentValues[key] = 0;
    }

    // Initialize custom operating thresholds / alerts
    this.customThresholds = overrides.customThresholds || {
      baseTemp: overrides.customThresholds?.baseTemp || this.profile.baseParams.temperature || 60,
      basePressure: overrides.customThresholds?.basePressure || this.profile.baseParams.pressure || 120,
      baseVibration: overrides.customThresholds?.baseVibration || this.profile.baseParams.vibration || 2.0,
      warnLimit: overrides.customThresholds?.warnLimit || 45,
      critLimit: overrides.customThresholds?.critLimit || 70
    };

    // Auto-start after random delay
    setTimeout(() => { this._transitionState('STARTING'); }, Math.random() * 5000 + 1000);
  }

  _transitionState(newState, reason = '') {
    if (this.state === newState) return;
    this.stateHistory.push({ from: this.state, to: newState, reason, timestamp: new Date() });
    if (this.stateHistory.length > 50) this.stateHistory.shift(); // cap history
    this.state = newState;
  }

  getNoise() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  getPerlinLikeNoise() {
    this.noiseOffset += 0.05;
    return Math.sin(this.noiseOffset) * 0.5 + Math.sin(this.noiseOffset * 0.5) * 0.25 + Math.sin(this.noiseOffset * 2) * 0.25;
  }

  update(ecosystem) {
    // Resolve zone safely — a machine may have been restored from DB with a zone
    // that doesn't exist in ecosystem.zones (e.g. custom name or typo). Fall back gracefully.
    if (!ecosystem.zones[this.zone]) {
      const fallback = Object.keys(ecosystem.zones)[0];
      console.warn(`[SIMULATOR] Zone "${this.zone}" not found for ${this.id}. Using "${fallback}".`);
      this.zone = fallback;
    }
    const zoneData = ecosystem.zones[this.zone];

    // Ensure all target/profile base parameters exist and are valid numbers
    for (let key in this.profile.baseParams) {
        if (this.currentValues[key] === undefined || this.currentValues[key] === null || isNaN(this.currentValues[key])) {
            this.currentValues[key] = this.profile.baseParams[key] || 0;
        }
    }
    // Sanitize any other existing values
    for (let key in this.currentValues) {
        if (this.currentValues[key] === null || this.currentValues[key] === undefined || isNaN(this.currentValues[key])) {
            this.currentValues[key] = 0;
        }
    }

    if (this.state === 'MAINTENANCE') {
      this.wearLevel = 0;
      this.activeAnomaly = null;
      for (let key in this.currentValues) {
        if (key.includes('temp')) this.currentValues[key] = zoneData.temperature;
        else this.currentValues[key] = 0;
      }
      return this.generateTelemetry(ecosystem);
    }

    if (this.state === 'OFFLINE' || this.state === 'EMERGENCY_SHUTDOWN') {
      for (let key in this.currentValues) {
        this.currentValues[key] = 0;
      }
      return this.generateTelemetry(ecosystem);
    }

    const target = this.profile.baseParams;
    let loadFactor = 1.0;

    // Environmental / Ecosystem modifiers
    const ambientTemp = zoneData.temperature;
    const floorVibration = zoneData.vibration;
    
    // Grid effects
    const powerStability = ecosystem.networks.power.stability;
    const coolantTemp = ecosystem.networks.cooling.coolantTemperature;
    const productionFlow = ecosystem.networks.production.flowRate;

    if (this.state === 'STARTING') {
      let ready = true;
      for (let key in target) {
        if (key.includes('temp')) continue; 
        const diff = target[key] - this.currentValues[key];
        this.currentValues[key] += diff * (1 - this.profile.physics.inertia) * 0.2;
        if (Math.abs(diff) > target[key] * 0.1) ready = false;
      }
      if (ready) this._transitionState('RUNNING', 'Startup complete');
      loadFactor = 0.5; 
    } 

    if (this.state === 'RUNNING' || this.state === 'DEGRADED' || this.state === 'FAILING') {
      // Progressive wear increases with temperature and vibration
      const wearRate = (this.state === 'RUNNING' ? 0.0001 : (this.state === 'DEGRADED' ? 0.0005 : 0.002)) * (1 + (this.currentValues.temperature || 25) / 100);
      this.wearLevel += wearRate;

      // Update degradation sub-fields
      this.degradation.bearingWear = Math.min(1, this.wearLevel * 0.8);
      this.degradation.lubricationLevel = Math.max(0, 1 - this.wearLevel * 0.6);
      this.degradation.thermalStress = Math.min(1, (this.currentValues.temperature || 25) / 150);

      // Update operational metrics
      this.operationalMetrics.uptimeHours += (2 / 3600); // 2s tick in hours
      this.operationalMetrics.efficiency = Math.max(0.3, 1 - this.wearLevel * 0.5);
      this.operationalMetrics.energyConsumption += this.operationalMetrics.loadFactor * 0.5;

      if (this.wearLevel > 0.6 && this.state === 'RUNNING') this._transitionState('DEGRADED', `Wear level reached ${(this.wearLevel*100).toFixed(0)}%`);
      if (this.wearLevel > 0.9 && this.state === 'DEGRADED') this._transitionState('FAILING', 'Critical degradation');
      if (this.wearLevel > 1.0) {
        this._transitionState('EMERGENCY_SHUTDOWN', 'Wear limit exceeded');
        console.log(`[SIMULATOR] ${this.id} reached critical failure. Emergency shutdown.`);
      }

      // Random failure injection (interactive demo frequency)
      if (!this.activeAnomaly && Math.random() < 0.02) {
        const anomalies = ['bearing_wear', 'lubrication_loss', 'overheating', 'misalignment', 'power_surge'];
        this.activeAnomaly = {
          type: anomalies[Math.floor(Math.random() * anomalies.length)],
          severity: Math.random() * 0.5 + 0.1
        };
      }
      if (this.activeAnomaly) {
        this.activeAnomaly.severity = Math.min(1.0, this.activeAnomaly.severity + 0.001); 
      }

      // Physics dynamics
      for (let key in target) {
        if (this.currentValues[key] === undefined || this.currentValues[key] === null || isNaN(this.currentValues[key])) {
            this.currentValues[key] = target[key] || 0;
        }
        let baseTarget = target[key];

        // Override target baseline with customThresholds if available
        if (this.customThresholds) {
          if (key.includes('temp') && this.customThresholds.baseTemp !== undefined) {
            baseTarget = this.customThresholds.baseTemp;
          } else if (key === 'pressure' && this.customThresholds.basePressure !== undefined) {
            baseTarget = this.customThresholds.basePressure;
          } else if (key === 'vibration' && this.customThresholds.baseVibration !== undefined) {
            baseTarget = this.customThresholds.baseVibration;
          }
        }
        
        // Correlated variables & anomalies
        if (key.includes('temp')) {
          baseTarget += this.wearLevel * 20; 
          baseTarget += (ambientTemp - 25) * 0.5; // ambient heat influences target
          baseTarget += (coolantTemp - 25) * 0.8; // coolant temp influences heavily
          
          if (this.activeAnomaly && (this.activeAnomaly.type === 'overheating' || this.activeAnomaly.type === 'lubrication_loss')) {
            baseTarget += 40 * this.activeAnomaly.severity;
          }
          if (this.activeAnomaly && this.activeAnomaly.type === 'bearing_wear') {
            baseTarget += 15 * this.activeAnomaly.severity;
          }
          
          // Emit heat to environment
          const heatOutput = (this.currentValues[key] - ambientTemp) * 0.01;
          if (heatOutput > 0) ecosystem.zones[this.zone].temperature += heatOutput;

          const heatDiff = baseTarget * loadFactor - this.currentValues[key];
          if (heatDiff > 0) this.currentValues[key] += heatDiff * this.profile.physics.heatRate;
          else this.currentValues[key] += heatDiff * this.profile.physics.coolingRate;

        } else if (key === 'vibration' || key === 'error_margin') {
          baseTarget += this.wearLevel * (key === 'vibration' ? 3 : 0.05);
          baseTarget += floorVibration * 0.5; // inherent vibration coupling
          
          if (this.activeAnomaly && (this.activeAnomaly.type === 'bearing_wear' || this.activeAnomaly.type === 'misalignment')) {
            baseTarget += (key === 'vibration' ? 5 : 0.08) * this.activeAnomaly.severity;
          }
          if (powerStability < 0.8) {
            baseTarget += (1 - powerStability) * 2; // jitter due to bad power
          }
          
          this.currentValues[key] = this.currentValues[key] * this.profile.physics.inertia + baseTarget * (1 - this.profile.physics.inertia);
          
          // Emit vibration to environment
          ecosystem.zones[this.zone].vibration += (this.currentValues[key] * 0.05);

        } else if (key === 'speed' || key === 'rpm') {
           // Conveyors and Motors depend on power and flow
           if (this.type === 'Conveyor' || this.type === 'RoboticArm') {
               baseTarget *= productionFlow;
           }
           baseTarget *= powerStability;
           if (this.activeAnomaly && this.activeAnomaly.type === 'misalignment') baseTarget *= (1 - 0.2 * this.activeAnomaly.severity); 
           
           this.currentValues[key] = this.currentValues[key] * this.profile.physics.inertia + baseTarget * (1 - this.profile.physics.inertia);
        } else {
          // Pressure, Flow, etc.
          if (this.type === 'Valve' || this.type === 'Pump') {
              // Pressure coupling happens in ecosystem fluid network
              baseTarget += ecosystem.networks.fluid.pressureSurge;
          }
          this.currentValues[key] = this.currentValues[key] * this.profile.physics.inertia + baseTarget * (1 - this.profile.physics.inertia);
        }

        // Apply noise
        const drift = this.getPerlinLikeNoise() * baseTarget * 0.02;
        const jitter = this.getNoise() * baseTarget * 0.01;
        this.currentValues[key] += drift + jitter;
      }
    }

    return this.generateTelemetry(ecosystem);
  }

  generateTelemetry(ecosystem) {
    let mappedTemp = this.currentValues.temperature || this.currentValues.motor_temp || this.currentValues.joint_temp || 0;
    let mappedPressure = this.currentValues.pressure || this.currentValues.belt_tension || this.currentValues.torque || 0;
    let mappedVib = this.currentValues.vibration || this.currentValues.error_margin || this.currentValues.current || 0;

    if (this.mobileOverride && this.mobileOverride.expiresAt > Date.now()) {
      // Vibration Override
      if (this.mobileOverride.vibration !== undefined && this.mobileOverride.vibration !== null) {
        mappedVib = this.mobileOverride.vibration;
        if (this.currentValues.vibration !== undefined) this.currentValues.vibration = mappedVib;
        if (this.currentValues.error_margin !== undefined) this.currentValues.error_margin = mappedVib;
        if (this.currentValues.current !== undefined) this.currentValues.current = mappedVib;
      }
      // Temperature Override
      if (this.mobileOverride.temperature !== undefined && this.mobileOverride.temperature !== null) {
        mappedTemp = this.mobileOverride.temperature;
        if (this.currentValues.temperature !== undefined) this.currentValues.temperature = mappedTemp;
        if (this.currentValues.motor_temp !== undefined) this.currentValues.motor_temp = mappedTemp;
        if (this.currentValues.joint_temp !== undefined) this.currentValues.joint_temp = mappedTemp;
      }
      // Pressure Override
      if (this.mobileOverride.pressure !== undefined && this.mobileOverride.pressure !== null) {
        mappedPressure = this.mobileOverride.pressure;
        if (this.currentValues.pressure !== undefined) this.currentValues.pressure = mappedPressure;
        if (this.currentValues.belt_tension !== undefined) this.currentValues.belt_tension = mappedPressure;
        if (this.currentValues.torque !== undefined) this.currentValues.torque = mappedPressure;
      }
    } else if (this.mobileOverride && this.mobileOverride.expiresAt <= Date.now()) {
      this.mobileOverride = null;
    }

    // Build rich structured sensor array for AI reasoning
    const sensorArray = Object.entries(this.currentValues).map(([name, value]) => ({
      name,
      value: parseFloat((value || 0).toFixed(3)),
      unit: name.includes('temp') ? '°C' : name.includes('pressure') ? 'bar' : name.includes('rpm') ? 'RPM' : name.includes('current') ? 'A' : name.includes('vibration') || name.includes('error') ? 'mm/s' : 'unit',
      confidence: parseFloat((1 - this.wearLevel * 0.3).toFixed(3)),
      sensorHealth: parseFloat((this.degradation.lubricationLevel).toFixed(3)),
      status: value > (this.profile.thresholds?.[name]?.critical || Infinity) ? 'CRITICAL' :
              value > (this.profile.thresholds?.[name]?.warning || Infinity) ? 'WARNING' : 'NORMAL'
    }));

    return {
      id: this.id,
      type: this.type,
      label: this.label,
      zone: this.zone,
      timestamp: new Date().toISOString(),
      // Canonical top-level for dashboard
      temperature: mappedTemp,
      pressure: mappedPressure,
      vibration: mappedVib,
      isShutdown: (this.state === 'OFFLINE' || this.state === 'EMERGENCY_SHUTDOWN' || this.state === 'MAINTENANCE'),
      machineState: this.state,
      wearLevel: parseFloat(this.wearLevel.toFixed(4)),
      customThresholds: this.customThresholds,
      // Rich structured data
      sensors: sensorArray,
      degradation: this.degradation,
      operationalMetrics: this.operationalMetrics,
      connections: this.connections,
      position: { x: this.x, y: this.y, zone: this.zone, floor: 'Ground' },
      physics: this.physics,
      environment: {
          ambientTemperature: ecosystem.zones[this.zone]?.temperature || 25,
          humidity: 0.45,
          airflow: 1.0
      },
      // Spatial proximity coupling data — populated each tick by tick()
      proximityInfluences: this.proximityInfluences || {},
      ecosystem_context: {
          zone_temp: isNaN(ecosystem.zones[this.zone]?.temperature) ? 25 : (ecosystem.zones[this.zone]?.temperature ?? 25),
          zone_vib: isNaN(ecosystem.zones[this.zone]?.vibration) ? 0.0 : (ecosystem.zones[this.zone]?.vibration ?? 0.0),
          coolant_temp: isNaN(ecosystem.networks.cooling.coolantTemperature) ? 25 : (ecosystem.networks.cooling.coolantTemperature ?? 25),
          power_stability: isNaN(ecosystem.networks.power.stability) ? 1.0 : (ecosystem.networks.power.stability ?? 1.0),
          flow_rate: isNaN(ecosystem.networks.production.flowRate) ? 1.0 : (ecosystem.networks.production.flowRate ?? 1.0)
      }
    };
  }

  shutdown() { 
    this.state = 'EMERGENCY_SHUTDOWN'; 
    for (let key in this.currentValues) {
      this.currentValues[key] = 0;
    }
  }
  // Update spatial coordinates — called from the save-layout socket event
  updatePosition(x, y) { this.x = x; this.y = y; this.proximityInfluences = {}; }
  restart() { 
      this.state = 'RUNNING';
      this.wearLevel = 0.0;
      this.degradation = { bearingWear: 0, lubricationLevel: 1.0, thermalStress: 0 };
      this.activeAnomaly = null;
      this.mobileOverride = null;
      
      const defaults = (this.initialConfig && this.initialConfig.sensors) 
          ? { ...this.initialConfig.sensors } 
          : { ...this.profile.baseParams };
      
      this.currentValues = { ...defaults };
  }
  maintain() {
      this.state = 'MAINTENANCE';
      setTimeout(() => { this.state = 'STARTING'; }, 5000); 
  }
}

class FactorySimulator {
  constructor() {
    this.machines = new Map();
    this.isRunning = false;
    this.ecosystem = {
        zones: {},
        networks: {
            cooling: { coolantTemperature: 25, capacity: 1000 },
            power: { load: 0, stability: 1.0, capacity: 5000 },
            production: { flowRate: 1.0, demand: 1.0 },
            fluid: { pressureSurge: 0, leaks: 0 }
        }
    };
    ZONES.forEach(z => {
        this.ecosystem.zones[z] = { temperature: 25, vibration: 0.0, humidity: 45 };
    });
    
    // Introduce dynamic system-wide anomalies
    setInterval(() => this.injectEcosystemEvent(), 45000); // Check every 45s
  }

  initialize(count = 50, savedMachines = null) {
    this.machines.clear();
    
    if (savedMachines && savedMachines.length > 0) {
        // Restore from DB
        savedMachines.forEach(doc => {
            const m = new MachineInstance(
                doc.id,
                doc.type,
                doc.position?.zone || doc._doc?.position?.zone || doc.zone || doc._doc?.zone,
                doc.position?.x !== undefined ? doc.position.x : (doc._doc?.position?.x !== undefined ? doc._doc.position.x : (doc.x !== undefined ? doc.x : (doc._doc?.x || 0))),
                doc.position?.y !== undefined ? doc.position.y : (doc._doc?.position?.y !== undefined ? doc._doc.position.y : (doc.y !== undefined ? doc.y : (doc._doc?.y || 0)))
            );
            m.state = doc.state || 'OFFLINE';
            m.wearLevel = doc.degradation?.wearLevel !== undefined ? doc.degradation.wearLevel : (doc._doc?.degradation?.wearLevel !== undefined ? doc._doc.degradation.wearLevel : (doc.wearLevel !== undefined ? doc.wearLevel : (doc._doc?.wearLevel || 0.0)));
            m.activeAnomaly = doc.activeAnomaly || null;
            m.currentValues = { ...m.profile.baseParams, ...(doc.currentValues || {}) };
            if (doc.customThresholds) {
              m.customThresholds = {
                baseTemp: doc.customThresholds.baseTemp,
                basePressure: doc.customThresholds.basePressure,
                baseVibration: doc.customThresholds.baseVibration,
                warnLimit: doc.customThresholds.warnLimit,
                critLimit: doc.customThresholds.critLimit
              };
            }
            this.machines.set(doc.id, m);
        });
        console.log(`[SIMULATOR] Restored ${savedMachines.length} machines from DB.`);
        return;
    }

    // Default random init
    const types = Object.keys(MACHINE_TYPES);
    for (let i = 1; i <= count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const zone = ZONES[Math.floor(Math.random() * ZONES.length)];
      const id = `${type.toUpperCase().slice(0,3)}_${String(i).padStart(3, '0')}`;
      const coords = getRandomCoordsInZone(zone);
      this.machines.set(id, new MachineInstance(id, type, zone, coords.x, coords.y));
    }
    console.log(`[SIMULATOR] Initialized ${count} physics-based machines with Ecosystem awareness.`);
  }

   start() { 
     this.isRunning = true; 
     for (let m of this.machines.values()) {
         if (m.state === 'OFFLINE' || m.state === 'EMERGENCY_SHUTDOWN') {
             m.state = 'STARTING';
         }
     }
   }
   stop() { 
     this.isRunning = false; 
     for (let m of this.machines.values()) {
         m.state = 'EMERGENCY_SHUTDOWN';
     }
   }

  tick() {
    for (let z in this.ecosystem.zones) {
        if (isNaN(this.ecosystem.zones[z].temperature) || this.ecosystem.zones[z].temperature === null || this.ecosystem.zones[z].temperature === undefined) {
            this.ecosystem.zones[z].temperature = 25;
        }
        if (isNaN(this.ecosystem.zones[z].vibration) || this.ecosystem.zones[z].vibration === null || this.ecosystem.zones[z].vibration === undefined) {
            this.ecosystem.zones[z].vibration = 0.0;
        }
    }

    if (!this.isRunning) {
        // Just return current telemetry without updating physics
        return Array.from(this.machines.values()).map(m => m.update(this.ecosystem, true)); 
    }

    // 1. Process environment relaxation (decay back to baseline)
    for (let z in this.ecosystem.zones) {
        this.ecosystem.zones[z].temperature += (25 - this.ecosystem.zones[z].temperature) * 0.05;
        this.ecosystem.zones[z].vibration *= 0.8; // Dampen vibration fast
    }
    this.ecosystem.networks.cooling.coolantTemperature += (25 - this.ecosystem.networks.cooling.coolantTemperature) * 0.02;
    this.ecosystem.networks.power.stability += (1.0 - this.ecosystem.networks.power.stability) * 0.1;
    this.ecosystem.networks.fluid.pressureSurge *= 0.9;
    
    // Simulate production cycle
    const timeHr = new Date().getHours();
    if (timeHr >= 22 || timeHr <= 5) {
        this.ecosystem.networks.production.demand = 0.5; // Night shift
    } else {
        this.ecosystem.networks.production.demand = 1.0; // Day shift
    }
    this.ecosystem.networks.production.flowRate += (this.ecosystem.networks.production.demand - this.ecosystem.networks.production.flowRate) * 0.05;

    // 2. Accumulate network loads
    let totalPowerLoad = 0;
    let totalHeatDischarge = 0;
    let offlineCriticalChain = false;

    // 3. Update Machines & apply physics
    const telemetry = [];
    for (let machine of this.machines.values()) {
      if (machine.state === 'RUNNING' || machine.state === 'DEGRADED') {
          totalPowerLoad += (machine.currentValues.current || 10);
          totalHeatDischarge += (machine.currentValues.temperature - 25) * 0.1;
      }
      if (machine.state === 'EMERGENCY_SHUTDOWN' && (machine.type === 'Conveyor' || machine.type === 'Pump')) {
          offlineCriticalChain = true;
      }
      telemetry.push(machine.update(this.ecosystem));
    }

    // 4. Cascade calculations
    // Power Grid
    if (totalPowerLoad > this.ecosystem.networks.power.capacity) {
        this.ecosystem.networks.power.stability -= 0.05; // Brownout
    } else if (Math.random() < 0.02) {
        this.ecosystem.networks.power.stability += (Math.random() - 0.5) * 0.1; // Grid noise
    }

    // Cooling Network Degradation
    if (totalHeatDischarge > this.ecosystem.networks.cooling.capacity) {
        this.ecosystem.networks.cooling.coolantTemperature += 0.5;
    }
    
    // Conveyor / Production Dependencies
    if (offlineCriticalChain) {
        this.ecosystem.networks.production.flowRate *= 0.8; // Bottleneck
    }

    // ── Spatial Proximity Physics ─────────────────────────────────
    // Use pixel positions stored on each machine (x,y in 0-100 canvas space).
    // Proximity influence falls off with inverse-square distance.
    // A machine that is running and hot/vibrating raises nearby machines' values.
    const INFLUENCE_RADIUS = 25;    // units (0-100 canvas space)
    const HEAT_CONDUCTIVITY  = 0.004; // fraction of temp delta transferred per tick
    const VIB_CONDUCTIVITY   = 0.003;
    const machineList = Array.from(this.machines.values());

    for (let a of machineList) {
      if (a.state !== 'RUNNING' && a.state !== 'DEGRADED') continue;
      for (let b of machineList) {
        if (a.id === b.id) continue;
        if (b.state === 'OFFLINE' || b.state === 'EMERGENCY_SHUTDOWN') continue;

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        if (dist > INFLUENCE_RADIUS) continue;

        // Influence factor: 1 at touching, 0 at INFLUENCE_RADIUS
        const factor = Math.pow(1 - dist / INFLUENCE_RADIUS, 2);

        // Heat transfer: hot machine heats neighbour
        const aTempKey = Object.keys(a.currentValues).find(k => k.includes('temp') || k === 'temperature') || 'temperature';
        const bTempKey = Object.keys(b.currentValues).find(k => k.includes('temp') || k === 'temperature') || 'temperature';
        const aTemp = a.currentValues[aTempKey] || 0;
        const bTemp = b.currentValues[bTempKey] || 0;
        if (aTemp > bTemp) {
          b.currentValues[bTempKey] = bTemp + (aTemp - bTemp) * HEAT_CONDUCTIVITY * factor;
          b.degradation.thermalStress = Math.min(1, b.degradation.thermalStress + 0.0001 * factor);
        }

        // Vibration propagation: high vibration agitates neighbour's bearings
        const aVib = a.currentValues.vibration || 0;
        const bVibKey = 'vibration';
        if (b.currentValues[bVibKey] !== undefined && aVib > 1.0) {
          b.currentValues[bVibKey] = (b.currentValues[bVibKey] || 0) + aVib * VIB_CONDUCTIVITY * factor;
          b.degradation.bearingWear = Math.min(1, b.degradation.bearingWear + 0.0001 * factor * aVib);
        }

        // Attach proximity influence to telemetry payload
        if (!a.proximityInfluences) a.proximityInfluences = {};
        if (!a.proximityInfluences[b.id]) a.proximityInfluences[b.id] = { distance: 0, heatTransfer: 0, vibTransfer: 0 };
        a.proximityInfluences[b.id].distance = Math.round(dist * 10) / 10;
        a.proximityInfluences[b.id].heatTransfer = Math.round((aTemp - bTemp) * HEAT_CONDUCTIVITY * factor * 100) / 100;
        a.proximityInfluences[b.id].vibTransfer = Math.round(aVib * VIB_CONDUCTIVITY * factor * 1000) / 1000;
      }
    }

    return telemetry;
  }

  /**
   * Add one or more machines with optional full sensor/physics overrides.
   * @param {Array<string|object>} items - Either type strings or {type, zone, label, sensors, connections, ...} objects
   * @returns {MachineInstance[]} newly added instances
   */
  addMachines(items) {
    const added = [];
    items.forEach(item => {
      const type = typeof item === 'string' ? item : item.type;
      const zone = (typeof item === 'object' && item.zone) ? item.zone : ZONES[Math.floor(Math.random() * ZONES.length)];
      const id = `${type.toUpperCase().slice(0,3)}_${String(this.machines.size + 1).padStart(3, '0')}`;
      const overrides = typeof item === 'object' ? item : {};
      
      const coords = getRandomCoordsInZone(zone);
      const instance = new MachineInstance(id, type, zone, coords.x, coords.y, overrides);
      this.machines.set(id, instance);
      added.push(instance);
    });
    return added;
  }

  getMachine(id) {
    return this.machines.get(id);
  }

  setMobileOverride(machineId, data) {
    const machine = this.machines.get(machineId);
    if (machine) {
        machine.mobileOverride = {
            vibration: data.vibration !== undefined ? parseFloat(data.vibration) : undefined,
            temperature: data.temperature !== undefined ? parseFloat(data.temperature) : undefined,
            pressure: data.pressure !== undefined ? parseFloat(data.pressure) : undefined,
            expiresAt: Date.now() + 5000 // expires in 5s
        };
    }
  }

  injectEcosystemEvent() {
      const events = ['power_spike', 'cooling_failure', 'pressure_surge', 'none', 'none', 'none'];
      const ev = events[Math.floor(Math.random() * events.length)];
      
      if (ev === 'power_spike') {
          console.log('[ECOSYSTEM EVENT] Power spike detected!');
          this.ecosystem.networks.power.stability = 0.6; 
      } else if (ev === 'cooling_failure') {
          console.log('[ECOSYSTEM EVENT] Cooling tower efficiency drop!');
          this.ecosystem.networks.cooling.coolantTemperature += 15;
      } else if (ev === 'pressure_surge') {
          console.log('[ECOSYSTEM EVENT] Hydraulic pressure wave!');
          this.ecosystem.networks.fluid.pressureSurge = 80;
      }
  }
}

module.exports = { FactorySimulator, MachineInstance, MACHINE_TYPES, ZONES };
