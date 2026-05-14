import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, Power, AlertTriangle, ShieldAlert, CheckCircle2, Thermometer, Gauge, Radio } from 'lucide-react';
import { formatMetric, formatTime, toNumber } from '../utils/helpers';
import { MiniTrend } from './SharedUI';

export default function SortableMachineCard({ id, machine, meta, role, history, onInvestigate, getStatusIcon, getStatusClass, isSortable }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled: !isSortable });

    const isOffline = machine.isShutdown;
    const statusColor = isOffline ? '#64748b' : machine.ai_status === 'Warning' ? '#f59e0b' : machine.ai_status === 'Critical' ? '#ef4444' : '#10b981';
    const statusBg = isOffline ? 'rgba(100, 116, 139, 0.1)' : machine.ai_status === 'Warning' ? 'rgba(245, 158, 11, 0.1)' : machine.ai_status === 'Critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)';

    // THE FIX: Uniform dark background, no grid, with a beautiful colored top-border accent.
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        backgroundColor: '#0f172a',
        backgroundImage: 'none',
        border: '1px solid rgba(255,255,255,0.05)',
        borderTop: `4px solid ${statusColor}`,
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
    };

    return (
        <article ref={setNodeRef} style={style} className={isOffline ? 'offline' : ''}>
            {isSortable && <div className="drag-handle" {...listeners} {...attributes} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} />}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                <div>
                    <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, letterSpacing: '1px', margin: '0 0 4px 0' }}>ZONE {meta.zone} / {meta.type.toUpperCase()}</p>
                    <h3 style={{ fontSize: '16px', color: '#f8fafc', margin: '0 0 4px 0', fontWeight: 600 }}>{id}</h3>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 4px 0' }}>{formatTime(machine.timestamp)} / {meta.label}</p>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{isOffline ? 'Cooling cycle active' : `Severity ${toNumber(machine.severity_score)}/100`}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: `1px solid ${statusColor}`, backgroundColor: statusBg, padding: '4px 8px', borderRadius: '6px', color: statusColor, fontSize: '12px', fontWeight: 600 }}>
                    {isOffline ? <Power size={12} /> : machine.ai_status === 'Warning' ? <AlertTriangle size={12} /> : machine.ai_status === 'Critical' ? <ShieldAlert size={12} /> : <CheckCircle2 size={12} />}
                    {isOffline ? 'Offline' : machine.ai_status}
                </div>
            </div>

            {isOffline ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 0', backgroundColor: '#1e293b', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.02)', position: 'relative', zIndex: 2 }}>
                    <Power size={24} color="#64748b" style={{ marginBottom: '8px' }} />
                    <strong style={{ color: '#94a3b8', letterSpacing: '2px', fontSize: '14px' }}>OFFLINE</strong>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '1rem', position: 'relative', zIndex: 2 }}>
                    <div style={{ backgroundColor: '#1e293b', backgroundImage: 'none', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                        <p style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 0 6px 0', textTransform: 'uppercase' }}><Thermometer size={10} /> Temp</p>
                        <strong style={{ color: '#f8fafc', fontSize: '15px' }}>{formatMetric(machine.temperature, 1)} <small style={{ color: '#64748b', fontSize: '11px', fontWeight: 500 }}>C</small></strong>
                    </div>
                    <div style={{ backgroundColor: '#1e293b', backgroundImage: 'none', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                        <p style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 0 6px 0', textTransform: 'uppercase' }}><Gauge size={10} /> Pressure</p>
                        <strong style={{ color: '#f8fafc', fontSize: '15px' }}>{formatMetric(machine.pressure, 1)} <small style={{ color: '#64748b', fontSize: '11px', fontWeight: 500 }}>bar</small></strong>
                    </div>
                    <div style={{ backgroundColor: '#1e293b', backgroundImage: 'none', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                        <p style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', margin: '0 0 6px 0', textTransform: 'uppercase' }}><Radio size={10} /> Vibration</p>
                        <strong style={{ color: '#f8fafc', fontSize: '15px' }}>{formatMetric(machine.vibration, 2)} <small style={{ color: '#64748b', fontSize: '11px', fontWeight: 500 }}>mm/s</small></strong>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', marginTop: 'auto', position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {!isOffline && <MiniTrend data={history} metric="temp" tone={machine.ai_status === 'Critical' ? 'critical' : machine.ai_status === 'Warning' ? 'warning' : 'normal'} />}
                </div>

                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onInvestigate(id);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)', cursor: 'pointer', pointerEvents: 'auto', zIndex: 99, fontSize: '12px', fontWeight: 600 }}
                >
                    <Eye size={14} /> Inspect
                </button>
            </div>
        </article>
    );
}