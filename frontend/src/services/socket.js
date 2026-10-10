// Native WebSocket service for real-time ESP32 telemetry updates
import { getStoredConfig } from '../utils/productStore.js';

class SocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.listeners = new Set();
    this.reconnectTimer = null;
  }

  get url() {
    const config = getStoredConfig();
    if (config.wsUrl) return config.wsUrl;
    if (config.apiBaseUrl) {
      const httpUrl = new URL(config.apiBaseUrl);
      const wsProtocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${httpUrl.host}/ws`;
    }
    // Default fallback to window location host or localhost:8000
    if (typeof window !== 'undefined' && window.location.hostname) {
      return `ws://${window.location.hostname}:8000/ws`;
    }
    return 'ws://localhost:8000/ws';
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const wsUrl = this.url;
      console.log(`Connecting to WebSocket at ${wsUrl}...`);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Connected to MethXAI Cold Chain WebSocket!');
        this.isConnected = true;
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
        console.log('WebSocket disconnected. Will attempt reconnect in 5s...');
        this.isConnected = false;
        this.notify({ type: 'connection_status', connected: false });
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
      };
    } catch (e) {
      console.error('Failed to initiate WebSocket connection:', e);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 5000);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
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
