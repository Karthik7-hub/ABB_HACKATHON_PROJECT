import React from 'react';
import { AlertCircle, CheckCircle2, ClipboardCheck, Eye, Zap, Brain } from 'lucide-react';
import { formatTime, toNumber, getMeta } from '../utils/helpers';
import { statusCopy } from '../utils/constants';

export default function SmartActionCenter({ activeAlerts, ackAlerts, commandLog, machineMeta, showAcknowledged, setShowAcknowledged, onAcknowledge, onAcknowledgeAll, onInvestigate, getStatusClass }) {
    return (
        <section className="pane right-pane">
            <div className="right-pane-bg" />
            <div className="pane-header flex-between">
                <div><h2 className="pane-title with-icon"><AlertCircle className="title-icon" /> Smart Action Center</h2><p className="pane-subtitle">ML-prioritized alerts and operator actions</p></div>
                {activeAlerts.length > 0 && (
                    <div className="action-header-tools">
                        <div className="alert-badge"><div className="alert-dot pulse" /> {activeAlerts.length} unresolved</div>
                        <button type="button" className="icon-action-btn" onClick={onAcknowledgeAll}><ClipboardCheck size={14} /> Ack all</button>
                    </div>
                )}
            </div>

            <div className="alerts-container">
                {activeAlerts.length === 0 ? (
                    <div className="empty-state alerts-empty">
                        <div className="normal-icon-wrapper"><CheckCircle2 className="normal-icon" /></div>
                        <h3 className="empty-title">All systems normal</h3>
                        <p className="empty-subtitle">Isolation Forest reports no unresolved anomalies.</p>
                    </div>
                ) : activeAlerts.map((item) => {
                    const meta = getMeta(item.id, machineMeta);
                    return (
                        <article key={`alert-${item.id}`} className={`alert-card ${getStatusClass(item.ai_status)}`}>
                            <div className="severity-bar" />
                            <div className="alert-content">
                                <div className="alert-info">
                                    <div className="alert-title-row">
                                        <h3 className="alert-id">{item.id}</h3>
                                        <span className="alert-status-badge">{item.ai_status}</span>
                                        {item.anomaly_source && item.anomaly_source !== 'none' && <span className="anomaly-source-tag">{item.anomaly_source}</span>}
                                    </div>
                                    <p className="alert-desc">Zone {meta.zone} / {meta.label} / {statusCopy[item.ai_status]}</p>
                                    {item.copilot && (
                                        <div className="copilot-mini"><Brain size={12} className="copilot-mini-icon" /><span>{item.copilot.probability}% probability - {item.copilot.failure_mode}</span></div>
                                    )}
                                </div>
                                <div className="severity-box"><div className="severity-number">{toNumber(item.severity_score)}</div><div className="severity-label">/ 100</div></div>
                            </div>
                            <div className="alert-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => onAcknowledge(item.id)}><ClipboardCheck size={13} /> Acknowledge</button>
                                <button type="button" className="btn btn-primary" onClick={() => onInvestigate(item.id)}><Eye size={13} /> Investigate</button>
                            </div>
                        </article>
                    );
                })}

                {ackAlerts.length > 0 && (
                    <div className="acknowledged-section">
                        <button type="button" className="ack-title" onClick={() => setShowAcknowledged((v) => !v)}><ClipboardCheck size={13} /> Acknowledged ({ackAlerts.length}) <span>{showAcknowledged ? 'Hide' : 'Show'}</span></button>
                        {showAcknowledged && ackAlerts.map((item) => (
                            <div key={`ack-${item.id}`} className="alert-card acknowledged">
                                <div className="alert-content compact">
                                    <div className="alert-info">
                                        <div className="alert-title-row"><h3 className="alert-id">{item.id}</h3><span className="ack-tag">Operator 1</span></div>
                                        <p className="alert-desc">Severity {toNumber(item.severity_score)}/100 / {getMeta(item.id, machineMeta).label}</p>
                                    </div>
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => onInvestigate(item.id)}>View</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="operations-log">
                    <div className="operations-header"><Zap size={14} /><h3>Command Log</h3></div>
                    {commandLog.length === 0 ? (
                        <p className="log-empty">No remote commands executed in this session.</p>
                    ) : commandLog.map((entry) => (
                        <div key={entry.id} className="log-entry">
                            <span className={`log-dot ${entry.action === 'shutdown' ? 'critical' : 'normal'}`} />
                            <div><strong>{entry.machineId}</strong><p>{entry.action === 'shutdown' ? 'Shutdown executed' : 'Restart completed'} / {formatTime(entry.timestamp)}</p></div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}