// Centralized API service for MethXAI Cold Chain Monitoring
// When backend is available, set VITE_API_BASE_URL in .env
// Falls back to mock data service when backend is not connected.

import {
  SHIPMENTS,
  BATCHES,
  ALERTS,
  CHECKPOINT_LOGS,
  DISPENSER_STATUS,
  getDashboardSummary,
  PRODUCTS,
} from '../data/mockData.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const USE_MOCK = !API_BASE_URL;

// Simulate network latency for mock mode
function mockDelay(data, ms = 200) {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

async function apiRequest(path, options = {}) {
  if (USE_MOCK) {
    return null; // caller handles mock fallback
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  isMockMode: USE_MOCK,

  async getDashboardSummary() {
    if (USE_MOCK) return mockDelay(getDashboardSummary());
    return apiRequest('/api/dashboard/summary');
  },

  async getShipments() {
    if (USE_MOCK) return mockDelay(SHIPMENTS);
    return apiRequest('/api/shipments');
  },

  async getShipment(id) {
    if (USE_MOCK) {
      const s = SHIPMENTS.find((x) => x.id === id);
      return mockDelay(s || null);
    }
    return apiRequest(`/api/shipments/${id}`);
  },

  async getShipmentReadings(id) {
    if (USE_MOCK) {
      const s = SHIPMENTS.find((x) => x.id === id);
      return mockDelay(s ? s.readings : []);
    }
    return apiRequest(`/api/shipments/${id}/readings`);
  },

  async getAlerts() {
    if (USE_MOCK) return mockDelay(ALERTS);
    return apiRequest('/api/alerts');
  },

  async acknowledgeAlert(id) {
    if (USE_MOCK) {
      const alert = ALERTS.find((a) => a.id === id);
      if (alert) alert.acknowledged = true;
      return mockDelay({ success: true });
    }
    return apiRequest(`/api/alerts/${id}/acknowledge`, { method: 'PATCH' });
  },

  async markAlertForReview(id) {
    if (USE_MOCK) {
      const alert = ALERTS.find((a) => a.id === id);
      if (alert) {
        alert.acknowledged = true;
        alert.markedForReview = true;
      }
      return mockDelay({ success: true });
    }
    return apiRequest(`/api/alerts/${id}/acknowledge`, {
      method: 'PATCH',
      body: JSON.stringify({ review: true }),
    });
  },

  async getBatches() {
    if (USE_MOCK) return mockDelay(BATCHES);
    return apiRequest('/api/batches');
  },

  async getCheckpoints() {
    if (USE_MOCK) return mockDelay(CHECKPOINT_LOGS);
    return apiRequest('/api/checkpoints');
  },

  async getProducts() {
    if (USE_MOCK) return mockDelay(PRODUCTS);
    return apiRequest('/api/products');
  },

  async getDispenserStatus() {
    if (USE_MOCK) return mockDelay(DISPENSER_STATUS);
    return apiRequest('/api/dispenser/status');
  },

  async verifyBatch(batchId) {
    if (USE_MOCK) {
      const batch = BATCHES.find((b) => b.batchId === batchId);
      return mockDelay({
        verified: batch ? batch.releaseStatus === 'RELEASED' : false,
        releaseStatus: batch ? batch.releaseStatus : 'UNKNOWN',
        message: batch ? batch.releaseStatus : 'Batch not found',
        isSimulated: true,
      });
    }
    return apiRequest('/api/dispenser/verify', {
      method: 'POST',
      body: JSON.stringify({ batchId }),
    });
  },
};
