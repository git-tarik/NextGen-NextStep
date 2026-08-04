import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import CandidatePortal from './components/CandidatePortal/CandidatePortal';
import HRDashboard from './components/HRDashboard/HRDashboard';
import './App.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: 'var(--accent-danger)', marginBottom: '0.5rem' }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{this.state.error?.toString()}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '1.5rem' }}
            className="btn-primary"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [loggedInCandidate, setLoggedInCandidate] = useState(null);

  return (
    <BrowserRouter>
      <div className="app-container">
        <nav className="navbar">
          <h2>
            <span className="logo-icon">⚡</span>
            NextGen NextStep
          </h2>
          <div className="nav-links">
            <Link to="/">← Switch Role</Link>
          </div>
        </nav>
        <main className="main-content">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Login setLoggedInCandidate={setLoggedInCandidate} />} />
              <Route path="/candidate" element={<CandidatePortal loggedInEmail={loggedInCandidate} />} />
              <Route path="/hr" element={<HRDashboard />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
