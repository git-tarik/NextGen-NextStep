import React, { useState, useEffect, useRef } from 'react';
import { createCandidate, uploadDocument, chatWithAssistant, getCandidateByEmail, getCandidateTimeline, getNotifications } from '../../api';

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
    { key: 'doc_verification', label: 'Document Verification', icon: '🔍' },
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
    
    // Chat state
    const [query, setQuery] = useState("");
    const [chatLog, setChatLog] = useState([
        { sender: 'bot', text: 'Hi! 👋 I\'m your AI onboarding assistant. Ask me anything about your onboarding journey!' }
    ]);
    const [chatLoading, setChatLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const suggestedQuestions = [
        "What documents do I need?",
        "How long does BGV take?",
        "What is Day-1 readiness?",
        "When do I get IT equipment?",
    ];

    useEffect(() => {
        if (loggedInEmail) {
            checkExistingCandidate();
        } else {
            setLoading(false);
        }
    }, [loggedInEmail]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLog, chatLoading]);

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

    const handleChat = async (e) => {
        e?.preventDefault();
        const q = typeof e === 'string' ? e : query;
        if (!q.trim()) return;
        
        const newLog = [...chatLog, { sender: 'user', text: q }];
        setChatLog(newLog);
        setQuery("");
        setChatLoading(true);
        
        try {
            const res = await chatWithAssistant(q);
            setChatLog([...newLog, { sender: 'bot', text: res.data.response }]);
        } catch (err) {
            setChatLog([...newLog, { sender: 'bot', text: 'Sorry, I had trouble connecting. Please try again.' }]);
        }
        setChatLoading(false);
    };

    const handleSuggestedQuestion = (q) => {
        setQuery(q);
        const fakeEvent = { preventDefault: () => {} };
        setChatLog(prev => [...prev, { sender: 'user', text: q }]);
        setChatLoading(true);
        
        chatWithAssistant(q).then(res => {
            setChatLog(prev => [...prev, { sender: 'bot', text: res.data.response }]);
            setChatLoading(false);
        }).catch(() => {
            setChatLog(prev => [...prev, { sender: 'bot', text: 'Sorry, I had trouble connecting.' }]);
            setChatLoading(false);
        });
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
                                    
                                    return (
                                        <TimelineStep 
                                            key={stage.key}
                                            step={`${stage.icon} ${stage.label}`}
                                            status={status}
                                            detail={
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
                                    const isVerified = doc?.status?.toLowerCase() === 'verified';
                                    
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

                    {/* Chat Assistant - Full Width */}
                    <div className="card full-width">
                        <h3>💬 AI Onboarding Assistant</h3>
                        
                        <div className="suggested-questions">
                            {suggestedQuestions.map((q, i) => (
                                <button 
                                    key={i} 
                                    className="suggested-q"
                                    onClick={() => handleSuggestedQuestion(q)}
                                    type="button"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>

                        <div className="chat-window">
                            {chatLog.map((msg, i) => (
                                <div key={i} className={`message ${msg.sender}`}>
                                    {msg.text}
                                </div>
                            ))}
                            {chatLoading && (
                                <div className="typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        <form className="chat-input" onSubmit={handleChat}>
                            <input 
                                value={query} 
                                onChange={e => setQuery(e.target.value)} 
                                placeholder="Ask about your onboarding process..." 
                                disabled={chatLoading}
                                id="chat-input"
                            />
                            <button type="submit" className="btn-primary" disabled={chatLoading || !query.trim()}>
                                Send
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CandidatePortal;
