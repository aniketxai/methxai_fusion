// Realistic mock data for MethXAI Cold Chain Monitoring System
// Multi-slot medicine telemetries (M1, M2, M3, M4, M5, M6)

export const PRODUCTS = {
  'Medicine M1': { minTemp: 2, maxTemp: 8, minHumidity: 30, maxHumidity: 70 },
  'Medicine M2': { minTemp: -25, maxTemp: -15, minHumidity: 0, maxHumidity: 60 },
  'Medicine M3': { minTemp: -90, maxTemp: -60, minHumidity: 0, maxHumidity: 60 },
  'Medicine M4': { minTemp: 2, maxTemp: 8, minHumidity: 30, maxHumidity: 70 },
  'Medicine M5': { minTemp: 2, maxTemp: 8, minHumidity: 30, maxHumidity: 70 },
  'Medicine M6': { minTemp: 2, maxTemp: 8, minHumidity: 30, maxHumidity: 70 },
};

export const CHECKPOINTS = [
  'Mumbai Cold Storage Hub',
  'Pune Transit Depot',
  'Nashik Distribution Center',
  'Aurangabad Regional Store',
  'Nagpur Medical Warehouse',
  'Pune Distribution Hub',
  'Mumbai Airport Cargo Terminal',
  'Delhi Airport Cold Storage',
  'Bangalore Regional Depot',
  'Hyderabad Pharma Hub',
  'Chennai Port Cold Storage',
  'Kolkata Distribution Center',
];

// Generate timestamp relative to now
function ts(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60000).toISOString();
}

// Generate sensor readings for a shipment
function generateReadings(shipmentId, baseTemp, tempRange, baseHumidity, hoursBack, intervalMin) {
  const readings = [];
  const count = Math.floor((hoursBack * 60) / intervalMin);
  const hasExcursion = baseTemp < tempRange.min || baseTemp > tempRange.max;

  for (let i = count; i >= 0; i--) {
    const time = new Date(Date.now() - i * intervalMin * 60000);
    const noise = (Math.sin(i / 8) + Math.random() * 0.6 - 0.3) * (tempRange.max - tempRange.min) * 0.12;
    let temp = baseTemp + noise;

    // Inject excursion in middle portion for some shipments
    if (hasExcursion && i > count * 0.3 && i < count * 0.6) {
      temp += (tempRange.max - baseTemp) * 0.8 + Math.random() * 2;
    }

    readings.push({
      timestamp: time.toISOString(),
      temperature: parseFloat(temp.toFixed(2)),
      humidity: parseFloat((baseHumidity + (Math.random() * 4 - 2)).toFixed(1)),
      isSimulated: true,
      sensorId: `SNR-${shipmentId.split('-')[1]}-${(i % 3) + 1}`,
    });
  }
  return readings;
}

function excursionFromReadings(readings, range) {
  const excursions = [];
  let current = null;

  readings.forEach((r) => {
    const isExcursion = r.temperature < range.minTemp || r.temperature > range.maxTemp;
    if (isExcursion && !current) {
      current = {
        startTime: r.timestamp,
        endTime: r.timestamp,
        readings: [r],
      };
    } else if (isExcursion && current) {
      current.endTime = r.timestamp;
      current.readings.push(r);
    } else if (!isExcursion && current) {
      excursions.push(current);
      current = null;
    }
  });
  if (current) excursions.push(current);

  return excursions.map((e) => {
    const temps = e.readings.map((r) => r.temperature);
    const start = new Date(e.startTime);
    const end = new Date(e.endTime);
    const durMs = end - start;
    const durMin = Math.round(durMs / 60000);

    return {
      startTime: e.startTime,
      endTime: e.endTime,
      durationMin: durMin,
      maxReading: Math.max(...temps).toFixed(2),
      minReading: Math.min(...temps).toFixed(2),
      durationLabel: durMin >= 60 ? `${(durMin / 60).toFixed(1)}h` : `${durMin}m`,
    };
  });
}

function riskFromExcursion(excursions, range) {
  if (!excursions.length) return { category: 'Normal', severity: 0, recommendation: 'No action required' };

  const worst = excursions.reduce((acc, e) => {
    const overMax = parseFloat(e.maxReading) - range.maxTemp;
    const underMin = range.minTemp - parseFloat(e.minReading);
    const severity = Math.max(overMax, underMin);
    return severity > acc.severity ? { severity, duration: e.durationMin } : acc;
  }, { severity: 0, duration: 0 });

  const severityVal = parseFloat(worst.severity.toFixed(2));

  if (severityVal > 5 || worst.duration > 120) {
    return {
      category: 'Critical',
      severity: severityVal,
      duration: worst.duration,
      recommendation: 'HOLD — Review required. Excursion exceeds critical threshold.',
    };
  } else if (severityVal > 2 || worst.duration > 30) {
    return {
      category: 'High',
      severity: severityVal,
      duration: worst.duration,
      recommendation: 'Flagged for review. Excursion may affect potency.',
    };
  } else {
    return {
      category: 'Moderate',
      severity: severityVal,
      duration: worst.duration,
      recommendation: 'Monitor. Minor excursion within tolerance.',
    };
  }
}

const SHIPMENT_DEFS = [
  { id: 'SHP-2410-001', product: 'Medicine M3', batch: 'BTC-M3-2401', origin: 'Mumbai Cold Storage Hub', checkpoint: 'Pune Transit Depot', baseTemp: -75, baseHumidity: 45, status: 'normal', hoursBack: 12 },
  { id: 'SHP-2410-002', product: 'Medicine M1', batch: 'BTC-M1-2308', origin: 'Pune Distribution Hub', checkpoint: 'Nashik Distribution Center', baseTemp: 9, baseHumidity: 55, status: 'warning', hoursBack: 18 },
  { id: 'SHP-2410-003', product: 'Medicine M2', batch: 'BTC-M2-2403', origin: 'Mumbai Airport Cargo Terminal', checkpoint: 'Delhi Airport Cold Storage', baseTemp: -20, baseHumidity: 40, status: 'normal', hoursBack: 6 },
  { id: 'SHP-2410-004', product: 'Medicine M4', batch: 'BTC-M4-2402', origin: 'Pune Distribution Hub', checkpoint: 'Aurangabad Regional Store', baseTemp: 12, baseHumidity: 65, status: 'critical', hoursBack: 24 },
  { id: 'SHP-2410-005', product: 'Medicine M5', batch: 'BTC-M5-2401', origin: 'Bangalore Regional Depot', checkpoint: 'Hyderabad Pharma Hub', baseTemp: 5, baseHumidity: 50, status: 'normal', hoursBack: 8 },
  { id: 'SHP-2410-006', product: 'Medicine M6', batch: 'BTC-M6-2312', origin: 'Chennai Port Cold Storage', checkpoint: 'Kolkata Distribution Center', baseTemp: 4, baseHumidity: 48, status: 'review', hoursBack: 20 },
  { id: 'SHP-2410-007', product: 'Medicine M1', batch: 'BTC-M1-2401', origin: 'Mumbai Cold Storage Hub', checkpoint: 'Pune Distribution Hub', baseTemp: 6, baseHumidity: 52, status: 'normal', hoursBack: 4 },
  { id: 'SHP-2410-008', product: 'Medicine M4', batch: 'BTC-M4-2405', origin: 'Delhi Airport Cold Storage', checkpoint: 'Nagpur Medical Warehouse', baseTemp: 3, baseHumidity: 46, status: 'delivered', hoursBack: 48 },
  { id: 'SHP-2410-009', product: 'Medicine M2', batch: 'BTC-M2-2404', origin: 'Hyderabad Pharma Hub', checkpoint: 'Hyderabad Pharma Hub', baseTemp: -18, baseHumidity: 55, status: 'normal', hoursBack: 2 },
  { id: 'SHP-2410-010', product: 'Medicine M5', batch: 'BTC-M5-2403', origin: 'Mumbai Airport Cargo Terminal', checkpoint: 'Mumbai Airport Cargo Terminal', baseTemp: 6, baseHumidity: 50, status: 'normal', hoursBack: 3 },
];

export const SHIPMENTS = SHIPMENT_DEFS.map((s) => {
  const range = PRODUCTS[s.product] || { minTemp: 2, maxTemp: 8, minHumidity: 30, maxHumidity: 70 };
  const readings = generateReadings(s.id, s.baseTemp, range, s.baseHumidity, s.hoursBack, 10);
  const excursions = excursionFromReadings(readings, range);
  const risk = riskFromExcursion(excursions, range);
  const lastReading = readings[readings.length - 1];
  const route = generateRoute(s.origin, s.checkpoint);

  return {
    id: s.id,
    product: s.product,
    batchId: s.batch,
    origin: s.origin,
    currentCheckpoint: s.checkpoint,
    currentTemp: lastReading.temperature,
    currentHumidity: lastReading.humidity,
    lastUpdate: lastReading.timestamp,
    status: s.status,
    tempRange: range,
    readings,
    excursions,
    risk,
    route,
    sensorId: `SNR-${s.id.split('-')[1]}-1`,
    sensorStatus: s.status === 'delivered' ? 'offline' : 'online',
    lastSensorSync: lastReading.timestamp,
    destination: route[route.length - 1].location,
    estimatedArrival: ts(-360),
    isSimulated: true,
  };
});

function generateRoute(origin, current) {
  const allRoutes = {
    'Mumbai Cold Storage Hub': ['Pune Transit Depot', 'Pune Distribution Hub', 'Nashik Distribution Center'],
    'Pune Distribution Hub': ['Nashik Distribution Center', 'Aurangabad Regional Store'],
    'Mumbai Airport Cargo Terminal': ['Delhi Airport Cold Storage', 'Nagpur Medical Warehouse'],
    'Bangalore Regional Depot': ['Hyderabad Pharma Hub', 'Chennai Port Cold Storage'],
    'Chennai Port Cold Storage': ['Kolkata Distribution Center'],
    'Delhi Airport Cold Storage': ['Nagpur Medical Warehouse', 'Aurangabad Regional Store'],
    'Hyderabad Pharma Hub': ['Bangalore Regional Depot'],
  };

  const stops = [origin, ...(allRoutes[origin] || [current])];
  const currentIdx = stops.indexOf(current);
  const reachedIdx = currentIdx >= 0 ? currentIdx : 0;

  return stops.map((loc, i) => ({
    location: loc,
    type: i === 0 ? 'origin' : i === stops.length - 1 ? 'destination' : 'transit',
    arrivedAt: ts(-(i + 1) * 180),
    status: i < reachedIdx ? 'passed' : i === reachedIdx ? 'current' : 'pending',
    temp: 2 + Math.random() * 6,
  }));
}

export const BATCHES = SHIPMENTS.map((s) => {
  const hasExcursion = s.excursions.length > 0;
  const riskCategory = s.risk.category;

  return {
    batchId: s.batchId,
    product: s.product,
    expiryDate: '2025-06-30',
    shipmentId: s.id,
    coldChainStatus: s.status,
    excursionCount: s.excursions.length,
    excursionHistory: s.excursions,
    reviewStatus: hasExcursion && riskCategory === 'Critical' ? 'hold' : hasExcursion ? 'flagged' : 'clear',
    releaseStatus: riskCategory === 'Critical' ? 'HOLD — REVIEW REQUIRED' : riskCategory === 'High' ? 'FLAGGED — PENDING REVIEW' : 'RELEASED',
    risk: s.risk,
    quantity: 500 + Math.floor(Math.random() * 2000),
    manufacturer: s.product.includes('M1') ? 'Dispenser Slot M1' : s.product.includes('M2') ? 'Dispenser Slot M2' : s.product.includes('M3') ? 'Dispenser Slot M3' : 'Dispenser Module',
    isSimulated: true,
  };
});

export const ALERTS = [
  { id: 'ALT-001', type: 'temperature_excursion', severity: 'critical', shipmentId: 'SHP-2410-004', batchId: 'BTC-M4-2402', message: 'Temperature exceeded 8°C upper limit (12.3°C) for Medicine M4 at Aurangabad Regional Store', timestamp: ts(45), acknowledged: false, checkpoint: 'Aurangabad Regional Store' },
  { id: 'ALT-002', type: 'temperature_excursion', severity: 'warning', shipmentId: 'SHP-2410-002', batchId: 'BTC-M1-2308', message: 'Temperature above 8°C range (9.1°C) for Medicine M1 at Nashik Distribution Center', timestamp: ts(90), acknowledged: false, checkpoint: 'Nashik Distribution Center' },
  { id: 'ALT-003', type: 'sensor_offline', severity: 'warning', shipmentId: 'SHP-2410-008', batchId: 'BTC-M4-2405', message: 'Sensor SNR-2401-1 has been offline for 2h 15m after delivery', timestamp: ts(135), acknowledged: true, checkpoint: 'Nagpur Medical Warehouse' },
  { id: 'ALT-004', type: 'missing_telemetry', severity: 'warning', shipmentId: 'SHP-2410-006', batchId: 'BTC-M6-2312', message: 'No telemetry received for 18m — possible signal loss near Kolkata', timestamp: ts(18), acknowledged: false, checkpoint: 'Kolkata Distribution Center' },
  { id: 'ALT-005', type: 'shipment_delay', severity: 'info', shipmentId: 'SHP-2410-003', batchId: 'BTC-M2-2403', message: 'Shipment 45m behind estimated arrival at Delhi Airport Cold Storage', timestamp: ts(60), acknowledged: false, checkpoint: 'Delhi Airport Cold Storage' },
  { id: 'ALT-006', type: 'temperature_excursion', severity: 'critical', shipmentId: 'SHP-2410-004', batchId: 'BTC-M4-2402', message: 'Excursion duration exceeded 1h for Medicine M4 — cumulative exposure risk', timestamp: ts(30), acknowledged: false, checkpoint: 'Aurangabad Regional Store' },
  { id: 'ALT-007', type: 'checkpoint_notification', severity: 'info', shipmentId: 'SHP-2410-001', batchId: 'BTC-M3-2401', message: 'Checkpoint notification: Shipment arrived at Pune Transit Depot', timestamp: ts(120), acknowledged: true, checkpoint: 'Pune Transit Depot' },
  { id: 'ALT-008', type: 'sensor_offline', severity: 'info', shipmentId: 'SHP-2410-010', batchId: 'BTC-M5-2403', message: 'Sensor SNR-2401-1 reconnected — telemetry resumed', timestamp: ts(5), acknowledged: false, checkpoint: 'Mumbai Airport Cargo Terminal' },
];

export const CHECKPOINT_LOGS = SHIPMENTS.flatMap((s) =>
  s.route.map((r) => ({
    checkpointId: `CKP-${s.id.split('-')[1]}-${r.location.slice(0, 3).toUpperCase()}`,
    shipmentId: s.id,
    location: r.location,
    type: r.type,
    arrivedAt: r.arrivedAt,
    status: r.status,
    temp: r.temp.toFixed(1),
    notified: r.status !== 'pending',
    isSimulated: true,
  }))
).sort((a, b) => new Date(b.arrivedAt) - new Date(a.arrivedAt));

export const DISPENSER_STATUS = {
  controllerConnected: true,
  lastSync: ts(5),
  batchVerified: null,
  releaseStatus: 'ARMED',
  syncInterval: 10,
  mechanismType: 'BO Motor Dispenser Assembly (Slots M1, M2, M3, M4)',
  isSimulated: false,
};

// Dashboard summary computed from shipments + alerts
export function getDashboardSummary() {
  const active = SHIPMENTS.filter((s) => s.status !== 'delivered');
  const excursions = SHIPMENTS.filter((s) => s.excursions.length > 0 && s.status !== 'delivered');
  const batchesReview = BATCHES.filter((b) => b.reviewStatus !== 'clear');
  const checkpointsNotified = CHECKPOINT_LOGS.filter((c) => c.notified).length;
  const unackAlerts = ALERTS.filter((a) => !a.acknowledged).length;

  return {
    activeShipments: active.length,
    excursionShipments: excursions.length,
    batchesReview: batchesReview.length,
    checkpointsNotified,
    unackAlerts,
    totalShipments: SHIPMENTS.length,
    deliveredShipments: SHIPMENTS.length - active.length,
  };
}
