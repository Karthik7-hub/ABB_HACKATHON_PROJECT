import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush, ReferenceLine } from 'recharts';
import { Maximize, Minimize } from 'lucide-react';
import { toNumber, formatMetric } from '../../utils/helpers';
import './SharedUI.css';

export function StatCard({ icon: Icon, label, value, detail, tone = 'neutral' }) {
    return (
        <div className={`stat-card tone-${tone}`}>
            <div className="stat-icon-wrap"><Icon className="stat-icon" /></div>
            <div>
                <p className="stat-label">{label}</p>
                <strong className="stat-value">{value}</strong>
                <span className="stat-detail">{detail}</span>
            </div>
        </div>
    );
}

export function MetricTile({ label, value, unit, anomaly, icon: Icon }) {
    return (
        <div className={`metric-box ${anomaly ? 'metric-anomaly' : ''}`}>
            <div className="metric-label-row">{Icon && <Icon className="metric-icon" />}<span className="metric-label">{label}</span></div>
            <div className="metric-value">{value}<span className="metric-unit">{unit}</span></div>
        </div>
    );
}

export function MiniTrend({ data, metric = 'temp', tone = 'normal' }) {
    const values = (data || []).map((item) => toNumber(item[metric], NaN)).filter((value) => Number.isFinite(value)).slice(-14);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    const range = max - min || 1;

    return (
        <div className={`mini-trend tone-${tone}`} aria-label="Recent machine trend">
            <span className="mini-trend-label">Trend</span>
            <div className="trend-bars">
                {values.length === 0 ? (<span className="trend-placeholder">Collecting</span>) : values.map((value, index) => (
                    <span key={`${metric}-${index}-${value}`} className="trend-bar" style={{ height: `${26 + ((value - min) / range) * 68}%` }} />
                ))}
            </div>
        </div>
    );
}

export function TrendChart({ title, data, dataKey, status = 'Normal', baseline, unit, height = 250 }) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    // FIX 1: Only take the last 60 data points! This stops the squishing and makes it scroll smoothly.
    const chartData = (data || []).slice(-60);

    const values = chartData.map((item) => toNumber(item[dataKey], NaN)).filter((value) => Number.isFinite(value));
    const latest = values.length ? values[values.length - 1] : null;
    const min = values.length ? Math.min(...values) : null;
    const max = values.length ? Math.max(...values) : null;
    const digits = dataKey === 'vibration' ? 2 : 1;

    const padding = (max !== null && min !== null) ? (max - min) * 0.2 : 0;
    const yMaxCalc = max !== null ? max + padding : (baseline ? baseline * 1.5 : 100);
    const yMinCalc = min !== null ? min - padding : (baseline ? baseline * 0.5 : 0);
    const range = yMaxCalc - yMinCalc || 1;

    const upperLimit = baseline ? baseline * 1.06 : yMaxCalc;
    const offUpper = Math.max(0, Math.min(1, (yMaxCalc - upperLimit) / range));

    const chartContent = (
        <>
            <div className="chart-title-row" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                    <h3 className="chart-title" style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {title}
                        {isFullscreen && <span style={{ backgroundColor: 'rgba(56,189,248,0.1)', color: '#38bdf8', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>FULLSCREEN MODE</span>}
                    </h3>
                    <span className="chart-subtitle">LAST {values.length || 0} SAMPLES</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <strong className="chart-latest" style={{ color: status === 'Warning' ? '#f59e0b' : status === 'Critical' ? '#ef4444' : '#10b981', fontSize: '24px' }}>
                        {latest === null ? '--' : formatMetric(latest, digits)} <span style={{ fontSize: '14px' }}>{unit.trim()}</span>
                    </strong>

                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        style={{
                            background: isFullscreen ? '#ef4444' : 'rgba(56,189,248,0.1)',
                            border: isFullscreen ? 'none' : '1px solid rgba(56,189,248,0.3)',
                            color: isFullscreen ? '#fff' : '#38bdf8',
                            cursor: 'pointer',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s'
                        }}
                    >
                        {isFullscreen ? <><Minimize size={18} /> Close Fullscreen</> : <><Maximize size={18} /> Fullscreen</>}
                    </button>
                </div>
            </div>

            <div className="chart-container" style={{ minHeight: isFullscreen ? 'calc(100vh - 200px)' : `${height}px`, width: '100%', position: 'relative' }}>
                <ResponsiveContainer width="100%" height={isFullscreen ? '100%' : height}>
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <defs>
                            <linearGradient id={`splitColor-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset={0} stopColor="#f59e0b" stopOpacity={1} />
                                <stop offset={offUpper} stopColor="#f59e0b" stopOpacity={1} />
                                <stop offset={offUpper} stopColor="#10b981" stopOpacity={1} />
                                <stop offset={1} stopColor="#10b981" stopOpacity={1} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.05)" vertical={false} />

                        <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickMargin={10} minTickGap={60} tick={{ fill: '#64748b' }} tickFormatter={(tick) => { const d = new Date(tick); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour12: false }); }} />
                        <YAxis domain={[yMinCalc, yMaxCalc]} stroke="#64748b" fontSize={11} tick={{ fill: '#64748b' }} tickFormatter={(val) => val.toFixed(digits)} />

                        <Tooltip labelFormatter={(label) => { const d = new Date(label); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour12: false }); }} formatter={(value) => [`${formatMetric(value, digits)}${unit}`, title]} contentStyle={{ backgroundColor: '#07111f', border: `1px solid rgba(148,163,184,0.2)`, borderRadius: '10px', fontSize: '12px', boxShadow: '0 18px 44px rgba(0,0,0,0.42)' }} labelStyle={{ color: '#cbd5e1', marginBottom: '4px', fontWeight: 'bold' }} />

                        {baseline && (
                            <ReferenceLine y={baseline} stroke="#10b981" strokeDasharray="4 4" opacity={0.3} />
                        )}

                        <Line type="monotone" dataKey={dataKey} stroke={`url(#splitColor-${dataKey})`} strokeWidth={2.8} dot={false} isAnimationActive={false} />
                        <Brush dataKey="time" height={16} stroke="rgba(56,189,248,0.3)" fill="#080b10" tickFormatter={() => ''} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="trend-range" style={{ marginTop: '1rem', display: 'flex', gap: '1rem', color: '#64748b', fontSize: '12px', fontWeight: 600 }}>
                <span>Min: {min === null ? '--' : formatMetric(min, digits)}</span>
                <span>Max: {max === null ? '--' : formatMetric(max, digits)}</span>
            </div>
        </>
    );

    if (isFullscreen) {
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(7, 17, 31, 0.95)', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '16px', padding: '2rem', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                    {chartContent}
                </div>
            </div>
        );
    }

    return (
        <div className="chart-section trend-card" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {chartContent}
        </div>
    );
}