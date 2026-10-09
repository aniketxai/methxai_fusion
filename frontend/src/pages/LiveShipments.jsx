// Live Shipments — searchable/filterable shipment table

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Truck } from 'lucide-react';
import { useShipments } from '../hooks/useApi.js';
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatTemp, timeAgo } from '../utils/format.js';
import { api } from '../services/api.js';

const STATUS_FILTERS = ['all', 'normal', 'warning', 'critical', 'review', 'delivered'];

export default function LiveShipments() {
  const { data: shipments, loading, error } = useShipments();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (!shipments) return [];
    return shipments.filter((s) => {
      const matchesSearch =
        !search ||
        s.id.toLowerCase().includes(search.toLowerCase()) ||
        s.product.toLowerCase().includes(search.toLowerCase()) ||
        s.batchId.toLowerCase().includes(search.toLowerCase()) ||
        s.currentCheckpoint.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [shipments, search, statusFilter]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Live Shipments</h1>
          <div className="subtitle">{filtered.length} of {shipments.length} shipments</div>
        </div>
        {api.isMockMode && <span className="demo-label">Simulated Data</span>}
      </div>

      <div className="filter-bar mb-16">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-muted)' }} />
          <input
            className="input search-input"
            style={{ paddingLeft: 28 }}
            placeholder="Search by ID, product, batch, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_FILTERS.map((f) => (
            <option key={f} value={f}>{f === 'all' ? 'All Status' : f.charAt(0).toUpperCase() + f.slice(1)}</option>
          ))}
        </select>
        <div className="spacer" />
        <span className="text-muted" style={{ fontSize: 11 }}>
          <Truck size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          Click a row for shipment details
        </span>
      </div>

      <div className="panel">
        <div className="table-scroll" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {filtered.length === 0 ? (
            <EmptyState title="No shipments found" message="Try adjusting your search or filter." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Shipment ID</th>
                  <th>Product</th>
                  <th>Batch ID</th>
                  <th>Current Temp</th>
                  <th>Humidity</th>
                  <th>Origin</th>
                  <th>Current Checkpoint</th>
                  <th>Last Update</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const outOfRange = s.currentTemp > s.tempRange.maxTemp || s.currentTemp < s.tempRange.minTemp;
                  return (
                    <tr key={s.id} onClick={() => navigate(`/shipments/${s.id}`)}>
                      <td className="mono">{s.id}</td>
                      <td>{s.product}</td>
                      <td className="mono">{s.batchId}</td>
                      <td style={{ fontWeight: 600, color: outOfRange ? 'var(--red)' : 'var(--text)' }}>
                        {formatTemp(s.currentTemp)}
                        <span className="text-muted" style={{ fontWeight: 400, fontSize: 10 }}>
                          {' '}({s.tempRange.minTemp}–{s.tempRange.maxTemp}°C)
                        </span>
                      </td>
                      <td>{s.currentHumidity.toFixed(0)}%</td>
                      <td>{s.origin}</td>
                      <td>{s.currentCheckpoint}</td>
                      <td className="text-muted">{timeAgo(s.lastUpdate)}</td>
                      <td><StatusBadge status={s.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
