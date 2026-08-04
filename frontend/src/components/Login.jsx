import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login({ setLoggedInCandidate }) {
    const navigate = useNavigate();
    const [loginType, setLoginType] = useState('candidate');
    const [email, setEmail] = useState('');
    const [hrPassword, setHrPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        
        if (loginType === 'hr') {
            if (hrPassword === 'admin') {
                navigate('/hr');
            } else {
                setError('Invalid HR password. Use "admin" for prototype.');
            }
        } else {
            if (!email) {
                setError('Please enter your email address.');
                return;
            }
            setLoggedInCandidate(email);
            navigate('/candidate');
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚡</div>
                    <h2 style={{ 
                        background: 'var(--gradient-brand)', 
                        WebkitBackgroundClip: 'text', 
                        WebkitTextFillColor: 'transparent',
                        fontSize: '1.5rem'
                    }}>
                        NextGen NextStep
                    </h2>
                    <p className="subtitle">AI-Powered Onboarding Control Tower</p>
                </div>

                <div className="role-toggle">
                    <button 
                        className={loginType === 'candidate' ? 'active' : ''}
                        onClick={() => { setLoginType('candidate'); setError(''); }}
                        type="button"
                    >
                        👤 Candidate
                    </button>
                    <button 
                        className={loginType === 'hr' ? 'active' : ''}
                        onClick={() => { setLoginType('hr'); setError(''); }}
                        type="button"
                    >
                        🛡️ HR Admin
                    </button>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    {loginType === 'candidate' ? (
                        <div className="form-group">
                            <label htmlFor="email-input">Email Address</label>
                            <input 
                                id="email-input"
                                type="email" 
                                placeholder="you@company.com" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                autoFocus
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Enter your email to view your portal or begin onboarding.
                            </p>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label htmlFor="password-input">Admin Password</label>
                            <input 
                                id="password-input"
                                type="password" 
                                placeholder="Enter password" 
                                value={hrPassword} 
                                onChange={(e) => setHrPassword(e.target.value)} 
                                autoFocus
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                Use "admin" for prototype access.
                            </p>
                        </div>
                    )}
                    
                    {error && <div className="error-message">{error}</div>}
                    
                    <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
                        {loginType === 'candidate' ? '🚀 Enter Portal' : '🔓 Access Dashboard'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;
