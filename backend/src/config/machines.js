const PHYSICAL_MACHINES = [
  { id: 'PUMP_01', type: 'pump', baseTemp: 65, basePressure: 120, baseVibration: 2.5 },
  { id: 'VALVE_A', type: 'valve', baseTemp: 45, basePressure: 80, baseVibration: 1.2 },
  { id: 'MOTOR_02', type: 'motor', baseTemp: 80, basePressure: 0, baseVibration: 5.0 },
  { id: 'COMPRESSOR_B', type: 'compressor', baseTemp: 70, basePressure: 200, baseVibration: 3.5 },
];

const MACHINE_TYPES = {
  Pump: { baseTemp: 63, basePressure: 118, baseVibration: 2.4, period: 18 },
  Valve: { baseTemp: 46, basePressure: 82, baseVibration: 1.1, period: 26 },
  Motor: { baseTemp: 78, basePressure: 0.1, baseVibration: 4.7, period: 22 },
  Compressor: { baseTemp: 72, basePressure: 195, baseVibration: 3.4, period: 20 },
  Reactor: { baseTemp: 92, basePressure: 142, baseVibration: 1.8, period: 32 },
  Chiller: { baseTemp: 28, basePressure: 64, baseVibration: 1.6, period: 28 },
};

module.exports = { PHYSICAL_MACHINES, MACHINE_TYPES };