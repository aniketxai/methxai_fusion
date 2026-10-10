import { PRODUCTS } from '../data/mockData.js';

const STORAGE_KEY = 'methxai_product_ranges';
const CONFIG_KEY = 'methxai_config';

export function getStoredProductRanges() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure stored ranges match current product definitions
      const keys = Object.keys(parsed);
      if (keys.length > 0 && keys.every((k) => k in PRODUCTS)) {
        return { ...PRODUCTS, ...parsed };
      }
    }
  } catch (e) {
    console.warn('Failed to parse stored product ranges:', e);
  }
  return { ...PRODUCTS };
}

export function saveStoredProductRanges(ranges) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ranges));
    window.dispatchEvent(new CustomEvent('methxai_product_ranges_updated', { detail: ranges }));
  } catch (e) {
    console.warn('Failed to save product ranges:', e);
  }
}

export function getStoredConfig() {
  const host = (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== '10.155.26.85')
    ? window.location.hostname
    : 'localhost';

  const envApi = import.meta.env.VITE_API_BASE_URL;
  const envWs = import.meta.env.VITE_WS_URL;

  const defaultApiBase = (envApi && !envApi.includes('10.155.26.85'))
    ? envApi
    : `http://${host}:8000`;

  const defaultWsUrl = (envWs && !envWs.includes('10.155.26.85'))
    ? envWs
    : `ws://${host}:8000/ws`;

  const defaults = {
    apiBaseUrl: defaultApiBase,
    wsUrl: defaultWsUrl,
    dataMode: 'api',
    refreshInterval: '5',
    operatorName: 'Aniket S. (Logistics Lead)',
    operatorId: 'OP-001',
  };
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.apiBaseUrl && parsed.apiBaseUrl.includes('10.155.26.85')) {
        parsed.apiBaseUrl = defaultApiBase;
      }
      if (parsed.wsUrl && parsed.wsUrl.includes('10.155.26.85')) {
        parsed.wsUrl = defaultWsUrl;
      }
      return { ...defaults, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to parse stored config:', e);
  }
  return defaults;
}

export function saveStoredConfig(config) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('methxai_config_updated', { detail: config }));
  } catch (e) {
    console.warn('Failed to save config:', e);
  }
}
