/**
 * Hook for monitoring offline/online status and sync state.
 * Uses the SyncEngine to track connectivity and pending operations.
 */

import { useState, useEffect, useCallback } from 'react';
import { syncEngine, SyncEvent } from '../db/sync';

interface OfflineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastError: string | null;
  triggerSync: () => Promise<void>;
}

export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(syncEngine.isOnline);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(syncEngine.pendingCount);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = syncEngine.addListener((event: SyncEvent) => {
      switch (event.type) {
        case 'connectivity_change':
          setIsOnline(event.isOnline ?? true);
          break;
        case 'sync_start':
          setIsSyncing(true);
          setLastError(null);
          break;
        case 'sync_complete':
          setIsSyncing(false);
          if (event.pendingCount !== undefined) {
            setPendingCount(event.pendingCount);
          }
          break;
        case 'sync_error':
          setIsSyncing(false);
          setLastError(event.error || 'Erreur de synchronisation');
          break;
        case 'pending_count_change':
          if (event.pendingCount !== undefined) {
            setPendingCount(event.pendingCount);
          }
          break;
      }
    });

    return unsubscribe;
  }, []);

  const triggerSync = useCallback(async () => {
    await syncEngine.fullSync();
  }, []);

  return { isOnline, isSyncing, pendingCount, lastError, triggerSync };
}
