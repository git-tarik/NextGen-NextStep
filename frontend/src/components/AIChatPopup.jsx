import React, { useState, useRef, useEffect } from 'react';
import { chatWithAssistant } from '../api';

function AIChatPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [chatLog, setChatLog] = useState([
    { sender: 'bot', text: "Hi! 👋 I'm your AI onboarding assistant. Ask me anything about your onboarding journey!" }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const suggestedQuestions = [
    "What documents do I need?",
    "How long does BGV take?",
    "What is Day-1 readiness?",
    "When do I get IT equipment?",
  ];

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, chatLog, chatLoading]);

  // Handle escape key to close popup
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSend = async (textToSend) => {
    const messageText = textToSend || query;
    if (!messageText.trim() || chatLoading) return;

    const userMessage = messageText.trim();
    setChatLog((prev) => [...prev, { sender: 'user', text: userMessage }]);
    if (!textToSend) setQuery('');
    setChatLoading(true);

    try {
      const res = await chatWithAssistant(userMessage);
      const botReply = res.data?.response || res.data?.answer || "I'm sorry, I couldn't get an answer.";
      setChatLog((prev) => [...prev, { sender: 'bot', text: botReply }]);
    } catch (err) {
      setChatLog((prev) => [
        ...prev,
        { sender: 'bot', text: 'Sorry, I ran into an issue getting an answer. Please try again later.' }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div className="ai-chat-widget">
      {/* Floating Action Button (FAB) */}
      <button
        type="button"
        className={`chat-fab ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Close Assistant' : 'Chat with AI Assistant'}
        aria-label="Toggle AI Assistant Chat"
      >
        <span className="fab-icon">{isOpen ? '✕' : '💬'}</span>
        {!isOpen && <span className="fab-label">AI Assistant</span>}
        {!isOpen && <span className="fab-pulse-ring"></span>}
      </button>

      {/* Floating Popup Window */}
      {isOpen && (
        <div className="chat-popup">
          {/* Header */}
          <div className="chat-popup-header">
            <div className="header-info">
              <div className="bot-avatar">🤖</div>
              <div>
                <h4>AI Onboarding Assistant</h4>
                <div className="status-badge">
                  <span className="status-dot"></span> Online & Ready
                </div>
              </div>
            </div>
            <button
              type="button"
              className="chat-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close Chat Window"
            >
              ✕
            </button>
          </div>

          {/* Suggested Questions */}
          <div className="chat-popup-suggestions">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                type="button"
                className="suggested-q"
                onClick={() => handleSend(q)}
                disabled={chatLoading}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Chat Messages Body */}
          <div className="chat-popup-body">
            {chatLog.map((msg, i) => (
              <div key={i} className={`message ${msg.sender}`}>
                {msg.text}
              </div>
            ))}
            {chatLoading && (
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Footer / Input Form */}
          <form className="chat-popup-footer" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about your onboarding..."
              disabled={chatLoading}
              id="popup-chat-input"
            />
            <button
              type="submit"
              className="btn-primary chat-send-btn"
              disabled={chatLoading || !query.trim()}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default AIChatPopup;
