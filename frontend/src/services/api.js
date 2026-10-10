// Centralized API service for MethXAI Cold Chain Monitoring
// Includes automatic resilient fallback for Vercel deployments and offline backend servers.

import {
  SHIPMENTS,
  BATCHES,
  ALERTS,
  CHECKPOINT_LOGS,
  DISPENSER_STATUS,
  getDashboardSummary,
} from '../data/mockData.js';
import { getStoredProductRanges, getStoredConfig } from '../utils/productStore.js';
import { socketService } from './socket.js';

function getApiConfig() {
  const config = getStoredConfig();
  const isMock = config.dataMode === 'mock' || !config.apiBaseUrl;
  return { baseUrl: config.apiBaseUrl, isMock };
}

function mockDelay(data, ms = 40) {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

async function apiRequest(path, options = {}) {
  const { baseUrl, isMock } = getApiConfig();
  if (isMock) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`API ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn(`[MethXAI API] Path '${path}' unreachable, activating simulated response:`, err.message);
    return null; // Triggers seamless fallback to mock data handler
  }
}

export const api = {
  get isMockMode() {
    return getApiConfig().isMock;
  },

  async getDashboardSummary() {
    const res = await apiRequest('/api/dashboard/summary');
    if (res !== null) return res;
    return mockDelay(getDashboardSummary());
  },

  async getShipments() {
    const res = await apiRequest('/api/shipments');
    if (res !== null) return res;
    const ranges = getStoredProductRanges();
    const updatedShipments = SHIPMENTS.map((s) => ({
      ...s,
      tempRange: ranges[s.product] || s.tempRange,
    }));
    return mockDelay(updatedShipments);
  },

  async getShipment(id) {
    const res = await apiRequest(`/api/shipments/${id}`);
    if (res !== null) return res;
    const ranges = getStoredProductRanges();
    const s = SHIPMENTS.find((x) => x.id === id);
    if (!s) return mockDelay(null);
    return mockDelay({
      ...s,
      tempRange: ranges[s.product] || s.tempRange,
    });
  },

  async getShipmentReadings(id) {
    const res = await apiRequest(`/api/shipments/${id}/readings`);
    if (res !== null) return res;
    const s = SHIPMENTS.find((x) => x.id === id);
    return mockDelay(s ? s.readings : []);
  },

  async getAlerts() {
    const res = await apiRequest('/api/alerts');
    if (res !== null) return res;
    return mockDelay(ALERTS);
  },

  async acknowledgeAlert(id) {
    const res = await apiRequest(`/api/alerts/${id}/acknowledge`, { method: 'PATCH' });
    if (res !== null) return res;
    const alert = ALERTS.find((a) => a.id === id);
    if (alert) alert.acknowledged = true;
    return mockDelay({ success: true });
  },

  async markAlertForReview(id) {
    const res = await apiRequest(`/api/alerts/${id}/acknowledge`, {
      method: 'PATCH',
      body: JSON.stringify({ review: true }),
    });
    if (res !== null) return res;
    const alert = ALERTS.find((a) => a.id === id);
    if (alert) {
      alert.acknowledged = true;
      alert.markedForReview = true;
    }
    return mockDelay({ success: true });
  },

  async getBatches() {
    const res = await apiRequest('/api/batches');
    if (res !== null) return res;
    return mockDelay(BATCHES);
  },

  async getCheckpoints() {
    const res = await apiRequest('/api/checkpoints');
    if (res !== null) return res;
    return mockDelay(CHECKPOINT_LOGS);
  },

  async getProducts() {
    const res = await apiRequest('/api/products');
    if (res !== null) return res;
    return mockDelay(getStoredProductRanges());
  },

  async getDispenserStatus() {
    const res = await apiRequest('/api/dispenser/status');
    if (res !== null) return res;
    return mockDelay(DISPENSER_STATUS);
  },

  async verifyBatch(batchId) {
    const res = await apiRequest('/api/dispenser/verify', {
      method: 'POST',
      body: JSON.stringify({ batchId }),
    });
    if (res !== null) return res;
    const batch = BATCHES.find((b) => b.batchId === batchId);
    return mockDelay({
      verified: batch ? batch.releaseStatus === 'RELEASED' : false,
      releaseStatus: batch ? batch.releaseStatus : 'UNKNOWN',
      message: batch ? `Batch ${batch.batchId} is ${batch.releaseStatus}` : 'Batch not found',
      isSimulated: true,
    });
  },

  async controlMotor(command, slotId = null, overrideLock = false) {
    const cmd = command.toUpperCase().trim();

    // Enforce cold chain security lock for held batches in mock / Vercel mode
    if (['M3 ON', 'M4 ON', 'R0 ON', 'R1 ON', 'STEP 512', 'VOICE_DISPENSE'].some((k) => cmd.includes(k)) && !overrideLock && slotId === 4) {
      const activeBatch = BATCHES.find((b) => b.batchId === 'BTC-M4-2402');
      if (activeBatch && activeBatch.releaseStatus === 'HOLD') {
        throw new Error(`Cold Chain Security Lock: Batch ${activeBatch.batchId} is in HOLD status (${activeBatch.holdReason}). Check override lock to test.`);
      }
    }

    const res = await apiRequest('/api/dispenser/control-motor', {
      method: 'POST',
      body: JSON.stringify({ command, slotId, overrideLock }),
    });
    if (res !== null) return res;

    // Simulated motor control dispatch logic for Vercel / Offline deployment
    let gateStatus = DISPENSER_STATUS.gateStatus || 'CLOSED';
    let motorState = 'IDLE';
    let activeScreen = DISPENSER_STATUS.activeScreen || 2;

    if (cmd.includes('GATE OPEN')) {
      gateStatus = 'OPEN';
      motorState = 'IDLE';
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance("Please take your vaccine. Kripya vaccine le le, MethXAI mein aapka swagat hai.");
        window.speechSynthesis.speak(utterance);
      }
    } else if (cmd.includes('GATE CLOSE')) {
      gateStatus = 'CLOSED';
      motorState = 'IDLE';
    } else if (cmd.includes('STOP')) {
      motorState = 'EMERGENCY_STOP';
      gateStatus = 'CLOSED';
    } else if (cmd.includes('START')) {
      motorState = 'IDLE';
    } else if (cmd.includes('AUTO_TEST')) {
      motorState = 'AUTO_TESTING';
      activeScreen = 14;
    } else if (['ON', 'STEP', 'DROP', 'VOICE_DISPENSE'].some((k) => cmd.includes(k))) {
      motorState = 'DISPENSING';
      activeScreen = 6;

      if (cmd.includes('VOICE_DISPENSE')) {
        setTimeout(() => {
          DISPENSER_STATUS.gateStatus = 'OPEN';
          DISPENSER_STATUS.motorState = 'IDLE';
          DISPENSER_STATUS.activeScreen = 6;
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance("Please take your vaccine. Kripya vaccine le le, MethXAI mein aapka swagat hai.");
            window.speechSynthesis.speak(utterance);
          }
          socketService.notify({
            type: 'motor_command_executed',
            data: { command: 'GATE OPEN', dispenserStatus: { ...DISPENSER_STATUS } }
          });
        }, 3000);
      }
    }

    DISPENSER_STATUS.gateStatus = gateStatus;
    DISPENSER_STATUS.motorState = motorState;
    DISPENSER_STATUS.lastCommand = cmd;
    DISPENSER_STATUS.activeScreen = activeScreen;

    const mockResult = {
      success: true,
      command: cmd,
      message: `[Vercel Mode] Dispatched command '${cmd}' to ESP32 / Arduino Uno`,
      dispenserStatus: { ...DISPENSER_STATUS },
    };

    socketService.notify({
      type: 'motor_command_executed',
      data: {
        command: cmd,
        dispenserStatus: { ...DISPENSER_STATUS },
        log: {
          timestamp: new Date().toISOString(),
          command: cmd,
          executedBy: 'Web Interface',
          status: 'DISPATCHED',
          motorState,
        },
      },
    });

    return mockDelay(mockResult);
  },

  async setLvglScreen(screen) {
    const res = await apiRequest('/api/lvgl/screen', {
      method: 'POST',
      body: JSON.stringify({ screen }),
    });
    if (res !== null) return res;

    DISPENSER_STATUS.activeScreen = screen;
    socketService.notify({
      type: 'lvgl_screen_changed',
      data: { screen, dispenserStatus: { ...DISPENSER_STATUS } },
    });
    return mockDelay({ success: true, activeScreen: screen });
  },

  async getLvglState() {
    const res = await apiRequest('/api/lvgl/state');
    if (res !== null) return res;

    return mockDelay({
      activeScreen: DISPENSER_STATUS.activeScreen || 14,
      dispenserStatus: DISPENSER_STATUS,
      currentTemp: DISPENSER_STATUS.currentTemp || 3.8,
      gateStatus: DISPENSER_STATUS.gateStatus || 'CLOSED',
      irBeamStatus: 'CLEAR',
      motorState: DISPENSER_STATUS.motorState || 'IDLE',
      lastCommand: DISPENSER_STATUS.lastCommand || null,
    });
  },
};
