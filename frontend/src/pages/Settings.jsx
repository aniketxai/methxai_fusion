// Settings — API config, temperature ranges, notification prefs, operator info

import { useState, useEffect } from 'react';
import { Save, Server, Bell, Thermometer, User } from 'lucide-react';
import {
  getStoredProductRanges,
  saveStoredProductRanges,
  getStoredConfig,
  saveStoredConfig,
} from '../utils/productStore.js';
import { api } from '../services/api.js';
import { socketService } from '../services/socket.js';

export default function Settings() {
  const [config, setConfig] = useState(getStoredConfig());
  const [productRanges, setProductRanges] = useState(getStoredProductRanges());
  const [notifications, setNotifications] = useState({
    tempExcursion: true,
    sensorOffline: true,
    missingTelemetry: true,
    shipmentDelay: false,
    checkpointNotification: true,
  });
  const [saved, setSaved] = useState(false);

  // Load preferences from localStorage if previously saved
  useEffect(() => {
    const savedNotif = localStorage.getItem('methxai_notifications');
    if (savedNotif) {
      try { setNotifications(JSON.parse(savedNotif)); } catch { /* ignore */ }
    }
  }, []);

  function handleSave() {
    saveStoredProductRanges(productRanges);
    saveStoredConfig(config);
    localStorage.setItem('methxai_notifications', JSON.stringify(notifications));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <div className="subtitle">System configuration and preferences</div>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={14} /> {saved ? 'Saved' : 'Save Settings'}
        </button>
      </div>

      {/* Backend configuration */}
      <div className="panel mb-16">
        <div className="panel-header">
          <h2><Server size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Backend Connection</h2>
        </div>
        <div className="panel-body">
          <div className="form-grid-2 mb-16">
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>API Base URL (VITE_API_BASE_URL)</label>
              <input
                className="input"
                style={{ width: '100%' }}
                placeholder="http://localhost:3000"
                value={config.apiBaseUrl}
                onChange={(e) => setConfig({ ...config, apiBaseUrl: e.target.value })}
              />
              <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                Leave empty to use mock data mode. Set in .env file or save here for persistence.
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>WebSocket URL (VITE_WS_URL)</label>
              <input
                className="input"
                style={{ width: '100%' }}
                placeholder="ws://localhost:3000"
                value={config.wsUrl}
                onChange={(e) => setConfig({ ...config, wsUrl: e.target.value })}
              />
              <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                For real-time updates. Leave empty if backend does not support WebSocket.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Current Data Mode</label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label className="checkbox">
                  <input type="radio" checked={config.dataMode === 'mock'} onChange={() => setConfig({ ...config, dataMode: 'mock' })} />
                  Mock Data
                </label>
                <label className="checkbox">
                  <input type="radio" checked={config.dataMode === 'api'} onChange={() => setConfig({ ...config, dataMode: 'api' })} />
                  Live API
                </label>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Auto-refresh Interval (seconds)</label>
              <input
                className="input"
                type="number"
                style={{ width: 80 }}
                value={config.refreshInterval}
                onChange={(e) => setConfig({ ...config, refreshInterval: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 10, background: 'var(--surface-alt)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', fontSize: 12 }}>
            <strong>Current status:</strong> {api.isMockMode ? 'Running in MOCK mode (no backend connected)' : 'API mode active'}
            {' • '}Socket: {socketService.isMock ? 'Not configured' : socketService.isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Temperature range config */}
      <div className="panel mb-16">
        <div className="panel-header">
          <h2><Thermometer size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Product Temperature Ranges</h2>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <div className="table-scroll" style={{ maxHeight: '300px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Min Temp (°C)</th>
                  <th>Max Temp (°C)</th>
                  <th>Min Humidity (%)</th>
                  <th>Max Humidity (%)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(productRanges).map(([product, range]) => (
                  <tr key={product} style={{ cursor: 'default' }}>
                    <td>{product}</td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        style={{ width: 80 }}
                        value={isNaN(range.minTemp) ? '' : range.minTemp}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                          setProductRanges({
                            ...productRanges,
                            [product]: { ...range, minTemp: val },
                          });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        style={{ width: 80 }}
                        value={isNaN(range.maxTemp) ? '' : range.maxTemp}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                          setProductRanges({
                            ...productRanges,
                            [product]: { ...range, maxTemp: val },
                          });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        style={{ width: 80 }}
                        value={isNaN(range.minHumidity) ? '' : range.minHumidity}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseInt(e.target.value);
                          setProductRanges({
                            ...productRanges,
                            [product]: { ...range, minHumidity: val },
                          });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        style={{ width: 80 }}
                        value={isNaN(range.maxHumidity) ? '' : range.maxHumidity}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseInt(e.target.value);
                          setProductRanges({
                            ...productRanges,
                            [product]: { ...range, maxHumidity: val },
                          });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Notification preferences */}
      <div className="panel mb-16">
        <div className="panel-header">
          <h2><Bell size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Notification Preferences</h2>
        </div>
        <div className="panel-body" style={{ padding: '12px 14px' }}>
          <div className="checkbox-grid">
            {[
              { key: 'tempExcursion', label: 'Temperature excursion alerts' },
              { key: 'sensorOffline', label: 'Sensor offline alerts' },
              { key: 'missingTelemetry', label: 'Missing telemetry alerts' },
              { key: 'shipmentDelay', label: 'Shipment delay alerts' },
              { key: 'checkpointNotification', label: 'Checkpoint arrival notifications' },
            ].map((item) => (
              <label key={item.key} className="checkbox">
                <input
                  type="checkbox"
                  checked={notifications[item.key]}
                  onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Operator info */}
      <div className="panel">
        <div className="panel-header">
          <h2><User size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Operator Profile</h2>
        </div>
        <div className="panel-body" style={{ padding: '8px 14px' }}>
          <div className="form-grid-2">
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Operator ID</label>
              <input className="input" style={{ width: '100%' }} value={config.operatorId} onChange={(e) => setConfig({ ...config, operatorId: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Display Name</label>
              <input className="input" style={{ width: '100%' }} value={config.operatorName} onChange={(e) => setConfig({ ...config, operatorName: e.target.value })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

