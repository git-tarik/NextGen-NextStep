import React, { useState, useEffect } from 'react';
import { getCandidates, getMetrics, getAuditLogs, approveCandidate } from '../../api';

function HRDashboard() {
    const [candidates, setCandidates] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [auditLogs, setAuditLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('pipeline');
    const [loading, setLoading] = useState(true);
    const [approvingId, setApprovingId] = useState(null);

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [candRes, metricsRes, auditRes] = await Promise.all([
                getCandidates(),
                getMetrics(),
                getAuditLogs(30)
            ]);
            setCandidates(candRes.data);
            setMetrics(metricsRes.data);
            setAuditLogs(auditRes.data);
        } catch (e) {
            console.error("Failed to load dashboard data:", e);
        }
        setLoading(false);
    };

    const handleApprove = async (candidateId) => {
        setApprovingId(candidateId);
        try {
            await approveCandidate(candidateId);
            await loadAll();
        } catch (e) {
            alert("Failed to approve candidate. Check terminal logs for details.");
        }
        setApprovingId(null);
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading HR Dashboard...</p>
            </div>
        );
    }

    const flaggedCandidates = candidates.filter(c => c.requires_hr_review);

    // Badge class helper
    const getStatusBadgeClass = (status) => {
        if (!status) return 'pending';
        const s = status.toLowerCase();
        if (s === 'ready' || s === 'completed') return 'verified';
        if (s === 'flagged' || s === 'rejected') return 'flagged';
        if (s === 'pending_hr_approval') return 'info';
        if (s === 'intake' || s === 'doc_collection') return 'intake';
        return 'pending';
    };

    const formatTime = (isoStr) => {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="fade-in">
            <div className="section-header">
                <div>
                    <h2>🛡️ HR Command Center</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        AI-powered onboarding oversight & analytics
                    </p>
                </div>
                <button className="btn-secondary" onClick={loadAll} type="button">
                    🔄 Refresh
                </button>
            </div>

            {/* KPI Cards */}
            {metrics && (
                <div className="kpi-grid">
                    <div className="kpi-card accent-primary">
                        <div className="kpi-icon">👥</div>
                        <div className="kpi-value">{metrics.total_candidates}</div>
                        <div className="kpi-label">Total Candidates</div>
                    </div>
                    <div className="kpi-card accent-success">
                        <div className="kpi-icon">✅</div>
                        <div className="kpi-value">{metrics.day1_ready_rate}%</div>
                        <div className="kpi-label">Day-1 Ready Rate</div>
                    </div>
                    <div className="kpi-card accent-primary">
                        <div className="kpi-icon">📊</div>
                        <div className="kpi-value">{metrics.avg_readiness_score}%</div>
                        <div className="kpi-label">Avg Readiness Score</div>
                    </div>
                    <div className="kpi-card accent-warning">
                        <div className="kpi-icon">⚠️</div>
                        <div className="kpi-value">{metrics.pending_reviews}</div>
                        <div className="kpi-label">Pending Reviews</div>
                    </div>
                    <div className="kpi-card accent-success">
                        <div className="kpi-icon">📄</div>
                        <div className="kpi-value">{metrics.docs_verified}</div>
                        <div className="kpi-label">Docs Verified</div>
                    </div>
                    <div className="kpi-card accent-danger">
                        <div className="kpi-icon">🚩</div>
                        <div className="kpi-value">{metrics.docs_flagged}</div>
                        <div className="kpi-label">Docs Flagged</div>
                    </div>
                    <div className="kpi-card accent-success">
                        <div className="kpi-icon">🛡️</div>
                        <div className="kpi-value">{metrics.bgv_cleared}</div>
                        <div className="kpi-label">BGV Cleared</div>
                    </div>
                    <div className="kpi-card accent-primary">
                        <div className="kpi-icon">💻</div>
                        <div className="kpi-value">{metrics.it_provisioned}</div>
                        <div className="kpi-label">IT Provisioned</div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="tabs">
                <button 
                    className={`tab ${activeTab === 'pipeline' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pipeline')}
                    type="button"
                >
                    📋 Candidate Pipeline
                </button>
                <button 
                    className={`tab ${activeTab === 'exceptions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('exceptions')}
                    type="button"
                >
                    🚨 Exceptions {flaggedCandidates.length > 0 && (
                        <span className="badge flagged" style={{ marginLeft: '0.5rem' }}>{flaggedCandidates.length}</span>
                    )}
                </button>
                <button 
                    className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audit')}
                    type="button"
                >
                    📜 Audit Log
                </button>
            </div>

            {/* Pipeline Tab */}
            {activeTab === 'pipeline' && (
                <div className="card">
                    <h3>Candidate Pipeline</h3>
                    {candidates.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">👤</div>
                            <h3>No candidates yet</h3>
                            <p>Candidates will appear here once they register through the portal.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Name</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Day-1 Readiness</th>
                                        <th>BGV</th>
                                        <th>IT</th>
                                        <th>Exceptions</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {candidates.map(c => (
                                        <tr key={c.id}>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>#{c.id}</td>
                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</td>
                                            <td>{c.role}</td>
                                            <td>
                                                <span className={`badge ${getStatusBadgeClass(c.status)}`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div className="progress-bar-container" style={{ width: '100px' }}>
                                                        <div 
                                                            className="progress-bar-fill"
                                                            style={{ 
                                                                width: `${c.day_1_readiness_score}%`,
                                                                background: c.day_1_readiness_score >= 100 
                                                                    ? 'var(--gradient-success)' 
                                                                    : 'var(--gradient-brand)'
                                                            }}
                                                        ></div>
                                                    </div>
                                                    <span style={{ 
                                                        fontSize: '0.8rem', 
                                                        fontWeight: 700, 
                                                        color: c.day_1_readiness_score >= 100 ? 'var(--accent-success)' : 'var(--text-secondary)',
                                                        minWidth: '35px'
                                                    }}>
                                                        {c.day_1_readiness_score}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${c.bgv_status === 'cleared' ? 'verified' : c.bgv_status === 'flagged' ? 'flagged' : 'pending'}`}>
                                                    {c.bgv_status || 'pending'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${c.it_status === 'completed' ? 'verified' : 'pending'}`}>
                                                    {c.it_status || 'pending'}
                                                </span>
                                            </td>
                                            <td>
                                                {c.requires_hr_review ? (
                                                    <span className="badge flagged">🚨 Review</span>
                                                ) : (
                                                    <span className="badge verified">Clear</span>
                                                )}
                                            </td>
                                            <td>
                                                {c.status === 'pending_hr_approval' ? (
                                                    <button
                                                        className="btn-primary"
                                                        type="button"
                                                        disabled={approvingId === c.id}
                                                        onClick={() => handleApprove(c.id)}
                                                    >
                                                        {approvingId === c.id ? '⏳ Approving...' : '✅ Approve'}
                                                    </button>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Exceptions Tab */}
            {activeTab === 'exceptions' && (
                <div className="card">
                    <h3>🚨 Exception Routing</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                        Candidates flagged for manual HR review
                    </p>
                    {flaggedCandidates.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">✅</div>
                            <h3>All Clear</h3>
                            <p>No candidates require manual review at this time.</p>
                        </div>
                    ) : (
                        <div>
                            {flaggedCandidates.map(c => (
                                <div 
                                    key={c.id} 
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between',
                                        padding: '1rem',
                                        background: 'var(--accent-danger-bg)',
                                        border: '1px solid var(--accent-danger-border)',
                                        borderRadius: 'var(--radius-sm)',
                                        marginBottom: '0.75rem'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                                            {c.name}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {c.role} • Score: {c.day_1_readiness_score}% • BGV: {c.bgv_status}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <span className="badge flagged">Needs Review</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Audit Log Tab */}
            {activeTab === 'audit' && (
                <div className="card">
                    <h3>📜 Audit Log — Compliance Tracking</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                        Complete audit trail of all system and AI agent actions
                    </p>
                    {auditLogs.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📜</div>
                            <h3>No audit entries yet</h3>
                            <p>Audit logs will appear as candidates are processed.</p>
                        </div>
                    ) : (
                        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            {auditLogs.map((log, i) => (
                                <div key={i} className="audit-item">
                                    <span className={`badge ${log.severity === 'warning' ? 'pending' : log.severity === 'error' ? 'flagged' : 'info'}`}>
                                        {log.action}
                                    </span>
                                    <span className="audit-detail">{log.details}</span>
                                    {log.agent_name && (
                                        <span className="audit-agent">{log.agent_name}</span>
                                    )}
                                    <span className="audit-time">{formatTime(log.timestamp)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default HRDashboard;
