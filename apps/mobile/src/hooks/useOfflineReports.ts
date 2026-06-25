/**
 * Hook for offline reports with sync freshness tracking.
 * Wraps report functions and auto-refreshes after sync events.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncEngine, SyncEvent } from '../db/sync';

const SYNC_META_LAST_SYNC = 'sync_last_sync_at';
const DEBOUNCE_MS = 5_000; // Debounce re-queries after sync

export type FreshnessLevel = 'fresh' | 'stale' | 'old' | 'unknown';

export interface FreshnessInfo {
  lastSyncedAt: string | null;
  level: FreshnessLevel;
  label: string;
}

/**
 * Get freshness level from a last-sync timestamp.
 * fresh = < 10 min, stale = 10min-1h, old = > 1h, unknown = never synced
 */
export function getFreshnessInfo(lastSyncedAt: string | null): FreshnessInfo {
  if (!lastSyncedAt) {
    return { lastSyncedAt: null, level: 'unknown', label: 'Jamais synchronise' };
  }

  const syncTime = new Date(lastSyncedAt).getTime();
  const now = Date.now();
  const diffMs = now - syncTime;
  const diffMin = diffMs / 60_000;

  if (diffMin < 10) {
    return { lastSyncedAt, level: 'fresh', label: 'A jour' };
  }
  if (diffMin < 60) {
    const mins = Math.floor(diffMin);
    return { lastSyncedAt, level: 'stale', label: `Il y a ${mins} min` };
  }
  if (diffMin < 1440) {
    const hours = Math.floor(diffMin / 60);
    return { lastSyncedAt, level: 'old', label: `Il y a ${hours}h` };
  }
  const days = Math.floor(diffMin / 1440);
  return { lastSyncedAt, level: 'old', label: `Il y a ${days}j` };
}

/**
 * Hook to track sync freshness.
 * Listens to sync events and updates the freshness level.
 */
export function useSyncFreshness(): FreshnessInfo {
  const [, setLastSyncedAt] = useState<string | null>(null);
  const [freshness, setFreshness] = useState<FreshnessInfo>({
    lastSyncedAt: null,
    level: 'unknown',
    label: 'Jamais synchronise',
  });

  // Load initial value
  useEffect(() => {
    AsyncStorage.getItem(SYNC_META_LAST_SYNC).then(value => {
      if (value) {
        setLastSyncedAt(value);
        setFreshness(getFreshnessInfo(value));
      }
    });
  }, []);

  // Listen to sync events
  useEffect(() => {
    const unsubscribe = syncEngine.addListener((event: SyncEvent) => {
      if (event.type === 'sync_complete') {
        AsyncStorage.getItem(SYNC_META_LAST_SYNC).then(value => {
          setLastSyncedAt(value);
          setFreshness(getFreshnessInfo(value));
        });
      }
    });

    return unsubscribe;
  }, []);

  // Update freshness periodically (every minute) — re-read from AsyncStorage
  useEffect(() => {
    const interval = setInterval(() => {
      AsyncStorage.getItem(SYNC_META_LAST_SYNC).then(value => {
        setLastSyncedAt(value);
        setFreshness(getFreshnessInfo(value));
      });
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  return freshness;
}

/**
 * Generic hook for running a report query that auto-refreshes after sync.
 */
export function useOfflineReport<T>(
  queryFn: () => Promise<T>,
  defaultValue: T,
  deps: unknown[] = []
): { data: T; loading: boolean; refresh: () => Promise<void> } {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await queryFn();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (e) {
      console.error('Report query error:', e);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [queryFn]);

  // Initial load + dependency changes
  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, ...deps]);

  // Auto-refresh after sync (debounced)
  useEffect(() => {
    const unsubscribe = syncEngine.addListener((event: SyncEvent) => {
      if (event.type === 'sync_complete') {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
          refresh();
        }, DEBOUNCE_MS);
      }
    });

    return () => {
      unsubscribe();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [refresh]);

  return { data, loading, refresh };
}
