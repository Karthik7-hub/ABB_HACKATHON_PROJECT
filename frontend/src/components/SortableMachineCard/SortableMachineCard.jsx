import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, Power, AlertTriangle, ShieldAlert, CheckCircle2, Thermometer, Gauge, Radio, Trash2 } from 'lucide-react';
import { formatMetric, formatTime, toNumber } from '../../utils/helpers';
import { MiniTrend } from '../SharedUI/SharedUI';
import './SortableMachineCard.css';

export default function SortableMachineCard({ id, machine, meta, role, history, onInvestigate, onDelete, onMachineCommand, getStatusIcon, getStatusClass, isSortable }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled: !isSortable });

    const isOffline = machine.isShutdown;
    const statusColor = isOffline ? '#64748b' : machine.ai_status === 'Warning' ? '#f59e0b' : machine.ai_status === 'Critical' ? '#ef4444' : '#10b981';
    const statusBg = isOffline ? 'rgba(100, 116, 139, 0.08)' : machine.ai_status === 'Warning' ? 'rgba(245, 158, 11, 0.08)' : machine.ai_status === 'Critical' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)';

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.45) 100%)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderTop: `4px solid ${statusColor}`,
        borderRadius: '16px',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 20px rgba(255,255,255,0.01)',
        boxSizing: 'border-box'
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        if (window.confirm(`Permanently delete ${id} from the simulation and database?`)) {
            onDelete(id);
        }
    };

    return (
        <article ref={setNodeRef} style={style} className={isOffline ? 'offline premium-machine-card' : 'premium-machine-card'}>
            {isSortable && (
                <div 
                    className="drag-handle" 
                    {...listeners} 
                    {...attributes} 
                    style={{ 
                        position: 'absolute', 
                        top: '12px', 
                        left: '12px', 
                        cursor: 'grab', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: '18px', 
                        height: '18px', 
                        borderRadius: '4px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        zIndex: 10
                    }}
                    title="Drag to reorder card"
                >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 2px)', gap: '2px' }}>
                        <div style={{ width: '2px', height: '2px', backgroundColor: '#64748b', borderRadius: '50%' }} />
                        <div style={{ width: '2px', height: '2px', backgroundColor: '#64748b', borderRadius: '50%' }} />
                        <div style={{ width: '2px', height: '2px', backgroundColor: '#64748b', borderRadius: '50%' }} />
                        <div style={{ width: '2px', height: '2px', backgroundColor: '#64748b', borderRadius: '50%' }} />
                        <div style={{ width: '2px', height: '2px', backgroundColor: '#64748b', borderRadius: '50%' }} />
                        <div style={{ width: '2px', height: '2px', backgroundColor: '#64748b', borderRadius: '50%' }} />
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                <div style={{ paddingLeft: isSortable ? '14px' : '0px' }}>
                    <p style={{ fontSize: '9px', color: '#38bdf8', fontWeight: 800, letterSpacing: '1.2px', margin: '0 0 6px 0', textTransform: 'uppercase' }}>
                        ZONE {meta.zone.toUpperCase()} / {meta.type.toUpperCase()}
                    </p>
                    <h3 style={{ fontSize: '18px', color: '#f8fafc', margin: '0 0 6px 0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '-0.5px' }}>
                        <span style={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            backgroundColor: statusColor, 
                            boxShadow: `0 0 10px ${statusColor}`,
                            display: 'inline-block',
                            animation: isOffline ? 'none' : 'premiumPulse 2s infinite ease-in-out'
                        }} />
                        {id}
                    </h3>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 4px 0', fontWeight: 550 }}>
                        {formatTime(machine.timestamp)} / {meta.label}
                    </p>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontWeight: 600 }}>
                        {isOffline ? 'Cooling down sequence active' : `Severity Score: ${toNumber(machine.severity_score)}/100`}
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: `1px solid ${statusColor}35`, backgroundColor: statusBg, padding: '5px 10px', borderRadius: '8px', color: statusColor, fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {isOffline ? <Power size={11} /> : machine.ai_status === 'Warning' ? <AlertTriangle size={11} /> : machine.ai_status === 'Critical' ? <ShieldAlert size={11} /> : <CheckCircle2 size={11} />}
                        {isOffline ? 'Offline' : machine.ai_status}
                    </div>

                </div>
            </div>

            {isOffline ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.75rem 0', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.2) 0%, rgba(15, 23, 42, 0.4) 100%)', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.02)', position: 'relative', zIndex: 2 }}>
                    <Power size={26} color="#64748b" style={{ marginBottom: '8px', filter: 'drop-shadow(0 0 6px rgba(100,116,139,0.3))' }} />
                    <strong style={{ color: '#64748b', letterSpacing: '2px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Standby / Offline</strong>
                    <span style={{ fontSize: '10px', color: '#475569', marginTop: '4px', fontWeight: 500 }}>System idle & cooled</span>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '1.25rem', position: 'relative', zIndex: 2 }}>
                    <div style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <p style={{ fontSize: '9px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 0 6px 0', textTransform: 'uppercase', fontWeight: 800 }}><Thermometer size={10} /> Temp</p>
                        <strong style={{ color: '#f8fafc', fontSize: '14px', fontFamily: 'monospace', fontWeight: 700 }}>
                            {formatMetric(machine.temperature, 1)}
                            <span style={{ color: '#64748b', fontSize: '10px', marginLeft: '2px', fontWeight: 550 }}>°C</span>
                        </strong>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <p style={{ fontSize: '9px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 0 6px 0', textTransform: 'uppercase', fontWeight: 800 }}><Gauge size={10} /> Pressure</p>
                        <strong style={{ color: '#f8fafc', fontSize: '14px', fontFamily: 'monospace', fontWeight: 700 }}>
                            {formatMetric(machine.pressure, 1)}
                            <span style={{ color: '#64748b', fontSize: '10px', marginLeft: '2px', fontWeight: 550 }}>bar</span>
                        </strong>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(139, 92, 246, 0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <p style={{ fontSize: '9px', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 0 6px 0', textTransform: 'uppercase', fontWeight: 800 }}><Radio size={10} /> Vib</p>
                        <strong style={{ color: '#f8fafc', fontSize: '14px', fontFamily: 'monospace', fontWeight: 700 }}>
                            {formatMetric(machine.vibration, 2)}
                            <span style={{ color: '#64748b', fontSize: '10px', marginLeft: '2px', fontWeight: 550 }}>mm/s</span>
                        </strong>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px', marginTop: 'auto', position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {!isOffline && history && history.length > 0 && (
                        <MiniTrend data={history} metric="temp" tone={machine.ai_status === 'Critical' ? 'critical' : machine.ai_status === 'Warning' ? 'warning' : 'normal'} />
                    )}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {role === 'engineer' && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            title={`Delete ${id}`}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                width: '31px',
                                height: '31px',
                                borderRadius: '8px', 
                                backgroundColor: 'rgba(239,68,68,0.06)', 
                                color: '#ef4444', 
                                border: '1px solid rgba(239,68,68,0.18)', 
                                cursor: 'pointer', 
                                pointerEvents: 'auto', 
                                zIndex: 99, 
                                transition: 'all 0.2s' 
                            }}
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                    {onMachineCommand && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onMachineCommand(id, isOffline ? 'restart' : 'shutdown');
                            }}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                padding: '6px 12px', 
                                borderRadius: '8px', 
                                backgroundColor: isOffline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', 
                                color: isOffline ? '#10b981' : '#ef4444', 
                                border: `1px solid ${isOffline ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`, 
                                cursor: 'pointer', 
                                pointerEvents: 'auto', 
                                zIndex: 99, 
                                fontSize: '12px', 
                                fontWeight: 700,
                                transition: 'all 0.2s'
                            }}
                        >
                            <Power size={13} /> {isOffline ? 'Restart' : 'Shutdown'}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onInvestigate(id);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)', cursor: 'pointer', pointerEvents: 'auto', zIndex: 99, fontSize: '12px', fontWeight: 700, transition: 'all 0.2s' }}
                    >
                        <Eye size={13} /> Inspect
                    </button>
                </div>
            </div>
            
            {/* Embedded pulse keyframe animation */}
            <style>{`
                @keyframes premiumPulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.2); opacity: 0.7; box-shadow: 0 0 14px currentColor; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .premium-machine-card {
                    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s, box-shadow 0.25s !important;
                }
                .premium-machine-card:hover {
                    transform: translateY(-4px) scale(1.01) !important;
                    border-color: rgba(56, 189, 248, 0.25) !important;
                    box-shadow: 0 16px 40px rgba(0,0,0,0.6), 0 0 20px rgba(56,189,248,0.05) !important;
                }
            `}</style>
        </article>
    );
}