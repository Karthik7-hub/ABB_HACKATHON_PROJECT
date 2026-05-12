import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Map as MapIcon,
  Grid,
  X,
  GripVertical,
  Settings,
  Power,
  Zap,
  Brain,
  AlertOctagon,
  Search,
  Filter,
  ArrowUpDown,
  Thermometer,
  Gauge,
  Radio,
  Clock3,
  Eye,
  ClipboardCheck,
  Smartphone,
  Server,
  Wifi,
  WifiOff,
  Plus,
  Layers,
  Cpu,
  CircuitBoard,
  Radar,
  Route,
  Sparkles,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './index.css';

const FALLBACK_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function resolveBackendUrl() {
  if (typeof window === 'undefined') return normalizeUrl(FALLBACK_BACKEND_URL);

  const params = new URLSearchParams(window.location.search);
  const urlFromQuery = params.get('backend');

  try {
    if (urlFromQuery) {
      window.localStorage.setItem('nexusBackendUrl', normalizeUrl(urlFromQuery));
      return normalizeUrl(urlFromQuery);
    }

    const savedUrl = window.localStorage.getItem('nexusBackendUrl');
    return normalizeUrl(savedUrl || FALLBACK_BACKEND_URL);
  } catch {
    return normalizeUrl(urlFromQuery || FALLBACK_BACKEND_URL);
  }
}

const BACKEND_URL = resolveBackendUrl();
const socket = io(BACKEND_URL);

const MACHINE_META = {
  PUMP_01: {
    label: 'Primary Pump',
    type: 'Pump',
    zone: 'A',
    criticality: 'High',
    cx: 25,
    cy: 35,
    shortLabel: 'PUMP 01',
  },
  VALVE_A: {
    label: 'Feed Valve',
    type: 'Valve',
    zone: 'C',
    criticality: 'Medium',
    cx: 50,
    cy: 60,
    shortLabel: 'VALVE A',
  },
  MOTOR_02: {
    label: 'Drive Motor',
    type: 'Motor',
    zone: 'B',
    criticality: 'High',
    cx: 75,
    cy: 38,
    shortLabel: 'MOTOR 02',
  },
  COMPRESSOR_B: {
    label: 'Air Compressor',
    type: 'Compressor',
    zone: 'D',
    criticality: 'High',
    cx: 62,
    cy: 76,
    shortLabel: 'COMP B',
  },
};

const DEFAULT_MACHINE_ORDER = Object.keys(MACHINE_META);
const STATUS_WEIGHT = { Critical: 4, Warning: 3, Unknown: 2, Normal: 1 };
const STORAGE_KEY_VIRTUAL_ASSETS = 'nexusVirtualMachines';
const STORAGE_KEY_MAP_NODE_SETTINGS = 'nexusMapNodeSettings';

const MACHINE_TYPES = {
  Pump: {
    labelPrefix: 'Aux Pump',
    baseTemp: 63,
    basePressure: 118,
    baseVibration: 2.4,
    failureMode: 'Cavitation-induced seal wear',
    recommendation: 'Balance suction pressure, verify strainer condition, and inspect seal cooling loop.',
    period: 18,
  },
  Valve: {
    labelPrefix: 'Control Valve',
    baseTemp: 46,
    basePressure: 82,
    baseVibration: 1.1,
    failureMode: 'Actuator drift and stem friction',
    recommendation: 'Run a position sweep, inspect packing compression, and validate actuator feedback.',
    period: 26,
  },
  Motor: {
    labelPrefix: 'Drive Motor',
    baseTemp: 78,
    basePressure: 0.1,
    baseVibration: 4.7,
    failureMode: 'Rotor imbalance under variable load',
    recommendation: 'Reduce load, inspect coupling alignment, and schedule bearing vibration analysis.',
    period: 22,
  },
  Compressor: {
    labelPrefix: 'Compressor',
    baseTemp: 72,
    basePressure: 195,
    baseVibration: 3.4,
    failureMode: 'Surge margin instability',
    recommendation: 'Open recirculation path, review anti-surge controller, and check inlet filtration.',
    period: 20,
  },
  Reactor: {
    labelPrefix: 'Blend Reactor',
    baseTemp: 92,
    basePressure: 142,
    baseVibration: 1.8,
    failureMode: 'Thermal runaway precursor',
    recommendation: 'Increase jacket flow, reduce feed rate, and verify temperature sensor redundancy.',
    period: 32,
  },
  Chiller: {
    labelPrefix: 'Process Chiller',
    baseTemp: 28,
    basePressure: 64,
    baseVibration: 1.6,
    failureMode: 'Refrigerant loop efficiency loss',
    recommendation: 'Inspect condenser airflow, check refrigerant pressure, and validate pump speed.',
    period: 28,
  },
};

const MAP_LAYOUTS = {
  ecosystem: {
    label: 'Ecosystem Chain',
    route: 'M8 50 H22 C30 50 31 24 42 24 H58 C69 24 70 50 78 50 H92 M42 24 C36 56 42 78 52 78 H70',
  },
  precision: {
    label: 'Precision Grid',
    route: 'M15 76 C30 56 42 65 50 52 C59 35 70 42 84 25',
  },
  process: {
    label: 'Process Flow',
    route: 'M12 34 C26 24 34 74 48 64 C62 54 68 30 88 46',
  },
  command: {
    label: 'Command Deck',
    route: 'M12 50 H34 L50 24 L66 50 H88 M50 24 V82',
  },
};

const MAP_MODES = [
  {
    key: 'risk',
    label: 'Risk Command',
    description: 'AI severity, anomaly source, and response priority.',
    icon: Radar,
    layout: 'ecosystem',
  },
  {
    key: 'flow',
    label: 'Flow Route',
    description: 'Process movement and upstream/downstream dependencies.',
    icon: Route,
    layout: 'process',
  },
  {
    key: 'systems',
    label: 'System Zones',
    description: 'Zones, criticality, and machine families.',
    icon: Layers,
    layout: 'precision',
  },
];

const ECOSYSTEM_COLUMNS = [
  { key: 'inputs', label: 'Inputs', subtitle: 'Materials / feed', x: 12, zones: ['A'] },
  { key: 'process', label: 'Process Core', subtitle: 'Pumps / reactors', x: 32, zones: ['A', 'C'] },
  { key: 'control', label: 'Control', subtitle: 'Valves / drives', x: 52, zones: ['B', 'C'] },
  { key: 'utilities', label: 'Utilities', subtitle: 'Air / cooling', x: 72, zones: ['B', 'D'] },
  { key: 'delivery', label: 'Output', subtitle: 'Distribution', x: 90, zones: ['D'] },
];

function getSavedVirtualMachines() {
  if (typeof window === 'undefined') return [];

  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY_VIRTUAL_ASSETS) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveVirtualMachines(machines) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY_VIRTUAL_ASSETS, JSON.stringify(machines));
  } catch {
    // Local storage is optional for the simulator.
  }
}

function getSavedMapNodeSettings() {
  if (typeof window === 'undefined') return {};

  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY_MAP_NODE_SETTINGS) || '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function saveMapNodeSettings(settings) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY_MAP_NODE_SETTINGS, JSON.stringify(settings));
  } catch {
    // Node layout personalization is optional.
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getZoneCoords(zone, index = 0) {
  const ranges = {
    A: { x: [16, 42], y: [20, 44] },
    B: { x: [58, 84], y: [20, 44] },
    C: { x: [16, 42], y: [62, 84] },
    D: { x: [58, 84], y: [62, 84] },
  };
  const range = ranges[zone] || ranges.A;
  const xSpan = range.x[1] - range.x[0];
  const ySpan = range.y[1] - range.y[0];
  const x = range.x[0] + ((index * 11) % xSpan);
  const y = range.y[0] + ((index * 7) % ySpan);
  return { cx: x, cy: y };
}

function createVirtualMachine(count, type = 'Pump') {
  const profile = MACHINE_TYPES[type] || MACHINE_TYPES.Pump;
  const zones = ['A', 'B', 'C', 'D'];
  const zone = zones[count % zones.length];
  const coords = getZoneCoords(zone, count + 2);
  const serial = String(count + 1).padStart(2, '0');

  return {
    id: `SIM_${type.toUpperCase().slice(0, 3)}_${serial}`,
    label: `${profile.labelPrefix} ${serial}`,
    shortLabel: `${type.slice(0, 4).toUpperCase()} ${serial}`,
    type,
    zone,
    criticality: count % 3 === 0 ? 'High' : 'Medium',
    cx: coords.cx,
    cy: coords.cy,
    createdAt: Date.now(),
    phase: Math.random() * Math.PI * 2,
    drift: 0.65 + Math.random() * 0.7,
    riskBias: 0.7 + Math.random() * 0.8,
    synthetic: true,
  };
}

function generateVirtualTelemetry(asset, now = Date.now()) {
  const profile = MACHINE_TYPES[asset.type] || MACHINE_TYPES.Pump;
  const age = Math.max((now - asset.createdAt) / 1000, 0);
  const wave = Math.sin(age / profile.period + asset.phase);
  const secondary = Math.cos(age / (profile.period * 0.55) + asset.phase * 1.7);
  const riskPulse = Math.max(0, Math.sin(age / 31 + asset.phase * 2.4) - 0.72) * asset.riskBias;
  const noise = () => (Math.random() - 0.5);

  const temperature = profile.baseTemp * (1 + wave * 0.045 + secondary * 0.018 + riskPulse * 0.34) + noise() * 1.2;
  const pressure = Math.max(0.1, profile.basePressure * (1 + secondary * 0.05 + wave * 0.018 + riskPulse * 0.28) + noise() * 2.6);
  const vibration = Math.max(0.05, profile.baseVibration * (1 + wave * 0.08 + riskPulse * 0.95) + noise() * 0.12);

  const tempDev = Math.abs(temperature - profile.baseTemp) / Math.max(profile.baseTemp, 1);
  const pressureDev = Math.abs(pressure - profile.basePressure) / Math.max(profile.basePressure, 1);
  const vibrationDev = Math.abs(vibration - profile.baseVibration) / Math.max(profile.baseVibration, 0.2);
  const maxDev = Math.max(tempDev, pressureDev, vibrationDev);
  const severityScore = Math.max(4, Math.min(96, Math.round(maxDev * 175 + riskPulse * 52 + asset.drift * 8)));
  const aiStatus = severityScore > 72 ? 'Critical' : severityScore > 42 ? 'Warning' : 'Normal';
  const anomalySource = maxDev === tempDev ? 'temperature' : maxDev === vibrationDev ? 'vibration' : 'pressure';

  return {
    id: asset.id,
    timestamp: new Date(now).toISOString(),
    temperature,
    pressure,
    vibration,
    ai_status: aiStatus,
    severity_score: severityScore,
    anomaly_source: aiStatus === 'Normal' ? 'none' : anomalySource,
    isShutdown: false,
    synthetic: true,
    copilot: aiStatus === 'Normal' ? null : {
      probability: Math.min(94, Math.max(58, Math.round(54 + severityScore * 0.42))),
      failure_mode: profile.failureMode,
      recommendation: profile.recommendation,
    },
  };
}

function appendTelemetryHistory(prev, data) {
  const next = { ...prev };

  data.forEach((machine) => {
    const existing = next[machine.id] ? [...next[machine.id]] : [];
    existing.push({
      time: formatTime(machine.timestamp),
      temp: toNumber(machine.temperature),
      pressure: toNumber(machine.pressure),
      vibration: toNumber(machine.vibration),
    });
    if (existing.length > 24) existing.shift();
    next[machine.id] = existing;
  });

  return next;
}

function buildSystemAnalysis(machine, meta) {
  if (!machine) return [];

  const source = machine.anomaly_source === 'none' ? 'model confidence' : machine.anomaly_source;
  const severity = toNumber(machine.severity_score);
  const isCritical = machine.ai_status === 'Critical';
  const isSynthetic = machine.synthetic;
  const context = meta.type === 'Valve'
    ? 'Flow control and actuator response'
    : meta.type === 'Pump'
      ? 'Hydraulic feed stability'
      : meta.type === 'Compressor'
        ? 'Utility air and surge margin'
        : meta.type === 'Motor'
          ? 'Rotating equipment health'
          : 'Process stability';

  return [
    {
      label: 'Why',
      value: `${source} deviated from the learned ${meta.type.toLowerCase()} baseline.`,
      detail: isSynthetic ? 'Generated behavior model is drifting into a risk pulse.' : 'AI layer compared the latest sample against trained normal operating bands.',
      tone: isCritical ? 'critical' : machine.ai_status === 'Warning' ? 'warning' : 'normal',
    },
    {
      label: 'Where',
      value: `Zone ${meta.zone} / ${context}`,
      detail: `Asset criticality is ${meta.criticality.toLowerCase()}, so the event is prioritized against nearby process dependencies.`,
      tone: 'neutral',
    },
    {
      label: 'Impact',
      value: severity > 70 ? 'High process interruption risk' : severity > 42 ? 'Early degradation signal' : 'Within control envelope',
      detail: `Severity ${severity}/100 is driven mostly by ${source}.`,
      tone: isCritical ? 'critical' : machine.ai_status === 'Warning' ? 'warning' : 'normal',
    },
  ];
}

function buildCopilotNarrative(machine, meta) {
  if (!machine) {
    return {
      headline: 'No machine selected',
      summary: 'Select an asset to generate a contextual diagnosis.',
      evidence: [],
      nextAction: 'Select a machine from the map or grid.',
    };
  }

  const profile = MACHINE_TYPES[meta.type] || MACHINE_TYPES.Pump;
  const severity = toNumber(machine.severity_score);
  const source = machine.anomaly_source && machine.anomaly_source !== 'none' ? machine.anomaly_source : 'baseline variance';
  const status = machine.isShutdown ? 'Offline' : machine.ai_status;
  const tempDelta = toNumber(machine.temperature) - profile.baseTemp;
  const pressureDelta = toNumber(machine.pressure) - profile.basePressure;
  const vibrationDelta = toNumber(machine.vibration) - profile.baseVibration;
  const strongest = [
    ['temperature', tempDelta, 'C'],
    ['pressure', pressureDelta, 'bar'],
    ['vibration', vibrationDelta, 'mm/s'],
  ].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  const direction = strongest[1] >= 0 ? 'above' : 'below';
  const formattedDelta = `${Math.abs(strongest[1]).toFixed(strongest[0] === 'vibration' ? 2 : 1)} ${strongest[2]}`;

  if (machine.isShutdown) {
    return {
      headline: `${meta.shortLabel} is isolated from operation`,
      summary: `Zone ${meta.zone} is holding ${meta.type.toLowerCase()} output in a safe state. Telemetry is intentionally low because the asset is shut down, not because the AI model lost signal.`,
      evidence: [
        `Temperature is ${formatMetric(machine.temperature, 1)} C during cooldown.`,
        `Pressure is ${formatMetric(machine.pressure, 1)} bar after isolation.`,
        `Vibration is ${formatMetric(machine.vibration, 2)} mm/s, consistent with an idle machine.`,
      ],
      nextAction: 'Use Engineer Controls to turn the machine back on after local checks are complete.',
    };
  }

  if (status === 'Normal') {
    return {
      headline: `${meta.shortLabel} is inside its learned operating envelope`,
      summary: `The strongest movement is ${strongest[0]}, currently ${formattedDelta} ${direction} the ${meta.type.toLowerCase()} baseline. Severity is ${severity}/100, so this is being kept as watch telemetry rather than an active fault.`,
      evidence: [
        `Zone ${meta.zone} ${meta.type.toLowerCase()} baseline remains stable.`,
        `Current risk is ${severity}/100 with ${source} as the leading signal.`,
        `${meta.criticality} criticality keeps this asset visible in the command view.`,
      ],
      nextAction: 'Keep monitoring. No shutdown recommendation is generated for this state.',
    };
  }

  const impact = status === 'Critical'
    ? 'could interrupt the connected process path if it keeps climbing'
    : 'looks like an early degradation pattern that should be checked before it becomes a trip event';

  return {
    headline: machine.copilot?.failure_mode || `${source} deviation on ${meta.shortLabel}`,
    summary: `${meta.shortLabel} in Zone ${meta.zone} is showing ${source} behavior. ${strongest[0]} is ${formattedDelta} ${direction} the expected ${meta.type.toLowerCase()} band, and severity ${severity}/100 ${impact}.`,
    evidence: [
      `${strongest[0]} is the strongest deviation in the latest sample.`,
      `The asset is ${meta.criticality.toLowerCase()} criticality within ${meta.label}.`,
      machine.synthetic ? 'This is generated by the virtual behavior model.' : 'This is from live telemetry evaluated by the AI layer.',
    ],
    nextAction: machine.copilot?.recommendation || `Inspect ${meta.label} and verify ${source} with local instrumentation.`,
  };
}

const statusCopy = {
  Normal: 'Stable operation',
  Warning: 'Requires review',
  Critical: 'Immediate action',
  Unknown: 'AI layer offline',
};

function toNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function formatMetric(value, digits = 1) {
  return toNumber(value).toFixed(digits);
}

function formatTime(timestamp, options = { hour: '2-digit', minute: '2-digit', second: '2-digit' }) {
  if (!timestamp) return '--';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString([], options);
}

function getMeta(id, registry = MACHINE_META) {
  return registry[id] || MACHINE_META[id] || {
    label: id,
    type: 'Machine',
    zone: 'Unassigned',
    criticality: 'Medium',
    shortLabel: id,
  };
}

function getStatusTone(machine) {
  if (!machine) return 'neutral';
  if (machine.isShutdown) return 'offline';
  if (machine.ai_status === 'Critical') return 'critical';
  if (machine.ai_status === 'Warning') return 'warning';
  if (machine.ai_status === 'Normal') return 'normal';
  return 'neutral';
}

function StatCard({ icon: Icon, label, value, detail, tone = 'neutral' }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-icon-wrap">
        <Icon className="stat-icon" />
      </div>
      <div>
        <p className="stat-label">{label}</p>
        <strong className="stat-value">{value}</strong>
        <span className="stat-detail">{detail}</span>
      </div>
    </div>
  );
}

function MetricTile({ label, value, unit, anomaly, icon: Icon }) {
  return (
    <div className={`metric-box ${anomaly ? 'metric-anomaly' : ''}`}>
      <div className="metric-label-row">
        {Icon && <Icon className="metric-icon" />}
        <span className="metric-label">{label}</span>
      </div>
      <div className="metric-value">
        {value}
        <span className="metric-unit">{unit}</span>
      </div>
    </div>
  );
}

function MiniTrend({ data, metric = 'temp', tone = 'normal' }) {
  const values = (data || [])
    .map((item) => toNumber(item[metric], NaN))
    .filter((value) => Number.isFinite(value))
    .slice(-14);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;

  return (
    <div className={`mini-trend tone-${tone}`} aria-label="Recent machine trend">
      <span className="mini-trend-label">Trend</span>
      <div className="trend-bars">
        {values.length === 0 ? (
          <span className="trend-placeholder">Collecting</span>
        ) : values.map((value, index) => (
          <span
            key={`${metric}-${index}-${value}`}
            className="trend-bar"
            style={{ height: `${26 + ((value - min) / range) * 68}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function SortableMachineCard({
  id,
  machine,
  role,
  isSortable,
  history,
  onInvestigate,
  getStatusIcon,
  getStatusClass,
  meta,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !isSortable,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    position: 'relative',
  };
  const isEngineer = role === 'engineer';
  const assetMeta = meta || getMeta(machine.id);
  const tone = getStatusTone(machine);
  const statusClass = getStatusClass(machine.ai_status);
  const statusText = machine.isShutdown ? 'Offline' : machine.ai_status;
  const healthHint = machine.isShutdown ? 'Cooling cycle active' : (statusCopy[machine.ai_status] || 'Monitoring');

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`machine-card tone-${tone} ${isEngineer ? 'edit-mode' : ''} ${isDragging ? 'is-dragging' : ''} ${machine.isShutdown ? 'shutdown' : ''}`}
      onClick={() => !isEngineer && onInvestigate(machine.id)}
    >
      {machine.isShutdown && (
        <div className="shutdown-overlay">
          <Power size={20} />
          <span>Offline</span>
        </div>
      )}

      <div className="card-header">
        <div className="asset-heading">
          {isEngineer && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="drag-handle"
              disabled={!isSortable}
              aria-label={`Reorder ${machine.id}`}
              title={isSortable ? 'Drag to reorder' : 'Switch sorting to layout order to drag'}
            >
              <GripVertical size={16} />
            </button>
          )}
          <div>
            <div className="asset-kicker">Zone {assetMeta.zone} / {assetMeta.type}{machine.synthetic ? ' / Simulated' : ''}</div>
            <h3 className="machine-id">{machine.id}</h3>
            <p className="machine-time">{formatTime(machine.timestamp)} / {assetMeta.label}</p>
          </div>
        </div>

        <div className={`machine-status-chip ${statusClass}`}>
          {getStatusIcon(machine.ai_status)}
          <span>{statusText}</span>
        </div>
      </div>

      <div className="machine-health-row">
        <span>{healthHint}</span>
        <strong>Severity {toNumber(machine.severity_score)}/100</strong>
      </div>

      <div className="metrics-grid">
        <MetricTile
          label="Temp"
          value={formatMetric(machine.temperature, 1)}
          unit=" C"
          icon={Thermometer}
          anomaly={machine.anomaly_source === 'temperature'}
        />
        <MetricTile
          label="Pressure"
          value={formatMetric(machine.pressure, 1)}
          unit=" bar"
          icon={Gauge}
          anomaly={machine.anomaly_source === 'pressure'}
        />
        <MetricTile
          label="Vibration"
          value={formatMetric(machine.vibration, 2)}
          unit=" mm/s"
          icon={Radio}
          anomaly={machine.anomaly_source === 'vibration'}
        />
      </div>

      <div className="card-footer">
        <MiniTrend data={history} tone={tone} />
        <button
          type="button"
          className="inspect-btn"
          onClick={(event) => {
            event.stopPropagation();
            onInvestigate(machine.id);
          }}
        >
          <Eye size={13} />
          Inspect
        </button>
      </div>

      {machine.ai_status !== 'Normal' && (
        <div className="card-severity-bar">
          <div
            className="csb-fill"
            style={{
              width: `${toNumber(machine.severity_score)}%`,
              background: machine.ai_status === 'Critical' ? 'var(--critical)' : 'var(--warning)',
            }}
          />
        </div>
      )}
    </article>
  );
}

function getMapCoords(machine, meta, index, layout) {
  if (layout !== 'ecosystem') {
    return {
      cx: toNumber(meta.cx, 18 + (index % 4) * 20),
      cy: toNumber(meta.cy, 24 + (index % 3) * 20),
    };
  }

  const typeColumn = {
    Pump: 1,
    Reactor: 1,
    Valve: 2,
    Motor: 2,
    Compressor: 3,
    Chiller: 3,
  };
  const columnIndex = typeColumn[meta.type] ?? (meta.zone === 'D' ? 4 : meta.zone === 'A' ? 0 : 2);
  const column = ECOSYSTEM_COLUMNS[columnIndex] || ECOSYSTEM_COLUMNS[2];
  const rowSeed = (index * 17 + String(machine.id).length * 5) % 42;

  return {
    cx: column.x + (((index % 2) * 3) - 1.5),
    cy: 29 + rowSeed,
  };
}

function FloorPlan({
  telemetry,
  metaRegistry,
  onNodeClick,
  mapLayout,
  setMapLayout,
  mapLayer,
  setMapLayer,
  role,
  nodeSettings = {},
  selectedNodeId,
  setSelectedNodeId,
  onNodeMove,
  onNodeSettingChange,
  onResetNode,
  onMachineCommand,
}) {
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const draggedNodeRef = useRef(null);
  const activeMode = MAP_MODES.find((mode) => mode.key === mapLayer) || MAP_MODES[0];
  const activeLayout = activeMode.layout || mapLayout || 'ecosystem';
  const layout = MAP_LAYOUTS[activeLayout] || MAP_LAYOUTS.ecosystem;
  const criticalCount = telemetry.filter((machine) => getStatusTone(machine) === 'critical').length;
  const warningCount = telemetry.filter((machine) => getStatusTone(machine) === 'warning').length;
  const simulatedCount = telemetry.filter((machine) => machine.synthetic).length;
  const activeCount = telemetry.filter((machine) => !machine.isShutdown).length;
  const selectedMachine = telemetry.find((machine) => machine.id === selectedNodeId);
  const selectedMeta = selectedMachine ? getMeta(selectedMachine.id, metaRegistry) : null;
  const selectedSettings = selectedNodeId ? (nodeSettings[selectedNodeId] || {}) : {};

  const handleModeChange = (mode) => {
    setMapLayer(mode.key);
    setMapLayout(mode.layout);
  };

  const handlePointerDown = (event, machine) => {
    if (role !== 'engineer') return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedNodeId(machine.id);
    dragRef.current = {
      id: machine.id,
      rect,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const handlePointerMove = (event) => {
    if (role !== 'engineer' || !dragRef.current) return;
    const drag = dragRef.current;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (distance < 4) return;
    drag.moved = true;
    draggedNodeRef.current = drag.id;
    const cx = clamp(((event.clientX - drag.rect.left) / drag.rect.width) * 100, 8, 92);
    const cy = clamp(((event.clientY - drag.rect.top) / drag.rect.height) * 100, 12, 88);
    onNodeMove(drag.id, {
      cx: Number(cx.toFixed(1)),
      cy: Number(cy.toFixed(1)),
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className={`floor-plan premium-map operations-map map-${activeLayout} layer-${mapLayer} ${role === 'engineer' ? 'engineer-map' : ''}`}>
      <div className="map-commandbar">
        <div>
          <p className="floor-kicker">Digital Twin / Command Map</p>
          <h3>{activeMode.label}</h3>
          <p className="floor-subtitle">{activeMode.description}</p>
        </div>
        <div className="floor-toolbar-stack">
          <div className="map-mode-row" aria-label="Map mode">
            {MAP_MODES.map((mode) => {
              const Icon = mode.icon;
              return (
              <button
                key={mode.key}
                type="button"
                className={`map-mode ${mapLayer === mode.key ? 'active' : ''}`}
                onClick={() => handleModeChange(mode)}
              >
                <Icon size={15} />
                <span>{mode.label}</span>
              </button>
              );
            })}
          </div>
        </div>
      </div>

      <div ref={stageRef} className="map-stage" role="img" aria-label={`${layout.label} plant map`}>
        <div className="map-grid-layer" />
        {activeLayout === 'ecosystem' ? (
          <div className="ecosystem-lanes" aria-hidden="true">
            {ECOSYSTEM_COLUMNS.map((column, index) => (
              <section key={column.key} className="map-lane" style={{ '--lane': index }}>
                <span className="lane-index">0{index + 1}</span>
                <strong>{column.label}</strong>
                <em>{column.subtitle}</em>
              </section>
            ))}
          </div>
        ) : (
          <div className="zone-plates" aria-hidden="true">
            {['A', 'B', 'C', 'D'].map((zone) => (
              <div key={zone} className={`zone-plate zone-${zone.toLowerCase()}`}>
                <span>Zone {zone}</span>
              </div>
            ))}
          </div>
        )}

        <div className="map-flow-network" aria-hidden="true">
          <span className="flow-line flow-primary" />
          <span className="flow-line flow-branch flow-branch-a" />
          <span className="flow-line flow-branch flow-branch-b" />
          <span className="flow-pulse pulse-one" />
          <span className="flow-pulse pulse-two" />
        </div>

        {telemetry.map((machine, index) => {
          const meta = getMeta(machine.id, metaRegistry);
          const settings = nodeSettings[machine.id] || {};
          const defaultCoords = getMapCoords(machine, meta, index, activeLayout);
          const coords = {
            cx: toNumber(settings.cx, defaultCoords.cx),
            cy: toNumber(settings.cy, defaultCoords.cy),
          };
          const tone = getStatusTone(machine);
          const severity = toNumber(machine.severity_score);
          const anomaly = machine.anomaly_source && machine.anomaly_source !== 'none'
            ? machine.anomaly_source
            : meta.criticality;
          const layerValue = mapLayer === 'flow'
            ? `${meta.type} / Zone ${meta.zone}`
            : mapLayer === 'systems'
              ? `${meta.criticality} criticality`
              : `Risk ${severity}/100`;

          return (
            <button
              key={machine.id}
              type="button"
              className={`map-node-card tone-${tone} size-${settings.size || 'medium'} accent-${settings.accent || 'auto'} ${selectedNodeId === machine.id ? 'selected' : ''} ${machine.synthetic ? 'synthetic' : ''}`}
              style={{ '--node-x': `${coords.cx}%`, '--node-y': `${coords.cy}%`, '--node-risk': severity }}
              onPointerDown={(event) => handlePointerDown(event, machine)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onClick={(event) => {
                if (draggedNodeRef.current === machine.id) {
                  event.preventDefault();
                  draggedNodeRef.current = null;
                  return;
                }
                if (role === 'engineer') {
                  setSelectedNodeId(machine.id);
                } else {
                  onNodeClick(machine.id);
                }
              }}
            >
              <span className="node-orbit" />
              <span className="node-topline">
                <span className="node-dot" />
                <span>{machine.synthetic ? 'Simulated' : meta.type}</span>
              </span>
              <strong>{meta.shortLabel}</strong>
              <span className="node-reading">
                {machine.isShutdown ? 'Offline' : `${formatMetric(machine.temperature, 0)} C / ${formatMetric(machine.pressure, 0)} bar`}
              </span>
              <span className="node-layer-value">{layerValue}</span>
              <span className="node-anomaly">{anomaly}</span>
            </button>
          );
        })}

        {role === 'engineer' && (
          <aside className="node-studio" aria-label="Engineer node settings">
            <div className="node-studio-header">
              <div>
                <p className="floor-kicker">Engineer Node Studio</p>
                <h3>{selectedMeta ? selectedMeta.shortLabel : 'Select a machine pill'}</h3>
              </div>
              <Settings size={16} />
            </div>

            {selectedMachine && selectedMeta ? (
              <>
                <div className="node-editor-grid">
                  <label>
                    Display label
                    <input
                      value={selectedMeta.shortLabel}
                      onChange={(event) => onNodeSettingChange(selectedMachine.id, { shortLabel: event.target.value })}
                    />
                  </label>
                  <label>
                    Zone
                    <select
                      value={selectedMeta.zone}
                      onChange={(event) => onNodeSettingChange(selectedMachine.id, { zone: event.target.value })}
                    >
                      {['A', 'B', 'C', 'D', 'Unassigned'].map((zone) => (
                        <option key={zone} value={zone}>{zone}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Criticality
                    <select
                      value={selectedMeta.criticality}
                      onChange={(event) => onNodeSettingChange(selectedMachine.id, { criticality: event.target.value })}
                    >
                      {['Low', 'Medium', 'High'].map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="node-setting-row">
                  <span>Size</span>
                  <div className="node-segmented">
                    {['small', 'medium', 'large'].map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={(selectedSettings.size || 'medium') === size ? 'active' : ''}
                        onClick={() => onNodeSettingChange(selectedMachine.id, { size })}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="node-setting-row">
                  <span>Accent</span>
                  <div className="color-swatch-row">
                    {['auto', 'blue', 'teal', 'amber', 'red'].map((accent) => (
                      <button
                        key={accent}
                        type="button"
                        className={`swatch accent-${accent} ${(selectedSettings.accent || 'auto') === accent ? 'active' : ''}`}
                        onClick={() => onNodeSettingChange(selectedMachine.id, { accent })}
                        aria-label={`Set ${accent} accent`}
                      />
                    ))}
                  </div>
                </div>

                <div className="node-command-grid">
                  <button type="button" className="node-command secondary" onClick={() => onNodeClick(selectedMachine.id)}>
                    <Eye size={14} />
                    Diagnose
                  </button>
                  <button type="button" className="node-command secondary" onClick={() => onResetNode(selectedMachine.id)}>
                    <RotateCcw size={14} />
                    Reset Pill
                  </button>
                  <button
                    type="button"
                    className={`node-command ${selectedMachine.isShutdown ? 'restore' : 'danger'}`}
                    onClick={() => onMachineCommand(selectedMachine.id, selectedMachine.isShutdown ? 'restart' : 'shutdown')}
                  >
                    <Power size={14} />
                    {selectedMachine.isShutdown ? 'Turn Back On' : 'Shut Down'}
                  </button>
                </div>
              </>
            ) : (
              <p className="node-studio-empty">Engineer mode lets you drag machine pills, resize them, recolor them, and control machine state from here.</p>
            )}
          </aside>
        )}
      </div>

      <div className="map-status-rail">
        <span><i className="legend-dot normal" /> Normal</span>
        <span><i className="legend-dot warning" /> Warning</span>
        <span><i className="legend-dot critical" /> Critical</span>
        <span><i className="legend-dot offline" /> Offline</span>
        <strong>{activeCount} active</strong>
        <strong>{criticalCount} critical</strong>
        <strong>{warningCount} warning</strong>
        {role === 'engineer' && <strong>{simulatedCount} simulated</strong>}
      </div>
    </div>
  );
}

function TrendChart({ title, data, dataKey, stroke, unit, domain }) {
  const values = (data || []).map((item) => toNumber(item[dataKey], NaN)).filter((value) => Number.isFinite(value));
  const latest = values.length ? values[values.length - 1] : null;
  const min = values.length ? Math.min(...values) : null;
  const max = values.length ? Math.max(...values) : null;
  const digits = dataKey === 'vibration' ? 2 : 1;

  return (
    <div className="chart-section trend-card">
      <div className="chart-title-row">
        <div>
          <h3 className="chart-title">{title}</h3>
          <span className="chart-subtitle">Last {values.length || 0} samples</span>
        </div>
        <strong className="chart-latest">
          {latest === null ? '--' : formatMetric(latest, digits)}
          <span>{unit.trim()}</span>
        </strong>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="4 8" stroke="rgba(148,163,184,0.13)" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis
              hide
              domain={domain}
            />
            <Tooltip
              formatter={(value) => [`${formatMetric(value, digits)}${unit}`, title]}
              contentStyle={{
                backgroundColor: '#07111f',
                border: '1px solid rgba(56,189,248,0.24)',
                borderRadius: '10px',
                fontSize: '12px',
                boxShadow: '0 18px 44px rgba(0,0,0,0.42)',
              }}
              labelStyle={{ color: '#cbd5e1' }}
            />
            <Line type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={2.8} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="trend-range">
        <span>Min {min === null ? '--' : formatMetric(min, digits)}</span>
        <span>Max {max === null ? '--' : formatMetric(max, digits)}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [telemetry, setTelemetry] = useState([]);
  const [virtualMachines, setVirtualMachines] = useState(() => getSavedVirtualMachines());
  const [virtualTelemetry, setVirtualTelemetry] = useState(() => getSavedVirtualMachines().map((asset) => generateVirtualTelemetry(asset)));
  const [virtualShutdowns, setVirtualShutdowns] = useState(new Set());
  const [telemetryHistory, setTelemetryHistory] = useState({});
  const [connected, setConnected] = useState(false);
  const [role, setRole] = useState('operator');
  const [viewMode, setViewMode] = useState('grid');
  const [mapLayout, setMapLayout] = useState('ecosystem');
  const [mapLayer, setMapLayer] = useState('risk');
  const [mapNodeSettings, setMapNodeSettings] = useState(() => getSavedMapNodeSettings());
  const [selectedMapNodeId, setSelectedMapNodeId] = useState(null);
  const [acknowledged, setAcknowledged] = useState(new Set());
  const [investigateId, setInvestigateId] = useState(null);
  const [machineOrder, setMachineOrder] = useState(DEFAULT_MACHINE_ORDER);
  const [commandLog, setCommandLog] = useState([]);
  const [machineQuery, setMachineQuery] = useState('');
  const [machineFilter, setMachineFilter] = useState('all');
  const [sortMode, setSortMode] = useState('layout');
  const [showAcknowledged, setShowAcknowledged] = useState(true);
  const [clock, setClock] = useState(new Date());
  const [newMachineType, setNewMachineType] = useState('Pump');

  useEffect(() => {
    document.title = 'Nexus Control System';
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    saveVirtualMachines(virtualMachines);
  }, [virtualMachines]);

  useEffect(() => {
    saveMapNodeSettings(mapNodeSettings);
  }, [mapNodeSettings]);

  useEffect(() => {
    const pushVirtualTick = () => {
      const next = virtualMachines.map((asset) => {
        const reading = generateVirtualTelemetry(asset);
        if (!virtualShutdowns.has(asset.id)) return reading;

        const profile = MACHINE_TYPES[asset.type] || MACHINE_TYPES.Pump;
        return {
          ...reading,
          temperature: profile.baseTemp * 0.48,
          pressure: Math.max(0.1, profile.basePressure * 0.08),
          vibration: 0.08,
          ai_status: 'Normal',
          severity_score: 2,
          anomaly_source: 'none',
          isShutdown: true,
          copilot: null,
        };
      });
      setVirtualTelemetry(next);
      if (next.length > 0) {
        setTelemetryHistory((prev) => appendTelemetryHistory(prev, next));
      }
    };

    pushVirtualTick();
    const interval = window.setInterval(pushVirtualTick, 2000);
    return () => window.clearInterval(interval);
  }, [virtualMachines, virtualShutdowns]);

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('telemetry', (data) => {
      setTelemetry(data);
      setTelemetryHistory((prev) => appendTelemetryHistory(prev, data));
    });

    socket.on('command:ack', (data) => {
      setCommandLog((prev) => [{ ...data, id: `${Date.now()}-${data.machineId}` }, ...prev].slice(0, 7));
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('telemetry');
      socket.off('command:ack');
    };
  }, []);

  const machineMeta = useMemo(() => {
    const simulatedMeta = virtualMachines.reduce((acc, asset) => {
      acc[asset.id] = asset;
      return acc;
    }, {});
    const baseMeta = { ...MACHINE_META, ...simulatedMeta };

    return Object.entries(mapNodeSettings).reduce((acc, [id, settings]) => {
      if (!acc[id]) return acc;
      acc[id] = {
        ...acc[id],
        ...(settings.label ? { label: settings.label } : {}),
        ...(settings.shortLabel ? { shortLabel: settings.shortLabel } : {}),
        ...(settings.zone ? { zone: settings.zone } : {}),
        ...(settings.criticality ? { criticality: settings.criticality } : {}),
        ...(Number.isFinite(Number(settings.cx)) ? { cx: Number(settings.cx) } : {}),
        ...(Number.isFinite(Number(settings.cy)) ? { cy: Number(settings.cy) } : {}),
      };
      return acc;
    }, baseMeta);
  }, [mapNodeSettings, virtualMachines]);

  const allTelemetry = useMemo(() => [...telemetry, ...virtualTelemetry], [telemetry, virtualTelemetry]);

  const machineMap = useMemo(
    () => allTelemetry.reduce((acc, machine) => {
      acc[machine.id] = machine;
      return acc;
    }, {}),
    [allTelemetry],
  );

  const orderedMachineIds = useMemo(() => {
    const telemetryIds = allTelemetry.map((machine) => machine.id);
    const ordered = machineOrder.filter((id) => telemetryIds.includes(id));
    const extras = telemetryIds.filter((id) => !machineOrder.includes(id));
    return [...ordered, ...extras];
  }, [machineOrder, allTelemetry]);

  const dashboardStats = useMemo(() => {
    const total = allTelemetry.length;
    const critical = allTelemetry.filter((machine) => machine.ai_status === 'Critical' && !machine.isShutdown).length;
    const warning = allTelemetry.filter((machine) => machine.ai_status === 'Warning' && !machine.isShutdown).length;
    const offline = allTelemetry.filter((machine) => machine.isShutdown).length;
    const active = Math.max(total - offline, 0);
    const highest = allTelemetry.reduce((top, machine) => (
      !top || toNumber(machine.severity_score) > toNumber(top.severity_score) ? machine : top
    ), null);
    const averageSeverity = total
      ? Math.round(allTelemetry.reduce((sum, machine) => sum + toNumber(machine.severity_score), 0) / total)
      : 0;
    const lastUpdated = allTelemetry.reduce((latest, machine) => {
      const next = new Date(machine.timestamp).getTime();
      return Number.isFinite(next) ? Math.max(latest, next) : latest;
    }, 0);
    const systemLabel = critical ? 'Critical' : warning ? 'Attention' : offline ? 'Cooling' : total ? 'Stable' : 'Waiting';

    return {
      total,
      active,
      critical,
      warning,
      offline,
      highest,
      averageSeverity,
      lastUpdated,
      systemLabel,
    };
  }, [allTelemetry]);

  const filteredMachineIds = useMemo(() => {
    const query = machineQuery.trim().toLowerCase();
    const filtered = orderedMachineIds.filter((id) => {
      const machine = machineMap[id];
      if (!machine) return false;
      const meta = getMeta(id, machineMeta);
      const status = machine.isShutdown ? 'offline' : String(machine.ai_status || 'unknown').toLowerCase();
      const matchesFilter = machineFilter === 'all' || machineFilter === status;
      const haystack = `${id} ${meta.label} ${meta.type} ${meta.zone} ${meta.criticality} ${machine.ai_status}`.toLowerCase();
      return matchesFilter && (!query || haystack.includes(query));
    });

    if (sortMode === 'severity') {
      filtered.sort((a, b) => toNumber(machineMap[b]?.severity_score) - toNumber(machineMap[a]?.severity_score));
    } else if (sortMode === 'status') {
      filtered.sort((a, b) => {
        const aStatus = machineMap[a]?.isShutdown ? 'Unknown' : machineMap[a]?.ai_status;
        const bStatus = machineMap[b]?.isShutdown ? 'Unknown' : machineMap[b]?.ai_status;
        return (STATUS_WEIGHT[bStatus] || 0) - (STATUS_WEIGHT[aStatus] || 0);
      });
    } else if (sortMode === 'zone') {
      filtered.sort((a, b) => String(getMeta(a, machineMeta).zone).localeCompare(String(getMeta(b, machineMeta).zone)));
    }

    return filtered;
  }, [machineFilter, machineMap, machineMeta, machineQuery, orderedMachineIds, sortMode]);

  const filteredTelemetry = useMemo(
    () => filteredMachineIds.map((id) => machineMap[id]).filter(Boolean),
    [filteredMachineIds, machineMap],
  );

  const actionableItems = useMemo(
    () => allTelemetry
      .filter((item) => (item.ai_status === 'Warning' || item.ai_status === 'Critical') && !item.isShutdown)
      .sort((a, b) => toNumber(b.severity_score) - toNumber(a.severity_score)),
    [allTelemetry],
  );

  const activeAlerts = useMemo(
    () => actionableItems.filter((item) => !acknowledged.has(item.id)),
    [acknowledged, actionableItems],
  );
  const ackAlerts = useMemo(
    () => actionableItems.filter((item) => acknowledged.has(item.id)),
    [acknowledged, actionableItems],
  );

  const investigatingMachine = machineMap[investigateId];
  const investigatingMeta = getMeta(investigateId, machineMeta);
  const investigatingHistory = telemetryHistory[investigateId] || [];
  const investigationAnalysis = useMemo(
    () => buildSystemAnalysis(investigatingMachine, investigatingMeta),
    [investigatingMachine, investigatingMeta],
  );
  const copilotNarrative = useMemo(
    () => buildCopilotNarrative(investigatingMachine, investigatingMeta),
    [investigatingMachine, investigatingMeta],
  );

  const handleDragEnd = useCallback((event) => {
    if (sortMode !== 'layout') return;
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setMachineOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        if (oldIndex === -1 || newIndex === -1) return items;
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, [sortMode]);

  const handleAcknowledge = useCallback((id) => {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleAcknowledgeAll = useCallback(() => {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      actionableItems.forEach((item) => next.add(item.id));
      return next;
    });
  }, [actionableItems]);

  const handleInvestigate = useCallback((id) => setInvestigateId(id), []);

  const handleMapNodeMove = useCallback((id, coords) => {
    setMapNodeSettings((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        ...coords,
      },
    }));
  }, []);

  const handleMapNodeSettingChange = useCallback((id, patch) => {
    setMapNodeSettings((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        ...patch,
      },
    }));
  }, []);

  const handleResetMapNode = useCallback((id) => {
    setMapNodeSettings((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleAddVirtualMachine = useCallback(() => {
    if (role !== 'engineer') return;
    const nextAsset = createVirtualMachine(virtualMachines.length, newMachineType);
    setVirtualMachines((prev) => [...prev, nextAsset]);
    setMachineOrder((prev) => [...prev, nextAsset.id]);
    setViewMode('map');
  }, [newMachineType, role, virtualMachines.length]);

  const handleRemoveVirtualMachine = useCallback((id) => {
    setVirtualMachines((prev) => prev.filter((asset) => asset.id !== id));
    setVirtualTelemetry((prev) => prev.filter((machine) => machine.id !== id));
    setMachineOrder((prev) => prev.filter((machineId) => machineId !== id));
    setMapNodeSettings((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setAcknowledged((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (investigateId === id) setInvestigateId(null);
    if (selectedMapNodeId === id) setSelectedMapNodeId(null);
  }, [investigateId, selectedMapNodeId]);

  const handleResetVirtualMachines = useCallback(() => {
    setVirtualMachines([]);
    setVirtualTelemetry([]);
    setVirtualShutdowns(new Set());
    setMachineOrder((prev) => prev.filter((id) => !id.startsWith('SIM_')));
    setMapNodeSettings((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !id.startsWith('SIM_'))));
  }, []);

  const handleShutdown = useCallback((machineId) => {
    if (machineMap[machineId]?.synthetic) {
      setVirtualShutdowns((prev) => {
        const next = new Set(prev);
        next.add(machineId);
        return next;
      });
      setCommandLog((prev) => [{
        id: `${Date.now()}-${machineId}`,
        machineId,
        action: 'shutdown',
        status: 'executed',
          timestamp: new Date().toISOString(),
        }, ...prev].slice(0, 7));
      return;
    }
    socket.emit('command:shutdown', { machineId });
  }, [machineMap]);

  const handleRestart = useCallback((machineId) => {
    if (machineMap[machineId]?.synthetic) {
      setVirtualShutdowns((prev) => {
        const next = new Set(prev);
        next.delete(machineId);
        return next;
      });
      setCommandLog((prev) => [{
        id: `${Date.now()}-${machineId}`,
        machineId,
        action: 'restart',
        status: 'executed',
        timestamp: new Date().toISOString(),
      }, ...prev].slice(0, 7));
      return;
    }
    socket.emit('command:restart', { machineId });
  }, [machineMap]);

  const handleMachineCommand = useCallback((machineId, action) => {
    if (action === 'restart') {
      handleRestart(machineId);
      return;
    }
    handleShutdown(machineId);
  }, [handleRestart, handleShutdown]);

  const getStatusIcon = useCallback((status) => {
    if (status === 'Normal') return <CheckCircle2 className="icon icon-normal" />;
    if (status === 'Warning') return <AlertTriangle className="icon icon-warning" />;
    if (status === 'Critical') return <ShieldAlert className="icon icon-critical" />;
    return <Activity className="icon icon-neutral" />;
  }, []);

  const getStatusClass = useCallback((status) => {
    if (status === 'Critical') return 'status-critical';
    if (status === 'Warning') return 'status-warning';
    if (status === 'Normal') return 'status-normal';
    return 'status-neutral';
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-logo-section">
          <div className="logo-icon-wrapper">
            <Activity className="logo-icon" />
          </div>
          <div>
            <h1 className="app-title">Nexus Control System</h1>
            <p className="app-subtitle">Next-Gen Industrial HMI - Digital Twin</p>
          </div>
        </div>

        <div className="header-controls">
          <div className="time-chip">
            <Clock3 size={14} />
            <span>{clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>

          <div className="role-switch" aria-label="Choose operating role">
            <button
              type="button"
              className={role === 'operator' ? 'active' : ''}
              onClick={() => setRole('operator')}
            >
              <Eye size={14} />
              Operator
            </button>
            <button
              type="button"
              className={role === 'engineer' ? 'active' : ''}
              onClick={() => setRole('engineer')}
            >
              <Settings size={14} />
              Engineer
            </button>
          </div>

          {commandLog.length > 0 && (
            <div className="command-toast">
              <Zap size={12} />
              <span>{commandLog[0].machineId} {commandLog[0].action === 'shutdown' ? 'shutdown executed' : 'restarted'}</span>
            </div>
          )}

          <div className={`status-badge ${connected ? 'status-live' : 'status-disconnected'}`}>
            <div className={`status-dot ${connected ? 'dot-pulse' : ''}`} />
            {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>{connected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className={`pane left-pane ${role === 'engineer' ? 'engineer-active' : ''}`}>
          <div className="overview-strip">
            <StatCard
              icon={connected ? Wifi : WifiOff}
              label="Connection"
              value={connected ? 'Live' : 'Offline'}
              detail={`${dashboardStats.active}/${dashboardStats.total || DEFAULT_MACHINE_ORDER.length} active assets`}
              tone={connected ? 'normal' : 'critical'}
            />
            <StatCard
              icon={Server}
              label="System State"
              value={dashboardStats.systemLabel}
              detail={dashboardStats.lastUpdated ? `Updated ${formatTime(dashboardStats.lastUpdated)}` : 'Waiting for telemetry'}
              tone={dashboardStats.critical ? 'critical' : dashboardStats.warning ? 'warning' : 'normal'}
            />
            <StatCard
              icon={Gauge}
              label="Peak Risk"
              value={dashboardStats.highest ? `${toNumber(dashboardStats.highest.severity_score)}/100` : '--'}
              detail={dashboardStats.highest ? dashboardStats.highest.id : `Avg ${dashboardStats.averageSeverity}/100`}
              tone={dashboardStats.critical ? 'critical' : dashboardStats.warning ? 'warning' : 'neutral'}
            />
            <StatCard
              icon={Power}
              label="Offline"
              value={dashboardStats.offline}
              detail={dashboardStats.offline ? 'Cooling protocol active' : 'No shutdowns'}
              tone={dashboardStats.offline ? 'offline' : 'neutral'}
            />
          </div>

          <div className="pane-header flex-between">
            <div>
              <h2 className="pane-title">
                Plant Overview
                {role === 'engineer' && <span className="badge-eng">Layout Editor</span>}
              </h2>
              <p className="pane-subtitle">
                {dashboardStats.critical} critical / {dashboardStats.warning} warning / {dashboardStats.offline} offline
              </p>
            </div>

            <div className="view-toggle" aria-label="Switch overview view">
              <button type="button" className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
                <Grid size={14} />
                Grid
              </button>
              <button type="button" className={`toggle-btn ${viewMode === 'map' ? 'active' : ''}`} onClick={() => setViewMode('map')}>
                <MapIcon size={14} />
                Digital Twin
              </button>
            </div>
          </div>

          <div className="control-toolbar">
            <label className="search-field">
              <Search size={15} />
              <input
                value={machineQuery}
                onChange={(event) => setMachineQuery(event.target.value)}
                placeholder="Search machine, zone, or type"
                aria-label="Search machines"
              />
            </label>

            <label className="select-field">
              <Filter size={15} />
              <select value={machineFilter} onChange={(event) => setMachineFilter(event.target.value)} aria-label="Filter machines by status">
                <option value="all">All statuses</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="normal">Normal</option>
                <option value="offline">Offline</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>

            <label className="select-field">
              <ArrowUpDown size={15} />
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} aria-label="Sort machines">
                <option value="layout">Layout order</option>
                <option value="severity">Severity</option>
                <option value="status">Status</option>
                <option value="zone">Zone</option>
              </select>
            </label>
          </div>

          {role === 'engineer' && (
            <div className="engineer-console">
              <div className="engineer-console-main">
                <div className="engineer-console-icon">
                  <CircuitBoard size={18} />
                </div>
                <div>
                  <p className="floor-kicker">Engineer Studio</p>
                  <h3>Build simulated assets with natural behavior</h3>
                  <p>Virtual machines drift, pulse, raise AI alerts, appear on the ecosystem map, and support shutdown/restart flows.</p>
                </div>
              </div>
              <div className="engineer-controls">
                <label className="select-field compact-field">
                  <Cpu size={15} />
                  <select value={newMachineType} onChange={(event) => setNewMachineType(event.target.value)} aria-label="Virtual machine type">
                    {Object.keys(MACHINE_TYPES).map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="premium-action-btn" onClick={handleAddVirtualMachine}>
                  <Plus size={15} />
                  Add Machine
                </button>
                <button type="button" className="premium-action-btn ghost" onClick={handleResetVirtualMachines} disabled={virtualMachines.length === 0}>
                  <RotateCcw size={15} />
                  Reset Sim
                </button>
              </div>
              {virtualMachines.length > 0 && (
                <div className="virtual-asset-strip">
                  {virtualMachines.map((asset) => (
                    <button key={asset.id} type="button" className="virtual-chip" onClick={() => handleInvestigate(asset.id)}>
                      <Sparkles size={13} />
                      <span>{asset.id}</span>
                      <i>Zone {asset.zone}</i>
                      <span
                        className="virtual-delete"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRemoveVirtualMachine(asset.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            handleRemoveVirtualMachine(asset.id);
                          }
                        }}
                        aria-label={`Remove ${asset.id}`}
                      >
                        <Trash2 size={12} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {allTelemetry.length === 0 ? (
            <div className="empty-state">
              <Activity className="empty-icon pulse" />
              <p className="empty-title">Waiting for telemetry</p>
              <p className="empty-subtitle">Start the backend simulator and AI layer to stream live machine data.</p>
            </div>
          ) : filteredMachineIds.length === 0 ? (
            <div className="empty-state">
              <Search className="empty-icon" />
              <p className="empty-title">No machines match this view</p>
              <p className="empty-subtitle">Adjust search or status filters to bring assets back into focus.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredMachineIds} strategy={rectSortingStrategy}>
                <div className="grid-overview">
                  {filteredMachineIds.map((id) => {
                    const machine = machineMap[id];
                    if (!machine) return null;
                    return (
                      <SortableMachineCard
                        key={id}
                        id={id}
                        machine={machine}
                        role={role}
                        meta={getMeta(id, machineMeta)}
                        isSortable={role === 'engineer' && sortMode === 'layout'}
                        history={telemetryHistory[id]}
                        onInvestigate={handleInvestigate}
                        getStatusIcon={getStatusIcon}
                        getStatusClass={getStatusClass}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <FloorPlan
              telemetry={filteredTelemetry}
              metaRegistry={machineMeta}
              onNodeClick={handleInvestigate}
              mapLayout={mapLayout}
              setMapLayout={setMapLayout}
              mapLayer={mapLayer}
              setMapLayer={setMapLayer}
              role={role}
              nodeSettings={mapNodeSettings}
              selectedNodeId={selectedMapNodeId}
              setSelectedNodeId={setSelectedMapNodeId}
              onNodeMove={handleMapNodeMove}
              onNodeSettingChange={handleMapNodeSettingChange}
              onResetNode={handleResetMapNode}
              onMachineCommand={handleMachineCommand}
            />
          )}
        </section>

        <section className="pane right-pane">
          <div className="right-pane-bg" />

          <div className="pane-header flex-between">
            <div>
              <h2 className="pane-title with-icon">
                <AlertCircle className="title-icon" />
                Smart Action Center
              </h2>
              <p className="pane-subtitle">ML-prioritized alerts and operator actions</p>
            </div>
            {activeAlerts.length > 0 && (
              <div className="action-header-tools">
                <div className="alert-badge">
                  <div className="alert-dot pulse" />
                  {activeAlerts.length} unresolved
                </div>
                <button type="button" className="icon-action-btn" onClick={handleAcknowledgeAll}>
                  <ClipboardCheck size={14} />
                  Ack all
                </button>
              </div>
            )}
          </div>

          <div className="alerts-container">
            {activeAlerts.length === 0 ? (
              <div className="empty-state alerts-empty">
                <div className="normal-icon-wrapper">
                  <CheckCircle2 className="normal-icon" />
                </div>
                <h3 className="empty-title">All systems normal</h3>
                <p className="empty-subtitle">Isolation Forest reports no unresolved anomalies.</p>
              </div>
            ) : activeAlerts.map((item) => {
              const meta = getMeta(item.id, machineMeta);
              return (
                <article key={`alert-${item.id}`} className={`alert-card ${getStatusClass(item.ai_status)}`}>
                  <div className="severity-bar" />

                  <div className="alert-content">
                    <div className="alert-info">
                      <div className="alert-title-row">
                        <h3 className="alert-id">{item.id}</h3>
                        <span className="alert-status-badge">{item.ai_status}</span>
                        {item.anomaly_source && item.anomaly_source !== 'none' && (
                          <span className="anomaly-source-tag">{item.anomaly_source}</span>
                        )}
                      </div>
                      <p className="alert-desc">Zone {meta.zone} / {meta.label} / {statusCopy[item.ai_status]}</p>
                      {item.copilot && (
                        <div className="copilot-mini">
                          <Brain size={12} className="copilot-mini-icon" />
                          <span>{item.copilot.probability}% probability - {item.copilot.failure_mode}</span>
                        </div>
                      )}
                    </div>

                    <div className="severity-box">
                      <div className="severity-number">{toNumber(item.severity_score)}</div>
                      <div className="severity-label">/ 100</div>
                    </div>
                  </div>

                  <div className="alert-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => handleAcknowledge(item.id)}>
                      <ClipboardCheck size={13} />
                      Acknowledge
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => handleInvestigate(item.id)}>
                      <Eye size={13} />
                      Investigate
                    </button>
                    {item.ai_status === 'Critical' && (
                      <button
                        type="button"
                        className="btn btn-shutdown"
                        onClick={() => {
                          setSelectedMapNodeId(item.id);
                          setViewMode('map');
                        }}
                      >
                        <Settings size={13} />
                        Engineer Settings
                      </button>
                    )}
                  </div>
                </article>
              );
            })}

            {ackAlerts.length > 0 && (
              <div className="acknowledged-section">
                <button type="button" className="ack-title" onClick={() => setShowAcknowledged((value) => !value)}>
                  <ClipboardCheck size={13} />
                  Acknowledged ({ackAlerts.length})
                  <span>{showAcknowledged ? 'Hide' : 'Show'}</span>
                </button>
                {showAcknowledged && ackAlerts.map((item) => (
                  <div key={`ack-${item.id}`} className="alert-card acknowledged">
                    <div className="alert-content compact">
                      <div className="alert-info">
                        <div className="alert-title-row">
                          <h3 className="alert-id">{item.id}</h3>
                          <span className="ack-tag">Operator 1</span>
                        </div>
                        <p className="alert-desc">Severity {toNumber(item.severity_score)}/100 / {getMeta(item.id, machineMeta).label}</p>
                      </div>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleInvestigate(item.id)}>
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="operations-log">
              <div className="operations-header">
                <Zap size={14} />
                <h3>Command Log</h3>
              </div>
              {commandLog.length === 0 ? (
                <p className="log-empty">No remote commands executed in this session.</p>
              ) : commandLog.map((entry) => (
                <div key={entry.id} className="log-entry">
                  <span className={`log-dot ${entry.action === 'shutdown' ? 'critical' : 'normal'}`} />
                  <div>
                    <strong>{entry.machineId}</strong>
                    <p>{entry.action === 'shutdown' ? 'Shutdown executed' : 'Restart completed'} / {formatTime(entry.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className={`investigate-panel diagnostic-panel ${investigateId ? 'open' : ''}`}>
          {investigatingMachine && (
            <>
              <div className="panel-header-inv diagnostic-header">
                <div className="diagnostic-identity">
                  <div className={`panel-icon-bg ${getStatusClass(investigatingMachine.ai_status)}`}>
                    <Settings className="panel-icon" />
                  </div>
                  <div>
                    <p className="panel-kicker">Zone {investigatingMeta.zone} / {investigatingMeta.type}</p>
                    <h2 className="panel-title-inv">{investigateId}</h2>
                    <p className="panel-sub-inv">{investigatingMeta.label} diagnostic report</p>
                    <div className="diagnostic-chip-row">
                      <span>{investigatingMeta.criticality} criticality</span>
                      <span>{investigatingMachine.synthetic ? 'Simulated behavior' : 'Live telemetry'}</span>
                      <span>{investigatingMachine.anomaly_source === 'none' ? 'Baseline stable' : `${investigatingMachine.anomaly_source} deviation`}</span>
                    </div>
                  </div>
                </div>
                <div className="diagnostic-header-actions">
                  <span className={`diagnostic-status tone-${getStatusTone(investigatingMachine)}`}>
                    {investigatingMachine.isShutdown ? 'Offline' : investigatingMachine.ai_status}
                  </span>
                  <button type="button" className="close-btn" onClick={() => setInvestigateId(null)} aria-label="Close diagnostic panel">
                    <X />
                  </button>
                </div>
              </div>

              <div className="panel-content-inv diagnostic-content">
                <div className="panel-summary-grid diagnostic-metric-grid">
                  <MetricTile
                    label="Temp"
                    value={formatMetric(investigatingMachine.temperature, 1)}
                    unit=" C"
                    icon={Thermometer}
                    anomaly={investigatingMachine.anomaly_source === 'temperature'}
                  />
                  <MetricTile
                    label="Pressure"
                    value={formatMetric(investigatingMachine.pressure, 1)}
                    unit=" bar"
                    icon={Gauge}
                    anomaly={investigatingMachine.anomaly_source === 'pressure'}
                  />
                  <MetricTile
                    label="Vibration"
                    value={formatMetric(investigatingMachine.vibration, 2)}
                    unit=" mm/s"
                    icon={Radio}
                    anomaly={investigatingMachine.anomaly_source === 'vibration'}
                  />
                </div>

                {investigatingMachine.copilot ? (
                  <div className="ai-insight-box premium-insight diagnostic-ai-card">
                    <div className="ai-insight-header premium">
                      <div className="ai-orbit">
                        <Brain className="ai-insight-icon" />
                      </div>
                      <div>
                        <p className="panel-kicker">AI Copilot</p>
                        <h3>Root Cause Snapshot</h3>
                      </div>
                    </div>
                    <div className="ai-insight-body">
                      <div className="copilot-hero">
                        <div className="prob-ring" style={{ '--score': investigatingMachine.copilot.probability }}>
                          <strong>{investigatingMachine.copilot.probability}%</strong>
                          <span>Probability</span>
                        </div>
                        <div className="copilot-hero-copy">
                          <div className={`risk-pill ${getStatusTone(investigatingMachine)}`}>
                            <AlertOctagon size={14} />
                            {investigatingMachine.ai_status} / {investigatingMachine.anomaly_source}
                          </div>
                          <h4>{copilotNarrative.headline}</h4>
                          <p>{copilotNarrative.summary}</p>
                        </div>
                      </div>

                      <div className="copilot-evidence-list">
                        {copilotNarrative.evidence.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>

                      <div className="system-analysis-grid">
                        {investigationAnalysis.map((item) => (
                          <div key={item.label} className={`analysis-card tone-${item.tone}`}>
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                            <p>{item.detail}</p>
                          </div>
                        ))}
                      </div>

                      <div className="ai-recommendation">
                        <div className="rec-label">Recommended action</div>
                        <p>{copilotNarrative.nextAction}</p>
                        <div className="panel-action-row">
                          {!acknowledged.has(investigateId) && (
                            <button type="button" className="btn btn-secondary" onClick={() => handleAcknowledge(investigateId)}>
                              <ClipboardCheck size={14} />
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="ai-insight-box normal-state diagnostic-ai-card">
                    <div className="ai-insight-header premium">
                      <div className="ai-orbit normal">
                        <CheckCircle2 className="ai-insight-icon normal" />
                      </div>
                      <div>
                        <p className="panel-kicker">AI Copilot</p>
                        <h3>Operating Envelope</h3>
                      </div>
                    </div>
                    <div className="ai-insight-body">
                      <div className="copilot-hero compact">
                        <div className="copilot-hero-copy">
                          <div className={`risk-pill ${getStatusTone(investigatingMachine)}`}>
                            <CheckCircle2 size={14} />
                            {investigatingMachine.isShutdown ? 'Offline' : investigatingMachine.ai_status}
                          </div>
                          <h4>{copilotNarrative.headline}</h4>
                          <p>{copilotNarrative.summary}</p>
                        </div>
                      </div>
                      <div className="copilot-evidence-list">
                        {copilotNarrative.evidence.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                      <div className="system-analysis-grid">
                        {investigationAnalysis.map((item) => (
                          <div key={item.label} className={`analysis-card tone-${item.tone}`}>
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                            <p>{item.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="diagnostic-chart-grid">
                  <TrendChart
                    title="Temperature Trend"
                    data={investigatingHistory}
                    dataKey="temp"
                    stroke="#ef4444"
                    unit=" C"
                    domain={['dataMin - 10', 'dataMax + 10']}
                  />
                  <TrendChart
                    title="Pressure Trend"
                    data={investigatingHistory}
                    dataKey="pressure"
                    stroke="#38bdf8"
                    unit=" bar"
                    domain={['dataMin - 20', 'dataMax + 20']}
                  />
                  <TrendChart
                    title="Vibration Trend"
                    data={investigatingHistory}
                    dataKey="vibration"
                    stroke="#f97316"
                    unit=" mm/s"
                    domain={['dataMin - 1', 'dataMax + 1']}
                  />
                </div>

                {role === 'engineer' && (
                  <div className="machine-control-card">
                    <div>
                      <p className="panel-kicker">Engineer Settings</p>
                      <h3>Machine Controls</h3>
                      <span>{investigatingMachine.isShutdown ? 'Machine is isolated. Turn it back on after checks.' : 'Manual commands live here, separate from AI reasoning.'}</span>
                    </div>
                    <div className="machine-control-actions">
                      <button
                        type="button"
                        className={`node-command ${investigatingMachine.isShutdown ? 'restore' : 'danger'}`}
                        onClick={() => handleMachineCommand(investigateId, investigatingMachine.isShutdown ? 'restart' : 'shutdown')}
                      >
                        <Power size={14} />
                        {investigatingMachine.isShutdown ? 'Turn Back On' : 'Shut Down'}
                      </button>
                      <button
                        type="button"
                        className="node-command secondary"
                        onClick={() => {
                          setSelectedMapNodeId(investigateId);
                          setViewMode('map');
                        }}
                      >
                        <Settings size={14} />
                        Map Pill Settings
                      </button>
                    </div>
                  </div>
                )}

                <div className="asset-sheet diagnostic-facts">
                  <div>
                    <span>Criticality</span>
                    <strong>{investigatingMeta.criticality}</strong>
                  </div>
                  <div>
                    <span>Latest sample</span>
                    <strong>{formatTime(investigatingMachine.timestamp)}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{investigatingMachine.isShutdown ? 'Offline' : investigatingMachine.ai_status}</strong>
                  </div>
                </div>

                <div className="sensor-hint">
                  <Smartphone size={16} />
                  <span>
                    Open <a href={`${BACKEND_URL}/sensor`} target="_blank" rel="noreferrer">sensor bridge</a> on your phone to stream live accelerometer data into this machine.
                  </span>
                </div>
              </div>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
