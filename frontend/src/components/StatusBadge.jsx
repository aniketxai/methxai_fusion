import { getStatusLabel } from '../utils/format.js';

export default function StatusBadge({ status }) {
  const cls = {
    normal: 'badge-normal',
    warning: 'badge-warning',
    critical: 'badge-critical',
    review: 'badge-review',
    delivered: 'badge-delivered',
    hold: 'badge-hold',
    released: 'badge-released',
    clear: 'badge-normal',
    flagged: 'badge-review',
  };

  const dotCls = {
    normal: 'badge-dot',
    warning: 'badge-dot',
    critical: 'badge-dot',
    review: 'badge-dot',
    delivered: 'badge-dot',
  };

  const dotColor = {
    normal: 'var(--green)',
    warning: 'var(--amber)',
    critical: 'var(--red)',
    review: 'var(--blue)',
    delivered: '#607d8b',
    hold: 'var(--amber)',
    released: 'var(--green)',
    clear: 'var(--green)',
    flagged: 'var(--blue)',
  };

  return (
    <span className={`badge ${cls[status] || 'badge-normal'}`}>
      <span
        className={dotCls[status] || 'badge-dot'}
        style={{ backgroundColor: dotColor[status] || 'var(--green)' }}
      />
      {getStatusLabel(status) || status}
    </span>
  );
}
