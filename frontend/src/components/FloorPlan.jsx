import React, { useMemo, useState } from 'react';
import { X, Power, RotateCcw, Activity, AlertTriangle, CheckCircle2, Thermometer, Gauge, Radio, Info, Maximize, Minimize } from 'lucide-react';
import { formatMetric, toNumber } from '../utils/helpers';

export default function FloorPlan({
    telemetry, metaRegistry, onNodeClick, mapLayout, setMapLayout,
    role, nodeSettings, selectedNodeId, setSelectedNodeId,
    onNodeMove, onMachineCommand
}) {
    // FIX: Added the Fullscreen state!
    const [isFullscreen, setIsFullscreen] = useState(false);

    const positions = useMemo(() => {
        const pos = {};
        telemetry.forEach((machine, index) => {
            const meta = metaRegistry[machine.id] || {};
            const customKey = `${mapLayout}_${machine.id}`;
            const custom = nodeSettings[customKey] || {};

            let x = 0;
            let y = 0;

            if (mapLayout === 'ecosystem') {
                const severity = toNumber(machine.severity_score);
                const radius = 280 - (severity / 100) * 280;
                const angle = (index * (360 / Math.max(telemetry.length, 1))) * (Math.PI / 180);
                x = 450 + radius * Math.cos(angle) - 90;
                y = 350 + radius * Math.sin(angle) - 60;
                pos[machine.id] = { x, y };
            }
            else if (mapLayout === 'zones') {
                if (meta.zone === 'A') { x = 60; y = 160; }
                else if (meta.zone === 'B') { x = 500; y = 160; }
                else if (meta.zone === 'C') { x = 60; y = 480; }
                else { x = 500; y = 480; }
                x += (index % 3) * 190; y += (index % 3) * 40;
                pos[machine.id] = { x: custom.x ?? x, y: custom.y ?? y };
            }
            else if (mapLayout === 'flow') {
                if (meta.type === 'Pump') { x = 50; y = 200 + (index * 60); }
                else if (meta.type === 'Valve') { x = 320; y = 200 + (index * 60); }
                else if (meta.type === 'Compressor') { x = 580; y = 200 + (index * 60); }
                else { x = 820; y = 200 + (index * 60); }
                pos[machine.id] = { x: custom.x ?? x, y: custom.y ?? y };
            }
        });
        return pos;
    }, [telemetry, metaRegistry, mapLayout, nodeSettings]);

    const selectedNode = telemetry.find(m => m.id === selectedNodeId);

    // Dynamic styling to make it pop out of the grid when fullscreen is active
    const containerStyle = isFullscreen ? {
        position: 'fixed', inset: 0, zIndex: 99999,
        backgroundColor: '#020617',
        backgroundImage: `linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px)`,
        backgroundSize: '30px 30px',
        overflow: 'hidden'
    } : {
        position: 'relative', width: '100%', minHeight: '750px',
        backgroundColor: '#020617', borderRadius: '16px', overflow: 'hidden',
        border: '1px solid rgba(56,189,248,0.2)', boxShadow: 'inset 0 0 100px rgba(0,0,0,0.5)',
        backgroundImage: `linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px)`,
        backgroundSize: '30px 30px'
    };

    return (
        <div style={containerStyle}>
            <style>
                {`
                  @keyframes led-flow { 0% { stroke-dashoffset: 24; } 100% { stroke-dashoffset: 0; } }
                  @keyframes ping { 75%, 100% { transform: scale(2.5); opacity: 0; } }
                `}
            </style>

            {/* TOP NAVIGATION BAR - Google Maps style floating header */}
            <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', right: '1.5rem', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>

                {/* Mode Selectors */}
                <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', padding: '6px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', pointerEvents: 'auto' }}>
                    <button onClick={() => setMapLayout('ecosystem')} style={{ padding: '8px 16px', backgroundColor: mapLayout === 'ecosystem' ? 'rgba(56,189,248,0.15)' : 'transparent', color: mapLayout === 'ecosystem' ? '#38bdf8' : '#94a3b8', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>Risk Command</button>
                    <button onClick={() => setMapLayout('flow')} style={{ padding: '8px 16px', backgroundColor: mapLayout === 'flow' ? 'rgba(56,189,248,0.15)' : 'transparent', color: mapLayout === 'flow' ? '#38bdf8' : '#94a3b8', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>Flow Route</button>
                    <button onClick={() => setMapLayout('zones')} style={{ padding: '8px 16px', backgroundColor: mapLayout === 'zones' ? 'rgba(56,189,248,0.15)' : 'transparent', color: mapLayout === 'zones' ? '#38bdf8' : '#94a3b8', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>System Zones</button>
                </div>

                {/* THE NEW FULLSCREEN TOGGLE */}
                <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto',
                        backgroundColor: isFullscreen ? '#ef4444' : 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(8px)',
                        color: isFullscreen ? '#fff' : '#38bdf8',
                        border: isFullscreen ? 'none' : '1px solid rgba(56,189,248,0.3)',
                        padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700,
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)', transition: 'all 0.2s'
                    }}
                >
                    {isFullscreen ? <><Minimize size={18} /> Exit Fullscreen</> : <><Maximize size={18} /> Fullscreen Map</>}
                </button>
            </div>

            {/* MAP LEGEND */}
            <div style={{
                position: 'absolute', bottom: '1.5rem', left: '1.5rem', zIndex: 10,
                backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1rem',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
                <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={12} /> Map Legend
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }} /> Stable Operation</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} /> Warning / Degradation</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} /> Critical / Offline</div>
                </div>
            </div>

            {/* LAYOUT BACKGROUNDS */}
            {mapLayout === 'ecosystem' && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <div style={{ border: '1px dashed rgba(239, 68, 68, 0.4)', width: '180px', height: '180px', borderRadius: '50%', position: 'absolute', left: '450px', top: '350px', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}></div>
                        <div style={{ border: '1px dashed rgba(245, 158, 11, 0.4)', width: '380px', height: '380px', borderRadius: '50%', position: 'absolute', left: '450px', top: '350px', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(245, 158, 11, 0.02)' }}></div>
                        <div style={{ border: '1px dashed rgba(16, 185, 129, 0.4)', width: '560px', height: '560px', borderRadius: '50%', position: 'absolute', left: '450px', top: '350px', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(16, 185, 129, 0.02)' }}></div>
                        <span style={{ position: 'absolute', top: '220px', left: '450px', transform: 'translateX(-50%)', color: '#ef4444', fontSize: '10px', fontWeight: 800, letterSpacing: '2px' }}>CRITICAL ZONE</span>
                    </div>
                </div>
            )}

            {mapLayout === 'zones' && (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '2rem', padding: '6rem 2rem 2rem 2rem', pointerEvents: 'none' }}>
                    {['A', 'B', 'C', 'D'].map(zone => (
                        <div key={zone} style={{ border: '2px solid rgba(56, 189, 248, 0.15)', borderRadius: '16px', backgroundColor: 'rgba(15, 23, 42, 0.4)', position: 'relative' }}>
                            <span style={{ position: 'absolute', top: '1.2rem', left: '1.5rem', color: 'rgba(56, 189, 248, 0.3)', fontSize: '24px', fontWeight: 800, letterSpacing: '4px' }}>ZONE {zone}</span>
                        </div>
                    ))}
                </div>
            )}

            {mapLayout === 'flow' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', backgroundColor: 'rgba(255,255,255,0.02)', paddingTop: '75px', pointerEvents: 'none' }}>
                    <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem' }}>
                        <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 800, marginRight: '8px' }}>01</span><span style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 700 }}>Inputs</span>
                    </div>
                    <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem' }}>
                        <span style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 800, marginRight: '8px' }}>02</span><span style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 700 }}>Process Core</span>
                    </div>
                    <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem' }}>
                        <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 800, marginRight: '8px' }}>03</span><span style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 700 }}>Control</span>
                    </div>
                    <div style={{ flex: 1, padding: '1.5rem' }}>
                        <span style={{ color: '#8b5cf6', fontSize: '12px', fontWeight: 800, marginRight: '8px' }}>04</span><span style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 700 }}>Utilities</span>
                    </div>
                </div>
            )}

            {/* SVG FLOW LINES */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                {mapLayout === 'flow' && telemetry.map((m, i) => {
                    if (i === 0) return null;
                    const prev = positions[telemetry[i - 1].id];
                    const curr = positions[m.id];
                    if (!prev || !curr) return null;

                    const x1 = prev.x + 90;
                    const y1 = prev.y + 60;
                    const x2 = curr.x + 90;
                    const y2 = curr.y + 60;

                    return (
                        <g key={`line-${m.id}`}>
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0284c7" strokeWidth="3" opacity="0.3" />
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#38bdf8" strokeWidth="3" strokeDasharray="8 16" style={{ animation: 'led-flow 1s linear infinite' }} />
                        </g>
                    )
                })}
            </svg>

            {/* THE DRAGGABLE MACHINE NODES */}
            {telemetry.map(machine => {
                const pos = positions[machine.id];
                const meta = metaRegistry[machine.id] || {};
                const isOffline = machine.isShutdown;
                const isWarning = machine.ai_status === 'Warning' || machine.ai_status === 'Critical';
                const statusColor = isOffline ? '#64748b' : machine.ai_status === 'Critical' ? '#ef4444' : machine.ai_status === 'Warning' ? '#f59e0b' : '#10b981';
                const isSelected = selectedNodeId === machine.id;
                const canDrag = role === 'engineer' && mapLayout !== 'ecosystem';

                if (!pos) return null;

                return (
                    <div
                        key={machine.id}
                        onClick={() => role === 'engineer' ? setSelectedNodeId(machine.id) : onNodeClick(machine.id)}
                        draggable={canDrag}
                        onDragEnd={(e) => {
                            if (!canDrag) return;
                            const rect = e.target.parentElement.getBoundingClientRect();
                            onNodeMove(`${mapLayout}_${machine.id}`, { x: e.clientX - rect.left - 90, y: e.clientY - rect.top - 60 });
                        }}
                        style={{
                            position: 'absolute', left: pos.x, top: pos.y, width: '180px',
                            backgroundColor: '#0f172a',
                            border: `1px solid ${isSelected ? '#38bdf8' : statusColor}`,
                            borderRadius: '12px',
                            cursor: canDrag ? 'move' : 'pointer',
                            boxShadow: isSelected ? '0 0 0 2px rgba(56,189,248,0.5)' : `0 10px 15px -3px rgba(0,0,0,0.5), 0 0 20px ${isWarning && !isOffline ? statusColor + '40' : 'transparent'}`,
                            zIndex: isSelected ? 20 : 5,
                            transition: mapLayout === 'ecosystem' ? 'left 0.5s ease-out, top 0.5s ease-out, border-color 0.2s' : 'border-color 0.2s, box-shadow 0.2s'
                        }}
                    >
                        {isWarning && !isOffline && (
                            <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '16px', height: '16px' }}>
                                <span style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: statusColor, borderRadius: '50%', opacity: 0.7, animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }}></span>
                                <span style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: statusColor, borderRadius: '50%' }}></span>
                            </div>
                        )}

                        <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                <p style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 700, margin: 0 }}>{machine.id}</p>
                                {isOffline ? <Power size={14} color="#ef4444" /> : isWarning ? <AlertTriangle size={14} color={statusColor} /> : <CheckCircle2 size={14} color={statusColor} />}
                            </div>
                            <p style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', margin: 0, fontWeight: 700, letterSpacing: '1px' }}>{meta.type || 'Unknown'}</p>
                        </div>

                        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'rgba(0,0,0,0.2)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}><Thermometer size={12} /> Temp</span>
                                <span style={{ color: machine.anomaly_source === 'temperature' ? statusColor : '#f8fafc', fontWeight: machine.anomaly_source === 'temperature' ? 700 : 400 }}>{formatMetric(machine.temperature, 0)}°C</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}><Gauge size={12} /> Press</span>
                                <span style={{ color: machine.anomaly_source === 'pressure' ? statusColor : '#f8fafc', fontWeight: machine.anomaly_source === 'pressure' ? 700 : 400 }}>{formatMetric(machine.pressure, 0)} bar</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}><Radio size={12} /> Vib</span>
                                <span style={{ color: machine.anomaly_source === 'vibration' ? statusColor : '#f8fafc', fontWeight: machine.anomaly_source === 'vibration' ? 700 : 400 }}>{formatMetric(machine.vibration, 1)} mm/s</span>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* ENGINEER POPUP STUDIO */}
            {selectedNodeId && selectedNode && (
                <div style={{ position: 'absolute', top: '5.5rem', right: '1.5rem', width: '320px', backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '12px', padding: '1.5rem', zIndex: 30, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div>
                            <p style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 700, letterSpacing: '1px', margin: '0 0 4px 0' }}>ENGINEER NODE STUDIO</p>
                            <h3 style={{ fontSize: '20px', color: '#f8fafc', margin: 0 }}>{selectedNodeId}</h3>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setSelectedNodeId(null); }}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                        <button onClick={() => onNodeClick(selectedNodeId)} style={{ flex: 1, padding: '10px', backgroundColor: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                            <Activity size={14} /> Full Diagnose
                        </button>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
                        <button
                            onClick={() => onMachineCommand(selectedNodeId, selectedNode.isShutdown ? 'restart' : 'shutdown')}
                            style={{ width: '100%', padding: '12px', backgroundColor: selectedNode.isShutdown ? '#10b981' : '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                        >
                            {selectedNode.isShutdown ? <><RotateCcw size={16} /> Restart Machine</> : <><Power size={16} /> Shut Down</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}