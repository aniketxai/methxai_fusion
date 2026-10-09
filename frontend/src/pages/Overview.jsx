// Overview dashboard — active shipments, excursions, alerts, temperature trend

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, AlertTriangle, PackageSearch, MapPin, Activity, CheckCircle,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine,
} from 'recharts';
import { useShipments, useAlerts, useDashboardSummary } from '../hooks/useApi.js';
import { LoadingState, ErrorState } from '../components/StateViews.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatTemp, timeAgo, formatTime } from '../utils/format.js';
import { api } from '../services/api.js';
import { ALERTS } from '../data/mockData.js';

export default function Overview() {
  const { data: shipments, loading: sLoading, error: sError } = useShipments();
  const { data: summary, loading: sumLoading } = useDashboardSummary();
  const { data: alerts, loading: aLoading } = useAlerts();
  const [selectedShipmentId, setSelectedShipmentId] = useState('SHP-2410-004');
  const navigate = useNavigate();

  const selectedShipment = useMemo(
    () => shipments?.find((s) => s.id === selectedShipmentId) || shipments?.[0],
    [shipments, selectedShipmentId]
  );

  const chartData = useMemo(() => {
    if (!selectedShipment) return [];
    return selectedShipment.readings.slice(-72).map((r) => ({
      time: formatTime(r.timestamp),
      temperature: r.temperature,
      humidity: r.humidity,
    }));
  }, [selectedShipment]);

  const recentAlerts = useMemo(() => {
    const all = alerts || ALERTS;
    return [...all].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 6);
  }, [alerts]);

  if (sLoading || sumLoading) return <LoadingState message="Loading dashboard..." />;
  if (sError) return <ErrorState message={sError} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Operations Overview</h1>
          <div className="subtitle">Real-time cold chain integrity summary</div>
        </div>
        {api.isMockMode && <span className="demo-label">Simulated Data</span>}
      </div>

      {/* Metrics */}
      <div className="metric-grid">
        <div className="metric-tile">
          <div className="label"><Truck size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Active Shipments</div>
          <div className="value">{summary?.activeShipments ?? '--'}</div>
          <div className="delta">{summary?.deliveredShipments ?? 0} delivered today</div>
        </div>
        <div className="metric-tile">
          <div className="label"><AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Temp Excursions</div>
          <div className="value alert">{summary?.excursionShipments ?? '--'}</div>
          <div className="delta">Shipments with excursion events</div>
        </div>
        <div className="metric-tile">
          <div className="label"><PackageSearch size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Batches Needing Review</div>
          <div className="value warn">{summary?.batchesReview ?? '--'}</div>
          <div className="delta">On hold or flagged</div>
        </div>
        <div className="metric-tile">
          <div className="label"><MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Checkpoints Notified</div>
          <div className="value">{summary?.checkpointsNotified ?? '--'}</div>
          <div className="delta">{summary?.unackAlerts ?? 0} unacknowledged alerts</div>
        </div>
      </div>

      {/* Temperature trend + recent alerts */}
      <div className="grid-2">
        <div className="panel">
          <div className="panel-header">
            <h2>Temperature Trend — {selectedShipment?.id}</h2>
            <select
              className="select"
              value={selectedShipmentId}
              onChange={(e) => setSelectedShipmentId(e.target.value)}
            >
              {shipments?.map((s) => (
                <option key={s.id} value={s.id}>{s.id} ({s.product})</option>
              ))}
            </select>
          </div>
          <div className="panel-body">
            <div className="range-bar">
              <span>Acceptable range:</span>
              <span className="range-val">{selectedShipment?.tempRange.minTemp}°C to {selectedShipment?.tempRange.maxTemp}°C</span>
              <StatusBadge status={selectedShipment?.status} />
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={50} />
                  <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip />
                  {selectedShipment && (
                    <>
                      <ReferenceArea
                        y1={selectedShipment.tempRange.minTemp}
                        y2={selectedShipment.tempRange.maxTemp}
                        fill="#e8f5e9"
                        fillOpacity={0.4}
                      />
                      <ReferenceLine y={selectedShipment.tempRange.maxTemp} stroke="#c62828" strokeDasharray="4 4" strokeWidth={1} />
                      <ReferenceLine y={selectedShipment.tempRange.minTemp} stroke="#c62828" strokeDasharray="4 4" strokeWidth={1} />
                    </>
                  )}
                  <Line type="monotone" dataKey="temperature" stroke="#0d7e7e" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Recent Alerts & Events</h2>
            <span className="meta">{recentAlerts.length} recent</span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {aLoading ? (
              <LoadingState message="Loading alerts..." />
            ) : (
              recentAlerts.map((alert) => (
                <div key={alert.id} className="alert-item">
                  <div className="alert-icon">
                    {alert.severity === 'critical' ? (
                      <AlertTriangle size={14} style={{ color: 'var(--red)' }} />
                    ) : alert.severity === 'warning' ? (
                      <AlertTriangle size={14} style={{ color: 'var(--amber)' }} />
                    ) : (
                      <CheckCircle size={14} style={{ color: 'var(--blue)' }} />
                    )}
                  </div>
                  <div className="alert-body">
                    <div className="alert-title">{alert.message}</div>
                    <div className="alert-meta">
                      {alert.shipmentId} • {timeAgo(alert.timestamp)}
                      {alert.acknowledged && ' • ACK'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Live shipment table */}
      <div className="panel">
        <div className="panel-header">
          <h2><Activity size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Live Shipment Monitoring</h2>
          <span className="meta">{shipments?.filter(s => s.status !== 'delivered').length} active</span>
        </div>
        <div className="table-scroll" style={{ maxHeight: '320px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Shipment ID</th>
                <th>Product</th>
                <th>Batch</th>
                <th>Temp</th>
                <th>Humidity</th>
                <th>Checkpoint</th>
                <th>Last Update</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shipments?.map((s) => (
                <tr key={s.id} onClick={() => navigate(`/shipments/${s.id}`)}>
                  <td className="mono">{s.id}</td>
                  <td>{s.product}</td>
                  <td className="mono">{s.batchId}</td>
                  <td style={{ fontWeight: 600, color: s.currentTemp > s.tempRange.maxTemp || s.currentTemp < s.tempRange.minTemp ? 'var(--red)' : 'var(--text)' }}>
                    {formatTemp(s.currentTemp)}
                  </td>
                  <td>{s.currentHumidity.toFixed(0)}%</td>
                  <td>{s.currentCheckpoint}</td>
                  <td className="text-muted">{timeAgo(s.lastUpdate)}</td>
                  <td><StatusBadge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
