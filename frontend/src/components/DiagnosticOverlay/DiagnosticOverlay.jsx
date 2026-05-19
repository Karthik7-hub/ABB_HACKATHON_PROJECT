import React, { useMemo, useState, useEffect } from 'react';
import { Settings, Power, RotateCcw, ClipboardCheck, ArrowLeft, AlertTriangle, Brain, Thermometer, Gauge, Radio, Settings2, CheckCircle2, Sliders, Activity, Save, Loader2, Wind, Cpu } from 'lucide-react';
import { TrendChart, MetricTile } from '../SharedUI/SharedUI';
import { buildSystemAnalysis, buildCopilotNarrative, getStatusTone, toNumber, formatMetric } from '../../utils/helpers';
import { MACHINE_TYPES } from '../../utils/constants';
import './DiagnosticOverlay.css';

export default function DiagnosticOverlay({
    investigateId,
    onClose,
    machine: propMachine,
    meta: propMeta,
    history: propHistory,
    role,
    setRole,
    fullscreenGraph,
    setFullscreenGraph,
    onUpdateThresholds,
}) {
    const [activeTab, setActiveTab] = useState('diagnostics');
    const [activeLogicMetric, setActiveLogicMetric] = useState('temp');

    const machine = propMachine || {};
    const meta = propMeta || {};
    const history = propHistory || [];

    // Local configuration states
    const [simBaseTemp, setSimBaseTemp] = useState(70);
    const [simBasePressure, setSimBasePressure] = useState(120);
    const [simBaseVibration, setSimBaseVibration] = useState(1.5);
    const [warnLimit, setWarnLimit] = useState(45);
    const [critLimit, setCritLimit] = useState(70);

    const [isDeploying, setIsDeploying] = useState(false);
    const [deploySuccess, setDeploySuccess] = useState(false);

    useEffect(() => {
        if (machine.id) {
            const defaults = MACHINE_TYPES[meta.type] || {};
            const thresholds = machine.customThresholds || {};
            setSimBaseTemp(Number(thresholds.baseTemp) || Number(localStorage.getItem(`baseTemp_${machine.id}`)) || defaults.baseTemp || 70);
            setSimBasePressure(Number(thresholds.basePressure) || Number(localStorage.getItem(`basePressure_${machine.id}`)) || defaults.basePressure || 120);
            setSimBaseVibration(Number(thresholds.baseVibration) || Number(localStorage.getItem(`baseVib_${machine.id}`)) || defaults.baseVibration || 1.5);
            setWarnLimit(Number(thresholds.warnLimit) || Number(localStorage.getItem(`warnLimit_${machine.id}`)) || 45);
            setCritLimit(Number(thresholds.critLimit) || Number(localStorage.getItem(`critLimit_${machine.id}`)) || 70);
        }
    }, [machine.id, meta.type]);

    useEffect(() => {
        if (MACHINE_TYPES[meta.type]) {
            MACHINE_TYPES[meta.type].baseTemp = simBaseTemp;
            MACHINE_TYPES[meta.type].basePressure = simBasePressure;
            MACHINE_TYPES[meta.type].baseVibration = simBaseVibration;
        }
    }, [simBaseTemp, simBasePressure, simBaseVibration, meta.type]);

    const handleDeployConfig = () => {
        setIsDeploying(true);
        setDeploySuccess(false);

        if (typeof onUpdateThresholds === 'function') {
            onUpdateThresholds(machine.id, {
                baseTemp: simBaseTemp,
                basePressure: simBasePressure,
                baseVibration: simBaseVibration,
                warnLimit: warnLimit,
                critLimit: critLimit
            });
        }

        setTimeout(() => {
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

    const getStatusClass = (status) => {
        if (status === 'Critical') return 'status-critical';
        if (status === 'Warning') return 'status-warning';
        if (status === 'Normal') return 'status-normal';
        return 'status-neutral';
    };

    return (
        <div className="diagnostic-overlay-wrapper">
            <div className="diagnostic-overlay-header">
                <div className="diagnostic-overlay-header-left">
                    <button className="back-to-map-btn" onClick={onClose}>
                        <ArrowLeft size={18} /> Back to Command Map
                    </button>

                    <div className="diagnostic-overlay-header-left">
                        <button
                            onClick={() => {
                                if (role !== 'engineer' && typeof setRole === 'function') {
                                    setRole('engineer');
                                }
                                setActiveTab('logic');
                            }}
                            className={`settings-trigger-btn ${getStatusClass(machine.ai_status)}`}
                            title="Open Threshold Settings"
                        >
                            <Settings size={24} style={{ color: 'var(--text-main)' }} />
                        </button>
                        <div>
                            <h1 className="machine-meta-title">{investigateId}</h1>
                            <p className="machine-meta-subtitle">Zone {meta.zone} / {meta.label}</p>
                        </div>
                    </div>
                </div>

                <div className="header-status-right">
                    <span className={`diagnostic-status tone-${getStatusTone(machine)}`}>
                        {machine.isShutdown ? 'System Offline' : machine.ai_status}
                    </span>
                    <p className="header-criticality-text">Criticality: {meta.criticality}</p>
                </div>
            </div>

            <div className="diagnostic-main-container">
                {/* TAB NAVIGATION */}
                <div className="tabs-navigation-bar">
                    <button 
                        onClick={() => setActiveTab('diagnostics')} 
                        className={`tab-nav-button ${activeTab === 'diagnostics' ? 'diagnostics-active' : 'inactive'}`}
                    >
                        <Activity size={18} /> System Diagnostics
                    </button>
                    {role === 'engineer' && (
                        <button 
                            onClick={() => setActiveTab('logic')} 
                            className={`tab-nav-button ${activeTab === 'logic' ? 'logic-active' : 'inactive'}`}
                        >
                            <Sliders size={18} /> Logic Editor (No-Code)
                        </button>
                    )}
                </div>

                {/* TAB 1: DIAGNOSTICS */}
                {activeTab === 'diagnostics' && (
                    <div className="diagnostics-tab-content">
                        <div className="diagnostics-summary-grid">
                            <div className="severity-score-card">
                                <div 
                                    className="severity-score-indicator-bar" 
                                    style={{ backgroundColor: getStatusTone(machine) === 'critical' ? '#ef4444' : getStatusTone(machine) === 'warning' ? '#f59e0b' : '#10b981' }} 
                                />
                                <p className="severity-card-label">AI Severity Score</p>
                                <div className="severity-card-value">
                                    {toNumber(machine.severity_score)} <span className="severity-card-value-max">/ 100</span>
                                </div>
                                <p className="severity-card-signal-text">Leading Signal: {machine.anomaly_source === 'none' ? 'Baseline Stable' : machine.anomaly_source}</p>

                                {machine.copilot && machine.copilot.smart_alarm && (
                                    <div className="severity-card-smart-alarm">
                                        <p className="severity-card-smart-alarm-text"><strong>🚨 Smart Alarm:</strong> {machine.copilot.smart_alarm}</p>
                                    </div>
                                )}
                            </div>

                            <div className="copilot-analysis-card">
                                <p className="copilot-card-header">
                                    <Brain size={14} color="#38bdf8" /> Copilot Root Cause Analysis
                                </p>
                                {machine.copilot ? (
                                    <div className="copilot-narrative-container">
                                        <div className="copilot-narrative-text" dangerouslySetInnerHTML={{ __html: machine.copilot.narrative.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/### (.*?)/, '<h3 style="font-size: 18px; color: #f8fafc; margin: 0 0 16px 0; line-height: 1.3">$1</h3>') }} />
                                    </div>
                                ) : (
                                    <p className="copilot-narrative-placeholder">Machine operating within expected parameters. No anomaly pattern detected.</p>
                                )}
                            </div>

                            <div className="floor-plan-overview-card">
                                <p className="severity-card-label">System Operational Health</p>
                                <div className="severity-card-value">
                                    {machine.isShutdown ? '0' : ((1 - (machine.wearLevel || 0)) * 100).toFixed(0)}<span className="severity-card-value-max">%</span>
                                </div>
                                <p className="severity-card-signal-text" style={{ color: getStatusTone(machine) === 'stable' ? '#10b981' : '#f59e0b' }}>
                                    Health Status: {machine.isShutdown ? 'DECOMMISSIONED' : machine.ai_status === 'Normal' ? 'OPTIMAL HEALTH' : 'DEGRADED PERFORMANCE'}
                                </p>
                            </div>
                        </div>

                        <div>
                            <h3 className="specs-category-title">Live Telemetry Streams</h3>
                            <div className="diagnostics-summary-grid">
                                <MetricTile label="Temperature" value={formatMetric(machine.temperature, 1)} unit=" C" icon={Thermometer} anomaly={machine.anomaly_source === 'temperature'} />
                                <MetricTile label="Internal Pressure" value={formatMetric(machine.pressure, 1)} unit=" bar" icon={Gauge} anomaly={machine.anomaly_source === 'pressure'} />
                                <MetricTile label="Rotor Vibration" value={formatMetric(machine.vibration, 2)} unit=" mm/s" icon={Radio} anomaly={machine.anomaly_source === 'vibration'} />
                            </div>
                        </div>

                        <div className="specs-grid-wrapper">
                            <div>
                                <h3 className="specs-category-title">
                                    <Cpu size={16} color="#38bdf8" /> Physical Configuration Specs
                                </h3>
                                <div className="specs-subgrid">
                                    <div className="spec-tile-box">
                                        <p className="spec-tile-label">Max Rated Speed</p>
                                        <p className="spec-tile-value">{machine.physics?.maxRPM || 3000} <span className="spec-tile-value-unit">RPM</span></p>
                                    </div>
                                    <div className="spec-tile-box">
                                        <p className="spec-tile-label">Thermal Mass</p>
                                        <p className="spec-tile-value">{machine.physics?.thermalMass || 100} <span className="spec-tile-value-unit">J/°C</span></p>
                                    </div>
                                    <div className="spec-tile-box">
                                        <p className="spec-tile-label">Heat Dissipation</p>
                                        <p className="spec-tile-value">{(machine.physics?.heatDissipation || 0.7).toFixed(2)}</p>
                                    </div>
                                    <div className="spec-tile-box">
                                        <p className="spec-tile-label">Power Capacity</p>
                                        <p className="spec-tile-value">{machine.physics?.powerCapacity || 500} <span className="spec-tile-value-unit">kW</span></p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="specs-category-title">
                                    <Wind size={16} color="#8b5cf6" /> Micro-Climate & Degradation
                                </h3>
                                <div className="specs-subgrid">
                                    <div className="spec-tile-box">
                                        <p className="spec-tile-label">Ambient Air Temp</p>
                                        <p className="spec-tile-value">{formatMetric(machine.environment?.ambientTemperature || 25, 1)} <span className="spec-tile-value-unit">°C</span></p>
                                    </div>
                                    <div className="spec-tile-box">
                                        <p className="spec-tile-label">Relative Humidity</p>
                                        <p className="spec-tile-value">{((machine.environment?.humidity || 0.45) * 100).toFixed(0)} <span className="spec-tile-value-unit">%</span></p>
                                    </div>
                                    <div className="spec-tile-box">
                                        <p className="spec-tile-label">Structural Wear</p>
                                        <p className="spec-tile-value-wear">{((machine.wearLevel || 0) * 100).toFixed(2)} <span className="spec-tile-value-unit">%</span></p>
                                    </div>
                                    <div className="spec-tile-box">
                                        <p className="spec-tile-label">Lubrication Level</p>
                                        <p className="spec-tile-value-stable">{((machine.degradation?.lubricationLevel || 1.0) * 100).toFixed(1)} <span className="spec-tile-value-unit">%</span></p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="trends-chart-container">
                            <TrendChart title="Temperature Historical Trend" data={history} dataKey="temp" status={machine.ai_status} baseline={MACHINE_TYPES[meta.type]?.baseTemp} unit=" °C" height={320} />
                            <TrendChart title="Pressure Historical Trend" data={history} dataKey="pressure" status={machine.ai_status} baseline={MACHINE_TYPES[meta.type]?.basePressure} unit=" bar" height={320} />
                            <TrendChart title="Vibration Historical Trend" data={history} dataKey="vibration" status={machine.ai_status} baseline={MACHINE_TYPES[meta.type]?.baseVibration} unit=" mm/s" height={320} />
                        </div>
                    </div>
                )}

                {/* TAB 2: LOGIC EDITOR (No-Code Configurator) */}
                {activeTab === 'logic' && role === 'engineer' && (
                    <div className="logic-editor-tab-content">
                        {/* Sliders Configuration Panel */}
                        <div className="sliders-config-panel">
                            <h3 className="sliders-panel-title">
                                <Settings2 size={20} color="#8b5cf6" /> Safety Threshold Configuration
                            </h3>

                            <div className="logic-metrics-button-row">
                                <button 
                                    onClick={() => setActiveLogicMetric('temp')} 
                                    className={`logic-metric-tab-btn ${activeLogicMetric === 'temp' ? 'active' : 'inactive'}`}
                                >
                                    <Thermometer size={16} /> Temperature
                                </button>
                                <button 
                                    onClick={() => setActiveLogicMetric('pressure')} 
                                    className={`logic-metric-tab-btn ${activeLogicMetric === 'pressure' ? 'active' : 'inactive'}`}
                                >
                                    <Gauge size={16} /> Pressure
                                </button>
                                <button 
                                    onClick={() => setActiveLogicMetric('vibration')} 
                                    className={`logic-metric-tab-btn ${activeLogicMetric === 'vibration' ? 'active' : 'inactive'}`}
                                >
                                    <Radio size={16} /> Vibration
                                </button>
                            </div>

                            {/* DYNAMIC BASELINE SLIDERS */}
                            {activeLogicMetric === 'temp' && (
                                <div className="slider-group-container">
                                    <div className="slider-header-labels">
                                        <span className="slider-name-label">Standard Operating Temperature</span>
                                        <span className="slider-value-preview">{simBaseTemp}°C</span>
                                    </div>
                                    <input type="range" min="10" max="150" value={simBaseTemp} onChange={e => setSimBaseTemp(Number(e.target.value))} className="slider-input-element" />
                                    <p className="slider-description-helper">Adjusts the baseline norm for the AI temperature anomaly detection engine.</p>
                                </div>
                            )}

                            {activeLogicMetric === 'pressure' && (
                                <div className="slider-group-container">
                                    <div className="slider-header-labels">
                                        <span className="slider-name-label">Standard Operating Pressure</span>
                                        <span className="slider-value-preview">{simBasePressure} bar</span>
                                    </div>
                                    <input type="range" min="10" max="300" value={simBasePressure} onChange={e => setSimBasePressure(Number(e.target.value))} className="slider-input-element" />
                                    <p className="slider-description-helper">Adjusts the baseline norm for the AI pressure anomaly detection engine.</p>
                                </div>
                            )}

                            {activeLogicMetric === 'vibration' && (
                                <div className="slider-group-container">
                                    <div className="slider-header-labels">
                                        <span className="slider-name-label">Standard Vibration Baseline</span>
                                        <span className="slider-value-preview">{simBaseVibration.toFixed(1)} mm/s</span>
                                    </div>
                                    <input type="range" min="0" max="10" step="0.1" value={simBaseVibration} onChange={e => setSimBaseVibration(Number(e.target.value))} className="slider-input-element" />
                                    <p className="slider-description-helper">Adjusts the baseline norm for the AI vibration anomaly detection engine.</p>
                                </div>
                            )}

                            {/* UNIVERSAL RISK SLIDERS */}
                            <div className="risk-sliders-subpanel">
                                <div className="slider-group-container">
                                    <div className="slider-header-labels">
                                        <span className="slider-name-label">Warning Alert Trigger</span>
                                        <span className="warning-slider-value">{warnLimit}% Risk</span>
                                    </div>
                                    <input type="range" min="10" max={critLimit - 5} value={warnLimit} onChange={e => setWarnLimit(Number(e.target.value))} className="warning-slider-input" />
                                </div>

                                <div className="slider-group-container">
                                    <div className="slider-header-labels">
                                        <span className="slider-name-label">Critical Shutdown Trigger</span>
                                        <span className="critical-slider-value">{critLimit}% Risk</span>
                                    </div>
                                    <input type="range" min={warnLimit + 5} max="95" value={critLimit} onChange={e => setCritLimit(Number(e.target.value))} className="critical-slider-input" />
                                </div>
                            </div>

                            {/* EXPLICIT SAVE BUTTON */}
                            <div className="deploy-button-container">
                                <button
                                    onClick={handleDeployConfig}
                                    disabled={isDeploying}
                                    className="deploy-action-btn"
                                >
                                    {isDeploying ? (
                                        <><Loader2 size={18} className="spin" /> Deploying to Edge Node...</>
                                    ) : (
                                        <><Save size={18} /> Save & Deploy Configuration</>
                                    )}
                                </button>

                                {deploySuccess && (
                                    <div className="deploy-status-success-box">
                                        <CheckCircle2 size={16} /> Configuration successfully deployed to physical node.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Live Visual Preview Panel */}
                        <div className="logic-visual-preview-panel">
                            <h3 className="visual-preview-panel-title">Live Logic Envelope Preview</h3>

                            <div className="envelope-chart-area">
                                {/* Critical Zone (Top) */}
                                <div className="envelope-critical-zone" style={{ height: `${100 - critLimit}%` }}>
                                    <span className="envelope-zone-title-critical">CRITICAL ZONE</span>
                                </div>

                                {/* Warning Zone (Middle) */}
                                <div className="envelope-warning-zone" style={{ top: `${100 - critLimit}%`, height: `${critLimit - warnLimit}%` }}>
                                    <span className="envelope-zone-title-warning">WARNING ZONE</span>
                                </div>

                                {/* Safe Zone (Bottom) */}
                                <div className="envelope-safe-zone" style={{ top: `${100 - warnLimit}%` }}>
                                    <span className="envelope-zone-title-safe">SAFE OPERATION</span>
                                </div>

                                {/* Y-Axis Labels */}
                                <div className="envelope-axis-label" style={{ left: '-30px', top: '-5px' }}>100</div>
                                <div className="envelope-axis-label" style={{ left: '-30px', top: `calc(${100 - critLimit}% - 8px)`, color: '#ef4444', transition: 'top 0.2s' }}>{critLimit}</div>
                                <div className="envelope-axis-label" style={{ left: '-30px', top: `calc(${100 - warnLimit}% - 8px)`, color: '#f59e0b', transition: 'top 0.2s' }}>{warnLimit}</div>
                                <div className="envelope-axis-label" style={{ left: '-20px', bottom: '-5px' }}>0</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}