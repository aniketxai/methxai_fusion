import PropTypes from 'prop-types';

export default function LoadingScreen({ message = 'Initializing Cold Chain System...' }) {
  return (
    <div className="full-loading-screen">
      <div className="loading-card">
        <div className="loading-logo-wrapper">
          <img src="/logo.jpg" alt="MethXAI Logo" className="loading-logo" />
          <div className="loading-ring" />
        </div>
        <h2 className="loading-title">MethXAI</h2>
        <div className="loading-subtitle">Cold Chain Monitoring & Quality Integrity</div>
        <div className="loading-progress-bar">
          <div className="loading-progress-fill" />
        </div>
        <div className="loading-msg">{message}</div>
      </div>
    </div>
  );
}

LoadingScreen.propTypes = {
  message: PropTypes.string,
};
