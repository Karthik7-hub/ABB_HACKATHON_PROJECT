import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X, Power, RotateCcw, Activity, AlertTriangle, CheckCircle2, Thermometer, Gauge, Radio, Maximize, Minimize, Upload, Lock, Unlock, Save, Grid, ZoomIn, ZoomOut, Eye, Settings, Image as ImageIcon, Copy, Trash2, Plus } from 'lucide-react';
import { formatMetric, toNumber, getStatusTone } from '../../utils/helpers';
import SearchableDropdown from '../SearchableDropdown';
import './FloorPlan.css';

const CANVAS_W = 1150;
const CANVAS_H = 680;

const MAP_MODES = [
  { key: 'risk', label: 'Risk Command', layout: 'ecosystem', icon: Activity, description: 'Live anomaly detection overlay' },
  { key: 'flow', label: 'Flow Network', layout: 'flow', icon: Grid, description: 'Topology and physical connections' },
  { key: 'systems', label: 'Zone Control', layout: 'zones', icon: Settings, description: 'Categorized machine clusters' },
];

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

const DEFAULT_ZONES = {
  A: { name: 'Cooling Zone', color: '#38bdf8', status: 'normal', x: 24, y: 24, width: 535, height: 300 },
  B: { name: 'High Heat Zone', color: '#ef4444', status: 'normal', x: 591, y: 24, width: 535, height: 300 },
  C: { name: 'Robotics Zone', color: '#8b5cf6', status: 'normal', x: 24, y: 356, width: 535, height: 300 },
  D: { name: 'Hydraulic Zone', color: '#f59e0b', status: 'normal', x: 591, y: 356, width: 535, height: 300 },
};

export default function FloorPlan({
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
  mapWorkspace = {},
  onMapWorkspaceChange,
  onMapBackgroundUpload,
  onSaveLayout,
  onNodeMove,
  onNodeSettingChange,
  onMachineCommand,
  onDuplicateMachine,
  hasUnsavedChanges,
  lastSavedTimestamp,
  onNodeZoneChange,
  onCustomConfirm,
}) {
  const containerRef = useRef(null);
  
  // PAN & ZOOM STATES
  const zoom = clamp(toNumber(mapWorkspace.zoom, 1.0), 0.3, 3.0);
  const panX = toNumber(mapWorkspace.panX, 0);
  const panY = toNumber(mapWorkspace.panY, 0);

  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [draggedZoneId, setDraggedZoneId] = useState(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [nodeStartPos, setNodeStartPos] = useState({ x: 0, y: 0 });
  const [zoneStartPos, setZoneStartPos] = useState({ x: 0, y: 0 });
  const [nodeStartZone, setNodeStartZone] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [newConnTarget, setNewConnTarget] = useState('');
  
  const zoomRef = useRef(zoom);
  const panRef = useRef({ x: panX, y: panY });

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = { x: panX, y: panY }; }, [panX, panY]);

  const clampPan = (newX, newY, currentZoom) => {
      const container = containerRef.current;
      if (!container) return { x: newX, y: newY };
      const viewportW = container.clientWidth;
      const viewportH = container.clientHeight;
      const contentW = CANVAS_W * currentZoom;
      const contentH = CANVAS_H * currentZoom;
      const padding = 60;
      const maxX = Math.max(0, (contentW - viewportW) / 2 + padding);
      const maxY = Math.max(0, (contentH - viewportH) / 2 + padding);
      return {
          x: Math.max(-maxX, Math.min(maxX, newX)),
          y: Math.max(-maxY, Math.min(maxY, newY))
      };
  };

  useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleWheel = (e) => {
          if (e.ctrlKey) {
              e.preventDefault();
              const zoomDirection = e.deltaY > 0 ? -1 : 1;
              const zoomStep = Math.abs(e.deltaY) < 50 ? 0.05 : 0.1;
              const newZoom = clamp(zoomRef.current + (zoomDirection * zoomStep), 0.3, 3.0);
              const { x, y } = clampPan(panRef.current.x, panRef.current.y, newZoom);
              onMapWorkspaceChange({ zoom: newZoom, panX: x, panY: y });
          } else {
              const currentPan = panRef.current;
              const targetX = currentPan.x - e.deltaX;
              const targetY = currentPan.y - e.deltaY;
              const clampedPan = clampPan(targetX, targetY, zoomRef.current);
              if (clampedPan.x !== currentPan.x || clampedPan.y !== currentPan.y) {
                  e.preventDefault();
                  onMapWorkspaceChange({ panX: clampedPan.x, panY: clampedPan.y });
              }
          }
      };

      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
  }, [onMapWorkspaceChange]);

  const getNumericPos = (machineId) => {
      const calculated = positions[machineId];
      if (!calculated) return { x: 0, y: 0 };
      
      let x = calculated.x;
      let y = calculated.y;
      
      if (typeof x === 'string') {
          if (x.includes('calc')) {
              const match = x.match(/([+-]?\d+)px/);
              const offset = match ? parseFloat(match[1]) : 0;
              x = CANVAS_W / 2 + offset;
          } else {
              x = parseFloat(x) || 0;
          }
      }
      
      if (typeof y === 'string') {
          if (y.includes('calc')) {
              const match = y.match(/([+-]?\d+)px/);
              const offset = match ? parseFloat(match[1]) : 0;
              y = CANVAS_H / 2 + offset;
          } else {
              y = parseFloat(y) || 0;
          }
      }
      
      return { x, y };
  };

  const getZoneAtCoords = (x, y) => {
      const zonesObj = mapWorkspace.zones || DEFAULT_ZONES;
      const centerX = x + 90;
      const centerY = y + 67.5;

      for (const [key, custom] of Object.entries(zonesObj)) {
          const zX = custom.x !== undefined ? custom.x : (key === 'A' || key === 'C' ? 24 : 591);
          const zY = custom.y !== undefined ? custom.y : (key === 'A' || key === 'B' ? 24 : 356);
          const zW = custom.width !== undefined ? custom.width : 535;
          const zH = custom.height !== undefined ? custom.height : 300;

          if (centerX >= zX && centerX <= zX + zW && centerY >= zY && centerY <= zY + zH) {
              return custom.name;
          }
      }
      return null;
  };

  const handleMouseDown = (e) => {
      if (e.target.closest('.machine-node') || e.target.closest('.no-pan') || e.target.closest('.zone-cell')) return;
      setSelectedNodeId(null);
      setSelectedZoneId(null);
      setIsPanning(true);
  };
  
  const handleMouseMove = (e) => {
      if (draggedNodeId) {
          const deltaX = (e.clientX - dragStartPos.x) / zoom;
          const deltaY = (e.clientY - dragStartPos.y) / zoom;
          onNodeMove(draggedNodeId, { 
              x: nodeStartPos.x + deltaX, 
              y: nodeStartPos.y + deltaY 
          });
          return;
      }

      if (draggedZoneId) {
          const deltaX = (e.clientX - dragStartPos.x) / zoom;
          const deltaY = (e.clientY - dragStartPos.y) / zoom;
          const currentZones = mapWorkspace.zones || DEFAULT_ZONES;
          const newZones = {
              ...currentZones,
              [draggedZoneId]: {
                  ...(currentZones[draggedZoneId] || {}),
                  x: zoneStartPos.x + deltaX,
                  y: zoneStartPos.y + deltaY
              }
          };
          onMapWorkspaceChange({ zones: newZones });
          return;
      }
      
      if (!isPanning) return;
      const { x, y } = clampPan(panRef.current.x + e.movementX, panRef.current.y + e.movementY, zoomRef.current);
      onMapWorkspaceChange({ panX: x, panY: y });
  };
  
  const handleMouseUp = () => {
      if (draggedNodeId) {
          const currentPos = nodeSettings[draggedNodeId] || { x: nodeStartPos.x, y: nodeStartPos.y };
          const finalZone = getZoneAtCoords(currentPos.x, currentPos.y);
          if (finalZone && nodeStartZone && finalZone !== nodeStartZone) {
              const reassignZone = () => {
                  if (onNodeZoneChange) {
                      onNodeZoneChange(draggedNodeId, finalZone);
                  }
              };
              const revertPos = () => {
                  onNodeMove(draggedNodeId, nodeStartPos);
              };

              if (onCustomConfirm) {
                  onCustomConfirm(
                      `Are you sure you want to reassign ${draggedNodeId} from "${nodeStartZone}" to "${finalZone}"?`,
                      reassignZone,
                      "Reassign Zone",
                      revertPos
                  );
              } else {
                  if (window.confirm(`Are you sure you want to reassign ${draggedNodeId} from "${nodeStartZone}" to "${finalZone}"?`)) {
                      reassignZone();
                  } else {
                      revertPos();
                  }
              }
          }
          setDraggedNodeId(null);
          setNodeStartZone(null);
      }
      if (draggedZoneId) {
          setDraggedZoneId(null);
      }
      setIsPanning(false);
  };

  const activeMode = MAP_MODES.find(m => m.key === mapLayer) || MAP_MODES[0];
  const gridVisible = mapWorkspace.gridVisible !== false;
  const layoutLocked = Boolean(mapWorkspace.layoutLocked);

  const showRisk = mapWorkspace.showRisk !== false;
  const showFlow = mapWorkspace.showFlow !== false;
  const showZones = mapWorkspace.showZones !== false;
  const zonesLocked = Boolean(mapWorkspace.zonesLocked);

  const getZoneLetter = (zoneName) => {
      const zonesObj = mapWorkspace.zones || DEFAULT_ZONES;
      const keys = Object.keys(zonesObj);
      if (!zoneName) return keys[0] || 'Z01';
      const lower = zoneName.toLowerCase().trim();
      for (const [key, custom] of Object.entries(zonesObj)) {
          if (key.toLowerCase() === lower || (custom.name && custom.name.toLowerCase().trim() === lower)) {
              return key;
          }
      }
      // Distribute across zones by hashing the name
      let hash = 0;
      for (let i = 0; i < lower.length; i++) hash = ((hash << 5) - hash + lower.charCodeAt(i)) | 0;
      return keys[Math.abs(hash) % keys.length] || keys[0];
  };

  // Default positions inside zone quadrants if no custom positions exist
  const positions = useMemo(() => {
      const pos = {};
      
      // Determine which layout to show based on layer toggles
      let layoutMode = 'zones';
      if (showZones) {
          layoutMode = 'zones';
      } else if (showFlow) {
          layoutMode = 'flow';
      } else if (showRisk) {
          layoutMode = 'ecosystem';
      }

      const zonesObj = mapWorkspace.zones || DEFAULT_ZONES;

      // Group telemetry nodes dynamically by all available zones
      const zoneGroups = {};
      Object.keys(zonesObj).forEach(k => {
          zoneGroups[k] = [];
      });
      
      telemetry.forEach(machine => {
          const meta = metaRegistry[machine.id] || {};
          const zoneKey = getZoneLetter(meta.zone || machine.zone);
          if (!zoneGroups[zoneKey]) {
              zoneGroups[zoneKey] = [];
          }
          zoneGroups[zoneKey].push(machine);
      });
      
      telemetry.forEach((machine, index) => {
          const meta = metaRegistry[machine.id] || {};
          const custom = nodeSettings[machine.id] || {};
          
          if (custom.x !== undefined && custom.y !== undefined && !isNaN(custom.x) && !isNaN(custom.y)) {
              pos[machine.id] = { x: Number(custom.x), y: Number(custom.y) };
          } else {
              let x = 0, y = 0;
              if (layoutMode === 'ecosystem') {
                  const severity = toNumber(machine.severity_score);
                  const radius = 280 - (severity / 100) * 280;
                  const angle = (index * (360 / Math.max(telemetry.length, 1))) * (Math.PI / 180);
                  x = CANVAS_W / 2 + radius * Math.cos(angle) - 90;
                  y = CANVAS_H / 2 + radius * Math.sin(angle) - 67.5;
                  pos[machine.id] = { x, y };
              }
              else if (layoutMode === 'flow') {
                  if (meta.type === 'Pump') { x = 60; y = 80 + (index * 130); }
                  else if (meta.type === 'Valve') { x = 340; y = 80 + (index * 130); }
                  else if (meta.type === 'Compressor') { x = 620; y = 80 + (index * 130); }
                  else { x = 900; y = 80 + (index * 130); }
                  pos[machine.id] = { x, y };
              }
              else {
                  const zoneKey = getZoneLetter(meta.zone || machine.zone);
                  const zoneMachines = zoneGroups[zoneKey] || [];
                  const zoneIndex = zoneMachines.findIndex(m => m.id === machine.id);
                  
                  const customZone = zonesObj[zoneKey] || {};
                  
                  const defaultOrigins = { 
                      A: { x: 24, y: 24, w: 535, h: 300 }, 
                      B: { x: 591, y: 24, w: 535, h: 300 }, 
                      C: { x: 24, y: 356, w: 535, h: 300 }, 
                      D: { x: 591, y: 356, w: 535, h: 300 } 
                  };
                  const defaultBound = defaultOrigins[zoneKey] || defaultOrigins['D'] || { x: 24, y: 24, w: 300, h: 200 };
                  
                  const zX = customZone.x !== undefined ? customZone.x : defaultBound.x;
                  const zY = customZone.y !== undefined ? customZone.y : defaultBound.y;
                  const zW = customZone.width !== undefined ? customZone.width : defaultBound.w;
                  const zH = customZone.height !== undefined ? customZone.height : defaultBound.h;
                  
                  const ZONE_W = zW, ZONE_H = zH, NODE_W = 180, NODE_H = 135, TITLE_OFFSET = 60;
                  
                  const COLS = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(zoneMachines.length))));
                  const col = zoneIndex % COLS;
                  const row = Math.floor(zoneIndex / COLS);
                  const totalCols = Math.min(COLS, zoneMachines.length);
                  const totalRows = Math.ceil(zoneMachines.length / COLS);
                  
                  const startX = zX + 16, endX = zX + ZONE_W - 16 - NODE_W;
                  const availableW = Math.max(0, endX - startX);
                  const startY = zY + TITLE_OFFSET, endY = zY + ZONE_H - 16 - NODE_H;
                  const availableH = Math.max(0, endY - startY);
                  
                  const defaultX = startX + (totalCols > 1 ? col * (availableW / (totalCols - 1)) : availableW / 2);
                  const defaultY = startY + (totalRows > 1 ? row * (availableH / (totalRows - 1)) : availableH / 2);
                  
                  pos[machine.id] = { x: defaultX, y: defaultY };
              }
          }
      });
      return pos;
  }, [telemetry, metaRegistry, nodeSettings, showZones, showFlow, showRisk, mapWorkspace.zones]);

  const selectedNode = telemetry.find(m => m.id === selectedNodeId);
  const selectedMeta = selectedNode ? metaRegistry[selectedNode.id] || {} : null;

  return (
      <div 
        ref={containerRef} 
        className={`map-container ${isFullscreen ? 'fullscreen' : ''}`} 
        style={{ 
            position: isFullscreen ? 'fixed' : 'relative', 
            width: '100%', 
            height: isFullscreen ? '100vh' : '750px', 
            backgroundColor: '#020617', 
            borderRadius: isFullscreen ? '0px' : '16px', 
            overflow: 'hidden', 
            border: isFullscreen ? 'none' : '1px solid rgba(56,189,248,0.2)', 
            boxShadow: 'inset 0 0 100px rgba(0,0,0,0.5)',
            zIndex: isFullscreen ? 99999 : 'auto'
        }}
        onMouseDown={handleMouseDown} 
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} 
        onMouseLeave={handleMouseUp}
      >

          {/* TOP HUD */}
          <div className="no-pan" style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', right: '1.5rem', zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'none', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                  <div style={{ pointerEvents: 'auto', marginBottom: '8px' }}>
                    <p style={{ color: '#38bdf8', fontSize: '10px', fontWeight: 800, margin: '0 0 4px 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>DIGITAL TWIN COMMAND</p>
                    <h3 style={{ color: '#f8fafc', margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>Nexus Command Canvas</h3>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)', padding: '6px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)', pointerEvents: 'auto', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)' }}>
                      <button className={`map-mode-btn mode-risk ${showRisk ? 'active' : ''}`} onClick={() => onMapWorkspaceChange({ showRisk: !showRisk })}>
                        <Activity size={14} /> Risk Command
                      </button>
                      <button className={`map-mode-btn mode-flow ${showFlow ? 'active' : ''}`} onClick={() => onMapWorkspaceChange({ showFlow: !showFlow })}>
                        <Grid size={14} /> Flow Network
                      </button>
                      <button className={`map-mode-btn mode-zone ${showZones ? 'active' : ''}`} onClick={() => onMapWorkspaceChange({ showZones: !showZones })}>
                        <Settings size={14} /> Zone Control
                      </button>
                  </div>
              </div>
              
              {role === 'engineer' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', pointerEvents: 'auto', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)', padding: '6px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' }}>
                  {/* Persistent, fixed-size Sync Status Badge to prevent layout shifts */}
                  <span style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '6px', 
                      fontSize: '10px', 
                      color: hasUnsavedChanges ? '#f59e0b' : '#10b981', 
                      backgroundColor: hasUnsavedChanges ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)', 
                      padding: '6px 10px', 
                      borderRadius: '8px', 
                      border: hasUnsavedChanges ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(16,185,129,0.2)', 
                      fontWeight: 700,
                      height: '32px',
                      boxSizing: 'border-box',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      transition: 'all 0.3s ease'
                  }}>
                    <span className={hasUnsavedChanges ? "dot-pulse" : ""} style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        backgroundColor: hasUnsavedChanges ? '#f59e0b' : '#10b981', 
                        boxShadow: hasUnsavedChanges ? '0 0 8px #f59e0b' : '0 0 8px #10b981', 
                        display: 'inline-block',
                        transition: 'all 0.3s ease'
                    }} />
                    {hasUnsavedChanges ? 'Unsaved' : 'Synced'}
                  </span>

                  {/* Persistent Last Saved Timestamp badge */}
                  <span style={{ 
                      fontSize: '10px', 
                      color: '#94a3b8', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      whiteSpace: 'nowrap',
                      height: '32px',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                      backgroundColor: 'rgba(30, 41, 59, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      transition: 'all 0.3s ease'
                  }}>
                    Saved: {lastSavedTimestamp ? new Date(lastSavedTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Initial'}
                  </span>

                  <label className="map-option-btn" title="Upload Background Map" style={{ width: '36px', height: '32px', padding: 0, justifyContent: 'center', boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}>
                    <Upload size={14} />
                    <input type="file" accept="image/*" onChange={onMapBackgroundUpload} style={{ display: 'none' }} />
                  </label>
                  <button className={`map-option-btn ${layoutLocked ? 'active' : ''}`} onClick={() => onMapWorkspaceChange({ layoutLocked: !layoutLocked })} title={layoutLocked ? "Unlock Node Positions" : "Lock Node Positions"} style={{ width: '36px', height: '32px', padding: 0, justifyContent: 'center', boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}>
                    {layoutLocked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                  <button className={`map-option-btn ${zonesLocked ? 'active' : ''}`} onClick={() => onMapWorkspaceChange({ zonesLocked: !zonesLocked })} title={zonesLocked ? "Unlock Zones" : "Lock Zones"} style={{ width: '36px', height: '32px', padding: 0, justifyContent: 'center', boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}>
                    {zonesLocked ? <Lock size={14} color="#8b5cf6" /> : <Unlock size={14} color="#a78bfa" />}
                  </button>
                  <button className={`map-option-btn ${gridVisible ? 'active' : ''}`} onClick={() => onMapWorkspaceChange({ gridVisible: !gridVisible })} title="Toggle Grid Overlay" style={{ width: '36px', height: '32px', padding: 0, justifyContent: 'center', boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}>
                    <Grid size={14} />
                  </button>
                  <button 
                        className="map-option-btn" 
                        onClick={() => {
                            const currentZones = { ...(mapWorkspace.zones || DEFAULT_ZONES) };
                            let nextKey = 'A';
                            for (let i = 0; i < 26; i++) {
                                const char = String.fromCharCode(65 + i);
                                if (!currentZones[char]) {
                                    nextKey = char;
                                    break;
                                }
                            }
                            if (currentZones[nextKey]) {
                                nextKey = `Z_${Date.now()}`;
                            }
                            currentZones[nextKey] = {
                                name: `Zone ${nextKey}`,
                                color: '#10b981',
                                status: 'normal',
                                x: 100,
                                y: 100,
                                width: 400,
                                height: 250,
                                locked: false
                            };
                            onMapWorkspaceChange({ zones: currentZones });
                            setSelectedZoneId(nextKey);
                        }} 
                        style={{ height: '32px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '11px', fontWeight: 700 }}
                        title="Add New Workspace Zone"
                      >
                        <Plus size={14} /> Add Zone
                      </button>
                  <button className="map-option-btn save-btn" onClick={onSaveLayout} style={{ height: '32px', boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}>
                    <Save size={14} /> Save Layout
                  </button>
                </div>
              )}
          </div>

          {/* BOTTOM HUD */}
          <div className="no-pan" style={{ position: 'absolute', bottom: '1.5rem', right: '1.5rem', zIndex: 50, display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)', padding: '6px 14px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)', pointerEvents: 'auto' }}>
              <span style={{ color: '#94a3b8', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}><Eye size={12} /> Scale</span>
              <button onClick={() => onMapWorkspaceChange({ zoom: zoom - 0.1 })} style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)', color: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', transition: 'all 0.2s' }} title="Zoom Out"><ZoomOut size={13} /></button>
              <span style={{ color: '#f8fafc', fontSize: '12px', fontWeight: 700, minWidth: '42px', textAlign: 'center', fontFamily: 'monospace' }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => onMapWorkspaceChange({ zoom: zoom + 0.1 })} style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)', color: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', transition: 'all 0.2s' }} title="Zoom In"><ZoomIn size={13} /></button>
              <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
              <button onClick={() => { onMapWorkspaceChange({ zoom: 1.0, panX: 0, panY: 0 }); }} style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', color: '#38bdf8', cursor: 'pointer', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recenter</button>
              <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
              <button onClick={() => setIsFullscreen(!isFullscreen)} style={{ background: 'none', border: 'none', color: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                  {isFullscreen ? <Minimize size={14} color="#38bdf8" /> : <Maximize size={14} />}
              </button>
          </div>

          {/* MAP CANVAS */}
          <div style={{
              position: 'absolute',
              left: '50%', top: '50%',
              width: `${CANVAS_W}px`, height: `${CANVAS_H}px`,
              marginLeft: `-${CANVAS_W / 2}px`,
              marginTop: `-${CANVAS_H / 2}px`,
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: 'center center',
              cursor: isPanning ? 'grabbing' : 'grab'
          }}>
              {/* Background Image */}
              {mapWorkspace.backgroundUrl && (
                  <div style={{
                      position: 'absolute', inset: 0,
                      backgroundImage: `url(${mapWorkspace.backgroundUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      opacity: 0.6,
                      pointerEvents: 'none'
                  }} />
              )}

              {/* Grid */}
              {gridVisible && (
                  <div style={{
                      position: 'absolute', inset: 0, pointerEvents: 'none',
                      backgroundImage: `linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px)`,
                      backgroundSize: `30px 30px`
                  }} />
              )}

              {/* Layout Specific Backdrops */}
              {showZones && (() => {
                  const zonesObj = mapWorkspace.zones || DEFAULT_ZONES;
                  
                  return Object.entries(zonesObj).map(([key, custom]) => {
                      const name = custom.name || `Zone ${key}`;
                      const color = custom.color || '#38bdf8';
                      const zX = custom.x !== undefined ? custom.x : (key === 'A' || key === 'C' ? 24 : 591);
                      const zY = custom.y !== undefined ? custom.y : (key === 'A' || key === 'B' ? 24 : 356);
                      const zW = custom.width !== undefined ? custom.width : 535;
                      const zH = custom.height !== undefined ? custom.height : 300;
                      
                      const isDraggable = role === 'engineer' && !layoutLocked && !zonesLocked && !custom.locked;
                      
                      // Calculate active machines in this zone
                      const zoneMachines = telemetry.filter(m => {
                          const meta = metaRegistry[m.id] || {};
                          return getZoneLetter(meta.zone) === key;
                      });

                      let zoneColor = color;
                      let bgOpacity = mapWorkspace.backgroundUrl ? 0.02 : 0.05;
                      let glowColor = color;
                      let borderDash = 'solid';
                      let glowIntensity = 8;

                      if (zoneMachines.length > 0) {
                          const activeMachines = zoneMachines.filter(m => !m.isShutdown);
                          const totalActive = activeMachines.length;
                          
                          const avgTemp = totalActive ? activeMachines.reduce((sum, m) => sum + (m.temperature || 0), 0) / totalActive : 0;
                          const avgVib = totalActive ? activeMachines.reduce((sum, m) => sum + (m.vibration || 0), 0) / totalActive : 0;
                          const avgRisk = totalActive ? activeMachines.reduce((sum, m) => sum + toNumber(m.severity_score), 0) / totalActive : 0;
                          
                          const criticalCount = zoneMachines.filter(m => m.ai_status === 'Critical' && !m.isShutdown).length;
                          const warningCount = zoneMachines.filter(m => m.ai_status === 'Warning' && !m.isShutdown).length;
                          const anomalyDensity = zoneMachines.length ? (criticalCount + warningCount) / zoneMachines.length : 0;

                          if (criticalCount > 0 || avgRisk > 60) {
                              zoneColor = '#ef4444'; // Red alert glow
                              bgOpacity = mapWorkspace.backgroundUrl ? 0.05 : 0.10;
                              glowColor = '#ef4444';
                              glowIntensity = 16;
                          } else if (avgTemp > 85) {
                              zoneColor = '#f97316'; // High heat orange alert
                              bgOpacity = mapWorkspace.backgroundUrl ? 0.04 : 0.08;
                              glowColor = '#f97316';
                              glowIntensity = 12;
                          } else if (avgVib > 4.0) {
                              zoneColor = '#a855f7'; // Purple vibration instability
                              bgOpacity = mapWorkspace.backgroundUrl ? 0.04 : 0.08;
                              glowColor = '#c084fc';
                              glowIntensity = 12;
                          } else if (name.toLowerCase().includes('cool') && avgTemp < 45) {
                              zoneColor = '#38bdf8'; // Blue cooling efficiency
                              bgOpacity = mapWorkspace.backgroundUrl ? 0.03 : 0.06;
                              glowColor = '#06b6d4';
                              glowIntensity = 10;
                          }

                          if (anomalyDensity > 0) {
                              borderDash = 'dashed';
                          }
                      }
                      
                      const isSelected = selectedZoneId === key;

                      return (
                          <div 
                            key={key} 
                            className={`zone-cell ${isSelected ? 'active-zone' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedZoneId(key);
                                setSelectedNodeId(null);
                            }}
                            style={{ 
                                position: 'absolute',
                                left: `${zX}px`,
                                top: `${zY}px`,
                                width: `${zW}px`,
                                height: `${zH}px`,
                                border: isSelected ? `2.5px solid ${color}` : `1.5px ${borderDash} ${zoneColor}50`, 
                                borderRadius: '12px', 
                                backgroundColor: isSelected ? `${color}15` : `${glowColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`, 
                                boxShadow: isSelected ? `inset 0 0 20px ${color}35, 0 0 16px ${color}25` : `inset 0 0 ${glowIntensity}px ${glowColor}15, 0 0 ${glowIntensity / 2}px ${glowColor}08`,
                                backdropFilter: 'blur(1px)',
                                cursor: isDraggable ? 'move' : 'pointer',
                                pointerEvents: 'auto',
                                transition: 'border-color 0.3s, background-color 0.3s, box-shadow 0.3s',
                                zIndex: isSelected ? 8 : 4
                            }}
                            onMouseDown={(e) => {
                                if (!isDraggable || e.target.closest('.no-drag')) return;
                                setDraggedZoneId(key);
                                setDragStartPos({ x: e.clientX, y: e.clientY });
                                setZoneStartPos({ x: zX, y: zY });
                                e.stopPropagation();
                            }}
                          >
                              {/* Zone Tag / Header */}
                              <div className="no-drag" style={{ 
                                  position: 'absolute', 
                                  top: '1.25rem', 
                                  left: '1.25rem', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '8px',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  background: 'rgba(15, 23, 42, 0.9)',
                                  border: `1px solid ${color}44`,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                  userSelect: 'none'
                              }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                                  <span style={{ color: color, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{name}</span>
                              </div>

                              {/* Resize Handle (NWSE) */}
                              {isDraggable && (
                                  <div 
                                      className="no-drag"
                                      style={{
                                          position: 'absolute',
                                          bottom: '8px',
                                          right: '8px',
                                          width: '18px',
                                          height: '18px',
                                          cursor: 'nwse-resize',
                                          display: 'flex',
                                          alignItems: 'flex-end',
                                          justifyContent: 'flex-end',
                                          zIndex: 30,
                                          padding: '2px'
                                      }}
                                      onMouseDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          const startX = e.clientX;
                                          const startY = e.clientY;
                                          const currentW = zW;
                                          const currentH = zH;
                                          
                                          const handleMouseMoveZoneResize = (moveEvent) => {
                                              const deltaX = (moveEvent.clientX - startX) / zoom;
                                              const deltaY = (moveEvent.clientY - startY) / zoom;
                                              const newW = Math.max(150, Math.min(1000, currentW + deltaX));
                                              const newH = Math.max(100, Math.min(800, currentH + deltaY));
                                              
                                              const updatedZones = {
                                                  ...zonesObj,
                                                  [key]: {
                                                      ...(zonesObj[key] || {}),
                                                      width: newW,
                                                      height: newH
                                                  }
                                              };
                                              onMapWorkspaceChange({ zones: updatedZones });
                                          };
                                          
                                          const handleMouseUpZoneResize = () => {
                                              document.removeEventListener('mousemove', handleMouseMoveZoneResize);
                                              document.removeEventListener('mouseup', handleMouseUpZoneResize);
                                              if (onSaveLayout) onSaveLayout();
                                          };
                                          
                                          document.addEventListener('mousemove', handleMouseMoveZoneResize);
                                          document.addEventListener('mouseup', handleMouseUpZoneResize);
                                      }}
                                  >
                                      <svg width="10" height="10" viewBox="0 0 10 10" style={{ stroke: color, strokeWidth: 1.5, opacity: 0.7 }}>
                                          <line x1="8" y1="0" x2="8" y2="8" />
                                          <line x1="0" y1="8" x2="8" y2="8" />
                                          <line x1="5" y1="3" x2="5" y2="5" />
                                          <line x1="3" y1="5" x2="5" y2="5" />
                                      </svg>
                                  </div>
                              )}
                          </div>
                      );
                  });
              })()}



              {!showZones && !showFlow && showRisk && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                      <div style={{ border: '1px dashed rgba(239, 68, 68, 0.4)', width: '200px', height: '200px', borderRadius: '50%', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}></div>
                      <div style={{ border: '1px dashed rgba(245, 158, 11, 0.4)', width: '400px', height: '400px', borderRadius: '50%', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(245, 158, 11, 0.02)' }}></div>
                      <div style={{ border: '1px dashed rgba(16, 185, 129, 0.4)', width: '600px', height: '600px', borderRadius: '50%', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(16, 185, 129, 0.02)' }}></div>
                  </div>
              )}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1, overflow: 'visible' }}>
                  <defs>
                    <marker id="flow-arrow-temp" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M0,0 L10,4 L0,8 L2,4 Z" fill="rgba(239, 68, 68, 0.8)" />
                    </marker>
                    <marker id="flow-arrow-pressure" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M0,0 L10,4 L0,8 L2,4 Z" fill="rgba(56, 189, 248, 0.8)" />
                    </marker>
                    <marker id="flow-arrow-vib" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M0,0 L10,4 L0,8 L2,4 Z" fill="rgba(168, 85, 247, 0.8)" />
                    </marker>
                    <marker id="flow-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M0,0 L10,4 L0,8 L2,4 Z" fill="rgba(56, 189, 248, 0.8)" />
                    </marker>
                  </defs>

                  {showFlow && (() => {
                      const connections = (mapWorkspace.connections && Object.keys(mapWorkspace.connections).length > 0)
                          ? mapWorkspace.connections
                          : {};
                      
                      const lines = [];
                      Object.entries(connections).forEach(([sourceId, targets]) => {
                          const sourcePos = positions[sourceId];
                          if (!sourcePos || !targets || !Array.isArray(targets)) return;
                          
                          const sourceSettings = nodeSettings[sourceId] || {};
                          const sourceSizeMult = sourceSettings.size === 'small' ? 0.7 : sourceSettings.size === 'large' ? 1.3 : 1;
                          const sourceW = sourceSettings.width || (180 * sourceSizeMult);
                          const sourceH = sourceSettings.height || 135;

                          const x1_raw = parseFloat(sourcePos.x) + (sourceW / 2);
                          const y1_raw = parseFloat(sourcePos.y) + (sourceH / 2);
                          if (isNaN(x1_raw) || isNaN(y1_raw)) return;

                          targets.forEach(targetConn => {
                              // Support both new object format and old string format
                              const targetId = typeof targetConn === 'object' ? targetConn.target : targetConn;
                              const connType = typeof targetConn === 'object' ? targetConn.type : 'PRESSURE';
                              const connWeight = typeof targetConn === 'object' ? (targetConn.weight || 0.5) : 0.5;

                              const targetPos = positions[targetId];
                              if (!targetPos) return;

                              const targetSettings = nodeSettings[targetId] || {};
                              const targetSizeMult = targetSettings.size === 'small' ? 0.7 : targetSettings.size === 'large' ? 1.3 : 1;
                              const targetW = targetSettings.width || (180 * targetSizeMult);
                              const targetH = targetSettings.height || 135;

                              const x2_raw = parseFloat(targetPos.x) + (targetW / 2);
                              const y2_raw = parseFloat(targetPos.y) + (targetH / 2);
                              if (isNaN(x2_raw) || isNaN(y2_raw)) return;

                              const dx_raw = x2_raw - x1_raw;
                              const dy_raw = y2_raw - y1_raw;
                              const dist_raw = Math.sqrt(dx_raw * dx_raw + dy_raw * dy_raw);
                              if (dist_raw < 5) return;

                              const cos = dx_raw / dist_raw;
                              const sin = dy_raw / dist_raw;

                              // Adjust starting point to boundary of source node
                              let startOffset = 0;
                              if (Math.abs(sin * sourceW) > Math.abs(cos * sourceH)) {
                                  startOffset = Math.abs((sourceH / 2) / sin);
                              } else {
                                  startOffset = Math.abs((sourceW / 2) / cos);
                              }
                              const x1 = x1_raw + (startOffset + 4) * cos;
                              const y1 = y1_raw + (startOffset + 4) * sin;

                              // Adjust target point to boundary of target node
                              let targetOffset = 0;
                              if (Math.abs(sin * targetW) > Math.abs(cos * targetH)) {
                                  targetOffset = Math.abs((targetH / 2) / sin);
                              } else {
                                  targetOffset = Math.abs((targetW / 2) / cos);
                              }
                              // Offset back so marker orient/arrowhead is fully visible and doesn't clip
                              const x2 = x2_raw - (targetOffset + 12) * cos;
                              const y2 = y2_raw - (targetOffset + 12) * sin;

                              const dx = x2 - x1;
                              const dy = y2 - y1;
                              const dist = Math.sqrt(dx * dx + dy * dy);
                              if (dist < 5) return;

                              // Curved path with bezier control points
                              const curvature = Math.min(dist * 0.2, 50);
                              const mx = (x1 + x2) / 2;
                              const my = (y1 + y2) / 2;
                              const nx = -dy / dist * curvature;
                              const ny = dx / dist * curvature;
                              const cx1 = mx + nx * 0.5;
                              const cy1 = my + ny * 0.5;
                              
                              const pathD = `M${x1},${y1} Q${cx1},${cy1} ${x2},${y2}`;

                              let edgeColor = 'rgba(56, 189, 248, 0.7)'; // Default fluid
                              let markerId = 'url(#flow-arrow-fluid)';
                              if (connType === 'TEMPERATURE') {
                                  edgeColor = 'rgba(239, 68, 68, 0.7)';
                                  markerId = 'url(#flow-arrow-temp)';
                              } else if (connType === 'VIBRATION') {
                                  edgeColor = 'rgba(168, 85, 247, 0.7)';
                                  markerId = 'url(#flow-arrow-vib)';
                              }

                              const strokeWidth = 1 + (connWeight * 3);
                              const animSpeed = 3 - (connWeight * 2);

                              lines.push(
                                  <g 
                                      key={`flow-link-${sourceId}-${targetId}`} 
                                      className="edge-group"
                                      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                                      onMouseEnter={(e) => {
                                          setHoveredEdge({
                                              sourceId,
                                              targetId,
                                              type: connType,
                                              weight: connWeight,
                                              x: e.clientX,
                                              y: e.clientY
                                          });
                                      }}
                                      onMouseMove={(e) => {
                                          setHoveredEdge(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                                      }}
                                      onMouseLeave={() => {
                                          setHoveredEdge(null);
                                      }}
                                  >
                                      {/* Wide transparent hover target */}
                                      <path 
                                          d={pathD}
                                          fill="none"
                                          stroke="transparent"
                                          strokeWidth={20}
                                          style={{ cursor: 'pointer' }}
                                      />
                                      {/* Background glow */}
                                      <path 
                                          d={pathD}
                                          fill="none"
                                          stroke={edgeColor.replace('0.7', '0.15')} 
                                          strokeWidth={strokeWidth * 3} 
                                          strokeLinecap="round"
                                      />
                                      {/* Main edge */}
                                      <path 
                                          d={pathD}
                                          fill="none"
                                          stroke={edgeColor.replace('0.7', '0.4')} 
                                          strokeWidth={strokeWidth} 
                                          strokeLinecap="round"
                                          markerEnd={markerId}
                                      />
                                      {/* Animated flow particles */}
                                      <path 
                                          d={pathD}
                                          fill="none"
                                          stroke={edgeColor} 
                                          strokeWidth={strokeWidth} 
                                          strokeDasharray="6 12" 
                                          strokeLinecap="round"
                                          style={{ animation: `led-flow ${animSpeed}s linear infinite` }} 
                                      />
                                  </g>
                              );
                          });
                      });
                      return lines;
                  })()}

                  {/* Physics Proximity Lines Removed */}
              </svg>

              {/* Machine Nodes */}
              {telemetry.map(machine => {
                  const pos = positions[machine.id]; 
                  const meta = metaRegistry[machine.id] || {};
                  const isOffline = machine.isShutdown;
                  const isWarning = machine.ai_status === 'Warning' || machine.ai_status === 'Critical';
                  const statusColor = isOffline ? '#64748b' : machine.ai_status === 'Critical' ? '#ef4444' : machine.ai_status === 'Warning' ? '#f59e0b' : '#10b981';
                  const isSelected = selectedNodeId === machine.id;
                  
                  // In engineer mode, allow dragging if not locked
                  const settings = nodeSettings[machine.id] || {};
                  const isLocked = layoutLocked || settings.locked;
                  const canDrag = role === 'engineer' && !isLocked;
                  
                  // Scaling
                  const sizeMultiplier = settings.size === 'small' ? 0.7 : settings.size === 'large' ? 1.3 : 1;
                  const nodeW = settings.width || (180 * sizeMultiplier);
                  const nodeH = settings.height || 135;
                  const widthStr = `${nodeW}px`;
                  const heightStr = settings.height ? `${nodeH}px` : 'auto';
                  
                  // Compute dynamic font scale: standard node size is 180w x 135h
                  const scaleW = nodeW / 180;
                  const scaleH = nodeH / 135;
                  const contentScale = Math.max(0.6, Math.min(1.2, Math.min(scaleW, scaleH)));

                  if (!pos) return null;
                  
                  return (
                      <div
                          key={machine.id} 
                          className="machine-node"
                          onClick={() => {
                              setSelectedZoneId(null);
                              if (role === 'engineer') {
                                  setSelectedNodeId(machine.id);
                              } else {
                                  onNodeClick(machine.id);
                              }
                          }}
                          onMouseDown={(e) => {
                              if (!canDrag) return;
                              if (e.target.closest('button') || e.target.closest('.no-pan')) return;
                              e.stopPropagation();
                              e.preventDefault();
                              
                              const numPos = getNumericPos(machine.id);
                              setDraggedNodeId(machine.id);
                              setDragStartPos({ x: e.clientX, y: e.clientY });
                              setNodeStartPos({ x: numPos.x, y: numPos.y });
                              const currentZone = meta.zone || 'Cooling Zone';
                              setNodeStartZone(currentZone);
                          }}
                          style={{ 
                              position: 'absolute', 
                              left: pos.x, top: pos.y, 
                              width: widthStr, 
                              height: heightStr,
                              display: 'flex',
                              flexDirection: 'column',
                              backgroundColor: 'rgba(15, 23, 42, 0.9)',
                              backdropFilter: 'blur(4px)',
                               border: `1px solid ${isSelected ? '#38bdf8' : (showRisk ? statusColor : '#475569')}`, 
                              borderRadius: '12px', 
                              cursor: canDrag ? 'move' : 'pointer', 
                              boxShadow: isSelected ? '0 0 0 2px rgba(56,189,248,0.5)' : (showRisk && isWarning && !isOffline ? `0 10px 15px -3px rgba(0,0,0,0.5), 0 0 20px ${statusColor}40` : '0 10px 15px -3px rgba(0,0,0,0.5)'), 
                              zIndex: isSelected ? 20 : 5, 
                              transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s, width 0.1s, height 0.1s' 
                          }}
                      >
                          {showRisk && isWarning && !isOffline && (
                              <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '16px', height: '16px' }}>
                                <span style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: statusColor, borderRadius: '50%', opacity: 0.7, animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }}></span>
                                <span style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: statusColor, borderRadius: '50%' }}></span>
                              </div>
                          )}
                          
                          <div style={{ padding: `${Math.round(12 * contentScale)}px`, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: `${Math.round(4 * contentScale)}px`, gap: '8px' }}>
                                  <p style={{ color: '#f8fafc', fontSize: `${Math.round(14 * contentScale)}px`, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={meta.shortLabel || machine.id}>{meta.shortLabel || machine.id}</p>
                                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                      {isOffline 
                                          ? <Power size={Math.max(10, Math.round(14 * contentScale))} color="#ef4444" /> 
                                          : (showRisk 
                                              ? (isWarning 
                                                  ? <AlertTriangle size={Math.max(10, Math.round(14 * contentScale))} color={statusColor} /> 
                                                  : <CheckCircle2 size={Math.max(10, Math.round(14 * contentScale))} color={statusColor} />)
                                              : <CheckCircle2 size={Math.max(10, Math.round(14 * contentScale))} color="#64748b" />)}
                                  </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                <p style={{ color: '#64748b', fontSize: `${Math.max(8, Math.round(10 * contentScale))}px`, textTransform: 'uppercase', margin: 0, fontWeight: 700, letterSpacing: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.type}</p>
                                {role === 'engineer' && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); onNodeSettingChange(machine.id, { locked: !settings.locked }); }}
                                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: settings.locked ? '#ef4444' : '#64748b', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                                    >
                                      {settings.locked ? <Lock size={Math.max(8, Math.round(12 * contentScale))} /> : <Unlock size={Math.max(8, Math.round(12 * contentScale))} />}
                                    </button>
                                  )}
                              </div>
                          </div>
                          <div style={{ padding: `${Math.round(10 * contentScale)}px ${Math.round(12 * contentScale)}px`, display: 'flex', flexDirection: 'column', gap: `${Math.round(6 * contentScale)}px`, backgroundColor: 'rgba(0,0,0,0.2)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', pointerEvents: 'none', flexGrow: 1, justifyContent: 'center', overflow: 'hidden' }}>
                              {(() => {
                                  const metricConfigs = {
                                      Motor: [
                                          { icon: Thermometer, label: 'Temp', key: 'temperature', unit: '°C', precision: 0 },
                                          { icon: RotateCcw, label: 'RPM', key: 'rpm', unit: ' rpm', precision: 0 },
                                          { icon: Activity, label: 'Curr', key: 'current', unit: 'A', precision: 1 }
                                      ],
                                      Reactor: [
                                          { icon: Thermometer, label: 'Temp', key: 'temperature', unit: '°C', precision: 0 },
                                          { icon: Gauge, label: 'Press', key: 'pressure', unit: ' bar', precision: 0 },
                                          { icon: Activity, label: 'Lvl', key: 'coolant_level', unit: '%', precision: 0 }
                                      ],
                                      Chiller: [
                                          { icon: Thermometer, label: 'Temp', key: 'temperature', unit: '°C', precision: 0 },
                                          { icon: Activity, label: 'Flow', key: 'flow_rate', unit: ' L/s', precision: 0 },
                                          { icon: Power, label: 'Pwr', key: 'power_kw', unit: ' kW', precision: 0 }
                                      ],
                                      default: [
                                          { icon: Thermometer, label: 'Temp', key: 'temperature', unit: '°C', precision: 0 },
                                          { icon: Gauge, label: 'Press', key: 'pressure', unit: ' bar', precision: 0 },
                                          { icon: Radio, label: 'Vib', key: 'vibration', unit: ' mm/s', precision: 1 }
                                      ]
                                  };
                                  const renderMetrics = metricConfigs[meta.type] || metricConfigs.default;
                                  return renderMetrics.map(config => {
                                      const IconComponent = config.icon;
                                      const isAnomaly = machine.anomaly_source === config.key;
                                      return (
                                          <div key={config.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${Math.max(9, Math.round(11 * contentScale))}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                  <IconComponent size={Math.max(8, Math.round(12 * contentScale))} /> {config.label}
                                              </span>
                                              <span style={{ color: isAnomaly ? statusColor : '#f8fafc', fontWeight: isAnomaly ? 700 : 400 }}>
                                                  {formatMetric(machine[config.key], config.precision)}{config.unit}
                                              </span>
                                          </div>
                                      );
                                  });
                              })()}
                          </div>
                          
                          {/* Corner Resize Handle */}
                          {canDrag && (
                              <div 
                                  className="no-pan"
                                  style={{
                                      position: 'absolute',
                                      bottom: '2px',
                                      right: '2px',
                                      width: '14px',
                                      height: '14px',
                                      cursor: 'nwse-resize',
                                      display: 'flex',
                                      alignItems: 'flex-end',
                                      justifyContent: 'flex-end',
                                      zIndex: 30
                                  }}
                                  onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      const startX = e.clientX;
                                      const startY = e.clientY;
                                      const currentW = settings.width || (180 * sizeMultiplier);
                                      const currentH = e.currentTarget.closest('.machine-node').offsetHeight;
                                      
                                      const handleMouseMoveResize = (moveEvent) => {
                                          const deltaX = (moveEvent.clientX - startX) / zoom;
                                          const deltaY = (moveEvent.clientY - startY) / zoom;
                                          const newWidth = Math.max(120, Math.min(400, currentW + deltaX));
                                          const newHeight = Math.max(100, Math.min(300, currentH + deltaY));
                                          onNodeSettingChange(machine.id, { width: newWidth, height: newHeight });
                                      };
                                      
                                      const handleMouseUpResize = () => {
                                          document.removeEventListener('mousemove', handleMouseMoveResize);
                                          document.removeEventListener('mouseup', handleMouseUpResize);
                                      };
                                      
                                      document.addEventListener('mousemove', handleMouseMoveResize);
                                      document.addEventListener('mouseup', handleMouseUpResize);
                                  }}
                              >
                                  <svg width="8" height="8" viewBox="0 0 8 8" style={{ stroke: statusColor, strokeWidth: 1.5, opacity: 0.7 }}>
                                      <line x1="6" y1="0" x2="6" y2="6" />
                                      <line x1="0" y1="6" x2="6" y2="6" />
                                      <line x1="4" y1="2" x2="4" y2="4" />
                                      <line x1="2" y1="4" x2="4" y2="4" />
                                  </svg>
                              </div>
                          )}
                          
                          {/* Severity Bar (from Rishi's design) */}
                          {showRisk && !isOffline && machine.ai_status !== 'Normal' && (
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', overflow: 'hidden' }}>
                                  <div style={{ width: `${toNumber(machine.severity_score)}%`, height: '100%', backgroundColor: statusColor, transition: 'width 0.3s' }} />
                              </div>
                          )}
                      </div>
                  );
              })}
          </div>

          {/* ENGINEER NODE STUDIO */}
          {selectedNodeId && selectedNode && (
              <div className="no-pan" style={{ position: 'absolute', top: '5.5rem', right: '1.5rem', width: '320px', backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '12px', padding: '1.5rem', zIndex: 50, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', pointerEvents: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                      <div><p style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 700, letterSpacing: '1px', margin: '0 0 4px 0' }}>ENGINEER NODE STUDIO</p><h3 style={{ fontSize: '20px', color: '#f8fafc', margin: 0 }}>{selectedMeta?.shortLabel || selectedNodeId}</h3></div>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedNodeId(null); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}><X size={20} /></button>
                  </div>
                  
                  {role === 'engineer' && (
                    <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
                        Display Label
                        <input 
                          type="text" 
                          value={selectedMeta?.shortLabel || ''} 
                          onChange={(e) => onNodeSettingChange(selectedNodeId, { shortLabel: e.target.value })}
                          className="hmi-input-text" 
                        />
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(30, 41, 59, 0.4)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#38bdf8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Topology Connections</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <SearchableDropdown
                              options={telemetry.filter(m => m.id !== selectedNodeId).map(m => ({
                                value: m.id,
                                label: metaRegistry[m.id]?.shortLabel ? `${metaRegistry[m.id].shortLabel} (${m.id})` : m.id
                              }))}
                              value={newConnTarget}
                              onChange={(val) => setNewConnTarget(val)}
                              placeholder="Type or select target asset..."
                            />
                          </div>
                          
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <select id="new-conn-type" defaultValue="PRESSURE" style={{ flex: 1, padding: '8px', background: '#0f172a', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', color: '#e2e8f0', fontSize: '11px', outline: 'none', appearance: 'none', WebkitAppearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2338bdf8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px top 50%', backgroundSize: '10px auto' }}>
                              <option value="PRESSURE" style={{ color: '#e2e8f0' }}>Pressure Link</option>
                              <option value="TEMPERATURE" style={{ color: '#e2e8f0' }}>Thermal Link</option>
                              <option value="VIBRATION" style={{ color: '#e2e8f0' }}>Vibration Link</option>
                            </select>
                            <input id="new-conn-weight" type="number" defaultValue="0.8" step="0.1" min="0.1" max="1.0" style={{ width: '54px', padding: '8px', background: '#0f172a', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', color: '#f8fafc', fontSize: '11px', textAlign: 'center', outline: 'none' }} />
                            <button onClick={() => {
                              const yEl = document.getElementById('new-conn-type');
                              const wEl = document.getElementById('new-conn-weight');
                              const targetId = newConnTarget;
                              if (targetId) {
                                  const currentTargets = mapWorkspace.connections?.[selectedNodeId] || [];
                                  if (!currentTargets.find(c => (c.target || c) === targetId && (c.type || 'PRESSURE') === yEl.value)) {
                                      const newConnections = {
                                          ...mapWorkspace.connections,
                                          [selectedNodeId]: [...currentTargets, { target: targetId, type: yEl.value, weight: parseFloat(wEl.value) }]
                                      };
                                      onMapWorkspaceChange({ connections: newConnections });
                                      setNewConnTarget('');
                                  } else {
                                      alert("A link of this type already exists to this asset.");
                                  }
                              }
                            }} style={{ background: 'linear-gradient(to right, #38bdf8, #0ea5e9)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(56, 189, 248, 0.3)' }}>Add Link</button>
                          </div>
                        </div>
                        
                        {mapWorkspace.connections?.[selectedNodeId]?.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', maxHeight: '140px', overflowY: 'auto', paddingRight: '4px', scrollbarWidth: 'thin' }}>
                            {mapWorkspace.connections[selectedNodeId].map((conn, idx) => {
                              const targetId = typeof conn === 'object' ? conn.target : conn;
                              const connType = typeof conn === 'object' ? conn.type : 'PRESSURE';
                              const connWeight = typeof conn === 'object' ? conn.weight : 0.5;
                              return (
                              <div 
                                key={idx} 
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between',
                                  background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.6) 100%)', 
                                  border: '1px solid rgba(255,255,255,0.08)', 
                                  padding: '8px 12px', 
                                  borderRadius: '8px', 
                                  fontSize: '11px', 
                                  color: '#e2e8f0',
                                  transition: 'all 0.2s',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ 
                                    width: '24px', 
                                    height: '24px', 
                                    borderRadius: '6px', 
                                    background: connType === 'TEMPERATURE' ? 'rgba(239, 68, 68, 0.15)' : connType === 'VIBRATION' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                    color: connType === 'TEMPERATURE' ? '#ef4444' : connType === 'VIBRATION' ? '#8b5cf6' : '#38bdf8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold'
                                  }}>
                                    <Activity size={12} />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 600, color: '#f8fafc', letterSpacing: '0.5px' }}>{metaRegistry[targetId]?.shortLabel || targetId}</span>
                                    <span style={{ color: '#94a3b8', fontSize: '9px', fontWeight: 500 }}>{connType} • w:{connWeight}</span>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => {
                                    const newTargets = (mapWorkspace.connections[selectedNodeId] || []).filter(c => !((c.target || c) === targetId && (c.type || 'PRESSURE') === connType));
                                    const newConnections = { ...mapWorkspace.connections };
                                    if (newTargets.length === 0) {
                                      delete newConnections[selectedNodeId];
                                    } else {
                                      newConnections[selectedNodeId] = newTargets;
                                    }
                                    onMapWorkspaceChange({ connections: newConnections });
                                  }}
                                  style={{ 
                                    background: 'rgba(239, 68, 68, 0.1)', 
                                    border: '1px solid rgba(239, 68, 68, 0.2)', 
                                    color: '#ef4444', 
                                    cursor: 'pointer', 
                                    width: '24px', 
                                    height: '24px', 
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )})}
                          </div>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '10px', fontStyle: 'italic', textAlign: 'center', marginTop: '4px' }}>No active target connections.</span>
                        )}
                      </div>
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', userSelect: 'none' }}>
                        <span>Lock Position</span>
                        <div 
                          onClick={() => onNodeSettingChange(selectedNodeId, { locked: !Boolean(nodeSettings[selectedNodeId]?.locked) })}
                          style={{
                            width: '40px',
                            height: '22px',
                            borderRadius: '11px',
                            backgroundColor: nodeSettings[selectedNodeId]?.locked ? '#ef4444' : '#1e293b',
                            border: '1px solid rgba(255,255,255,0.15)',
                            position: 'relative',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
                          }}
                        >
                          <div style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: '#fff',
                            position: 'absolute',
                            top: '2px',
                            left: nodeSettings[selectedNodeId]?.locked ? '20px' : '2px',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                          }} />
                        </div>
                      </label>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button onClick={() => onNodeClick(selectedNodeId)} style={{ flex: 1, padding: '10px', backgroundColor: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}><Activity size={14} /> Full Diagnose</button>
                    {role === 'engineer' && (
                        <button onClick={() => onDuplicateMachine(selectedNodeId)} style={{ padding: '10px', backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}><Copy size={14} /> Duplicate</button>
                    )}
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                    <button onClick={() => onMachineCommand(selectedNodeId, selectedNode.isShutdown ? 'restart' : 'shutdown')} style={{ width: '100%', padding: '12px', backgroundColor: selectedNode.isShutdown ? '#10b981' : '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                      {selectedNode.isShutdown ? <><RotateCcw size={16} /> Restart Machine</> : <><Power size={16} /> Shut Down</>}
                    </button>
                  </div>
              </div>
          )}


          {/* Zone Control Sidebar (Zone Editor Studio) */}
          {selectedZoneId && (mapWorkspace.zones || DEFAULT_ZONES)[selectedZoneId] && (
              <div className="no-pan animate-fade-in" style={{
                  position: 'absolute',
                  top: '5.5rem',
                  right: '1.5rem',
                  width: '320px',
                  backgroundColor: 'rgba(10, 15, 30, 0.95)',
                  backdropFilter: 'blur(16px) saturate(180%)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(56,189,248,0.05)',
                  color: '#f8fafc',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxSizing: 'border-box'
              }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: (mapWorkspace.zones || DEFAULT_ZONES)[selectedZoneId].color || '#38bdf8' }} />
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.5px' }}>Zone {selectedZoneId} Studio</h4>
                      </div>
                      <button onClick={() => setSelectedZoneId(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Zone Name</label>
                      <input 
                          type="text" 
                          value={(mapWorkspace.zones || DEFAULT_ZONES)[selectedZoneId].name || ''} 
                          onChange={(e) => {
                              const currentZones = { ...(mapWorkspace.zones || DEFAULT_ZONES) };
                              currentZones[selectedZoneId] = {
                                  ...currentZones[selectedZoneId],
                                  name: e.target.value
                              };
                              onMapWorkspaceChange({ zones: currentZones });
                          }}
                          placeholder="Enter zone name" 
                          style={{
                              backgroundColor: '#070c19',
                              border: '1px solid rgba(56,189,248,0.2)',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              color: '#f8fafc',
                              fontSize: '13px',
                              outline: 'none',
                              width: '100%',
                              boxSizing: 'border-box'
                          }} 
                      />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Theme Color</label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {['#38bdf8', '#ef4444', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899'].map(color => {
                              const isSelected = (mapWorkspace.zones || DEFAULT_ZONES)[selectedZoneId].color === color;
                              return (
                                  <button
                                      key={color}
                                      onClick={() => {
                                          const currentZones = { ...(mapWorkspace.zones || DEFAULT_ZONES) };
                                          currentZones[selectedZoneId] = {
                                              ...currentZones[selectedZoneId],
                                              color
                                          };
                                          onMapWorkspaceChange({ zones: currentZones });
                                      }}
                                      style={{
                                          width: '26px',
                                          height: '26px',
                                          borderRadius: '50%',
                                          backgroundColor: color,
                                          border: isSelected ? '2px solid #fff' : '2px solid transparent',
                                          boxShadow: isSelected ? `0 0 10px ${color}` : 'none',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                          padding: 0
                                      }}
                                  />
                              );
                          })}
                      </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Zone Controls</label>
                      <button
                          onClick={() => {
                              const currentZones = { ...(mapWorkspace.zones || DEFAULT_ZONES) };
                              currentZones[selectedZoneId] = {
                                  ...currentZones[selectedZoneId],
                                  locked: !currentZones[selectedZoneId].locked
                              };
                              onMapWorkspaceChange({ zones: currentZones });
                          }}
                          style={{
                              padding: '8px 12px',
                              backgroundColor: (mapWorkspace.zones || DEFAULT_ZONES)[selectedZoneId].locked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                              border: `1px solid ${(mapWorkspace.zones || DEFAULT_ZONES)[selectedZoneId].locked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)'}`,
                              color: (mapWorkspace.zones || DEFAULT_ZONES)[selectedZoneId].locked ? '#ef4444' : '#38bdf8',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              transition: 'all 0.2s'
                          }}
                      >
                          {(mapWorkspace.zones || DEFAULT_ZONES)[selectedZoneId].locked ? <Lock size={14} /> : <Unlock size={14} />}
                          {(mapWorkspace.zones || DEFAULT_ZONES)[selectedZoneId].locked ? 'Unlock Zone Position' : 'Lock Zone Position'}
                      </button>
                  </div>

                  {role === 'engineer' && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                          <button
                           onClick={() => {
                               const doDelete = () => {
                                   const currentZones = { ...(mapWorkspace.zones || DEFAULT_ZONES) };
                                   delete currentZones[selectedZoneId];
                                   onMapWorkspaceChange({ zones: currentZones });
                                   setSelectedZoneId(null);
                               };

                               if (onCustomConfirm) {
                                   onCustomConfirm(
                                       `Are you sure you want to delete Zone "${mapWorkspace.zones?.[selectedZoneId]?.name || selectedZoneId}"?`,
                                       doDelete,
                                       "Delete Zone"
                                   );
                               } else {
                                   if (window.confirm(`Are you sure you want to delete Zone ${selectedZoneId}?`)) {
                                       doDelete();
                                   }
                               }
                           }}
                              style={{
                                  width: '100%',
                                  padding: '10px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  color: '#ef4444',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  display: 'flex',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  gap: '6px',
                                  transition: 'all 0.2s'
                              }}
                          >
                              <Trash2 size={13} /> Delete Zone
                          </button>
                      </div>
                  )}
              </div>
          )}


          {/* Edge Diagnostic Hover Panel */}
          {hoveredEdge && (() => {
              const sourceNode = telemetry.find(m => m.id === hoveredEdge.sourceId);
              const targetNode = telemetry.find(m => m.id === hoveredEdge.targetId);
              
              // Compute dynamic risk cascade propagation factor
              const sourceRisk = sourceNode ? toNumber(sourceNode.severity_score) : 0;
              const cascadeRisk = (sourceRisk * hoveredEdge.weight).toFixed(1);
              
              const borderColors = {
                  TEMPERATURE: '#ef4444',
                  PRESSURE: '#38bdf8',
                  VIBRATION: '#a855f7'
              };
              const borderColor = borderColors[hoveredEdge.type] || '#38bdf8';

              return (
                  <div style={{
                      position: 'fixed',
                      left: hoveredEdge.x + 15,
                      top: hoveredEdge.y + 15,
                      width: '280px',
                      backgroundColor: 'rgba(10, 15, 30, 0.95)',
                      backdropFilter: 'blur(8px)',
                      border: `1.5px solid ${borderColor}`,
                      borderRadius: '12px',
                      padding: '12px 14px',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.4)',
                      color: '#f8fafc',
                      fontSize: '12px',
                      zIndex: 100000,
                      pointerEvents: 'none',
                      fontFamily: 'system-ui, sans-serif'
                  }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
                          <span style={{ color: borderColor, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>
                              {hoveredEdge.type} LINK
                          </span>
                          <span style={{ color: '#64748b', fontSize: '10px', fontFamily: 'monospace' }}>active flow</span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                          <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 600 }}>{hoveredEdge.sourceId}</div>
                          <span style={{ color: borderColor }}>➔</span>
                          <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 600, textAlign: 'right' }}>{hoveredEdge.targetId}</div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#94a3b8' }}>Dynamic Flow Weight:</span>
                              <span style={{ fontWeight: 700, color: borderColor }}>{(hoveredEdge.weight * 100).toFixed(0)}% ({hoveredEdge.weight.toFixed(2)})</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#94a3b8' }}>Source Severity Score:</span>
                              <span style={{ fontWeight: 700, color: sourceRisk > 70 ? '#ef4444' : sourceRisk > 40 ? '#f59e0b' : '#10b981' }}>{sourceRisk}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '6px', marginTop: '2px' }}>
                              <span style={{ color: '#94a3b8', fontWeight: 600 }}>Cascade Risk Factor:</span>
                              <span style={{ fontWeight: 800, color: '#f43f5e' }}>{cascadeRisk}%</span>
                          </div>
                      </div>
                  </div>
              );
          })()}

      </div>
  );
}