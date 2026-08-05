import React, { useState, useEffect, useRef } from 'react';
import { createCandidate, uploadDocument, getCandidateByEmail, getCandidateTimeline, getNotifications, submitBankDetails, getPayslipDownloadUrl } from '../../api';
import AIChatPopup from '../AIChatPopup';

// Readiness Gauge Component
function ReadinessGauge({ score }) {
    const radius = 72;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    
    return (
        <div className="readiness-gauge">
            <svg viewBox="0 0 180 180">
                <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="50%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                </defs>
                <circle className="track" cx="90" cy="90" r={radius} />
                <circle 
                    className="fill" 
                    cx="90" cy="90" r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
            </svg>
            <div className="score-text">
                <div className="score-value">{score}</div>
                <div className="score-label">Day-1 Ready</div>
            </div>
        </div>
    );
}

// Timeline Step Component
function TimelineStep({ step, status, detail, isLast }) {
    const dotClass = status === 'completed' ? 'completed' : status === 'active' ? 'active' : status === 'flagged' ? 'flagged' : '';
    return (
        <div className="timeline-item">
            <div className={`timeline-dot ${dotClass}`}></div>
            <div className="timeline-content">
                <h4>{step}</h4>
                <p>{detail}</p>
            </div>
        </div>
    );
}

// Onboarding stage definitions
const ONBOARDING_STAGES = [
    { key: 'intake', label: 'Intake', icon: '📋' },
    { key: 'doc_collection', label: 'Document Collection', icon: '📁' },
    { key: 'pending_hr_approval', label: 'HR Approval', icon: '✅' },
    { key: 'bgv_coordination', label: 'Background Verification', icon: '🛡️' },
    { key: 'hr_setup', label: 'HR Record Setup', icon: '👤' },
    { key: 'payroll_setup', label: 'Payroll Setup', icon: '💰' },
    { key: 'it_provisioning', label: 'IT Provisioning', icon: '💻' },
    { key: 'ready', label: 'Day-1 Ready', icon: '🎉' },
];

function CandidatePortal({ loggedInEmail }) {
    const [candidateId, setCandidateId] = useState(null);
    const [candidate, setCandidate] = useState(null);
    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [docType, setDocType] = useState('ID');
    const [documents, setDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    
    // Timeline
    const [timeline, setTimeline] = useState([]);
    
    // Notifications
    const [notifications, setNotifications] = useState([]);

    // Payroll / bank details
    const [bankForm, setBankForm] = useState({ accountNumber: '', bankName: '', panNumber: '' });
    const [submittingBank, setSubmittingBank] = useState(false);
    const [bankError, setBankError] = useState('');

    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (loggedInEmail) {
            checkExistingCandidate();
        } else {
            setLoading(false);
        }
    }, [loggedInEmail]);

    const checkExistingCandidate = async () => {
        try {
            const res = await getCandidateByEmail(loggedInEmail);
            if (res.data.candidate) {
                setCandidate(res.data.candidate);
                setCandidateId(res.data.candidate.id);
                // Load timeline and notifications
                loadTimeline(res.data.candidate.id);
                loadNotifications(res.data.candidate.id);
            }
            if (res.data.documents) {
                setDocuments(res.data.documents);
            }
        } catch (e) {
            console.log("Candidate not found, needs registration.");
        }
        setLoading(false);
    };

    const loadTimeline = async (id) => {
        try {
            const res = await getCandidateTimeline(id);
            setTimeline(res.data);
        } catch (e) {
            console.log("Could not load timeline");
        }
    };

    const loadNotifications = async (id) => {
        try {
            const res = await getNotifications(id);
            setNotifications(res.data);
        } catch (e) {
            console.log("Could not load notifications");
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            const res = await createCandidate({
                name: e.target.name.value,
                email: loggedInEmail,
                role: e.target.role.value
            });
            setCandidateId(res.data.id);
            setCandidate(res.data);
            loadTimeline(res.data.id);
            loadNotifications(res.data.id);
        } catch (e) {
            alert("Error creating candidate. Email may already be registered.");
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) {
            alert("Please select a file to upload!");
            return;
        }
        if (!candidateId) return;
        
        setUploading(true);
        try {
            await uploadDocument(candidateId, file, docType);
            setFile(null);
            setFileName('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            checkExistingCandidate();
        } catch (error) {
            alert("Failed to upload document. Check terminal logs for details.");
        }
        setUploading(false);
    };

    const handleBankDetailsSubmit = async (e) => {
        e.preventDefault();
        if (!candidateId) return;
        setBankError('');
        setSubmittingBank(true);
        try {
            await submitBankDetails(candidateId, {
                account_number: bankForm.accountNumber,
                bank_name: bankForm.bankName,
                pan_number: bankForm.panNumber
            });
            setBankForm({ accountNumber: '', bankName: '', panNumber: '' });
            await checkExistingCandidate();
        } catch (error) {
            setBankError('Failed to submit bank details. Please check the values and try again.');
        }
        setSubmittingBank(false);
    };

    const handleFileSelect = (selectedFile) => {
        setFile(selectedFile);
        setFileName(selectedFile.name);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) handleFileSelect(droppedFile);
    };



    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading your portal...</p>
            </div>
        );
    }

    if (!loggedInEmail) {
        return (
            <div className="empty-state">
                <div className="empty-icon">🔒</div>
                <h3>Access Required</h3>
                <p>Please login first to access your candidate portal.</p>
            </div>
        );
    }

    const requiredDocs = ["ID", "Degree", "Offer Letter"];
    const uploadedTypes = documents.map(d => d.document_type);
    const missingDocs = requiredDocs.filter(d => !uploadedTypes.includes(d));
    const readinessScore = candidate?.day_1_readiness_score || 0;

    // Determine current stage for timeline
    const currentStepKey = candidate?.status || 'intake';
    const stageIndex = ONBOARDING_STAGES.findIndex(s => s.key === currentStepKey);

    return (
        <div className="fade-in">
            {/* Header */}
            <div className="section-header">
                <div>
                    <h2>Welcome, {candidate?.name || loggedInEmail} 👋</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {candidate ? `Role: ${candidate.role}` : 'Complete registration to begin your journey'}
                        {candidate && <span style={{ margin: '0 0.5rem' }}>•</span>}
                        {candidate && <span className={`badge ${readinessScore >= 100 ? 'success' : readinessScore > 50 ? 'pending' : 'intake'}`}>
                            {readinessScore >= 100 ? 'Day-1 Ready' : 'In Progress'}
                        </span>}
                    </p>
                </div>
            </div>

            {!candidateId ? (
                /* Registration Form */
                <div style={{ maxWidth: '500px' }}>
                    <div className="card">
                        <h3>📋 Begin Your Onboarding Journey</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                            Complete the form below to start your onboarding process. Our AI agents will guide you through every step.
                        </p>
                        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Full Name</label>
                                <input name="name" placeholder="John Doe" required id="register-name" />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Role</label>
                                <select name="role" id="register-role">
                                    <option value="Software Engineer">Software Engineer</option>
                                    <option value="Product Manager">Product Manager</option>
                                    <option value="Data Analyst">Data Analyst</option>
                                    <option value="UX Designer">UX Designer</option>
                                    <option value="DevOps Engineer">DevOps Engineer</option>
                                </select>
                            </div>
                            <button type="submit" className="btn-primary">🚀 Begin Onboarding</button>
                        </form>
                    </div>
                </div>
            ) : (
                /* Main Portal */
                <div className="portal-grid">
                    {/* Readiness Score + Onboarding Steps */}
                    <div className="card">
                        <h3>🎯 Day-1 Readiness</h3>
                        <ReadinessGauge score={readinessScore} />
                        <div style={{ marginTop: '1.5rem' }}>
                            <h4 style={{ marginBottom: '1rem' }}>Onboarding Progress</h4>
                            <div className="timeline">
                                {ONBOARDING_STAGES.map((stage, i) => {
                                    let status = 'pending';
                                    if (i < stageIndex) status = 'completed';
                                    else if (i === stageIndex) status = candidate?.requires_hr_review ? 'flagged' : 'active';

                                    // Background verification is mocked (no real BGV vendor integration yet)
                                    const isMockBgv = stage.key === 'bgv_coordination' && (status === 'completed' || status === 'active');

                                    return (
                                        <TimelineStep
                                            key={stage.key}
                                            step={`${stage.icon} ${stage.label}`}
                                            status={status}
                                            detail={
                                                isMockBgv ? 'Mock Review in Process' :
                                                status === 'completed' ? 'Completed' :
                                                status === 'active' ? 'In Progress' :
                                                status === 'flagged' ? 'Needs Review' : 'Pending'
                                            }
                                            isLast={i === ONBOARDING_STAGES.length - 1}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Documents Section */}
                    <div>
                        <div className="card">
                            <h3>📄 Documents</h3>
                            
                            {/* Document Status Cards */}
                            <div className="doc-grid" style={{ marginBottom: '1.5rem' }}>
                                {requiredDocs.map(req => {
                                    const doc = documents.find(d => d.document_type === req);
                                    const isUploaded = !!doc;
                                    const isFlagged = doc?.status?.toLowerCase() === 'flagged';
                                    const isVerified = isUploaded && !isFlagged && doc?.status?.toLowerCase() !== 'uploaded';
                                    
                                    return (
                                        <div key={req} className={`doc-card ${isVerified ? 'uploaded' : isFlagged ? 'flagged' : isUploaded ? 'uploaded' : 'missing'}`}>
                                            <div className="doc-icon">
                                                {isVerified ? '✅' : isFlagged ? '⚠️' : isUploaded ? '📎' : '📭'}
                                            </div>
                                            <div className="doc-name">{req}</div>
                                            <div className="doc-status">
                                                <span className={`badge ${isVerified ? 'verified' : isFlagged ? 'flagged' : isUploaded ? 'pending' : 'error'}`}>
                                                    {isVerified ? 'Verified' : isFlagged ? 'Flagged' : isUploaded ? 'Uploaded' : 'Missing'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {candidate?.status === 'pending_hr_approval' && (
                                <div style={{
                                    background: 'var(--accent-primary-bg, rgba(99, 102, 241, 0.1))',
                                    border: '1px solid var(--accent-primary-border, rgba(99, 102, 241, 0.3))',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '0.75rem 1rem',
                                    marginBottom: '1rem',
                                    fontSize: '0.8rem',
                                    color: 'var(--text-secondary)'
                                }}>
                                    ✅ All documents reviewed. Awaiting HR approval to continue onboarding.
                                </div>
                            )}

                            {missingDocs.length > 0 && (
                                <div style={{ 
                                    background: 'var(--accent-warning-bg)', 
                                    border: '1px solid var(--accent-warning-border)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '0.75rem 1rem',
                                    marginBottom: '1rem',
                                    fontSize: '0.8rem',
                                    color: 'var(--accent-warning)'
                                }}>
                                    ⚠️ {missingDocs.length} document(s) still required. Upload them to proceed with verification.
                                </div>
                            )}

                            {/* Upload Form */}
                            <form onSubmit={handleUpload}>
                                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <select 
                                        value={docType} 
                                        onChange={e => setDocType(e.target.value)}
                                        style={{ flex: '0 0 160px' }}
                                        id="doc-type-select"
                                    >
                                        <option value="ID">Government ID</option>
                                        <option value="Degree">Degree Certificate</option>
                                        <option value="Offer Letter">Offer Letter</option>
                                    </select>
                                    <button 
                                        type="submit" 
                                        className="btn-primary" 
                                        disabled={!file || uploading}
                                    >
                                        {uploading ? '⏳ Processing...' : '⬆️ Upload'}
                                    </button>
                                </div>
                                
                                <div 
                                    className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        onChange={e => { if (e.target.files[0]) handleFileSelect(e.target.files[0]); }}
                                        style={{ display: 'none' }}
                                        id="file-upload-input"
                                    />
                                    <div className="upload-icon">
                                        {fileName ? '📎' : '☁️'}
                                    </div>
                                    <p>
                                        {fileName 
                                            ? <><strong>{fileName}</strong> — ready to upload</>
                                            : <>Drag & drop a file here or <span className="browse-link">browse</span></>
                                        }
                                    </p>
                                </div>
                            </form>
                        </div>

                        {/* Payroll Setup */}
                        {(candidate?.status === 'payroll_setup' || candidate?.payslip_pdf_path) && (
                            <div className="card">
                                <h3>💰 Payroll Setup</h3>

                                {candidate?.payslip_pdf_path ? (
                                    <div>
                                        <div style={{
                                            background: 'var(--accent-success-bg)',
                                            border: '1px solid var(--accent-success-border)',
                                            borderRadius: 'var(--radius-sm)',
                                            padding: '0.75rem 1rem',
                                            marginBottom: '1rem',
                                            fontSize: '0.8rem',
                                            color: 'var(--text-secondary)'
                                        }}>
                                            ✅ Payroll configured — Annual CTC ₹9,00,000. Your payslip with the full salary breakdown and bank details is ready.
                                        </div>
                                        <a
                                            className="btn-primary"
                                            style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
                                            href={getPayslipDownloadUrl(candidateId)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download
                                        >
                                            ⬇️ Download Payslip (PDF)
                                        </a>
                                    </div>
                                ) : (
                                    <div>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                            Your HR record has been set up. To finalize payroll at an annual CTC of ₹9,00,000, please submit your bank details below.
                                        </p>
                                        <form onSubmit={handleBankDetailsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Bank Name</label>
                                                <input
                                                    value={bankForm.bankName}
                                                    onChange={e => setBankForm({ ...bankForm, bankName: e.target.value })}
                                                    placeholder="e.g. HDFC Bank"
                                                    required
                                                    id="bank-name-input"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Account Number</label>
                                                <input
                                                    value={bankForm.accountNumber}
                                                    onChange={e => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                                                    placeholder="Bank account number"
                                                    required
                                                    id="bank-account-input"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>PAN Number</label>
                                                <input
                                                    value={bankForm.panNumber}
                                                    onChange={e => setBankForm({ ...bankForm, panNumber: e.target.value.toUpperCase() })}
                                                    placeholder="ABCDE1234F"
                                                    maxLength={10}
                                                    required
                                                    id="pan-number-input"
                                                />
                                            </div>
                                            {bankError && (
                                                <div style={{ color: 'var(--accent-danger, #ef4444)', fontSize: '0.8rem' }}>{bankError}</div>
                                            )}
                                            <button type="submit" className="btn-primary" disabled={submittingBank}>
                                                {submittingBank ? '⏳ Submitting...' : '💾 Submit & Generate Payslip'}
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Notifications */}
                        {notifications.length > 0 && (
                            <div className="card">
                                <h3>🔔 Notifications</h3>
                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    {notifications.slice(0, 5).map((n, i) => (
                                        <div key={i} className="notification-item">
                                            <div className={`notif-icon ${n.type === 'success' ? 'success' : n.type === 'warning' ? 'warning' : 'info'}`}>
                                                {n.type === 'success' ? '✅' : n.type === 'warning' ? '⚠️' : 'ℹ️'}
                                            </div>
                                            <div className="notif-content">
                                                <div className="notif-title">{n.title}</div>
                                                <div className="notif-message">{n.message}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            )}
            {/* Floating AI Assistant Popup */}
            <AIChatPopup />
        </div>
    );
}

export default CandidatePortal;
