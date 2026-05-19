import { Radar, Route, Layers } from 'lucide-react';

export const FALLBACK_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export const MACHINE_META = {
  PUMP_01: { label: 'Primary Pump', type: 'Pump', zone: 'A', criticality: 'High', cx: 25, cy: 35, shortLabel: 'PUMP 01' },
  VALVE_A: { label: 'Feed Valve', type: 'Valve', zone: 'C', criticality: 'Medium', cx: 50, cy: 60, shortLabel: 'VALVE A' },
  MOTOR_02: { label: 'Drive Motor', type: 'Motor', zone: 'B', criticality: 'High', cx: 75, cy: 38, shortLabel: 'MOTOR 02' },
  COMPRESSOR_B: { label: 'Air Compressor', type: 'Compressor', zone: 'D', criticality: 'High', cx: 62, cy: 76, shortLabel: 'COMP B' },
};

export const DEFAULT_MACHINE_ORDER = Object.keys(MACHINE_META);
export const STATUS_WEIGHT = { Critical: 4, Warning: 3, Unknown: 2, Normal: 1 };
export const STORAGE_KEY_VIRTUAL_ASSETS = 'nexusVirtualMachines';
export const STORAGE_KEY_MAP_NODE_SETTINGS = 'nexusMapNodeSettings';

export const MACHINE_TYPES = {
  Pump: { labelPrefix: 'Aux Pump', baseTemp: 63, basePressure: 118, baseVibration: 2.4, failureMode: 'Cavitation-induced seal wear', recommendation: 'Balance suction pressure, verify strainer condition, and inspect seal cooling loop.', period: 18 },
  Valve: { labelPrefix: 'Control Valve', baseTemp: 46, basePressure: 82, baseVibration: 1.1, failureMode: 'Actuator drift and stem friction', recommendation: 'Run a position sweep, inspect packing compression, and validate actuator feedback.', period: 26 },
  Motor: { labelPrefix: 'Drive Motor', baseTemp: 78, basePressure: 0.1, baseVibration: 4.7, failureMode: 'Rotor imbalance under variable load', recommendation: 'Reduce load, inspect coupling alignment, and schedule bearing vibration analysis.', period: 22 },
  Compressor: { labelPrefix: 'Compressor', baseTemp: 72, basePressure: 195, baseVibration: 3.4, failureMode: 'Surge margin instability', recommendation: 'Open recirculation path, review anti-surge controller, and check inlet filtration.', period: 20 },
  Reactor: { labelPrefix: 'Blend Reactor', baseTemp: 92, basePressure: 142, baseVibration: 1.8, failureMode: 'Thermal runaway precursor', recommendation: 'Increase jacket flow, reduce feed rate, and verify temperature sensor redundancy.', period: 32 },
  Chiller: { labelPrefix: 'Process Chiller', baseTemp: 28, basePressure: 64, baseVibration: 1.6, failureMode: 'Refrigerant loop efficiency loss', recommendation: 'Inspect condenser airflow, check refrigerant pressure, and validate pump speed.', period: 28 },
};

export const MAP_LAYOUTS = {
  ecosystem: { label: 'Ecosystem Chain', route: 'M8 50 H22 C30 50 31 24 42 24 H58 C69 24 70 50 78 50 H92 M42 24 C36 56 42 78 52 78 H70' },
  precision: { label: 'Precision Grid', route: 'M15 76 C30 56 42 65 50 52 C59 35 70 42 84 25' },
  process: { label: 'Process Flow', route: 'M12 34 C26 24 34 74 48 64 C62 54 68 30 88 46' },
  command: { label: 'Command Deck', route: 'M12 50 H34 L50 24 L66 50 H88 M50 24 V82' },
};

export const MAP_MODES = [
  { key: 'risk', label: 'Risk Command', description: 'AI severity, anomaly source, and response priority.', icon: Radar, layout: 'ecosystem' },
  { key: 'flow', label: 'Flow Route', description: 'Process movement and upstream/downstream dependencies.', icon: Route, layout: 'process' },
  { key: 'systems', label: 'System Zones', description: 'Zones, criticality, and machine families.', icon: Layers, layout: 'precision' },
];

export const ECOSYSTEM_COLUMNS = [
  { key: 'inputs', label: 'Inputs', subtitle: 'Materials / feed', x: 12, zones: ['A'] },
  { key: 'process', label: 'Process Core', subtitle: 'Pumps / reactors', x: 32, zones: ['A', 'C'] },
  { key: 'control', label: 'Control', subtitle: 'Valves / drives', x: 52, zones: ['B', 'C'] },
  { key: 'utilities', label: 'Utilities', subtitle: 'Air / cooling', x: 72, zones: ['B', 'D'] },
  { key: 'delivery', label: 'Output', subtitle: 'Distribution', x: 90, zones: ['D'] },
];

export const statusCopy = {
  Normal: 'Stable operation',
  Warning: 'Requires review',
  Critical: 'Immediate action',
  Unknown: 'AI layer offline',
};