import React from 'react';
import { TrendingUp, Clock, ShieldCheck, AlertTriangle, Zap, CheckCircle2, Activity } from 'lucide-react';

export default function ManagerAnalytics({ telemetry }) {
    // Calculate live stats based on your actual telemetry data
    const total = telemetry.length;
    const healthy = telemetry.filter(m => m.ai_status === 'Normal').length;
    const healthPercent = total > 0 ? ((healthy / total) * 100).toFixed(0) : 0;
    const activeAlerts = total - healthy;

    // Simulated chart data for the risk trend
    const chartData = [
        { label: '8AM', val: 40 },
        { label: '10AM', val: 30 },
        { label: '12PM', val: 45 },
        { label: '2PM', val: 80 },
        { label: '4PM', val: 50 },
        { label: '6PM', val: 30 },
        { label: '8PM', val: 20 }
    ];

    return (
        <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>
            <h2 style={{ color: '#f8fafc', fontSize: '18px', margin: 0, fontWeight: 700 }}>Plant Performance Overview</h2>

            {/* 2x2 KPI GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ backgroundColor: 'rgba(56,189,248,0.05)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(56,189,248,0.1)' }}>
                    <ShieldCheck size={20} color="#38bdf8" />
                    <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, margin: '8px 0 4px 0', letterSpacing: '1px' }}>AVAILABILITY</p>
                    <h3 style={{ color: '#f8fafc', margin: 0, fontSize: '26px', fontWeight: 800 }}>{healthPercent}%</h3>
                </div>

                <div style={{ backgroundColor: 'rgba(16,185,129,0.05)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.1)' }}>
                    <Clock size={20} color="#10b981" />
                    <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, margin: '8px 0 4px 0', letterSpacing: '1px' }}>RESPONSE TIME</p>
                    <h3 style={{ color: '#f8fafc', margin: 0, fontSize: '26px', fontWeight: 800 }}>42s</h3>
                </div>

                <div style={{ backgroundColor: 'rgba(245,158,11,0.05)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.1)' }}>
                    <AlertTriangle size={20} color="#f59e0b" />
                    <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, margin: '8px 0 4px 0', letterSpacing: '1px' }}>ACTIVE ALERTS</p>
                    <h3 style={{ color: '#f8fafc', margin: 0, fontSize: '26px', fontWeight: 800 }}>{activeAlerts}</h3>
                </div>

                <div style={{ backgroundColor: 'rgba(139,92,246,0.05)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.1)' }}>
                    <Zap size={20} color="#8b5cf6" />
                    <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, margin: '8px 0 4px 0', letterSpacing: '1px' }}>EFFICIENCY (OEE)</p>
                    <h3 style={{ color: '#f8fafc', margin: 0, fontSize: '26px', fontWeight: 800 }}>88%</h3>
                </div>
            </div>

            {/* ENHANCED CHART WITH AXES AND LABELS */}
            <div style={{ backgroundColor: '#07111f', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div>
                        <span style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 600, display: 'block' }}>Daily Risk Trend</span>
                        <span style={{ color: '#64748b', fontSize: '12px' }}>Aggregated severity scores</span>
                    </div>
                    <TrendingUp size={18} color="#38bdf8" />
                </div>

                {/* Chart Container */}
                <div style={{ position: 'relative', height: '140px', display: 'flex', marginTop: '10px' }}>
                    {/* Y-Axis Labels - Note the bottom padding offsets the labels below */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: '12px', color: '#64748b', fontSize: '10px', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px' }}>
                        <span>100</span>
                        <span>50</span>
                        <span>0</span>
                    </div>

                    {/* Bars Area - THE CSS FIX IS HERE (alignItems: 'stretch') */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', paddingLeft: '16px', position: 'relative' }}>
                        {/* Horizontal Grid Lines */}
                        <div style={{ position: 'absolute', top: 0, left: 16, right: 0, borderTop: '1px dashed rgba(255,255,255,0.05)' }}></div>
                        <div style={{ position: 'absolute', top: 'calc(50% - 10px)', left: 16, right: 0, borderTop: '1px dashed rgba(255,255,255,0.05)' }}></div>

                        {chartData.map((d, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, width: '100%', height: '100%' }}>

                                {/* Bar Wrapper ensures heights calculate correctly */}
                                <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '8px' }}>
                                    <div style={{ width: '60%', height: `${d.val}%`, backgroundColor: d.val > 70 ? '#ef4444' : '#38bdf8', borderRadius: '4px 4px 0 0', opacity: 0.9, transition: 'height 0.3s ease-in-out' }}></div>
                                </div>

                                {/* X-Axis Label */}
                                <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 600, height: '12px' }}>{d.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* SECTION: AI OPERATIONAL INSIGHTS */}
            <div style={{ flex: 1, backgroundColor: '#07111f', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 600, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={16} color="#10b981" /> AI Operational Insights
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <AlertTriangle size={16} color="#f59e0b" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div>
                            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '13px', lineHeight: 1.4 }}>Vibration anomalies detected in Zone D compressors during peak load hours.</p>
                            <span style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>2 hours ago</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <CheckCircle2 size={16} color="#10b981" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div>
                            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '13px', lineHeight: 1.4 }}>Cooling protocol successfully prevented Pump_01 thermal overload.</p>
                            <span style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>4 hours ago</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <TrendingUp size={16} color="#38bdf8" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div>
                            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '13px', lineHeight: 1.4 }}>Overall Equipment Effectiveness (OEE) is up 4% compared to yesterday.</p>
                            <span style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>Shift start</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}