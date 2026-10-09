// WebSocket / Socket.IO service for real-time updates
// When backend is available, set VITE_WS_URL in .env
// Falls back to simulated polling when not connected.

const WS_URL = import.meta.env.VITE_WS_URL || '';

export const socketService = {
  isConnected: false,
  isMock: !WS_URL,
  url: WS_URL,

  connect() {
    if (!WS_URL) {
      this.isConnected = false;
      this.isMock = true;
      return null;
    }
    // Socket.IO would connect here when backend is ready
    // const socket = io(WS_URL);
    // return socket;
    this.isConnected = false;
    return null;
  },

  disconnect() {
    this.isConnected = false;
  },
};
