// Shipment Detail — full temperature/humidity history, route, excursions, batch status

import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine,
} from 'recharts';
import { ArrowLeft, Thermometer, Droplets, MapPin, AlertTriangle, Cpu, Package } from 'lucide-react';
import { useShipment } from '../hooks/useApi.js';
import { LoadingState, ErrorState } from '../components/StateViews.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDateTime, timeAgo } from '../utils/format.js';


export default function ShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: shipment, loading, error } = useShipment(id);

  const tempData = useMemo(() => {
    if (!shipment) return [];
    return shipment.readings.map((r) => ({
      time: new Date(r.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      temperature: r.temperature,
      humidity: r.humidity,
    }));
  }, [shipment]);

  if (loading) return <LoadingState message="Loading shipment..." />;
  if (error) return <ErrorState message={error} />;
  if (!shipment) return <ErrorState title="Shipment not found" message={`No shipment with ID ${id}`} />;

  return (
    <div>
      <button className="detail-back" onClick={() => navigate('/shipments')}>
        <ArrowLeft size={14} /> Back to shipments
      </button>

      <div className="page-header">
        <div>
          <h1>{shipment.id}</h1>
          <div className="subtitle">{shipment.product} • Batch {shipment.batchId}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {shipment.isSimulated && <span className="demo-label">Simulated</span>}
          <StatusBadge status={shipment.status} />
        </div>
      </div>

      <div className="detail-grid">
        {/* Left: shipment info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <div className="panel-header"><h2>Shipment Info</h2></div>
            <div className="panel-body" style={{ padding: '8px 14px' }}>
              <ul className="info-list">
                <li><span className="key">Shipment ID</span><span className="val mono">{shipment.id}</span></li>
                <li><span className="key">Product</span><span className="val">{shipment.product}</span></li>
                <li><span className="key">Batch ID</span><span className="val mono">{shipment.batchId}</span></li>
                <li><span className="key">Origin</span><span className="val">{shipment.origin}</span></li>
                <li><span className="key">Destination</span><span className="val">{shipment.destination}</span></li>
                <li><span className="key">Current Location</span><span className="val">{shipment.currentCheckpoint}</span></li>
                <li><span className="key">Est. Arrival</span><span className="val">{formatDateTime(shipment.estimatedArrival)}</span></li>
                <li><span className="key">Last Update</span><span className="val">{timeAgo(shipment.lastUpdate)}</span></li>
              </ul>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h2><Cpu size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Sensor Status</h2></div>
            <div className="panel-body" style={{ padding: '8px 14px' }}>
              <ul className="info-list">
                <li><span className="key">Sensor ID</span><span className="val mono">{shipment.sensorId}</span></li>
                <li><span className="key">Connectivity</span><span className="val">{shipment.sensorStatus === 'online' ? 'Online' : 'Offline'}</span></li>
                <li><span className="key">Last Sync</span><span className="val">{timeAgo(shipment.lastSensorSync)}</span></li>
                <li><span className="key">Data Source</span><span className="val">Simulated</span></li>
              </ul>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h2><Package size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Batch Status</h2></div>
            <div className="panel-body" style={{ padding: '8px 14px' }}>
              <ul className="info-list">
                <li><span className="key">Batch ID</span><span className="val mono">{shipment.batchId}</span></li>
                <li><span className="key">Risk Category</span><span className="val">{shipment.risk.category}</span></li>
                <li><span className="key">Excursions</span><span className="val">{shipment.excursions.length}</span></li>
                <li><span className="key">Recommendation</span><span className="val" style={{ fontSize: 11 }}>{shipment.risk.recommendation}</span></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right: charts and details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <div className="panel-header">
              <h2><Thermometer size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Temperature History</h2>
              <span className="meta">Range: {shipment.tempRange.minTemp}°C to {shipment.tempRange.maxTemp}°C</span>
            </div>
            <div className="panel-body">
              <div className="chart-container tall">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tempData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={40} />
                    <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip />
                    <ReferenceArea
                      y1={shipment.tempRange.minTemp}
                      y2={shipment.tempRange.maxTemp}
                      fill="#e8f5e9"
                      fillOpacity={0.4}
                    />
                    <ReferenceLine y={shipment.tempRange.maxTemp} stroke="#c62828" strokeDasharray="4 4" strokeWidth={1} label={{ value: 'Max', fontSize: 10, fill: '#c62828' }} />
                    <ReferenceLine y={shipment.tempRange.minTemp} stroke="#c62828" strokeDasharray="4 4" strokeWidth={1} label={{ value: 'Min', fontSize: 10, fill: '#c62828' }} />
                    <Line type="monotone" dataKey="temperature" stroke="#0d7e7e" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2><Droplets size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Humidity Trend</h2>
              <span className="meta">Range: {shipment.tempRange.minHumidity}% to {shipment.tempRange.maxHumidity}%</span>
            </div>
            <div className="panel-body">
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tempData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={40} />
                    <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="humidity" stroke="#1565c0" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Route / checkpoints */}
          <div className="panel">
            <div className="panel-header">
              <h2><MapPin size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Route & Checkpoints</h2>
              <span className="meta">Simulated GPS data</span>
            </div>
            <div className="panel-body" style={{ padding: '8px 14px' }}>
              <ul className="timeline">
                {shipment.route.map((stop, i) => (
                  <li key={i} className="timeline-item">
                    <span className="timeline-time">{formatDateTime(stop.arrivedAt)}</span>
                    <span className="timeline-event">
                      <strong>{stop.location}</strong>
                      {' — '}
                      <span style={{ textTransform: 'capitalize' }}>{stop.type}</span>
                      {' '}
                      {stop.status === 'current' && <span className="badge badge-warning" style={{ marginLeft: 4 }}>Current</span>}
                      {stop.status === 'passed' && <span className="text-muted" style={{ marginLeft: 4 }}>(passed)</span>}
                      {stop.status === 'pending' && <span className="text-muted" style={{ marginLeft: 4 }}>(pending)</span>}
                      <span className="text-muted" style={{ marginLeft: 8 }}>{stop.temp.toFixed(1)}°C</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Excursion events */}
          <div className="panel">
            <div className="panel-header">
              <h2><AlertTriangle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Excursion Events</h2>
              <span className="meta">{shipment.excursions.length} detected</span>
            </div>
            {shipment.excursions.length === 0 ? (
              <div className="state-box" style={{ padding: '20px' }}>
                <div className="state-title" style={{ color: 'var(--green)' }}>No excursions detected</div>
                <div className="state-msg">All readings within acceptable range.</div>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Start</th>
                      <th>End</th>
                      <th>Duration</th>
                      <th>Min</th>
                      <th>Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipment.excursions.map((e, i) => (
                      <tr key={i} style={{ cursor: 'default' }}>
                        <td className="mono">{formatDateTime(e.startTime)}</td>
                        <td className="mono">{formatDateTime(e.endTime)}</td>
                        <td><strong>{e.durationLabel}</strong></td>
                        <td style={{ color: 'var(--red)' }}>{e.minReading}°C</td>
                        <td style={{ color: 'var(--red)' }}>{e.maxReading}°C</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
