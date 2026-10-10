// Native WebSocket service for real-time ESP32 telemetry updates
// Supports automatic fallback to simulated live telemetry when deployed on Vercel or when backend is offline.
import { getStoredConfig } from '../utils/productStore.js';
import { DISPENSER_STATUS, SHIPMENTS } from '../data/mockData.js';

class SocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isSimulated = false;
    this.listeners = new Set();
    this.reconnectTimer = null;
    this.simulatedTimer = null;
  }

  get url() {
    const config = getStoredConfig();
    if (config.wsUrl) return config.wsUrl;
    if (config.apiBaseUrl) {
      try {
        const httpUrl = new URL(config.apiBaseUrl);
        const wsProtocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${wsProtocol}//${httpUrl.host}/ws`;
      } catch (e) {
        // ignore invalid URL
      }
    }
    if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost') {
      return `ws://${window.location.hostname}:8000/ws`;
    }
    return 'ws://localhost:8000/ws';
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const isVercelHost = typeof window !== 'undefined' && (
      window.location.hostname.includes('vercel.app') ||
      window.location.protocol === 'https:'
    );

    if (isVercelHost) {
      console.log('[MethXAI] Environment detected as Vercel/HTTPS. Activating live simulated telemetry stream...');
      this.activateSimulatedMode();
      return;
    }

    try {
      const wsUrl = this.url;
      console.log(`Connecting to WebSocket at ${wsUrl}...`);
      this.ws = new WebSocket(wsUrl);

      const connTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.warn('[MethXAI] WebSocket connection timeout. Switching to live simulated telemetry...');
          try { this.ws.close(); } catch (e) { /* ignore */ }
          this.activateSimulatedMode();
        }
      }, 2000);

      this.ws.onopen = () => {
        clearTimeout(connTimeout);
        console.log('Connected to MethXAI Cold Chain WebSocket!');
        this.isConnected = true;
        this.isSimulated = false;
        if (this.simulatedTimer) clearInterval(this.simulatedTimer);
        this.notify({ type: 'connection_status', connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notify(data);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      this.ws.onclose = () => {
        clearTimeout(connTimeout);
        if (!this.isSimulated) {
          console.log('[MethXAI] WebSocket closed. Switching to live simulated telemetry mode...');
          this.activateSimulatedMode();
        }
      };

      this.ws.onerror = (err) => {
        clearTimeout(connTimeout);
        if (!this.isSimulated) {
          console.warn('[MethXAI] WebSocket error. Activating live simulated telemetry mode...', err);
          this.activateSimulatedMode();
        }
      };
    } catch (e) {
      console.warn('Failed to initiate WebSocket connection:', e);
      this.activateSimulatedMode();
    }
  }

  activateSimulatedMode() {
    if (this.isSimulated) return;
    this.isSimulated = true;
    this.isConnected = true;
    
    // Notify listeners of initial status and data
    this.notify({ type: 'connection_status', connected: true, simulated: true });
    this.notify({
      type: 'init',
      dispenserStatus: DISPENSER_STATUS,
      activeShipments: SHIPMENTS.length,
      alertsCount: 1,
    });

    if (this.simulatedTimer) clearInterval(this.simulatedTimer);

    // Periodic live telemetry simulation loop (ticks every 3 seconds)
    this.simulatedTimer = setInterval(() => {
      const delta = (Math.random() * 0.2 - 0.1);
      const currentTemp = +(3.8 + delta).toFixed(1);
      const currentHumidity = +(48.0 + (Math.random() * 0.8 - 0.4)).toFixed(1);

      DISPENSER_STATUS.currentTemp = currentTemp;

      const activeShipment = SHIPMENTS[2] || SHIPMENTS[0];
      if (activeShipment) {
        activeShipment.currentTemp = currentTemp;
        activeShipment.currentHumidity = currentHumidity;
        if (!activeShipment.readings) activeShipment.readings = [];
        activeShipment.readings.push({
          timestamp: new Date().toISOString(),
          temperature: currentTemp,
          humidity: currentHumidity,
          isSimulated: true,
          sensorId: 'ESP32-HARDWARE-01',
        });
        if (activeShipment.readings.length > 50) {
          activeShipment.readings.shift();
        }
      }

      this.notify({
        type: 'telemetry_update',
        data: {
          shipmentId: activeShipment ? activeShipment.id : 'SHP-2410-007',
          currentTemp,
          currentHumidity,
          dispenserStatus: { ...DISPENSER_STATUS },
          reading: {
            timestamp: new Date().toISOString(),
            temperature: currentTemp,
            humidity: currentHumidity,
            isSimulated: true,
            sensorId: 'ESP32-HARDWARE-01',
          },
        },
      });
    }, 3000);
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 10000);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.simulatedTimer) clearInterval(this.simulatedTimer);
    if (this.ws) {
      try { this.ws.close(); } catch (e) { /* ignore */ }
      this.ws = null;
    }
    this.isConnected = false;
    this.isSimulated = false;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  notify(data) {
    this.listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error('Error in socket listener:', err);
      }
    });
  }
}

export const socketService = new SocketService();

export function initSocket() {
  socketService.connect();
}

export function subscribeToSocket(callback) {
  return socketService.subscribe(callback);
}
