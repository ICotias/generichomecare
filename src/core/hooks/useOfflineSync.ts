/**
 * Hook para monitorar e exibir status da fila offline.
 */
import { useState, useEffect, useCallback } from 'react';
import { getPendingCount, processQueue } from '../services/offlineQueue';

export const useOfflineSync = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000); // Poll every 10s
    return () => clearInterval(interval);
  }, [refresh]);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await processQueue();
      await refresh();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [refresh]);

  return { pendingCount, isSyncing, syncNow, refresh };
};
