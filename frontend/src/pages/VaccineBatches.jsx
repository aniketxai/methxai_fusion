// Vaccine Batches — inventory with cold-chain status, excursion history, release/hold

import { useState, useMemo, useEffect } from 'react';
import { Search, AlertTriangle, Cpu } from 'lucide-react';
import { useBatches } from '../hooks/useApi.js';
import { api } from '../services/api.js';
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews.jsx';
import { formatDate, formatDateTime } from '../utils/format.js';

const REVIEW_FILTERS = ['all', 'clear', 'flagged', 'hold'];

export default function VaccineBatches() {
  const { data: batches, loading, error } = useBatches();
  const [search, setSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState(null);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && selectedBatch) {
        setSelectedBatch(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBatch]);


  const filtered = useMemo(() => {
    if (!batches) return [];
    return batches.filter((b) => {
      const matchesSearch =
        !search ||
        b.batchId.toLowerCase().includes(search.toLowerCase()) ||
        b.product.toLowerCase().includes(search.toLowerCase()) ||
        b.shipmentId.toLowerCase().includes(search.toLowerCase());
      const matchesReview =
        reviewFilter === 'all' || b.reviewStatus === reviewFilter;
      return matchesSearch && matchesReview;
    });
  }, [batches, search, reviewFilter]);

  if (loading) return <LoadingState message="Loading batch inventory..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Vaccine Batch Management</h1>
          <div className="subtitle">{filtered.length} batches under active quality tracking</div>
        </div>
        <span className="badge badge-normal" style={{ fontSize: 11 }}>
          <span className="pulse-dot" /> Quality Monitoring
        </span>
      </div>

      <div className="filter-bar mb-16">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-muted)' }} />
          <input
            className="input search-input"
            style={{ paddingLeft: 28 }}
            placeholder="Search batch, product, shipment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="select" value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)}>
          {REVIEW_FILTERS.map((f) => (
            <option key={f} value={f}>{f === 'all' ? 'All Review Status' : f.charAt(0).toUpperCase() + f.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="panel">
        <div className="table-scroll" style={{ maxHeight: '400px' }}>
          {filtered.length === 0 ? (
            <EmptyState title="No batches found" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Product</th>
                  <th>Manufacturer</th>
                  <th>Expiry</th>
                  <th>Qty</th>
                  <th>Shipment</th>
                  <th>Excursions</th>
                  <th>Cold-Chain</th>
                  <th>Release/Hold</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.batchId} onClick={() => setSelectedBatch(b)}>
                    <td className="mono">{b.batchId}</td>
                    <td>{b.product}</td>
                    <td>{b.manufacturer}</td>
                    <td>{formatDate(b.expiryDate)}</td>
                    <td>{b.quantity}</td>
                    <td className="mono">{b.shipmentId}</td>
                    <td style={{ fontWeight: 600, color: b.excursionCount > 0 ? 'var(--red)' : 'var(--text)' }}>{b.excursionCount}</td>
                    <td><span className={`badge ${b.coldChainStatus === 'normal' ? 'badge-normal' : b.coldChainStatus === 'critical' ? 'badge-critical' : b.coldChainStatus === 'warning' ? 'badge-warning' : b.coldChainStatus === 'delivered' ? 'badge-delivered' : 'badge-review'}`}>{b.coldChainStatus}</span></td>
                    <td>
                      {b.releaseStatus === 'RELEASED' ? (
                        <span className="badge badge-released">Released</span>
                      ) : b.releaseStatus.includes('HOLD') ? (
                        <span className="badge badge-hold">HOLD — REVIEW</span>
                      ) : (
                        <span className="badge badge-review">FLAGGED</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Batch detail modal/drawer */}
      {selectedBatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelectedBatch(null)}>
          <div
            style={{ width: 'min(480px, 100%)', background: 'var(--surface)', borderLeft: '1px solid var(--border)', padding: 20, overflowY: 'auto', maxHeight: '100vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 16 }}>{selectedBatch.batchId}</h2>
                <div className="text-muted" style={{ fontSize: 12 }}>{selectedBatch.product}</div>
              </div>
              <button className="btn btn-sm" onClick={() => setSelectedBatch(null)}>Close</button>
            </div>

            <ul className="info-list mb-16">
              <li><span className="key">Manufacturer</span><span className="val">{selectedBatch.manufacturer}</span></li>
              <li><span className="key">Expiry Date</span><span className="val">{formatDate(selectedBatch.expiryDate)}</span></li>
              <li><span className="key">Quantity</span><span className="val">{selectedBatch.quantity} doses</span></li>
              <li><span className="key">Shipment</span><span className="val mono">{selectedBatch.shipmentId}</span></li>
              <li><span className="key">Cold-Chain Status</span><span className="val">{selectedBatch.coldChainStatus}</span></li>
              <li><span className="key">Release/Hold</span><span className="val">{selectedBatch.releaseStatus}</span></li>
            </ul>

            {/* Actuate Dispense Motor Button */}
            <div style={{ marginBottom: 16 }}>
              <button 
                onClick={async () => {
                  const motorMap = {
                    'Medicine M1': 'M3 ON',
                    'Medicine M2': 'M4 ON',
                    'Medicine M3': 'R0 ON',
                    'Medicine M4': 'R1 ON',
                    'Medicine M5': 'STEP 512',
                    'Medicine M6': 'STEP -512'
                  };
                  const cmd = motorMap[selectedBatch.product] || 'M3 ON';
                  try {
                    await api.controlMotor(cmd);
                    alert(`Dispense Command '${cmd}' dispatched to ESP32 / Arduino Uno for ${selectedBatch.batchId}`);
                  } catch (e) {
                    alert(`Dispense Blocked: ${e.message}`);
                  }
                }}
                className="btn btn-primary" 
                style={{ width: '100%', padding: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Cpu size={16} /> Dispense {selectedBatch.batchId} via ESP32 Motor
              </button>
            </div>

            {/* Viability-risk estimation */}
            <div className="panel mb-16">
              <div className="panel-header">
                <h2>Thermal Degradation Index (MKT)</h2>
                <span className="badge badge-normal" style={{ fontSize: 10 }}>WHO TRS 961</span>
              </div>
              <div className="panel-body" style={{ padding: '8px 14px' }}>
                <ul className="info-list">
                  <li><span className="key">Risk Category</span><span className="val" style={{ color: selectedBatch.risk.category === 'Critical' ? 'var(--red)' : selectedBatch.risk.category === 'High' ? 'var(--amber)' : selectedBatch.risk.category === 'Moderate' ? 'var(--amber)' : 'var(--green)' }}>{selectedBatch.risk.category}</span></li>
                  <li><span className="key">Excursion Severity</span><span className="val">{selectedBatch.risk.severity?.toFixed(2)}°C deviation</span></li>
                  {selectedBatch.risk.duration > 0 && (
                    <li><span className="key">Excursion Duration</span><span className="val">{selectedBatch.risk.duration} min</span></li>
                  )}
                  <li><span className="key">Recommendation</span><span className="val" style={{ fontSize: 11 }}>{selectedBatch.risk.recommendation}</span></li>
                  <li><span className="key">Viability Assessment</span><span className="val">
                    {selectedBatch.risk.category === 'Normal' ? 'Within Specification' : 'Inspection Required'}
                  </span></li>
                </ul>
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <strong>Analysis:</strong> {selectedBatch.excursionCount > 0
                    ? `Batch recorded ${selectedBatch.excursionCount} thermal excursion(s). Peak deviation: ${selectedBatch.risk.severity?.toFixed(2)}°C beyond threshold.`
                    : 'Zero thermal excursion events recorded. Potency intact per manufacturer specifications.'}
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                  Automated MKT Index: Mean Kinetic Temperature calculated via Arrhenius thermal kinetics equation.
                </div>
              </div>
            </div>

            {/* Excursion history */}
            <div className="panel">
              <div className="panel-header">
                <h2><AlertTriangle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Excursion History</h2>
                <span className="meta">{selectedBatch.excursionHistory.length} events</span>
              </div>
              {selectedBatch.excursionHistory.length === 0 ? (
                <div className="state-box" style={{ padding: '16px' }}>
                  <div className="state-title" style={{ color: 'var(--green)', fontSize: 12 }}>No excursions recorded</div>
                </div>
              ) : (
                <div className="table-scroll" style={{ maxHeight: '200px' }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Start</th><th>Duration</th><th>Min</th><th>Max</th></tr>
                    </thead>
                    <tbody>
                      {selectedBatch.excursionHistory.map((e, i) => (
                        <tr key={i} style={{ cursor: 'default' }}>
                          <td className="mono">{formatDateTime(e.startTime)}</td>
                          <td>{e.durationLabel}</td>
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
      )}
    </div>
  );
}
