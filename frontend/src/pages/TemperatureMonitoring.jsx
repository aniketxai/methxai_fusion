// Temperature Monitoring — per-shipment temperature/humidity charts with range config

import { useState, useMemo, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine,
} from 'recharts';
import { Thermometer, Droplets, Cpu, AlertTriangle } from 'lucide-react';
import { useShipments } from '../hooks/useApi.js';
import { LoadingState, ErrorState } from '../components/StateViews.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatTemp, formatDateTime, timeAgo } from '../utils/format.js';
import { getStoredProductRanges, saveStoredProductRanges } from '../utils/productStore.js';

export default function TemperatureMonitoring() {
  const { data: shipments, loading, error } = useShipments();
  const [selectedId, setSelectedId] = useState('');
  const [productConfig, setProductConfig] = useState(getStoredProductRanges());
  const [editingProduct, setEditingProduct] = useState(null);
  const [editValues, setEditValues] = useState({ minTemp: 0, maxTemp: 0 });

  useEffect(() => {
    if (shipments && shipments.length > 0) {
      if (!selectedId || !shipments.some((s) => s.id === selectedId)) {
        setSelectedId(shipments[0].id);
      }
    }
  }, [shipments, selectedId]);

  const selected = useMemo(
    () => shipments?.find((s) => s.id === selectedId) || shipments?.[0],
    [shipments, selectedId]
  );

  const tempData = useMemo(() => {
    if (!selected) return [];
    return selected.readings.map((r) => ({
      time: new Date(r.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      temperature: r.temperature,
      humidity: r.humidity,
    }));
  }, [selected]);

  if (loading) return <LoadingState message="Loading sensor data..." />;
  if (error) return <ErrorState message={error} />;

  const currentRange = selected ? (productConfig[selected.product] || selected.tempRange) : null;

  function startEdit(productName) {
    const cfg = productConfig[productName] || selected.tempRange;
    setEditingProduct(productName);
    setEditValues({ minTemp: cfg.minTemp, maxTemp: cfg.maxTemp });
  }

  function saveEdit() {
    if (editingProduct) {
      const updated = {
        ...productConfig,
        [editingProduct]: { ...productConfig[editingProduct], ...editValues },
      };
      setProductConfig(updated);
      saveStoredProductRanges(updated);
      setEditingProduct(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Temperature & Cold-Chain Integrity</h1>
          <div className="subtitle">Per-shipment sensor monitoring with configurable ranges</div>
        </div>
        <span className="badge badge-normal" style={{ fontSize: 11 }}>
          <span className="pulse-dot" /> ESP32 Telemetry Mesh
        </span>
      </div>

      <div className="filter-bar mb-16">
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Select shipment:</label>
        <select className="select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ minWidth: 280 }}>
          {shipments.map((s) => (
            <option key={s.id} value={s.id}>{s.id} — {s.product}</option>
          ))}
        </select>
        {selected && <StatusBadge status={selected.status} />}
      </div>

      {selected && currentRange && (
        <div className="detail-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Current conditions */}
            <div className="panel">
              <div className="panel-header"><h2>Current Conditions</h2></div>
              <div className="panel-body" style={{ padding: '8px 14px' }}>
                <ul className="info-list">
                  <li><span className="key">Current Temp</span><span className="val" style={{ color: selected.currentTemp > currentRange.maxTemp || selected.currentTemp < currentRange.minTemp ? 'var(--red)' : 'var(--green)' }}>{formatTemp(selected.currentTemp)}</span></li>
                  <li><span className="key">Current Humidity</span><span className="val">{selected.currentHumidity.toFixed(0)}%</span></li>
                  <li><span className="key">Last Reading</span><span className="val">{timeAgo(selected.lastUpdate)}</span></li>
                  <li><span className="key">Sensor ID</span><span className="val mono">{selected.sensorId}</span></li>
                  <li><span className="key">Sensor Status</span><span className="val" style={{ color: selected.sensorStatus === 'online' ? 'var(--green)' : 'var(--text-muted)' }}>{selected.sensorStatus === 'online' ? 'Online' : 'Offline'}</span></li>
                  <li><span className="key">Sensor Array</span><span className="val">ESP32 BLE Node</span></li>
                </ul>
              </div>
            </div>

            {/* Temperature range config */}
            <div className="panel">
              <div className="panel-header">
                <h2>Acceptable Range — {selected.product}</h2>
                {editingProduct !== selected.product && (
                  <button className="btn btn-sm" onClick={() => startEdit(selected.product)}>Edit Range</button>
                )}
              </div>
              <div className="panel-body" style={{ padding: '8px 14px' }}>
                {editingProduct === selected.product ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <label style={{ fontSize: 12 }}>Min (°C)</label>
                      <input
                        className="input"
                        type="number"
                        value={isNaN(editValues.minTemp) ? '' : editValues.minTemp}
                        onChange={(e) => setEditValues({ ...editValues, minTemp: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        style={{ width: 80 }}
                      />
                      <label style={{ fontSize: 12 }}>Max (°C)</label>
                      <input
                        className="input"
                        type="number"
                        value={isNaN(editValues.maxTemp) ? '' : editValues.maxTemp}
                        onChange={(e) => setEditValues({ ...editValues, maxTemp: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        style={{ width: 80 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
                      <button className="btn btn-sm" onClick={() => setEditingProduct(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <ul className="info-list">
                    <li><span className="key">Min Temperature</span><span className="val">{currentRange.minTemp}°C</span></li>
                    <li><span className="key">Max Temperature</span><span className="val">{currentRange.maxTemp}°C</span></li>
                    <li><span className="key">Min Humidity</span><span className="val">{currentRange.minHumidity}%</span></li>
                    <li><span className="key">Max Humidity</span><span className="val">{currentRange.maxHumidity}%</span></li>
                  </ul>
                )}
              </div>
            </div>

            {/* Excursion summary */}
            <div className="panel">
              <div className="panel-header">
                <h2><AlertTriangle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Excursion Summary</h2>
                <span className="meta">{selected.excursions.length} events</span>
              </div>
              {selected.excursions.length === 0 ? (
                <div className="state-box" style={{ padding: '20px' }}>
                  <div className="state-title" style={{ color: 'var(--green)', fontSize: 12 }}>No excursions — within range</div>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Start</th>
                        <th>End</th>
                        <th>Duration</th>
                        <th>Min Temp</th>
                        <th>Max Temp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.excursions.map((e, i) => (
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="panel">
              <div className="panel-header">
                <h2><Thermometer size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Temperature Over Time</h2>
                <span className="meta">{selected.readings.length} readings</span>
              </div>
              <div className="panel-body">
                <div className="range-bar">
                  <span>Acceptable range:</span>
                  <span className="range-val">{currentRange.minTemp}°C to {currentRange.maxTemp}°C</span>
                </div>
                <div className="chart-container tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={tempData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={40} />
                      <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip formatter={(val) => [`${val}°C`, 'Temperature']} />
                      <ReferenceArea y1={currentRange.minTemp} y2={currentRange.maxTemp} fill="#d1fae5" fillOpacity={0.4} />
                      <ReferenceLine y={currentRange.maxTemp} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1} />
                      <ReferenceLine y={currentRange.minTemp} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1} />
                      <Line type="monotone" dataKey="temperature" stroke="#0284c7" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2><Droplets size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Humidity Trend</h2>
              </div>
              <div className="panel-body">
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={tempData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={40} />
                      <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 5', 'dataMax + 5']} />
                      <Tooltip formatter={(val) => [`${val}%`, 'Humidity']} />
                      <Line type="monotone" dataKey="humidity" stroke="#2563eb" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2><Cpu size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Sensor Connectivity</h2>
              </div>
              <div className="panel-body" style={{ padding: '8px 14px' }}>
                <ul className="info-list">
                  <li><span className="key">Sensor ID</span><span className="val mono">{selected.sensorId}</span></li>
                  <li><span className="key">Status</span><span className="val" style={{ color: selected.sensorStatus === 'online' ? 'var(--green)' : 'var(--text-muted)' }}>{selected.sensorStatus === 'online' ? 'Online — receiving telemetry' : 'Offline'}</span></li>
                  <li><span className="key">Last Data Received</span><span className="val">{timeAgo(selected.lastSensorSync)}</span></li>
                  <li><span className="key">Reading Interval</span><span className="val">10 minutes</span></li>
                  <li><span className="key">Telemetry Standard</span><span className="val">WHO TRS 961 Compliant</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

