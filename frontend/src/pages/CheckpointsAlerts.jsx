// Checkpoints & Alerts — alert management with acknowledge/review actions

import { useState, useMemo, useCallback } from 'react';
import {
  AlertTriangle, Thermometer, Cpu, WifiOff, Clock, MapPin, CheckCircle, Eye,
} from 'lucide-react';
import { useAlerts, useCheckpoints } from '../hooks/useApi.js';
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews.jsx';
import { api } from '../services/api.js';
import { ALERTS } from '../data/mockData.js';
import { timeAgo, formatDateTime, getAlertTypeLabel, getSeverityClass } from '../utils/format.js';

const TYPE_ICONS = {
  temperature_excursion: Thermometer,
  sensor_offline: Cpu,
  missing_telemetry: WifiOff,
  shipment_delay: Clock,
  checkpoint_notification: MapPin,
};

const SEVERITY_FILTERS = ['all', 'critical', 'warning', 'info'];

export default function CheckpointsAlerts() {
  const { data: initialAlerts, loading: aLoading, error: aError, reload } = useAlerts();
  const { data: checkpoints, loading: cLoading, error: cError } = useCheckpoints();
  const [alerts, setAlerts] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [ackFilter, setAckFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('alerts');

  // Sync mock data into local state so acknowledge actions update the UI
  useMemo(() => {
    if (initialAlerts) setAlerts(initialAlerts);
  }, [initialAlerts]);

  const handleAck = useCallback(async (id) => {
    await api.acknowledgeAlert(id);
    setAlerts((prev) => (prev || []).map((a) => a.id === id ? { ...a, acknowledged: true } : a));
  }, []);

  const handleReview = useCallback(async (id) => {
    await api.markAlertForReview(id);
    setAlerts((prev) => (prev || []).map((a) => a.id === id ? { ...a, acknowledged: true, markedForReview: true } : a));
  }, []);

  const filteredAlerts = useMemo(() => {
    const all = alerts || [];
    return all
      .filter((a) => severityFilter === 'all' || a.severity === severityFilter)
      .filter((a) => ackFilter === 'all' || (ackFilter === 'ack' && a.acknowledged) || (ackFilter === 'unack' && !a.acknowledged))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [alerts, severityFilter, ackFilter]);

  const filteredCheckpoints = useMemo(() => {
    return (checkpoints || []).sort((a, b) => new Date(b.arrivedAt) - new Date(a.arrivedAt));
  }, [checkpoints]);

  if (aLoading || cLoading) return <LoadingState />;
  if (aError) return <ErrorState message={aError} />;
  if (cError) return <ErrorState message={cError} />;

  const unackCount = (alerts || []).filter((a) => !a.acknowledged).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Checkpoints & Alerts</h1>
          <div className="subtitle">{unackCount} unacknowledged alerts</div>
        </div>
        {api.isMockMode && <span className="demo-label">Simulated Data</span>}
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'alerts' ? 'active' : ''}`} onClick={() => setActiveTab('alerts')}>
          Alerts ({filteredAlerts.length})
        </button>
        <button className={`tab ${activeTab === 'checkpoints' ? 'active' : ''}`} onClick={() => setActiveTab('checkpoints')}>
          Checkpoints ({filteredCheckpoints.length})
        </button>
      </div>

      {activeTab === 'alerts' && (
        <>
          <div className="filter-bar mb-16">
            <select className="select" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
              {SEVERITY_FILTERS.map((f) => (
                <option key={f} value={f}>{f === 'all' ? 'All Severity' : f.charAt(0).toUpperCase() + f.slice(1)}</option>
              ))}
            </select>
            <select className="select" value={ackFilter} onChange={(e) => setAckFilter(e.target.value)}>
              <option value="all">All Acknowledgement</option>
              <option value="unack">Unacknowledged</option>
              <option value="ack">Acknowledged</option>
            </select>
            <div className="spacer" />
            <button className="btn btn-sm" onClick={reload}>Refresh</button>
          </div>

          <div className="panel">
            {filteredAlerts.length === 0 ? (
              <EmptyState title="No alerts match your filters" />
            ) : (
              filteredAlerts.map((alert) => {
                const Icon = TYPE_ICONS[alert.type] || AlertTriangle;
                const iconColor = alert.severity === 'critical' ? 'var(--red)' : alert.severity === 'warning' ? 'var(--amber)' : 'var(--blue)';
                return (
                  <div key={alert.id} className="alert-item">
                    <div className="alert-icon">
                      <Icon size={16} style={{ color: iconColor }} />
                    </div>
                    <div className="alert-body">
                      <div className="alert-title">{alert.message}</div>
                      <div className="alert-meta">
                        <span className={`badge ${getSeverityClass(alert.severity)}`} style={{ marginRight: 6 }}>{alert.severity}</span>
                        <span className="mono">{alert.shipmentId}</span>
                        {' • '}
                        <span>{getAlertTypeLabel(alert.type)}</span>
                        {' • '}
                        <span>{timeAgo(alert.timestamp)}</span>
                        {' • '}
                        <span>{alert.checkpoint}</span>
                        {alert.acknowledged && <span style={{ color: 'var(--green)' }}> • ACK</span>}
                        {alert.markedForReview && <span style={{ color: 'var(--blue)' }}> • REVIEW</span>}
                      </div>
                    </div>
                    <div className="alert-actions">
                      {!alert.acknowledged && (
                        <>
                          <button className="btn btn-sm" onClick={() => handleAck(alert.id)}>
                            <CheckCircle size={12} /> Ack
                          </button>
                          <button className="btn btn-sm" onClick={() => handleReview(alert.id)}>
                            <Eye size={12} /> Review
                          </button>
                        </>
                      )}
                      {alert.acknowledged && !alert.markedForReview && (
                        <button className="btn btn-sm" onClick={() => handleReview(alert.id)}>
                          <Eye size={12} /> Review
                        </button>
                      )}
                      {alert.markedForReview && (
                        <span className="text-muted" style={{ fontSize: 11 }}>Reviewed</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {activeTab === 'checkpoints' && (
        <div className="panel">
          <div className="table-scroll" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            {filteredCheckpoints.length === 0 ? (
              <EmptyState title="No checkpoint logs" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Checkpoint ID</th>
                    <th>Shipment</th>
                    <th>Location</th>
                    <th>Type</th>
                    <th>Arrived</th>
                    <th>Temp</th>
                    <th>Status</th>
                    <th>Notified</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCheckpoints.map((c, i) => (
                    <tr key={i} style={{ cursor: 'default' }}>
                      <td className="mono">{c.checkpointId}</td>
                      <td className="mono">{c.shipmentId}</td>
                      <td>{c.location}</td>
                      <td style={{ textTransform: 'capitalize' }}>{c.type}</td>
                      <td>{formatDateTime(c.arrivedAt)}</td>
                      <td>{c.temp}°C</td>
                      <td style={{ textTransform: 'capitalize' }}>{c.status}</td>
                      <td>{c.notified ? <span className="badge badge-normal">Yes</span> : <span className="badge badge-review">Pending</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
