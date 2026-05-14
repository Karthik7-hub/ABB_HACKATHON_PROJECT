import React, { useMemo, useState, useEffect } from 'react';
import { Settings, Power, RotateCcw, ClipboardCheck, ArrowLeft, AlertTriangle, Brain, Thermometer, Gauge, Radio, Settings2, CheckCircle2, Sliders, Activity, Save, Loader2 } from 'lucide-react';
import { TrendChart, MetricTile } from './SharedUI';
import { buildSystemAnalysis, buildCopilotNarrative, getStatusTone, toNumber, formatMetric } from '../utils/helpers';
import { MACHINE_TYPES } from '../utils/constants';

export default function DiagnosticOverlay({ machine, meta, history, role, investigateId, acknowledged, onAcknowledge, onCommand, onClose }) {

    // Tab System & Logic Editor States
    const [activeTab, setActiveTab] = useState('diagnostics');
    const [activeLogicMetric, setActiveLogicMetric] = useState('temp');

    // FIX: Grab saved values from localStorage for THIS specific machine, or fallback to defaults
    const [simBaseTemp, setSimBaseTemp] = useState(() => Number(localStorage.getItem(`baseTemp_${machine.id}`)) || MACHINE_TYPES[meta.type]?.baseTemp || 50);
    const [simBasePressure, setSimBasePressure] = useState(() => Number(localStorage.getItem(`basePressure_${machine.id}`)) || MACHINE_TYPES[meta.type]?.basePressure || 100);
    const [simBaseVibration, setSimBaseVibration] = useState(() => Number(localStorage.getItem(`baseVib_${machine.id}`)) || MACHINE_TYPES[meta.type]?.baseVibration || 2.0);

    const [warnLimit, setWarnLimit] = useState(() => Number(localStorage.getItem(`warnLimit_${machine.id}`)) || 40);
    const [critLimit, setCritLimit] = useState(() => Number(localStorage.getItem(`critLimit_${machine.id}`)) || 75);

    const [isDeploying, setIsDeploying] = useState(false);
    const [deploySuccess, setDeploySuccess] = useState(false);

    // Instantly sync slider values to the chart baselines visually
    useEffect(() => {
        if (MACHINE_TYPES[meta.type]) {
            MACHINE_TYPES[meta.type].baseTemp = simBaseTemp;
            MACHINE_TYPES[meta.type].basePressure = simBasePressure;
            MACHINE_TYPES[meta.type].baseVibration = simBaseVibration;
        }
    }, [simBaseTemp, simBasePressure, simBaseVibration, meta.type]);

    // FIX: Save values permanently to localStorage when the button is clicked!
    const handleDeployConfig = () => {
        setIsDeploying(true);
        setDeploySuccess(false);

        setTimeout(() => {
            // Save settings for this specific machine ID
            localStorage.setItem(`baseTemp_${machine.id}`, simBaseTemp);
            localStorage.setItem(`basePressure_${machine.id}`, simBasePressure);
            localStorage.setItem(`baseVib_${machine.id}`, simBaseVibration);
            localStorage.setItem(`warnLimit_${machine.id}`, warnLimit);
            localStorage.setItem(`critLimit_${machine.id}`, critLimit);

            setIsDeploying(false);
            setDeploySuccess(true);

            setTimeout(() => {
                setDeploySuccess(false);
            }, 3000);
        }, 1200);
    };

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
            <style>
                {`
                    .spin { animation: spin 1s linear infinite; } 
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                    @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                `}
            </style>

            <div style={{
                position: 'sticky', top: 0, zIndex: 100, padding: '1.5rem 3rem',
                backgroundColor: 'rgba(7, 17, 31, 0.85)', backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(56,189,248,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <button
                        onClick={onClose}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#f8fafc', cursor: 'pointer', padding: '12px 24px', borderRadius: '10px',
                            fontSize: '15px', fontWeight: 600, boxShadow: '0 4px 6px rgba(0,0,0,0.3)', transition: 'background 0.2s'
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

            <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 3rem', display: 'flex', flexDirection: 'column' }}>

                {/* TAB NAVIGATION */}
                <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <button onClick={() => setActiveTab('diagnostics')} style={{ padding: '0 0 1rem 0', background: 'none', border: 'none', borderBottom: activeTab === 'diagnostics' ? '3px solid #38bdf8' : '3px solid transparent', color: activeTab === 'diagnostics' ? '#f8fafc' : '#64748b', cursor: 'pointer', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
                        <Activity size={18} /> System Diagnostics
                    </button>
                    {role === 'engineer' && (
                        <button onClick={() => setActiveTab('logic')} style={{ padding: '0 0 1rem 0', background: 'none', border: 'none', borderBottom: activeTab === 'logic' ? '3px solid #8b5cf6' : '3px solid transparent', color: activeTab === 'logic' ? '#f8fafc' : '#64748b', cursor: 'pointer', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
                            <Sliders size={18} /> Logic Editor (No-Code)
                        </button>
                    )}
                </div>

                {/* TAB 1: DIAGNOSTICS */}
                {activeTab === 'diagnostics' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(56,189,248,0.1)', borderRadius: '16px', padding: '1.5rem', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', backgroundColor: getStatusTone(machine) === 'critical' ? '#ef4444' : getStatusTone(machine) === 'warning' ? '#f59e0b' : '#10b981' }} />
                                <p style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>AI Severity Score</p>
                                <div style={{ fontSize: '48px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                    {toNumber(machine.severity_score)} <span style={{ fontSize: '18px', color: '#64748b', fontWeight: 500 }}>/ 100</span>
                                </div>
                                <p style={{ color: '#38bdf8', fontSize: '14px', marginTop: '0.5rem', marginBottom: '1rem' }}>Leading Signal: {machine.anomaly_source === 'none' ? 'Baseline Stable' : machine.anomaly_source}</p>

                                {copilotNarrative && (
                                    <div style={{ marginTop: 'auto', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px' }}>
                                        <p style={{ color: '#ef4444', fontSize: '14px', margin: 0, lineHeight: 1.4 }}><strong>🚨 Problem:</strong> {copilotNarrative.problem}</p>
                                    </div>
                                )}
                            </div>

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
                            <TrendChart title="Temperature Historical Trend" data={history} dataKey="temp" status={machine.ai_status} baseline={MACHINE_TYPES[meta.type]?.baseTemp} unit=" °C" height={320} />
                            <TrendChart title="Pressure Historical Trend" data={history} dataKey="pressure" status={machine.ai_status} baseline={MACHINE_TYPES[meta.type]?.basePressure} unit=" bar" height={320} />
                            <TrendChart title="Vibration Historical Trend" data={history} dataKey="vibration" status={machine.ai_status} baseline={MACHINE_TYPES[meta.type]?.baseVibration} unit=" mm/s" height={320} />
                        </div>
                    </div>
                )}

                {/* TAB 2: LOGIC EDITOR (No-Code Configurator) */}
                {activeTab === 'logic' && role === 'engineer' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>

                        {/* Sliders Configuration Panel */}
                        <div style={{ backgroundColor: '#0f172a', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                            <h3 style={{ color: '#f8fafc', marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
                                <Settings2 size={20} color="#8b5cf6" /> Safety Threshold Configuration
                            </h3>

                            <div style={{ display: 'flex', gap: '10px', marginBottom: '2.5rem' }}>
                                <button onClick={() => setActiveLogicMetric('temp')} style={{ flex: 1, padding: '10px 12px', backgroundColor: activeLogicMetric === 'temp' ? 'rgba(56,189,248,0.15)' : 'transparent', color: activeLogicMetric === 'temp' ? '#38bdf8' : '#64748b', border: '1px solid', borderColor: activeLogicMetric === 'temp' ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                    <Thermometer size={16} /> Temperature
                                </button>
                                <button onClick={() => setActiveLogicMetric('pressure')} style={{ flex: 1, padding: '10px 12px', backgroundColor: activeLogicMetric === 'pressure' ? 'rgba(56,189,248,0.15)' : 'transparent', color: activeLogicMetric === 'pressure' ? '#38bdf8' : '#64748b', border: '1px solid', borderColor: activeLogicMetric === 'pressure' ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                    <Gauge size={16} /> Pressure
                                </button>
                                <button onClick={() => setActiveLogicMetric('vibration')} style={{ flex: 1, padding: '10px 12px', backgroundColor: activeLogicMetric === 'vibration' ? 'rgba(56,189,248,0.15)' : 'transparent', color: activeLogicMetric === 'vibration' ? '#38bdf8' : '#64748b', border: '1px solid', borderColor: activeLogicMetric === 'vibration' ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                    <Radio size={16} /> Vibration
                                </button>
                            </div>

                            {/* DYNAMIC BASELINE SLIDERS */}
                            {activeLogicMetric === 'temp' && (
                                <div style={{ marginBottom: '2.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>Standard Operating Temperature</span>
                                        <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '16px' }}>{simBaseTemp}°C</span>
                                    </div>
                                    <input type="range" min="10" max="150" value={simBaseTemp} onChange={e => setSimBaseTemp(Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'ew-resize' }} />
                                    <p style={{ color: '#64748b', fontSize: '12px', marginTop: '8px' }}>Adjusts the baseline norm for the AI temperature anomaly detection engine.</p>
                                </div>
                            )}

                            {activeLogicMetric === 'pressure' && (
                                <div style={{ marginBottom: '2.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>Standard Operating Pressure</span>
                                        <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '16px' }}>{simBasePressure} bar</span>
                                    </div>
                                    <input type="range" min="10" max="300" value={simBasePressure} onChange={e => setSimBasePressure(Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'ew-resize' }} />
                                    <p style={{ color: '#64748b', fontSize: '12px', marginTop: '8px' }}>Adjusts the baseline norm for the AI pressure anomaly detection engine.</p>
                                </div>
                            )}

                            {activeLogicMetric === 'vibration' && (
                                <div style={{ marginBottom: '2.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>Standard Vibration Baseline</span>
                                        <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '16px' }}>{simBaseVibration.toFixed(1)} mm/s</span>
                                    </div>
                                    <input type="range" min="0" max="10" step="0.1" value={simBaseVibration} onChange={e => setSimBaseVibration(Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8', cursor: 'ew-resize' }} />
                                    <p style={{ color: '#64748b', fontSize: '12px', marginTop: '8px' }}>Adjusts the baseline norm for the AI vibration anomaly detection engine.</p>
                                </div>
                            )}

                            {/* UNIVERSAL RISK SLIDERS */}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '2rem' }}>
                                <div style={{ marginBottom: '2.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>Warning Alert Trigger</span>
                                        <span style={{ color: '#f59e0b', fontWeight: 800, fontSize: '16px' }}>{warnLimit}% Risk</span>
                                    </div>
                                    <input type="range" min="10" max={critLimit - 5} value={warnLimit} onChange={e => setWarnLimit(Number(e.target.value))} style={{ width: '100%', accentColor: '#f59e0b', cursor: 'ew-resize' }} />
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>Critical Shutdown Trigger</span>
                                        <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '16px' }}>{critLimit}% Risk</span>
                                    </div>
                                    <input type="range" min={warnLimit + 5} max="95" value={critLimit} onChange={e => setCritLimit(Number(e.target.value))} style={{ width: '100%', accentColor: '#ef4444', cursor: 'ew-resize' }} />
                                </div>
                            </div>

                            {/* EXPLICIT SAVE BUTTON */}
                            <div style={{ marginTop: '2.5rem' }}>
                                <button
                                    onClick={handleDeployConfig}
                                    disabled={isDeploying}
                                    style={{
                                        width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                                        background: 'linear-gradient(to right, #8b5cf6, #38bdf8)', color: '#fff',
                                        cursor: isDeploying ? 'wait' : 'pointer', fontSize: '15px', fontWeight: 700,
                                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                                        opacity: isDeploying ? 0.8 : 1, boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {isDeploying ? (
                                        <><Loader2 size={18} className="spin" /> Deploying to Edge Node...</>
                                    ) : (
                                        <><Save size={18} /> Save & Deploy Configuration</>
                                    )}
                                </button>

                                {deploySuccess && (
                                    <div style={{ marginTop: '1rem', padding: '12px 16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', color: '#10b981', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, animation: 'fadeSlideUp 0.3s ease-out' }}>
                                        <CheckCircle2 size={16} /> Configuration successfully deployed to physical node.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Live Visual Preview Panel */}
                        <div style={{ backgroundColor: '#07111f', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <h3 style={{ color: '#f8fafc', marginTop: 0, marginBottom: '2rem', fontSize: '16px', color: '#94a3b8' }}>Live Logic Envelope Preview</h3>

                            <div style={{ height: '420px', display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '45px', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>

                                {/* Critical Zone (Top) */}
                                <div style={{ position: 'absolute', top: 0, left: '45px', right: 0, height: `${100 - critLimit}%`, backgroundColor: 'rgba(239,68,68,0.1)', borderBottom: '2px dashed #ef4444', transition: 'height 0.2s', display: 'flex', alignItems: 'flex-end', padding: '8px' }}>
                                    <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 800, letterSpacing: '1px' }}>CRITICAL ZONE</span>
                                </div>

                                {/* Warning Zone (Middle) */}
                                <div style={{ position: 'absolute', top: `${100 - critLimit}%`, left: '45px', right: 0, height: `${critLimit - warnLimit}%`, backgroundColor: 'rgba(245,158,11,0.1)', borderBottom: '2px dashed #f59e0b', transition: 'top 0.2s, height 0.2s', display: 'flex', alignItems: 'flex-end', padding: '8px' }}>
                                    <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 800, letterSpacing: '1px' }}>WARNING ZONE</span>
                                </div>

                                {/* Safe Zone (Bottom) */}
                                <div style={{ position: 'absolute', top: `${100 - warnLimit}%`, bottom: 0, left: '45px', right: 0, backgroundColor: 'rgba(16,185,129,0.05)', transition: 'top 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ color: '#10b981', fontSize: '16px', fontWeight: 800, opacity: 0.5, letterSpacing: '2px' }}>SAFE OPERATION</span>
                                </div>

                                {/* Y-Axis Labels */}
                                <div style={{ color: '#64748b', fontSize: '12px', position: 'absolute', left: '-30px', top: '-5px', fontWeight: 700 }}>100</div>
                                <div style={{ color: '#ef4444', fontSize: '12px', position: 'absolute', left: '-30px', top: `calc(${100 - critLimit}% - 8px)`, fontWeight: 700, transition: 'top 0.2s' }}>{critLimit}</div>
                                <div style={{ color: '#f59e0b', fontSize: '12px', position: 'absolute', left: '-30px', top: `calc(${100 - warnLimit}% - 8px)`, fontWeight: 700, transition: 'top 0.2s' }}>{warnLimit}</div>
                                <div style={{ color: '#64748b', fontSize: '12px', position: 'absolute', left: '-20px', bottom: '-5px', fontWeight: 700 }}>0</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}