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
} from '../data/mockData.js';
import { getStoredProductRanges, getStoredConfig } from '../utils/productStore.js';

function getApiConfig() {
  const config = getStoredConfig();
  const isMock = config.dataMode === 'mock' || !config.apiBaseUrl;
  return { baseUrl: config.apiBaseUrl, isMock };
}

// Simulate network latency for mock mode
function mockDelay(data, ms = 200) {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

async function apiRequest(path, options = {}) {
  const { baseUrl, isMock } = getApiConfig();
  if (isMock) {
    return null; // caller handles mock fallback
  }
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  get isMockMode() {
    return getApiConfig().isMock;
  },

  async getDashboardSummary() {
    if (this.isMockMode) return mockDelay(getDashboardSummary());
    return apiRequest('/api/dashboard/summary');
  },

  async getShipments() {
    if (this.isMockMode) {
      const ranges = getStoredProductRanges();
      // Apply configured ranges dynamically
      const updatedShipments = SHIPMENTS.map((s) => ({
        ...s,
        tempRange: ranges[s.product] || s.tempRange,
      }));
      return mockDelay(updatedShipments);
    }
    return apiRequest('/api/shipments');
  },

  async getShipment(id) {
    if (this.isMockMode) {
      const ranges = getStoredProductRanges();
      const s = SHIPMENTS.find((x) => x.id === id);
      if (!s) return mockDelay(null);
      return mockDelay({
        ...s,
        tempRange: ranges[s.product] || s.tempRange,
      });
    }
    return apiRequest(`/api/shipments/${id}`);
  },

  async getShipmentReadings(id) {
    if (this.isMockMode) {
      const s = SHIPMENTS.find((x) => x.id === id);
      return mockDelay(s ? s.readings : []);
    }
    return apiRequest(`/api/shipments/${id}/readings`);
  },

  async getAlerts() {
    if (this.isMockMode) return mockDelay(ALERTS);
    return apiRequest('/api/alerts');
  },

  async acknowledgeAlert(id) {
    if (this.isMockMode) {
      const alert = ALERTS.find((a) => a.id === id);
      if (alert) alert.acknowledged = true;
      return mockDelay({ success: true });
    }
    return apiRequest(`/api/alerts/${id}/acknowledge`, { method: 'PATCH' });
  },

  async markAlertForReview(id) {
    if (this.isMockMode) {
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
    if (this.isMockMode) return mockDelay(BATCHES);
    return apiRequest('/api/batches');
  },

  async getCheckpoints() {
    if (this.isMockMode) return mockDelay(CHECKPOINT_LOGS);
    return apiRequest('/api/checkpoints');
  },

  async getProducts() {
    if (this.isMockMode) return mockDelay(getStoredProductRanges());
    return apiRequest('/api/products');
  },

  async getDispenserStatus() {
    if (this.isMockMode) return mockDelay(DISPENSER_STATUS);
    return apiRequest('/api/dispenser/status');
  },

  async verifyBatch(batchId) {
    if (this.isMockMode) {
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

