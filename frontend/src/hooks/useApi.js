// Hook for loading data from API with loading/error/empty states

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';

export function useApi(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (e) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

export function useDashboardSummary() {
  return useApi(() => api.getDashboardSummary());
}

export function useShipments() {
  return useApi(() => api.getShipments());
}

export function useShipment(id) {
  return useApi(() => api.getShipment(id), [id]);
}

export function useAlerts() {
  return useApi(() => api.getAlerts());
}

export function useBatches() {
  return useApi(() => api.getBatches());
}

export function useCheckpoints() {
  return useApi(() => api.getCheckpoints());
}
