// Formatting utilities for MethXAI

export function formatTemp(value) {
  return `${value.toFixed(1)}°C`;
}

export function formatHumidity(value) {
  return `${value.toFixed(0)}%`;
}

export function formatDateTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDate(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function timeAgo(iso) {
  if (!iso) return '--';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function getStatusLabel(status) {
  const map = {
    normal: 'Normal',
    warning: 'Warning',
    critical: 'Critical',
    review: 'Under Review',
    delivered: 'Delivered',
  };
  return map[status] || status;
}

export function getAlertTypeLabel(type) {
  const map = {
    temperature_excursion: 'Temperature Excursion',
    sensor_offline: 'Sensor Offline',
    missing_telemetry: 'Missing Telemetry',
    shipment_delay: 'Shipment Delay',
    checkpoint_notification: 'Checkpoint Notification',
  };
  return map[type] || type;
}

export function getSeverityClass(severity) {
  const map = { critical: 'badge-critical', warning: 'badge-warning', info: 'badge-review' };
  return map[severity] || 'badge-review';
}
