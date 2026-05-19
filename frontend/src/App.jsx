import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Activity, Map as MapIcon, Grid, X, Settings, Power, Search, Filter, ArrowUpDown, Clock3, Eye, Server, Wifi, WifiOff, Plus, Cpu, CircuitBoard, RotateCcw, Trash2, Gauge, Sparkles, Check, ChevronDown, TrendingUp, Wand2, Bot, Loader2, CheckCircle2 } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import './index.css';

import { MACHINE_META, DEFAULT_MACHINE_ORDER, STATUS_WEIGHT, STORAGE_KEY_VIRTUAL_ASSETS, STORAGE_KEY_MAP_NODE_SETTINGS, MACHINE_TYPES } from './utils/constants';

import { resolveBackendUrl, generateVirtualTelemetry, appendTelemetryHistory, getMeta, toNumber, formatTime, createVirtualMachine, resetVirtualMachineState, buildSmartAlarm } from './utils/helpers';

import { StatCard } from './components/SharedUI/SharedUI';
import SortableMachineCard from './components/SortableMachineCard/SortableMachineCard';
import FloorPlan from './components/FloorPlan/FloorPlan';
import SearchableDropdown from './components/SearchableDropdown';
import DiagnosticOverlay from './components/DiagnosticOverlay/DiagnosticOverlay';
import SmartActionCenter from './components/SmartActionCenter/SmartActionCenter';
import ManagerAnalytics from './components/ManagerAnalytics/ManagerAnalytics';


function getSavedMapNodeSettings() { try { const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY_MAP_NODE_SETTINGS) || '{}'); return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}; } catch { return {}; } }
function saveMapNodeSettings(settings) { try { window.localStorage.setItem(STORAGE_KEY_MAP_NODE_SETTINGS, JSON.stringify(settings)); } catch { } }

const BACKEND_URL = resolveBackendUrl();
const socket = io(BACKEND_URL);

const DEFAULT_MAP_WORKSPACE = {
  backgroundUrl: '',
  backgroundName: '',
  gridVisible: true,
  layoutLocked: false,
  zoom: 1,
  panX: 0,
  panY: 0,
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'normal', label: 'Normal' },
  { value: 'offline', label: 'Offline' },
  { value: 'unknown', label: 'Unknown' }
];

const SORT_OPTIONS = [
  { value: 'layout', label: 'Layout order' },
  { value: 'severity', label: 'Severity' },
  { value: 'status', label: 'Status' },
  { value: 'zone', label: 'Zone' }
];

function HmiSelect({ icon: Icon, value, options, onChange, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <div
      className={`hmi-select ${open ? 'open' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="hmi-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon size={15} />
        <span>{selected.label}</span>
      </button>
      {open && (
        <div className="hmi-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'selected' : ''}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [telemetry, setTelemetry] = useState([]);
  const [telemetryHistory, setTelemetryHistory] = useState({});
  const [connected, setConnected] = useState(false);
  const [role, setRole] = useState(() => localStorage.getItem('nexus_user_role') || 'operator');
  
  const handleRoleChange = useCallback((newRole) => {
    setRole(newRole);
    localStorage.setItem('nexus_user_role', newRole);
  }, []);
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullscreenGraph, setFullscreenGraph] = useState(null);
  const [mapWorkspace, setMapWorkspace] = useState(DEFAULT_MAP_WORKSPACE);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState(null);
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [isAILive, setIsAILive] = useState(false);
  const [alertToasts, setAlertToasts] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState(null); // { title, message, onConfirm, onCancel }

  const triggerConfirm = useCallback((message, onConfirm, title = "Confirm Action", onCancel = null) => {
    setConfirmConfig({ title, message, onConfirm, onCancel });
  }, []);
  const [zonalInsights, setZonalInsights] = useState([]);

  // Full-control machine configuration state
  const SENSOR_DEFAULTS = {
    Pump:       { temperature: 60, pressure: 120, vibration: 2.0, rpm: 1450, flow_rate: 500 },
    Motor:      { temperature: 70, rpm: 3600, vibration: 1.5, current: 25, torque: 150 },
    Compressor: { temperature: 75, pressure: 250, vibration: 3.0, rpm: 2800 },
    Conveyor:   { speed: 2.5, load: 500, motor_temp: 55, belt_tension: 800 },
    Boiler:     { temperature: 250, pressure: 400, fuel_flow: 50, water_level: 65 },
    Valve:      { pressure: 100, flow_rate: 300, position: 100 },
    RoboticArm: { joint_temp: 45, torque: 80, error_margin: 0.01, latency: 15 },
    Reactor:    { temperature: 92, pressure: 142, vibration: 1.8 },
    Chiller:    { temperature: 28, pressure: 64, vibration: 1.6 },
  };

  const DEFAULT_ZONES = {
    A: { name: 'Cooling Zone', color: '#38bdf8', status: 'normal', x: 24, y: 24, width: 535, height: 300 },
    B: { name: 'High Heat Zone', color: '#ef4444', status: 'normal', x: 591, y: 24, width: 535, height: 300 },
    C: { name: 'Robotics Zone', color: '#8b5cf6', status: 'normal', x: 24, y: 356, width: 535, height: 300 },
    D: { name: 'Hydraulic Zone', color: '#f59e0b', status: 'normal', x: 591, y: 356, width: 535, height: 300 },
  };

  const zonesList = useMemo(() => {
    const workspaceZones = mapWorkspace.zones && Object.keys(mapWorkspace.zones).length > 0
      ? mapWorkspace.zones
      : DEFAULT_ZONES;
    return Object.values(workspaceZones).map(z => z.name);
  }, [mapWorkspace.zones]);

  const [machineConfig, setMachineConfig] = useState({ type: 'Pump', zone: 'Cooling Zone', label: '', loadFactor: 0.75, sensors: { ...SENSOR_DEFAULTS['Pump'] } });

  // AI STATES
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState(null); // Holds the summary of what was generated

  useEffect(() => { document.title = 'Nexus Control System'; }, []);
  useEffect(() => { const interval = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(interval); }, []);

  // Auto-dismiss alert toasts after 6 seconds
  useEffect(() => {
    if (alertToasts.length === 0) return;
    const timer = setTimeout(() => {
      setAlertToasts(prev => prev.slice(0, -1));
    }, 6000);
    return () => clearTimeout(timer);
  }, [alertToasts]);

  // Fetch workspace settings on load
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/workspace`)
      .then(res => res.json())
      .then(data => {
        setMapWorkspace(prev => ({ ...prev, ...data }));
        if (data.lastSavedTimestamp) {
          setLastSavedTimestamp(new Date(data.lastSavedTimestamp));
        }
      })
      .catch(err => console.error('Failed to load workspace settings:', err));
  }, []);

  // Update workspace settings locally and flag dirty state
  const handleMapWorkspaceChange = useCallback((patch) => {
    setMapWorkspace(prev => ({ ...prev, ...patch }));
    setHasUnsavedChanges(true);
  }, []);

  // Background upload handler (flags unsaved changes)
  const handleMapBackgroundUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    fetch(`${BACKEND_URL}/api/upload-map`, {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          handleMapWorkspaceChange({ backgroundUrl: data.url, backgroundName: file.name });
        }
      })
      .catch(err => console.error('Map upload failed:', err));
  }, [handleMapWorkspaceChange]);

  const handleSaveLayout = useCallback(async () => {
    const timestampStr = new Date().toISOString();
    const payload = {
      ...mapWorkspace,
      lastSavedTimestamp: timestampStr
    };

    try {
      // 1. Save workspace configuration (zoom, pan, grid, zones, connections, background)
      const res = await fetch(`${BACKEND_URL}/api/workspace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 2. Save machine layout positions on backend
      const nodes = Object.entries(mapNodeSettings).map(([id, s]) => ({ id, x: s.x || 0, y: s.y || 0 }));
      socket.emit('map:save_layout', { nodes });

      // 3. Persist to localStorage
      saveMapNodeSettings(mapNodeSettings);

      setHasUnsavedChanges(false);
      setLastSavedTimestamp(new Date(timestampStr));
    } catch (err) {
      console.error('Failed to save layout:', err);
      alert('Failed to save layout: ' + err.message);
    }
  }, [mapWorkspace, mapNodeSettings]);

  const handleNodeZoneChange = useCallback((machineId, zoneName) => {
    socket.emit('engineer:update_machine_zone', { machineId, zone: zoneName });
    setTelemetry(prev => prev.map(m => m.id === machineId ? { ...m, zone: zoneName } : m));
    setHasUnsavedChanges(true);
  }, []);

  // Backend now handles all physics simulation!

  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true);
      fetch(`${BACKEND_URL}/api/workspace`)
        .then(res => res.json())
        .then(data => {
          setMapWorkspace(prev => ({ ...prev, ...data }));
          if (data.lastSavedTimestamp) {
            setLastSavedTimestamp(new Date(data.lastSavedTimestamp));
          }
        })
        .catch(err => console.error('Failed to load workspace settings on reconnect:', err));
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('telemetry', (data) => {
      if (!Array.isArray(data)) {
        console.warn("Received telemetry is not an array:", data);
        return;
      }
      setTelemetry(data);
      setTelemetryHistory((prev) => appendTelemetryHistory(prev, data));
      setAcknowledged((prev) => {
        let updated = new Set(prev);
        let changed = false;
        data.forEach(m => { if (m.ai_status === 'Normal' && updated.has(m.id)) { updated.delete(m.id); changed = true; } });
        return changed ? updated : prev;
      });
      // Synchronize database-persisted positions into mapNodeSettings if not present
      setMapNodeSettings((prev) => {
        const next = { ...prev };
        let updated = false;
        data.forEach((m) => {
          if (m.position && m.position.x !== undefined && m.position.y !== undefined) {
            if (!prev[m.id] || prev[m.id].x === undefined || prev[m.id].y === undefined) {
              next[m.id] = { ...prev[m.id], x: m.position.x, y: m.position.y };
              updated = true;
            }
          }
        });
        return updated ? next : prev;
      });
    });
    socket.on('command:ack', (data) => setCommandLog((prev) => [{ ...data, id: `${Date.now()}-${data.machineId}` }, ...prev].slice(0, 7)));
    socket.on('sim:status', (data) => setIsSimRunning(data.isRunning));
    socket.on('ai:status', (data) => setIsAILive(data.live));
    socket.on('ai:zonal_insights', (data) => setZonalInsights(data));
    socket.on('ai:alerts', (alerts) => {
      if (!Array.isArray(alerts) || alerts.length === 0) return;
      setAlertHistory(prev => [...alerts, ...prev].slice(0, 100));
    });
    return () => { socket.off('connect'); socket.off('disconnect'); socket.off('telemetry'); socket.off('command:ack'); socket.off('sim:status'); socket.off('ai:status'); socket.off('ai:zonal_insights'); socket.off('ai:alerts'); };
  }, []);

  const handleToggleSim = useCallback(() => {
      if (isSimRunning) {
          setShowStopConfirm(true);
      } else {
          socket.emit('engineer:start_sim');
      }
  }, [isSimRunning]);

  const handleConfirmStopSim = useCallback(() => {
      socket.emit('engineer:stop_sim');
      setShowStopConfirm(false);
  }, []);

  const machineMeta = useMemo(() => {
    const baseMeta = { ...MACHINE_META };
    const meta = { ...baseMeta };
    
    telemetry.forEach((m) => {
      const base = getMeta(m.id, baseMeta, m);
      const settings = mapNodeSettings[m.id] || {};
      meta[m.id] = { ...base, ...settings };
    });
    
    Object.entries(mapNodeSettings).forEach(([id, settings]) => {
      if (!meta[id]) {
        const base = getMeta(id, baseMeta, null);
        meta[id] = { ...base, ...settings };
      }
    });
    
    return meta;
  }, [mapNodeSettings, telemetry]);

  const allTelemetry = telemetry;
  const machineMap = useMemo(() => allTelemetry.reduce((acc, machine) => { acc[machine.id] = machine; return acc; }, {}), [allTelemetry]);

  const orderedMachineIds = useMemo(() => {
    const telemetryIds = allTelemetry.map((machine) => machine.id);
    const ordered = machineOrder.filter((id) => telemetryIds.includes(id));
    const extras = telemetryIds.filter((id) => !machineOrder.includes(id));
    return [...ordered, ...extras];
  }, [machineOrder, allTelemetry]);

  const dashboardStats = useMemo(() => {
    const total = allTelemetry.length;
    const critical = allTelemetry.filter((m) => m.ai_status === 'Critical' && !m.isShutdown).length;
    const warning = allTelemetry.filter((m) => m.ai_status === 'Warning' && !m.isShutdown).length;
    const offline = allTelemetry.filter((m) => m.isShutdown).length;
    const active = Math.max(total - offline, 0);
    const highest = allTelemetry.reduce((top, m) => (!top || toNumber(m.severity_score) > toNumber(top.severity_score) ? m : top), null);
    const avgSev = total ? Math.round(allTelemetry.reduce((sum, m) => sum + toNumber(m.severity_score), 0) / total) : 0;
    const lastUpdated = allTelemetry.reduce((latest, m) => Math.max(latest, new Date(m.timestamp).getTime()), 0);
    const systemLabel = critical ? 'Critical' : warning ? 'Attention' : offline ? 'Cooling' : total ? 'Stable' : 'Waiting';
    return { total, active, critical, warning, offline, highest, averageSeverity: avgSev, lastUpdated, systemLabel };
  }, [allTelemetry]);

  const filteredMachineIds = useMemo(() => {
    const query = machineQuery.trim().toLowerCase();
    const filtered = orderedMachineIds.filter((id) => {
      const machine = machineMap[id];
      if (!machine) return false;
      const meta = getMeta(id, machineMeta, machine);
      const status = machine.isShutdown ? 'offline' : String(machine.ai_status || 'unknown').toLowerCase();
      const matchesFilter = machineFilter === 'all' || machineFilter === status;
      return matchesFilter && (!query || `${id} ${meta.label} ${meta.type} ${meta.zone} ${meta.criticality} ${machine.ai_status}`.toLowerCase().includes(query));
    });
    if (sortMode === 'severity') filtered.sort((a, b) => toNumber(machineMap[b]?.severity_score) - toNumber(machineMap[a]?.severity_score));
    else if (sortMode === 'status') filtered.sort((a, b) => (STATUS_WEIGHT[machineMap[b]?.isShutdown ? 'Unknown' : machineMap[b]?.ai_status] || 0) - (STATUS_WEIGHT[machineMap[a]?.isShutdown ? 'Unknown' : machineMap[a]?.ai_status] || 0));
    else if (sortMode === 'zone') filtered.sort((a, b) => String(getMeta(a, machineMeta, machineMap[a]).zone).localeCompare(String(getMeta(b, machineMeta, machineMap[b]).zone)));
    return filtered;
  }, [machineFilter, machineMap, machineMeta, machineQuery, orderedMachineIds, sortMode]);

  const actionableItems = useMemo(() => {
    return allTelemetry
      .filter((item) => (item.ai_status === 'Warning' || item.ai_status === 'Critical') && !item.isShutdown)
      .map((item) => {
        const meta = getMeta(item.id, machineMeta);
        return buildSmartAlarm(item, meta);
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [allTelemetry, machineMeta]);

  const activeAlerts = useMemo(() => actionableItems.filter((item) => !acknowledged.has(item.id)), [acknowledged, actionableItems]);
  const ackAlerts = useMemo(() => actionableItems.filter((item) => acknowledged.has(item.id)), [acknowledged, actionableItems]);
  const suppressedAlerts = useMemo(() => {
    return actionableItems.filter((item) => item.priorityScore < 45 || item.urgency === 'Informational');
  }, [actionableItems]);

  const filteredTelemetry = useMemo(() => filteredMachineIds.map((id) => machineMap[id]).filter(Boolean), [filteredMachineIds, machineMap]);

  const handleDragEnd = useCallback((event) => {
    if (sortMode !== 'layout') return;
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setMachineOrder((items) => arrayMove(items, items.indexOf(active.id), items.indexOf(over.id)));
    }
  }, [sortMode]);

  const handleAcknowledge = useCallback((id) => setAcknowledged((prev) => new Set(prev).add(id)), []);
  const handleAcknowledgeAll = useCallback(() => activeAlerts.forEach(alert => setAcknowledged((prev) => new Set(prev).add(alert.id))), [activeAlerts]);
  const handleInvestigate = useCallback((id) => {
    history.pushState({ investigateId: id }, '');
    setInvestigateId(id);
  }, []);
  useEffect(() => {
    const handlePopState = (e) => {
      setInvestigateId((current) => {
        if (current) return null;
        return current;
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleMapNodeMove = useCallback((id, coords) => setMapNodeSettings((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...coords } })), []);
  const handleMapNodeSettingChange = useCallback((id, patch) => setMapNodeSettings((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } })), []);
  const handleResetMapNode = useCallback((id) => setMapNodeSettings((prev) => { const next = { ...prev }; delete next[id]; return next; }), []);

  const handleOpenAddModal = useCallback(() => {
    const type = newMachineType;
    setMachineConfig({ type, zone: 'Assembly Line', label: '', loadFactor: 0.75, sensors: { ...SENSOR_DEFAULTS[type] || {} } });
    setShowAddModal(true);
  }, [newMachineType]);

  const handleConfirmAddMachine = useCallback(() => {
    if (role !== 'engineer') return;
    socket.emit('engineer:add_machine', machineConfig);
    setShowAddModal(false);
  }, [machineConfig, role]);

  const handleDuplicateMachine = useCallback((id) => {
      const machine = machineMap[id];
      if (!machine) return;
      const meta = getMeta(id, machineMeta, machine);
      const newConfig = {
          type: meta.type || 'Pump',
          zone: meta.zone || 'Assembly Line',
          label: (meta.shortLabel || meta.label || id) + ' (Copy)',
          loadFactor: 0.75,
          sensors: { ...(machine.currentValues || SENSOR_DEFAULTS[meta.type] || SENSOR_DEFAULTS['Pump']) }
      };
      setMachineConfig(newConfig);
      setShowAddModal(true);
  }, [machineMap, machineMeta]);

  const DEFAULT_BLUEPRINT = JSON.stringify([
    { "type": "Pump", "zone": "Cooling System", "label": "Coolant Pump A", "loadFactor": 0.8, "sensors": { "temperature": 60, "pressure": 120, "vibration": 2.0, "rpm": 1450, "flow_rate": 500 } },
    { "type": "Boiler", "zone": "Boiler/Turbine Area", "label": "Main Boiler", "loadFactor": 0.9, "sensors": { "temperature": 250, "pressure": 400, "fuel_flow": 50, "water_level": 65 } },
    { "type": "Motor", "zone": "Assembly Line", "label": "Drive Motor 1", "loadFactor": 0.75, "sensors": { "temperature": 70, "rpm": 3600, "vibration": 1.5, "current": 25, "torque": 150 } }
  ], null, 2);

  const handleAIGenerate = useCallback(() => {
    if (!aiPromptText.trim()) return;
    setIsAIGenerating(true);
    setTimeout(() => {
      try {
        const parsed = JSON.parse(aiPromptText);
        const machines = Array.isArray(parsed) ? parsed : [parsed];
        if (machines.length === 0) throw new Error('Empty array');
        // Validate each has at least a type
        const valid = machines.filter(m => m.type && Object.keys(SENSOR_DEFAULTS).includes(m.type));
        if (valid.length === 0) throw new Error('No valid machine types found');
        socket.emit('engineer:ai_generate', { newAssets: valid });
        const grouped = valid.reduce((acc, m) => { acc[m.type] = (acc[m.type] || 0) + 1; return acc; }, {});
        setAiSummary({ grouped, machines: valid });
      } catch(e) {
        setAiBlueprintError(`Parse error: ${e.message}. Check your JSON format.`);
      }
      setIsAIGenerating(false);
    }, 600);
  }, [aiPromptText]);

  const [aiBlueprintError, setAiBlueprintError] = useState(null);

  const closeAIPrompt = useCallback(() => {
    setShowAIPrompt(false);
    setAiPromptText('');
    setAiSummary(null);
    setAiBlueprintError(null);
  }, []);

  const confirmAIDeployment = useCallback(() => {
    closeAIPrompt();
    setViewMode('grid');
  }, [closeAIPrompt]);


  const handleRemoveVirtualMachine = useCallback((id) => {
    setMachineOrder((prev) => prev.filter((m) => m !== id));
    setMapNodeSettings((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setAcknowledged((prev) => { const next = new Set(prev); next.delete(id); return next; });
    if (investigateId === id) setInvestigateId(null);
    if (selectedMapNodeId === id) setSelectedMapNodeId(null);
  }, [investigateId, selectedMapNodeId]);

  const handleResetVirtualMachines = useCallback(() => {
    socket.emit('engineer:reset_sim');
  }, []);

  const handleMachineCommand = useCallback((machineId, action) => {
    socket.emit(`command:${action}`, { machineId });
  }, []);

  const handleMachineDelete = useCallback((machineId) => {
    triggerConfirm(
      `Permanently delete virtual asset ${machineId} from the simulation and database?`,
      () => {
        socket.emit('command:delete', { machineId });
        setMapWorkspace((prev) => {
          if (!prev.connections) return prev;
          const nextConnections = { ...prev.connections };
          delete nextConnections[machineId];
          for (let [srcId, conns] of Object.entries(nextConnections)) {
            if (Array.isArray(conns)) {
              nextConnections[srcId] = conns.filter(c => (c.target || c) !== machineId);
            }
          }
          return { ...prev, connections: nextConnections };
        });
      },
      "Delete Machine"
    );
  }, [triggerConfirm]);

  const handleUpdateThresholds = useCallback((machineId, customThresholds) => {
    socket.emit('engineer:update_thresholds', { machineId, customThresholds });
  }, []);

  const getStatusClass = useCallback((status) => status === 'Critical' ? 'status-critical' : status === 'Warning' ? 'status-warning' : status === 'Normal' ? 'status-normal' : 'status-neutral', []);

  return (
    <div className="app-container">
      {investigateId && machineMap[investigateId] && (
        <DiagnosticOverlay
          machine={machineMap[investigateId]}
          meta={getMeta(investigateId, machineMeta)}
          history={telemetryHistory[investigateId] || []}
          role={role}
          setRole={setRole}
          investigateId={investigateId}
          acknowledged={acknowledged}
          onAcknowledge={handleAcknowledge}
          onCommand={handleMachineCommand}
          onClose={() => setInvestigateId(null)}
          fullscreenGraph={fullscreenGraph}
          setFullscreenGraph={setFullscreenGraph}
          onUpdateThresholds={handleUpdateThresholds}
        />
      )}

      {!investigateId && (
        <>
          <header className="app-header">
            <div className="header-logo-section">
              <div className="logo-icon-wrapper"><Activity className="logo-icon" /></div>
              <div><h1 className="app-title">Nexus Control System</h1><p className="app-subtitle">Next-Gen Industrial HMI - Digital Twin</p></div>
            </div>
            <div className="header-controls">
              <div className="time-chip"><Clock3 size={14} /><span>{clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div>

              <button 
                type="button" 
                className={`btn ${isSimRunning ? 'btn-danger' : 'btn-success'}`} 
                onClick={handleToggleSim} 
                style={{ 
                  marginRight: '0.75rem',
                  padding: '8px 16px'
                }}
              >
                <Power size={14} /> {isSimRunning ? 'Stop Factory' : 'Start Factory'}
              </button>

              <div className="role-switch">
                <button type="button" className={role === 'operator' ? 'active' : ''} onClick={() => handleRoleChange('operator')}><Eye size={14} /> Operator</button>
                <button type="button" className={role === 'engineer' ? 'active' : ''} onClick={() => handleRoleChange('engineer')}><Settings size={14} /> Engineer</button>
                <button type="button" className={role === 'manager' ? 'active' : ''} onClick={() => handleRoleChange('manager')}><TrendingUp size={14} /> Manager</button>
              </div>

              <div className={`status-badge ${connected ? 'status-live' : 'status-disconnected'}`}>
                <div className={`status-dot ${connected ? 'dot-pulse' : ''}`} />
                {connected ? <Wifi size={13} /> : <WifiOff size={13} />}<span>{connected ? 'Live' : 'Offline'}</span>
              </div>

              <div className={`status-badge ${isAILive ? 'status-live' : 'status-disconnected'}`} style={{
                color: isAILive ? '#c084fc' : '#f87171',
                borderColor: isAILive ? 'rgba(168,85,247,0.3)' : 'rgba(239,68,68,0.3)',
                background: isAILive ? 'rgba(168,85,247,0.1)' : 'rgba(239,68,68,0.1)'
              }}>
                <div className={`status-dot ${isAILive ? 'dot-pulse' : ''}`} style={{
                  backgroundColor: isAILive ? '#a855f7' : '#ef4444',
                  boxShadow: isAILive ? '0 0 12px #a855f7' : '0 0 12px #ef4444'
                }} />
                <Bot size={13} style={{ color: isAILive ? '#a855f7' : '#ef4444' }} />
                <span>{isAILive ? 'AI: Active' : 'AI: Dead'}</span>
              </div>
            </div>
          </header>

          <main className="main-content">
            <section className={`pane left-pane ${role === 'engineer' ? 'engineer-active' : ''}`}>
              <div className="overview-strip">
                <StatCard icon={connected ? Wifi : WifiOff} label="Connection" value={connected ? 'Live' : 'Offline'} detail={`${dashboardStats.active}/${dashboardStats.total || DEFAULT_MACHINE_ORDER.length} active assets`} tone={connected ? 'normal' : 'critical'} />
                <StatCard icon={Server} label="System State" value={dashboardStats.systemLabel} detail={dashboardStats.lastUpdated ? `Updated ${formatTime(dashboardStats.lastUpdated)}` : 'Waiting for telemetry'} tone={dashboardStats.critical ? 'critical' : dashboardStats.warning ? 'warning' : 'normal'} />
                <StatCard icon={Gauge} label="Peak Risk" value={dashboardStats.highest ? `${toNumber(dashboardStats.highest.severity_score)}/100` : '--'} detail={dashboardStats.highest ? dashboardStats.highest.id : `Avg ${dashboardStats.averageSeverity}/100`} tone={dashboardStats.critical ? 'critical' : dashboardStats.warning ? 'warning' : 'neutral'} />
                <StatCard icon={Power} label="Offline" value={dashboardStats.offline} detail={dashboardStats.offline ? 'Cooling protocol active' : 'No shutdowns'} tone={dashboardStats.offline ? 'offline' : 'neutral'} />
              </div>

              <div className="pane-header flex-between">
                <div><h2 className="pane-title">Plant Overview {role === 'engineer' && <span className="badge-eng">Layout Editor</span>}</h2><p className="pane-subtitle">{dashboardStats.critical} critical / {dashboardStats.warning} warning / {dashboardStats.offline} offline</p></div>
                <div className="view-toggle">
                  <button type="button" className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><Grid size={14} /> Grid</button>
                  <button type="button" className={`toggle-btn ${viewMode === 'map' ? 'active' : ''}`} onClick={() => setViewMode('map')}><MapIcon size={14} /> Digital Twin</button>
                </div>
              </div>

              <div className="control-toolbar" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', backgroundColor: 'transparent', border: 'none', padding: 0, alignItems: 'center' }}>
                <label className="search-field" style={{ flex: 1, minWidth: '220px', backgroundColor: '#0f172a', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={16} color="#94a3b8" />
                  <input value={machineQuery} onChange={(e) => setMachineQuery(e.target.value)} placeholder="Search..." style={{ fontSize: '13px', color: '#f8fafc', background: 'none', border: 'none', outline: 'none', width: '100%' }} />
                </label>

                <HmiSelect
                  icon={Filter}
                  value={machineFilter}
                  options={FILTER_OPTIONS}
                  onChange={setMachineFilter}
                  ariaLabel="Filter machines by status"
                />

                <HmiSelect
                  icon={ArrowUpDown}
                  value={sortMode}
                  options={SORT_OPTIONS}
                  onChange={setSortMode}
                  ariaLabel="Sort machines order"
                />

                {role === 'engineer' && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button type="button" className="premium-action-btn" onClick={handleOpenAddModal} style={{ height: '36px', fontSize: '12px', padding: '0 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <Plus size={14} /> Add
                    </button>
                    <button type="button" className="premium-action-btn" onClick={() => setShowAIPrompt(true)} style={{ height: '36px', fontSize: '12px', padding: '0 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(to right, #8b5cf6, #38bdf8)', border: 'none', color: '#fff', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)', fontWeight: 600 }}>
                      <Wand2 size={14} /> GenAI
                    </button>
                    <button type="button" className="premium-action-btn ghost" onClick={handleResetVirtualMachines} style={{ height: '36px', fontSize: '12px', padding: '0 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <RotateCcw size={14} /> Reset
                    </button>
                  </div>
                )}
              </div>

              {allTelemetry.length === 0 ? (
                <div className="empty-state"><Activity className="empty-icon pulse" /><p className="empty-title">Waiting for telemetry</p></div>
              ) : filteredMachineIds.length === 0 ? (
                <div className="empty-state"><Search className="empty-icon" /><p className="empty-title">No machines match</p></div>
              ) : viewMode === 'grid' ? (
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={filteredMachineIds} strategy={rectSortingStrategy}>
                    <div className="grid-overview">
                      {filteredMachineIds.map((id) => machineMap[id] && (
                        <SortableMachineCard key={id} id={id} machine={machineMap[id]} role={role} meta={getMeta(id, machineMeta)} isSortable={role === 'engineer' && sortMode === 'layout'} history={telemetryHistory[id]} onInvestigate={handleInvestigate} onDelete={handleMachineDelete} onMachineCommand={handleMachineCommand} getStatusClass={getStatusClass} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <FloorPlan
                  telemetry={allTelemetry}
                  metaRegistry={machineMeta}
                  onNodeClick={setInvestigateId}
                  mapLayout={mapLayout}
                  setMapLayout={setMapLayout}
                  mapLayer={mapLayer}
                  setMapLayer={setMapLayer}
                  onCustomConfirm={triggerConfirm}
                  role={role}
                  nodeSettings={mapNodeSettings}
                  selectedNodeId={selectedMapNodeId}
                  setSelectedNodeId={setSelectedMapNodeId}
                  mapWorkspace={mapWorkspace}
                  onMapWorkspaceChange={handleMapWorkspaceChange}
                  onMapBackgroundUpload={handleMapBackgroundUpload}
                  onSaveLayout={handleSaveLayout}
                  hasUnsavedChanges={hasUnsavedChanges}
                  lastSavedTimestamp={lastSavedTimestamp}
                  onNodeZoneChange={handleNodeZoneChange}
                  onNodeMove={(id, coords) => {
                    setMapNodeSettings(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...coords } }));
                    setHasUnsavedChanges(true);
                  }}
                  onNodeSettingChange={(id, patch) => {
                    setMapNodeSettings(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
                    setHasUnsavedChanges(true);
                  }}
                  onMachineCommand={handleMachineCommand}
                  onDuplicateMachine={handleDuplicateMachine}
                />
              )}
            </section>

            {role === 'manager' ? (
              <section className="pane right-pane">
                <ManagerAnalytics telemetry={allTelemetry} zonalInsights={zonalInsights} />
              </section>
            ) : (
              <SmartActionCenter
                activeAlerts={activeAlerts}
                ackAlerts={ackAlerts}
                suppressedAlerts={suppressedAlerts}
                commandLog={commandLog}
                machineMeta={machineMeta}
                showAcknowledged={showAcknowledged}
                setShowAcknowledged={setShowAcknowledged}
                onAcknowledge={handleAcknowledge}
                onAcknowledgeAll={handleAcknowledgeAll}
                onInvestigate={handleInvestigate}
                onEngineerSettings={(id) => { setSelectedMapNodeId(id); setViewMode('map'); }}
                getStatusClass={getStatusClass}
              />
            )}
          </main>
        </>
      )}


      {/* ── Blueprint Deployer Modal ── */}
      {showAIPrompt && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#0a0f1e', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(139,92,246,0.4)', width: '760px', maxWidth: '95%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 60px rgba(139,92,246,0.08)' }}>

            {aiSummary ? (
              // ─── SUCCESS STATE ───
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                  <CheckCircle2 color="#10b981" size={32} />
                </div>
                <h3 style={{ color: '#f8fafc', fontSize: '22px', margin: '0 0 6px', fontWeight: 700 }}>Blueprint Deployed!</h3>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 2rem' }}>{aiSummary.machines.length} machine{aiSummary.machines.length > 1 ? 's' : ''} initialised and entering startup sequence.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '2rem', textAlign: 'left' }}>
                  {aiSummary.machines.map((m, i) => (
                    <div key={i} style={{ backgroundColor: '#0f172a', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <Cpu size={13} color="#38bdf8" />
                        <span style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.type}</span>
                      </div>
                      <p style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 600, margin: '0 0 2px' }}>{m.label || m.type}</p>
                      <p style={{ color: '#475569', fontSize: '11px', margin: 0 }}>{m.zone} · {Object.keys(m.sensors || {}).length} sensors · {((m.loadFactor || 0.75)*100).toFixed(0)}% load</p>
                    </div>
                  ))}
                </div>

                <button onClick={confirmAIDeployment} style={{ padding: '12px 32px', borderRadius: '10px', border: 'none', background: 'linear-gradient(to right, #8b5cf6, #38bdf8)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  View in Dashboard <Grid size={15} />
                </button>
              </div>

            ) : (
              // ─── INPUT STATE ───
              <>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #8b5cf6, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wand2 color="white" size={18} /></div>
                    <div>
                      <h3 style={{ color: '#f8fafc', fontSize: '18px', margin: 0, fontWeight: 700 }}>Blueprint Deployer</h3>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0' }}>Paste a JSON array to deploy multiple machines in one shot</p>
                    </div>
                  </div>
                  <button onClick={() => setAiPromptText(DEFAULT_BLUEPRINT)} style={{ padding: '6px 14px', borderRadius: '7px', border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.06)', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={12} /> Load Template
                  </button>
                </div>

                {/* Schema Reference */}
                <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 14px', marginBottom: '1rem' }}>
                  <p style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>Schema Reference</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontSize: '11px' }}>
                    {[
                      ['type', '"Pump" | "Motor" | "Compressor" | "Valve" | "Boiler" | "Conveyor" | "RoboticArm"'],
                      ['zone', '"Assembly Line" | "Cooling System" | "Boiler/Turbine Area" | ...'],
                      ['label', 'string (optional display name)'],
                      ['loadFactor', 'number 0.1–1.0 (operating load %)'],
                      ['sensors', 'object with machine-specific keys (see below)'],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: '6px' }}>
                        <code style={{ color: '#38bdf8', fontFamily: 'monospace', minWidth: '90px' }}>{k}</code>
                        <span style={{ color: '#475569' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '10px', paddingTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {[
                      ['Pump', 'temperature, pressure, vibration, rpm, flow_rate'],
                      ['Motor', 'temperature, rpm, vibration, current, torque'],
                      ['Compressor', 'temperature, pressure, vibration, rpm'],
                      ['Boiler', 'temperature, pressure, fuel_flow, water_level'],
                      ['Valve', 'pressure, flow_rate, position'],
                      ['Conveyor', 'speed, load, motor_temp, belt_tension'],
                      ['RoboticArm', 'joint_temp, torque, error_margin, latency'],
                    ].map(([t, s]) => (
                      <div key={t} style={{ backgroundColor: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: '5px', padding: '3px 8px' }}>
                        <span style={{ color: '#8b5cf6', fontFamily: 'monospace', fontSize: '10px', fontWeight: 700 }}>{t}:</span>
                        <span style={{ color: '#475569', fontSize: '10px' }}> {s}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* JSON Editor */}
                <textarea
                  value={aiPromptText}
                  onChange={(e) => { setAiPromptText(e.target.value); setAiBlueprintError(null); }}
                  placeholder={'[\n  {\n    "type": "Pump",\n    "zone": "Cooling System",\n    "label": "Coolant Pump A",\n    "loadFactor": 0.8,\n    "sensors": { "temperature": 60, "pressure": 120, "vibration": 2.0 }\n  }\n]'}
                  spellCheck={false}
                  style={{ width: '100%', height: '220px', padding: '14px', borderRadius: '10px', backgroundColor: '#060c18', color: '#a5f3fc', border: `1px solid ${aiBlueprintError ? '#ef4444' : 'rgba(56,189,248,0.2)'}`, fontSize: '12.5px', fontFamily: '"Fira Code", "Cascadia Code", monospace', outline: 'none', resize: 'vertical', lineHeight: 1.65, boxSizing: 'border-box' }}
                  disabled={isAIGenerating}
                />
                {aiBlueprintError && (
                  <p style={{ color: '#ef4444', fontSize: '12px', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⚠ {aiBlueprintError}
                  </p>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                  <p style={{ color: '#334155', fontSize: '11px', margin: 0 }}>Array of machine config objects · each machine deployed independently</p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={closeAIPrompt} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Cancel</button>
                    <button
                      onClick={handleAIGenerate}
                      disabled={isAIGenerating || !aiPromptText.trim()}
                      style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: 'linear-gradient(to right, #8b5cf6, #38bdf8)', color: '#fff', cursor: (isAIGenerating || !aiPromptText.trim()) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', opacity: (isAIGenerating || !aiPromptText.trim()) ? 0.5 : 1 }}
                    >
                      {isAIGenerating ? <><Loader2 size={15} className="spin" /> Deploying...</> : <><Wand2 size={15} /> Deploy Blueprint</>}
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      )}
      {/* ── Full-Control Add Machine Modal ── */}
      {showAddModal && (
        <div className="add-machine-modal-overlay">
          <div className="add-machine-modal">
            <div className="add-machine-header">
              <div className="add-machine-icon"><Cpu color="white" size={20} /></div>
              <div><h3 className="add-machine-title">Configure New Machine</h3><p className="add-machine-subtitle">Set initial sensor values, zone, and operating parameters</p></div>
            </div>

            {/* Type + Zone + Label */}
            <div className="add-machine-form-grid">
              <div>
                <label className="add-machine-label">Machine Type</label>
                <SearchableDropdown
                  options={Object.keys(SENSOR_DEFAULTS).map(t => ({ value: t, label: t }))}
                  value={machineConfig.type}
                  onChange={val => {
                    setMachineConfig(c => {
                      if (c.type === val) return c; // Avoid resetting sensors if type hasn't changed
                      return {
                        ...c,
                        type: val,
                        sensors: { ...(SENSOR_DEFAULTS[val] || {}) }
                      };
                    });
                  }}
                  placeholder="Type or select type..."
                  inputStyle={{
                    padding: '10px 30px 10px 14px',
                    fontSize: '14px',
                    color: '#f8fafc',
                    border: '1px solid rgba(56, 189, 248, 0.2)'
                  }}
                />
              </div>
              <div>
                <label className="add-machine-label">Zone</label>
                <SearchableDropdown
                  options={zonesList.map(z => ({ value: z, label: z }))}
                  value={machineConfig.zone}
                  onChange={val => setMachineConfig(c => {
                    if (c.zone === val) return c; // Avoid resetting if zone hasn't changed
                    return { ...c, zone: val };
                  })}
                  placeholder="Type or select zone..."
                  inputStyle={{
                    padding: '10px 30px 10px 14px',
                    fontSize: '14px',
                    color: '#f8fafc',
                    border: '1px solid rgba(56, 189, 248, 0.2)'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="add-machine-label">Label (optional)</label>
              <input value={machineConfig.label} onChange={e => setMachineConfig(c => ({ ...c, label: e.target.value }))} placeholder={`e.g. Cooling Pump #1`} className="add-machine-input" />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="add-machine-label">Load Factor: {(machineConfig.loadFactor * 100).toFixed(0)}%</label>
              <input type="range" min="0.1" max="1.0" step="0.05" value={machineConfig.loadFactor} onChange={e => setMachineConfig(c => ({ ...c, loadFactor: parseFloat(e.target.value) }))} style={{ width: '100%', accentColor: '#38bdf8' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569' }}><span>Idle (10%)</span><span>Full Load (100%)</span></div>
            </div>

            {/* Sensor controls */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="add-machine-label" style={{ marginBottom: '1rem' }}>Initial Sensor Values</label>
              <div className="add-machine-form-grid">
                {Object.entries(machineConfig.sensors).map(([key, val]) => (
                  <div key={key}>
                    <label style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>{key.replace(/_/g, ' ')}</label>
                    <input
                      type="number"
                      value={val}
                      step={key.includes('error') ? '0.001' : key.includes('vibration') ? '0.1' : '1'}
                      onChange={e => setMachineConfig(c => ({ ...c, sensors: { ...c.sensors, [key]: parseFloat(e.target.value) || 0 } }))}
                      className="add-machine-input"
                      style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddModal(false)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleConfirmAddMachine} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'linear-gradient(to right, #38bdf8, #8b5cf6)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Plus size={16} /> Deploy Machine</button>
            </div>
          </div>
        </div>
      )}

      {showStopConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(2, 6, 23, 0.85)',
          backdropFilter: 'blur(16px) saturate(180%)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.5), inset 0 0 32px rgba(239, 68, 68, 0.05)',
            borderRadius: '20px',
            width: '460px',
            padding: '2rem',
            color: '#f8fafc',
            transform: 'scale(1)',
            animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)'
              }}>
                <Power color="#ef4444" size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '0.5px', color: '#f8fafc' }}>
                  CONFIRM OPERATIONS HALT
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Critical Action Required
                </p>
              </div>
            </div>

            <div style={{
              background: 'rgba(2, 6, 23, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
              fontSize: '13px',
              lineHeight: '1.6',
              color: '#94a3b8'
            }}>
              Are you sure you want to <strong style={{ color: '#ef4444' }}>STOP</strong> the industrial factory simulation? 
              <br /><br />
              This will immediately halt all physics updates, conveyor belts, pressure waves, cooling tower fans, and Bayesian GNN real-time anomaly inference pipelines across all 4 production zones.
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowStopConfirm(false)} 
                style={{ 
                  padding: '10px 20px', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(255, 255, 255, 0.1)', 
                  background: 'rgba(30, 41, 59, 0.3)', 
                  color: '#94a3b8', 
                  cursor: 'pointer', 
                  fontSize: '13px', 
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmStopSim} 
                style={{ 
                  padding: '10px 20px', 
                  borderRadius: '8px', 
                  border: 'none', 
                  background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', 
                  color: '#fff', 
                  cursor: 'pointer', 
                  fontSize: '13px', 
                  fontWeight: 700, 
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                  transition: 'all 0.2s'
                }}
              >
                Halt Plant Operations
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmConfig && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '30px', maxWidth: '440px', width: '90%', textAlign: 'center', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#f8fafc', fontWeight: 700, letterSpacing: '-0.5px' }}>{confirmConfig.title}</h3>
            
            <div style={{
              marginBottom: '1.5rem',
              fontSize: '13px',
              lineHeight: '1.6',
              color: '#94a3b8'
            }}>
              {confirmConfig.message}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => {
                  if (confirmConfig.onCancel) confirmConfig.onCancel();
                  setConfirmConfig(null);
                }} 
                style={{ 
                  padding: '10px 20px', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(255, 255, 255, 0.1)', 
                  background: 'rgba(30, 41, 59, 0.3)', 
                  color: '#94a3b8', 
                  cursor: 'pointer', 
                  fontSize: '13px', 
                  fontWeight: 600,
                  transition: 'all 0.2s',
                  minWidth: '100px'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (confirmConfig.onConfirm) confirmConfig.onConfirm();
                  setConfirmConfig(null);
                }} 
                style={{ 
                  padding: '10px 20px', 
                  borderRadius: '8px', 
                  border: 'none', 
                  background: confirmConfig.title.toLowerCase().includes('delete') ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #38bdf8 0%, #0369a1 100%)', 
                  color: '#fff', 
                  cursor: 'pointer', 
                  fontSize: '13px', 
                  fontWeight: 700, 
                  boxShadow: confirmConfig.title.toLowerCase().includes('delete') ? '0 4px 14px rgba(239, 68, 68, 0.3)' : '0 4px 14px rgba(56, 189, 248, 0.3)',
                  transition: 'all 0.2s',
                  minWidth: '100px'
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}