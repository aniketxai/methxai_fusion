import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { User, Menu } from 'lucide-react';
import { api } from '../services/api.js';
import { socketService } from '../services/socket.js';

export default function Header({ onToggleSidebar }) {
  const [now, setNow] = useState(new Date());
  const [wsConnected, setWsConnected] = useState(socketService.isConnected);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    socketService.connect();
    const unsubscribe = socketService.subscribe((msg) => {
      if (msg.type === 'connection_status' || msg.type === 'init') {
        setWsConnected(socketService.isConnected);
      }
    });
    return () => unsubscribe();
  }, []);

  const isApi = !api.isMockMode;
  const statusLabel = isApi
    ? wsConnected
      ? 'ESP32 & BACKEND LIVE'
      : 'BACKEND CONNECTED'
    : 'MOCK TELEMETRY ONLINE';
  const statusClass = 'connected';

  return (
    <header className="header">
      <div className="header-brand-group">
        <button
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>
        <div className="header-brand">
          <img src="/logo.jpg" alt="MethXAI Logo" className="header-logo" />
          <div className="header-titles">
            <div className="header-title">MethXAI</div>
            <div className="header-subtitle">Cold Chain Monitoring Platform</div>
          </div>
        </div>
      </div>
      <div className="header-right">
        <div className={`conn-indicator ${statusClass}`}>
          <span className="pulse-dot" />
          <span>{statusLabel}</span>
        </div>
        <div className="header-datetime">
          {now.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })}
        </div>
        <div className="header-operator">
          <User size={14} strokeWidth={1.8} />
          <span>Aniket S. (Logistics Lead)</span>
        </div>
      </div>
    </header>
  );
}

Header.propTypes = {
  onToggleSidebar: PropTypes.func,
};
