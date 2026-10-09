// Reports — summary of shipments, batches, excursions, dispenser integration status

import { useMemo, useState, useEffect } from 'react';
import { useShipments, useBatches, useCheckpoints } from '../hooks/useApi.js';
import { LoadingState, ErrorState } from '../components/StateViews.jsx';
import { formatDateTime } from '../utils/format.js';
import { api } from '../services/api.js';
import { DISPENSER_STATUS } from '../data/mockData.js';
import { Cpu, Download, FlaskConical, CheckCircle, XCircle } from 'lucide-react';

export default function Reports() {
  const { data: shipments, loading: sLoading, error: sError } = useShipments();
  const { data: batches, loading: bLoading } = useBatches();
  const { data: checkpoints, loading: cLoading } = useCheckpoints();
  const [dispenser, setDispenser] = useState(DISPENSER_STATUS);
  const [selectedVerifyBatch, setSelectedVerifyBatch] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getDispenserStatus().then((res) => {
      if (mounted && res) setDispenser(res);
    }).catch(console.error);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (batches && batches.length > 0 && !selectedVerifyBatch) {
      setSelectedVerifyBatch(batches[0].batchId);
    }
  }, [batches, selectedVerifyBatch]);

  const reportData = useMemo(() => {
    if (!shipments || !batches) return null;
    const totalExcursions = shipments.reduce((acc, s) => acc + s.excursions.length, 0);
    const criticalBatches = batches.filter((b) => b.risk.category === 'Critical').length;
    const normalShipments = shipments.filter((s) => s.status === 'normal').length;
    const warningShipments = shipments.filter((s) => s.status === 'warning').length;
    const criticalShipments = shipments.filter((s) => s.status === 'critical').length;
    const deliveredShipments = shipments.filter((s) => s.status === 'delivered').length;

    return {
      totalShipments: shipments.length,
      normalShipments,
      warningShipments,
      criticalShipments,
      deliveredShipments,
      totalExcursions,
      criticalBatches,
      totalBatches: batches.length,
      totalCheckpoints: checkpoints?.length || 0,
    };
  }, [shipments, batches, checkpoints]);

  if (sLoading || bLoading || cLoading) return <LoadingState message="Compiling report data..." />;
  if (sError) return <ErrorState message={sError} />;

  function handleVerify(batchId) {
    if (!batchId) return;
    setVerifying(true);
    setVerifyResult(null);
    api.verifyBatch(batchId).then((result) => {
      setVerifyResult(result);
      setVerifying(false);
    }).catch((err) => {
      setVerifyResult({ verified: false, message: err.message || 'Verification failed' });
      setVerifying(false);
    });
  }

  function exportCSV() {
    if (!shipments) return;
    const headers = ['Shipment ID', 'Product', 'Batch ID', 'Current Temp', 'Humidity', 'Origin', 'Checkpoint', 'Last Update', 'Status', 'Excursions'];
    const rows = shipments.map((s) => [
      s.id,
      `"${s.product.replace(/"/g, '""')}"`,
      s.batchId,
      s.currentTemp,
      s.currentHumidity,
      `"${s.origin.replace(/"/g, '""')}"`,
      `"${s.currentCheckpoint.replace(/"/g, '""')}"`,
      s.lastUpdate,
      s.status,
      s.excursions.length,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'methxai_shipment_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <div className="subtitle">Cold chain summary and dispenser integration status</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {api.isMockMode && <span className="demo-label">Simulated</span>}
          <button className="btn btn-sm" onClick={exportCSV}>
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary metrics */}
      {reportData && (
        <div className="metric-grid mb-16">
          <div className="metric-tile">
            <div className="label">Total Shipments</div>
            <div className="value">{reportData.totalShipments}</div>
            <div className="delta">{reportData.deliveredShipments} delivered</div>
          </div>
          <div className="metric-tile">
            <div className="label">Total Excursions</div>
            <div className="value alert">{reportData.totalExcursions}</div>
            <div className="delta">Across all shipments</div>
          </div>
          <div className="metric-tile">
            <div className="label">Critical Batches</div>
            <div className="value alert">{reportData.criticalBatches}</div>
            <div className="delta">On hold for review</div>
          </div>
          <div className="metric-tile">
            <div className="label">Checkpoint Logs</div>
            <div className="value">{reportData.totalCheckpoints}</div>
            <div className="delta">Total recorded</div>
          </div>
        </div>
      )}

      {/* Shipment status breakdown */}
      <div className="grid-2 mb-16">
        <div className="panel">
          <div className="panel-header"><h2>Shipment Status Breakdown</h2></div>
          <div className="panel-body" style={{ padding: '8px 14px' }}>
            <ul className="info-list">
              <li><span className="key">Normal</span><span className="val" style={{ color: 'var(--green)' }}>{reportData?.normalShipments}</span></li>
              <li><span className="key">Warning</span><span className="val" style={{ color: 'var(--amber)' }}>{reportData?.warningShipments}</span></li>
              <li><span className="key">Critical</span><span className="val" style={{ color: 'var(--red)' }}>{reportData?.criticalShipments}</span></li>
              <li><span className="key">Delivered</span><span className="val">{reportData?.deliveredShipments}</span></li>
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><h2>Batch Review Summary</h2></div>
          <div className="panel-body" style={{ padding: '8px 14px' }}>
            <ul className="info-list">
              <li><span className="key">Total Batches</span><span className="val">{reportData?.totalBatches}</span></li>
              <li><span className="key">Critical (Hold)</span><span className="val" style={{ color: 'var(--red)' }}>{reportData?.criticalBatches}</span></li>
              <li><span className="key">Released</span><span className="val" style={{ color: 'var(--green)' }}>{reportData?.totalBatches - reportData?.criticalBatches - (batches?.filter(b => b.reviewStatus === 'flagged').length || 0)}</span></li>
              <li><span className="key">Flagged (Pending Review)</span><span className="val" style={{ color: 'var(--blue)' }}>{batches?.filter(b => b.reviewStatus === 'flagged').length || 0}</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Excursion report table */}
      <div className="panel mb-16">
        <div className="panel-header"><h2>Excursion Report — All Shipments</h2></div>
        <div className="table-scroll" style={{ maxHeight: '300px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Shipment</th>
                <th>Product</th>
                <th>Batch</th>
                <th>Excursions</th>
                <th>Risk Category</th>
                <th>Max Severity</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {shipments?.map((s) => (
                <tr key={s.id} style={{ cursor: 'default' }}>
                  <td className="mono">{s.id}</td>
                  <td>{s.product}</td>
                  <td className="mono">{s.batchId}</td>
                  <td>{s.excursions.length}</td>
                  <td style={{ fontWeight: 600, color: s.risk.category === 'Critical' ? 'var(--red)' : s.risk.category === 'High' ? 'var(--amber)' : 'var(--text)' }}>{s.risk.category}</td>
                  <td>{s.risk.severity?.toFixed(2)}°C</td>
                  <td style={{ fontSize: 11 }}>{s.risk.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MethXAI Dispenser Integration */}
      <div className="panel">
        <div className="panel-header">
          <h2><FlaskConical size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />MethXAI Dispensing Integration</h2>
          <span className="demo-label">Simulated</span>
        </div>
        <div className="panel-body">
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div>
              <ul className="info-list">
                <li>
                  <span className="key"><Cpu size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Controller Connected</span>
                  <span className="val" style={{ color: dispenser.controllerConnected ? 'var(--green)' : 'var(--red)' }}>
                    {dispenser.controllerConnected ? 'Yes' : 'No — not connected'}
                  </span>
                </li>
                <li><span className="key">Last Synchronization</span><span className="val">{formatDateTime(dispenser.lastSync)}</span></li>
                <li><span className="key">Sync Interval</span><span className="val">{dispenser.syncInterval}s</span></li>
                <li><span className="key">Release Status</span><span className="val">{dispenser.releaseStatus}</span></li>
                <li><span className="key">Mechanism</span><span className="val" style={{ fontSize: 11 }}>{dispenser.mechanismType}</span></li>
              </ul>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Batch Verification Request</div>
              <div className="text-muted" style={{ fontSize: 11, marginBottom: 12 }}>
                Verify a batch against cold-chain status before dispensing. The frontend requests verification from the backend — it does not directly control hardware.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <select
                  className="select"
                  value={selectedVerifyBatch}
                  onChange={(e) => setSelectedVerifyBatch(e.target.value)}
                  style={{ minWidth: 200 }}
                >
                  {batches?.map((b) => (
                    <option key={b.batchId} value={b.batchId}>{b.batchId} — {b.product}</option>
                  ))}
                </select>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={verifying || !selectedVerifyBatch}
                  onClick={() => handleVerify(selectedVerifyBatch)}
                >
                  {verifying ? 'Verifying...' : 'Verify Batch'}
                </button>
              </div>
              {verifyResult && (
                <div style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface-alt)', fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {verifyResult.verified ? (
                      <CheckCircle size={14} style={{ color: 'var(--green)' }} />
                    ) : (
                      <XCircle size={14} style={{ color: 'var(--red)' }} />
                    )}
                    <strong>{verifyResult.verified ? 'VERIFIED — Batch Released' : 'BLOCKED — Batch on Hold'}</strong>
                  </div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{verifyResult.message}</div>
                  <div className="text-muted" style={{ fontSize: 10, marginTop: 4 }}>Result is simulated — no backend controller connected.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

