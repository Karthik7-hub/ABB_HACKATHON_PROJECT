import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Activity, Map as MapIcon, Grid, X, Settings, Power, Search, Filter, ArrowUpDown, Clock3, Eye, Server, Wifi, WifiOff, Plus, Cpu, CircuitBoard, RotateCcw, Trash2, Gauge, Sparkles, Check, ChevronDown, TrendingUp, Wand2, Bot, Loader2, CheckCircle2 } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import './index.css';

import { MACHINE_META, DEFAULT_MACHINE_ORDER, STATUS_WEIGHT, STORAGE_KEY_VIRTUAL_ASSETS, STORAGE_KEY_MAP_NODE_SETTINGS, MACHINE_TYPES } from './utils/constants';

import { resolveBackendUrl, generateVirtualTelemetry, appendTelemetryHistory, getMeta, toNumber, formatTime, createVirtualMachine, resetVirtualMachineState } from './utils/helpers';

import { StatCard } from './components/SharedUI';
import SortableMachineCard from './components/SortableMachineCard';
import FloorPlan from './components/FloorPlan';
import DiagnosticOverlay from './components/DiagnosticOverlay';
import SmartActionCenter from './components/SmartActionCenter';
import ManagerAnalytics from './components/ManagerAnalytics';

function getSavedVirtualMachines() { try { const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY_VIRTUAL_ASSETS) || '[]'); return Array.isArray(saved) ? saved : []; } catch { return []; } }
function saveVirtualMachines(machines) { try { window.localStorage.setItem(STORAGE_KEY_VIRTUAL_ASSETS, JSON.stringify(machines)); } catch { } }
function getSavedMapNodeSettings() { try { const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY_MAP_NODE_SETTINGS) || '{}'); return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}; } catch { return {}; } }
function saveMapNodeSettings(settings) { try { window.localStorage.setItem(STORAGE_KEY_MAP_NODE_SETTINGS, JSON.stringify(settings)); } catch { } }

const BACKEND_URL = resolveBackendUrl();
const socket = io(BACKEND_URL);

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
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [fullscreenGraph, setFullscreenGraph] = useState(null);

  // AI STATES
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState(null); // Holds the summary of what was generated

  useEffect(() => { document.title = 'Nexus Control System'; }, []);
  useEffect(() => { const interval = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(interval); }, []);
  useEffect(() => { saveVirtualMachines(virtualMachines); }, [virtualMachines]);
  useEffect(() => { saveMapNodeSettings(mapNodeSettings); }, [mapNodeSettings]);

  useEffect(() => {
    const pushVirtualTick = () => {
      const next = virtualMachines.map((asset) => {
        const reading = generateVirtualTelemetry(asset);
        if (!virtualShutdowns.has(asset.id)) return reading;
        const profile = MACHINE_TYPES[asset.type] || MACHINE_TYPES.Pump;
        return { ...reading, temperature: profile.baseTemp * 0.48, pressure: Math.max(0.1, profile.basePressure * 0.08), vibration: 0.08, ai_status: 'Normal', severity_score: 2, anomaly_source: 'none', isShutdown: true, copilot: null };
      });
      setVirtualTelemetry(next);
      if (next.length > 0) { setTelemetryHistory((prev) => appendTelemetryHistory(prev, next)); }
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
      setAcknowledged((prev) => {
        let updated = new Set(prev);
        let changed = false;
        data.forEach(m => { if (m.ai_status === 'Normal' && updated.has(m.id)) { updated.delete(m.id); changed = true; } });
        return changed ? updated : prev;
      });
    });
    socket.on('command:ack', (data) => setCommandLog((prev) => [{ ...data, id: `${Date.now()}-${data.machineId}` }, ...prev].slice(0, 7)));
    return () => { socket.off('connect'); socket.off('disconnect'); socket.off('telemetry'); socket.off('command:ack'); };
  }, []);

  const machineMeta = useMemo(() => {
    const simulatedMeta = virtualMachines.reduce((acc, asset) => { acc[asset.id] = asset; return acc; }, {});
    const baseMeta = { ...MACHINE_META, ...simulatedMeta };
    return Object.entries(mapNodeSettings).reduce((acc, [id, settings]) => {
      if (!acc[id] && !getMeta(id, baseMeta)) return acc;
      acc[id] = { ...getMeta(id, baseMeta), ...acc[id], ...settings };
      return acc;
    }, baseMeta);
  }, [mapNodeSettings, virtualMachines]);

  const allTelemetry = useMemo(() => [...telemetry, ...virtualTelemetry], [telemetry, virtualTelemetry]);
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
      const meta = getMeta(id, machineMeta);
      const status = machine.isShutdown ? 'offline' : String(machine.ai_status || 'unknown').toLowerCase();
      const matchesFilter = machineFilter === 'all' || machineFilter === status;
      return matchesFilter && (!query || `${id} ${meta.label} ${meta.type} ${meta.zone} ${meta.criticality} ${machine.ai_status}`.toLowerCase().includes(query));
    });
    if (sortMode === 'severity') filtered.sort((a, b) => toNumber(machineMap[b]?.severity_score) - toNumber(machineMap[a]?.severity_score));
    else if (sortMode === 'status') filtered.sort((a, b) => (STATUS_WEIGHT[machineMap[b]?.isShutdown ? 'Unknown' : machineMap[b]?.ai_status] || 0) - (STATUS_WEIGHT[machineMap[a]?.isShutdown ? 'Unknown' : machineMap[a]?.ai_status] || 0));
    else if (sortMode === 'zone') filtered.sort((a, b) => String(getMeta(a, machineMeta).zone).localeCompare(String(getMeta(b, machineMeta).zone)));
    return filtered;
  }, [machineFilter, machineMap, machineMeta, machineQuery, orderedMachineIds, sortMode]);

  const actionableItems = useMemo(() => allTelemetry.filter((item) => (item.ai_status === 'Warning' || item.ai_status === 'Critical') && !item.isShutdown).sort((a, b) => toNumber(b.severity_score) - toNumber(a.severity_score)), [allTelemetry]);
  const activeAlerts = useMemo(() => actionableItems.filter((item) => !acknowledged.has(item.id)), [acknowledged, actionableItems]);
  const ackAlerts = useMemo(() => actionableItems.filter((item) => acknowledged.has(item.id)), [acknowledged, actionableItems]);

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

  const handleAddVirtualMachine = useCallback(() => {
    if (role !== 'engineer') return;
    const nextAsset = createVirtualMachine(virtualMachines.length, newMachineType);
    setVirtualMachines((prev) => [...prev, nextAsset]);
    setMachineOrder((prev) => [...prev, nextAsset.id]);
    setViewMode('map');
  }, [newMachineType, role, virtualMachines.length]);

  const handleAIGenerate = useCallback(() => {
    if (!aiPromptText.trim()) return;
    setIsAIGenerating(true);

    setTimeout(() => {
      let normalizedText = aiPromptText.toLowerCase();
      const wordMap = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'a': 1, 'an': 1 };
      Object.keys(wordMap).forEach(word => {
        normalizedText = normalizedText.replace(new RegExp(`\\b${word}\\b`, 'g'), wordMap[word]);
      });

      const types = ['pump', 'compressor', 'valve', 'motor'];
      let totalNewAssets = [];

      types.forEach(type => {
        const regex = new RegExp(`(\\d+)\\s+${type}s?`, 'i');
        const match = normalizedText.match(regex);
        if (match) {
          const count = Math.min(parseInt(match[1], 10), 10);
          const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
          for (let i = 0; i < count; i++) { totalNewAssets.push(capitalizedType); }
        }
      });

      if (totalNewAssets.length === 0) {
        types.forEach(type => {
          if (normalizedText.includes(type)) {
            totalNewAssets.push(type.charAt(0).toUpperCase() + type.slice(1));
          }
        });
      }

      if (totalNewAssets.length > 0) {
        setVirtualMachines(prev => {
          let currentLength = prev.length;
          const generated = totalNewAssets.map(type => createVirtualMachine(currentLength++, type));
          setMachineOrder(prevOrder => [...prevOrder, ...generated.map(m => m.id)]);

          // Group for the summary dialog
          const grouped = generated.reduce((acc, curr) => {
            acc[curr.type] = (acc[curr.type] || 0) + 1;
            return acc;
          }, {});

          setAiSummary(grouped); // Trigger summary dialog
          return [...prev, ...generated];
        });
      } else {
        alert("AI couldn't detect a specific machine setup. Try asking: 'Generate 3 pumps and 2 valves'.");
      }
      setIsAIGenerating(false);
    }, 1500);
  }, [aiPromptText]);

  const closeAIPrompt = useCallback(() => {
    setShowAIPrompt(false);
    setAiPromptText('');
    setAiSummary(null);
  }, []);

  const confirmAIDeployment = useCallback(() => {
    closeAIPrompt();
    setViewMode('map');
  }, [closeAIPrompt]);


  const handleRemoveVirtualMachine = useCallback((id) => {
    setVirtualMachines((prev) => prev.filter((a) => a.id !== id));
    setVirtualTelemetry((prev) => prev.filter((m) => m.id !== id));
    setMachineOrder((prev) => prev.filter((m) => m !== id));
    setMapNodeSettings((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setAcknowledged((prev) => { const next = new Set(prev); next.delete(id); return next; });
    if (investigateId === id) setInvestigateId(null);
    if (selectedMapNodeId === id) setSelectedMapNodeId(null);
  }, [investigateId, selectedMapNodeId]);

  const handleResetVirtualMachines = useCallback(() => {
    setVirtualMachines([]); setVirtualTelemetry([]); setVirtualShutdowns(new Set());
    setMachineOrder((prev) => prev.filter((id) => !id.startsWith('SIM_')));
    setMapNodeSettings((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !id.startsWith('SIM_'))));
  }, []);

  const handleMachineCommand = useCallback((machineId, action) => {
    if (machineMap[machineId]?.synthetic) {
      setVirtualShutdowns((prev) => {
        const next = new Set(prev);
        if (action === 'shutdown') {
          next.add(machineId);
        } else {
          next.delete(machineId);
          resetVirtualMachineState(machineId);
        }
        return next;
      });
      setCommandLog((prev) => [{ id: `${Date.now()}-${machineId}`, machineId, action, status: 'executed', timestamp: new Date().toISOString() }, ...prev].slice(0, 7));
      return;
    }
    socket.emit(`command:${action}`, { machineId });
  }, [machineMap]);

  const getStatusClass = useCallback((status) => status === 'Critical' ? 'status-critical' : status === 'Warning' ? 'status-warning' : status === 'Normal' ? 'status-normal' : 'status-neutral', []);

  return (
    <div className="app-container">
      {investigateId && machineMap[investigateId] && (
        <DiagnosticOverlay
          machine={machineMap[investigateId]}
          meta={getMeta(investigateId, machineMeta)}
          history={telemetryHistory[investigateId] || []}
          role={role}
          investigateId={investigateId}
          acknowledged={acknowledged}
          onAcknowledge={handleAcknowledge}
          onCommand={handleMachineCommand}
          onClose={() => history.back()}
          fullscreenGraph={fullscreenGraph}
          setFullscreenGraph={setFullscreenGraph}
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

              <div className="role-switch">
                <button type="button" className={role === 'operator' ? 'active' : ''} onClick={() => setRole('operator')}><Eye size={14} /> Operator</button>
                <button type="button" className={role === 'engineer' ? 'active' : ''} onClick={() => setRole('engineer')}><Settings size={14} /> Engineer</button>
                <button type="button" className={role === 'manager' ? 'active' : ''} onClick={() => setRole('manager')}><TrendingUp size={14} /> Manager</button>
              </div>

              <div className={`status-badge ${connected ? 'status-live' : 'status-disconnected'}`}>
                <div className={`status-dot ${connected ? 'dot-pulse' : ''}`} />
                {connected ? <Wifi size={13} /> : <WifiOff size={13} />}<span>{connected ? 'Live' : 'Offline'}</span>
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

              <div className="control-toolbar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', backgroundColor: 'transparent', border: 'none', padding: 0 }}>
                <label className="search-field" style={{ flex: 1, minWidth: '300px', backgroundColor: '#0f172a', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(56,189,248,0.2)' }}>
                  <Search size={18} color="#94a3b8" />
                  <input value={machineQuery} onChange={(e) => setMachineQuery(e.target.value)} placeholder="Search machine, zone, or type" style={{ fontSize: '15px', color: '#f8fafc' }} />
                </label>

                <label className="select-field" style={{ minWidth: '220px', backgroundColor: '#0f172a', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(56,189,248,0.2)', position: 'relative' }}>
                  <Filter size={16} color="#38bdf8" />
                  <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)} style={{ fontSize: '15px', color: '#f8fafc', fontWeight: 500, width: '100%', appearance: 'none', backgroundColor: 'transparent', border: 'none', colorScheme: 'dark' }}>
                    <option value="all">All statuses</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="normal">Normal</option><option value="offline">Offline</option><option value="unknown">Unknown</option>
                  </select>
                  <ChevronDown size={16} color="#94a3b8" style={{ position: 'absolute', right: '16px', pointerEvents: 'none' }} />
                </label>

                <label className="select-field" style={{ minWidth: '220px', backgroundColor: '#0f172a', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(56,189,248,0.2)', position: 'relative' }}>
                  <ArrowUpDown size={16} color="#38bdf8" />
                  <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} style={{ fontSize: '15px', color: '#f8fafc', fontWeight: 500, width: '100%', appearance: 'none', backgroundColor: 'transparent', border: 'none', colorScheme: 'dark' }}>
                    <option value="layout">Layout order</option><option value="severity">Severity</option><option value="status">Status</option><option value="zone">Zone</option>
                  </select>
                  <ChevronDown size={16} color="#94a3b8" style={{ position: 'absolute', right: '16px', pointerEvents: 'none' }} />
                </label>
              </div>

              {role === 'engineer' && (
                <div className="engineer-console">
                  <div className="engineer-console-main">
                    <div className="engineer-console-icon"><CircuitBoard size={18} /></div>
                    <div><p className="floor-kicker">Engineer Studio</p><h3>Build simulated assets with natural behavior</h3><p>Virtual machines drift, pulse, raise AI alerts, appear on the ecosystem map, and support shutdown/restart flows.</p></div>
                  </div>
                  <div className="engineer-controls" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button type="button" className="premium-action-btn" onClick={() => setShowAddMenu(true)}><Plus size={15} /> Add Machine</button>
                    <button type="button" className="premium-action-btn" onClick={() => setShowAIPrompt(true)} style={{ background: 'linear-gradient(to right, #8b5cf6, #38bdf8)', border: 'none', color: '#fff', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)' }}><Wand2 size={15} /> AI Prompt Builder</button>
                    <button type="button" className="premium-action-btn ghost" onClick={handleResetVirtualMachines} disabled={virtualMachines.length === 0}><RotateCcw size={15} /> Reset Sim</button>
                  </div>
                  {virtualMachines.length > 0 && (
                    <div className="virtual-asset-strip">
                      {virtualMachines.map((asset) => (
                        <button key={asset.id} type="button" className="virtual-chip" onClick={() => handleInvestigate(asset.id)}>
                          <Sparkles size={13} /><span>{asset.id}</span><i>Zone {asset.zone}</i>
                          <span className="virtual-delete" onClick={(e) => { e.stopPropagation(); handleRemoveVirtualMachine(asset.id); }}><Trash2 size={12} /></span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {allTelemetry.length === 0 ? (
                <div className="empty-state"><Activity className="empty-icon pulse" /><p className="empty-title">Waiting for telemetry</p></div>
              ) : filteredMachineIds.length === 0 ? (
                <div className="empty-state"><Search className="empty-icon" /><p className="empty-title">No machines match</p></div>
              ) : viewMode === 'grid' ? (
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={filteredMachineIds} strategy={rectSortingStrategy}>
                    <div className="grid-overview">
                      {filteredMachineIds.map((id) => machineMap[id] && (
                        <SortableMachineCard key={id} id={id} machine={machineMap[id]} role={role} meta={getMeta(id, machineMeta)} isSortable={role === 'engineer' && sortMode === 'layout'} history={telemetryHistory[id]} onInvestigate={handleInvestigate} getStatusClass={getStatusClass} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <FloorPlan telemetry={filteredTelemetry} metaRegistry={machineMeta} onNodeClick={handleInvestigate} mapLayout={mapLayout} setMapLayout={setMapLayout} mapLayer={mapLayer} setMapLayer={setMapLayer} role={role} nodeSettings={mapNodeSettings} selectedNodeId={selectedMapNodeId} setSelectedNodeId={setSelectedMapNodeId} onNodeMove={handleMapNodeMove} onNodeSettingChange={handleMapNodeSettingChange} onResetNode={handleResetMapNode} onMachineCommand={handleMachineCommand} />
              )}
            </section>

            {role === 'manager' ? (
              <section className="pane right-pane">
                <ManagerAnalytics telemetry={allTelemetry} />
              </section>
            ) : (
              <SmartActionCenter
                activeAlerts={activeAlerts}
                ackAlerts={ackAlerts}
                commandLog={commandLog}
                machineMeta={machineMeta}
                showAcknowledged={showAcknowledged}
                setShowAcknowledged={setShowAcknowledged}
                onAcknowledge={handleAcknowledge}
                onAcknowledgeAll={handleAcknowledgeAll}
                onInvestigate={handleInvestigate}
                getStatusClass={getStatusClass}
              />
            )}
          </main>
        </>
      )}

      {showAddMenu && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(56,189,248,0.3)', width: '400px', maxWidth: '90%' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '20px', margin: '0 0 1rem 0' }}>Add Virtual Machine</h3>
            <label style={{ display: 'block', marginBottom: '2rem' }}>
              <span style={{ display: 'block', color: '#cbd5e1', fontSize: '12px', fontWeight: 600, letterSpacing: '1px', marginBottom: '8px' }}>MACHINE TYPE</span>
              <div style={{ position: 'relative' }}>
                <Cpu size={16} color="#38bdf8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <select value={newMachineType} onChange={(e) => setNewMachineType(e.target.value)} style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: '8px', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)', fontSize: '15px', outline: 'none', appearance: 'none', colorScheme: 'dark' }}>
                  {Object.keys(MACHINE_TYPES).map((type) => (<option key={type} value={type}>{type}</option>))}
                </select>
                <ChevronDown size={16} color="#94a3b8" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </label>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddMenu(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Cancel</button>
              <button onClick={() => { handleAddVirtualMachine(); setShowAddMenu(false); }} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#38bdf8', color: '#0f172a', cursor: 'pointer', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={16} /> Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ENHANCED AI GENERATOR MODAL WITH SUMMARY STATE */}
      {showAIPrompt && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '2.5rem', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.4)', width: '600px', maxWidth: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7), 0 0 40px rgba(139,92,246,0.1)' }}>

            {/* Conditional Render: Success Summary vs Input Prompt */}
            {aiSummary ? (
              // --- SUCCESS STATE ---
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                  <CheckCircle2 color="#10b981" size={32} />
                </div>
                <h3 style={{ color: '#f8fafc', fontSize: '24px', margin: '0 0 8px 0', fontWeight: 700 }}>Deployment Successful</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 2rem 0' }}>The AI has auto-configured the following assets and initiated their telemetry engines:</p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                  {Object.entries(aiSummary).map(([type, count]) => (
                    <div key={type} style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Sparkles size={16} color="#38bdf8" />
                      <span style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 700 }}>{count}x</span>
                      <span style={{ color: '#cbd5e1', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>{type}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={confirmAIDeployment}
                  style={{ padding: '14px 32px', borderRadius: '10px', border: 'none', background: 'linear-gradient(to right, #8b5cf6, #38bdf8)', color: '#fff', cursor: 'pointer', fontSize: '15px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 10px 25px -5px rgba(56, 189, 248, 0.4)' }}
                >
                  Deploy to Digital Twin <MapIcon size={16} />
                </button>
              </div>
            ) : (
              // --- INPUT STATE ---
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #8b5cf6, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot color="white" size={24} />
                  </div>
                  <div>
                    <h3 style={{ color: '#f8fafc', fontSize: '20px', margin: 0, fontWeight: 700 }}>AI Auto-Configuration</h3>
                    <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>Type a natural language prompt to instantly build your plant layout.</p>
                  </div>
                </div>

                <div style={{ position: 'relative', marginBottom: '2rem' }}>
                  <textarea
                    value={aiPromptText}
                    onChange={(e) => setAiPromptText(e.target.value)}
                    placeholder="e.g., 'Build me a cooling setup with 3 pumps, 1 compressor, and 2 valves.'"
                    style={{ width: '100%', height: '120px', padding: '16px', borderRadius: '12px', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)', fontSize: '16px', outline: 'none', resize: 'none', lineHeight: 1.5 }}
                    disabled={isAIGenerating}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                    <strong>Supported:</strong> Pump, Compressor, Valve, Motor
                  </p>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={closeAIPrompt} disabled={isAIGenerating} style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                      Cancel
                    </button>
                    <button
                      onClick={handleAIGenerate}
                      disabled={isAIGenerating || !aiPromptText.trim()}
                      style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(to right, #8b5cf6, #38bdf8)', color: '#fff', cursor: isAIGenerating ? 'wait' : 'pointer', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', opacity: (isAIGenerating || !aiPromptText.trim()) ? 0.6 : 1 }}
                    >
                      {isAIGenerating ? (
                        <><Loader2 size={18} className="spin" /> Parsing Configuration...</>
                      ) : (
                        <><Wand2 size={18} /> Generate Machines</>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      )}
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}