import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { User, Menu, Cpu, Radio } from 'lucide-react';
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
      ? 'ESP32 & BACKEND ACTIVE'
      : 'SERVER ONLINE'
    : 'MOCK SIMULATION';

  return (
    <header className="header" style={{ borderBottom: '1px solid #CBD5E1', background: '#FFFFFF', padding: '0 20px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div className="header-brand-group" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155' }}
        >
          <Menu size={18} />
        </button>
        <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.jpg" alt="MethXAI Logo" style={{ height: '28px', width: '28px', borderRadius: '4px' }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '15px', color: '#0F172A', letterSpacing: '-0.3px', lineHeight: 1.1 }}>MethXAI Fusion</div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Cold Chain Telemetry System</div>
          </div>
        </div>
      </div>

      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px' }}>
        <div style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Radio size={13} color="#059669" />
          <span style={{ fontWeight: 600, color: '#0F172A' }}>{statusLabel}</span>
          <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>(115200 Baud)</span>
        </div>

        <div style={{ fontFamily: 'monospace', color: '#475569', fontSize: '12px' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0F172A', color: '#F8FAFC', padding: '5px 10px', borderRadius: '6px', fontWeight: 600, fontSize: '11.5px' }}>
          <User size={13} />
          <span>Aniket S. (OP-001)</span>
        </div>
      </div>
    </header>
  );
}

Header.propTypes = {
  onToggleSidebar: PropTypes.func,
};
