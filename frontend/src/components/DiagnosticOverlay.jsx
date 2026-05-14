import React, { useMemo } from 'react';
import { Settings, Power, RotateCcw, ClipboardCheck, ArrowLeft, AlertTriangle, Brain, Thermometer, Gauge, Radio } from 'lucide-react';
import { TrendChart, MetricTile } from './SharedUI';
import { buildSystemAnalysis, buildCopilotNarrative, getStatusTone, toNumber, formatMetric } from '../utils/helpers';
import { MACHINE_TYPES } from '../utils/constants';

export default function DiagnosticOverlay({ machine, meta, history, role, investigateId, acknowledged, onAcknowledge, onCommand, onClose }) {

    const investigationAnalysis = useMemo(() => buildSystemAnalysis(machine, meta), [machine, meta]);
    const copilotNarrative = useMemo(() => buildCopilotNarrative(machine, meta), [machine, meta]);

    const getStatusClass = (status) => {
        if (status === 'Critical') return 'status-critical';
        if (status === 'Warning') return 'status-warning';
        if (status === 'Normal') return 'status-normal';
        return 'status-neutral';
    };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#07111f', zIndex: 9999, overflowY: 'auto' }}>

            <div style={{
                position: 'sticky', top: 0, zIndex: 100,
                padding: '1.5rem 3rem',
                backgroundColor: 'rgba(7, 17, 31, 0.85)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(56,189,248,0.1)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <button
                        onClick={onClose}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#f8fafc', cursor: 'pointer',
                            padding: '12px 24px', borderRadius: '10px',
                            fontSize: '15px', fontWeight: 600,
                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                            transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#334155'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#1e293b'}
                    >
                        <ArrowLeft size={18} /> Back to Command Map
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className={`panel-icon-bg ${getStatusClass(machine.ai_status)}`} style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Settings size={24} style={{ color: 'var(--text-main)' }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '28px', color: '#f8fafc', margin: 0 }}>{investigateId}</h1>
                            <p style={{ color: '#94a3b8', margin: '4px 0 0 0' }}>Zone {meta.zone} / {meta.label}</p>
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <span className={`diagnostic-status tone-${getStatusTone(machine)}`} style={{ fontSize: '16px', padding: '8px 16px' }}>
                        {machine.isShutdown ? 'System Offline' : machine.ai_status}
                    </span>
                    <p style={{ color: '#64748b', fontSize: '13px', marginTop: '8px' }}>Criticality: {meta.criticality}</p>
                </div>
            </div>

            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 3rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {/* AI SEVERITY SCORE BOX */}
                    <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(56,189,248,0.1)', borderRadius: '16px', padding: '1.5rem', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', backgroundColor: getStatusTone(machine) === 'critical' ? '#ef4444' : getStatusTone(machine) === 'warning' ? '#f59e0b' : '#10b981' }} />
                        <p style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>AI Severity Score</p>
                        <div style={{ fontSize: '48px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                            {toNumber(machine.severity_score)} <span style={{ fontSize: '18px', color: '#64748b', fontWeight: 500 }}>/ 100</span>
                        </div>
                        <p style={{ color: '#38bdf8', fontSize: '14px', marginTop: '0.5rem', marginBottom: '1rem' }}>Leading Signal: {machine.anomaly_source === 'none' ? 'Baseline Stable' : machine.anomaly_source}</p>

                        {/* PROBLEM TEXT MOVED HERE */}
                        {copilotNarrative && (
                            <div style={{ marginTop: 'auto', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px' }}>
                                <p style={{ color: '#ef4444', fontSize: '14px', margin: 0, lineHeight: 1.4 }}><strong>🚨 Problem:</strong> {copilotNarrative.problem}</p>
                            </div>
                        )}
                    </div>

                    {/* COPILOT ROOT CAUSE BOX */}
                    <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(56,189,248,0.1)', borderRadius: '16px', padding: '1.5rem' }}>
                        <p style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Brain size={14} color="#38bdf8" /> Copilot Root Cause Analysis
                        </p>
                        {copilotNarrative ? (
                            <>
                                <h3 style={{ fontSize: '18px', color: '#f8fafc', margin: '0 0 16px 0', lineHeight: 1.3 }}>{copilotNarrative.headline}</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <p style={{ color: '#f59e0b', fontSize: '14px', margin: 0, lineHeight: 1.5 }}><strong>🔍 Reason:</strong> {copilotNarrative.reason}</p>
                                    <p style={{ color: '#10b981', fontSize: '14px', margin: 0, lineHeight: 1.5 }}><strong>🛠️ Suggested Fix:</strong> {copilotNarrative.fix}</p>
                                </div>
                            </>
                        ) : (
                            <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>Machine operating within expected parameters. No anomaly pattern detected.</p>
                        )}
                    </div>

                    {/* CONTROL PANEL BOX */}
                    <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(56,189,248,0.1)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                        <p style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Control Panel</p>
                        <div style={{ marginTop: 'auto' }}>
                            <button
                                onClick={() => onAcknowledge(investigateId)}
                                disabled={acknowledged.has(investigateId) || machine.ai_status === 'Normal'}
                                style={{ opacity: (acknowledged.has(investigateId) || machine.ai_status === 'Normal') ? 0.5 : 1, backgroundColor: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1rem', width: '100%', justifyContent: 'center' }}
                            >
                                <ClipboardCheck size={16} /> {acknowledged.has(investigateId) ? 'Risk Acknowledged' : 'Acknowledge Risk (Operator)'}
                            </button>

                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => onCommand(investigateId, 'shutdown')}
                                    disabled={machine.isShutdown || role !== 'engineer'}
                                    style={{ flex: 1, opacity: (machine.isShutdown || role !== 'engineer') ? 0.5 : 1, backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', cursor: (machine.isShutdown || role !== 'engineer') ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                >
                                    <Power size={16} /> Shutdown
                                </button>

                                <button
                                    onClick={() => onCommand(investigateId, 'restart')}
                                    disabled={!machine.isShutdown || role !== 'engineer'}
                                    style={{ flex: 1, opacity: (!machine.isShutdown || role !== 'engineer') ? 0.5 : 1, backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', cursor: (!machine.isShutdown || role !== 'engineer') ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                >
                                    <RotateCcw size={16} /> Restart
                                </button>
                            </div>

                            {/* UPDATED ROLE MESSAGE FOR MANAGERS */}
                            {role !== 'engineer' && (
                                <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '12px', textAlign: 'center', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '8px', borderRadius: '6px' }}>
                                    <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                    {role === 'manager' ? "View-only mode: Managerial access active." : "Switch to Engineer role to use controls."}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <h3 style={{ color: '#f8fafc', fontSize: '16px', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>Live Telemetry Streams</h3>
                    <div className="panel-summary-grid diagnostic-metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <MetricTile label="Temperature" value={formatMetric(machine.temperature, 1)} unit=" C" icon={Thermometer} anomaly={machine.anomaly_source === 'temperature'} />
                        <MetricTile label="Internal Pressure" value={formatMetric(machine.pressure, 1)} unit=" bar" icon={Gauge} anomaly={machine.anomaly_source === 'pressure'} />
                        <MetricTile label="Rotor Vibration" value={formatMetric(machine.vibration, 2)} unit=" mm/s" icon={Radio} anomaly={machine.anomaly_source === 'vibration'} />
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <TrendChart
                        title="Temperature Historical Trend"
                        data={history}
                        dataKey="temp"
                        status={machine.ai_status}
                        baseline={MACHINE_TYPES[meta.type]?.baseTemp}
                        unit=" °C"
                        height={320}
                    />
                    <TrendChart
                        title="Pressure Historical Trend"
                        data={history}
                        dataKey="pressure"
                        status={machine.ai_status}
                        baseline={MACHINE_TYPES[meta.type]?.basePressure}
                        unit=" bar"
                        height={320}
                    />
                    <TrendChart
                        title="Vibration Historical Trend"
                        data={history}
                        dataKey="vibration"
                        status={machine.ai_status}
                        baseline={MACHINE_TYPES[meta.type]?.baseVibration}
                        unit=" mm/s"
                        height={320}
                    />
                </div>
            </div>
        </div>
    );
}