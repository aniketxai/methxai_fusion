import { AlertCircle, Inbox, Loader2, WifiOff } from 'lucide-react';

export function LoadingState({ message = 'Loading data...' }) {
  return (
    <div className="state-box">
      <Loader2 size={28} className="state-icon spin" />
      <div className="state-title">{message}</div>
    </div>
  );
}

export function EmptyState({ title = 'No data available', message }) {
  return (
    <div className="state-box">
      <Inbox size={28} className="state-icon" />
      <div className="state-title">{title}</div>
      {message && <div className="state-msg">{message}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Failed to load', message }) {
  return (
    <div className="state-box">
      <AlertCircle size={28} className="state-icon" style={{ color: 'var(--red)' }} />
      <div className="state-title">{title}</div>
      {message && <div className="state-msg">{message}</div>}
    </div>
  );
}

export function DisconnectedState({ title = 'Backend not connected', message }) {
  return (
    <div className="state-box">
      <WifiOff size={28} className="state-icon" style={{ color: 'var(--amber)' }} />
      <div className="state-title">{title}</div>
      {message && <div className="state-msg">{message}</div>}
    </div>
  );
}
