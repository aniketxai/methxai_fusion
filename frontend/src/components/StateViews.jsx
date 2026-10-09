import PropTypes from 'prop-types';
import { AlertCircle, Inbox, Loader2, WifiOff } from 'lucide-react';

export function LoadingState({ message = 'Loading data...' }) {
  return (
    <div className="state-box">
      <Loader2 size={28} className="state-icon spin" />
      <div className="state-title">{message}</div>
    </div>
  );
}

LoadingState.propTypes = {
  message: PropTypes.string,
};

export function EmptyState({ title = 'No data available', message }) {
  return (
    <div className="state-box">
      <Inbox size={28} className="state-icon" />
      <div className="state-title">{title}</div>
      {message && <div className="state-msg">{message}</div>}
    </div>
  );
}

EmptyState.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
};

export function ErrorState({ title = 'Failed to load', message }) {
  return (
    <div className="state-box">
      <AlertCircle size={28} className="state-icon" style={{ color: 'var(--red)' }} />
      <div className="state-title">{title}</div>
      {message && <div className="state-msg">{message}</div>}
    </div>
  );
}

ErrorState.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
};

export function DisconnectedState({ title = 'Backend not connected', message }) {
  return (
    <div className="state-box">
      <WifiOff size={28} className="state-icon" style={{ color: 'var(--amber)' }} />
      <div className="state-title">{title}</div>
      {message && <div className="state-msg">{message}</div>}
    </div>
  );
}

DisconnectedState.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
};

