import { useEffect, useState } from 'react';
import { Circle, User } from 'lucide-react';
import { api } from '../services/api.js';
import { socketService } from '../services/socket.js';

export default function Header() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const connected = !api.isMockMode && socketService.isConnected;
  const statusLabel = api.isMockMode ? 'MOCK DATA' : connected ? 'CONNECTED' : 'DISCONNECTED';
  const statusClass = api.isMockMode ? 'mock' : connected ? 'connected' : 'disconnected';

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-title">MethXAI</div>
        <div className="header-subtitle">Cold Chain Monitoring System</div>
      </div>
      <div className="header-right">
        <div className={`conn-indicator ${statusClass}`}>
          <Circle size={7} fill="currentColor" strokeWidth={0} />
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
          <span>OP-001 / Logistics Desk</span>
        </div>
      </div>
    </header>
  );
}
