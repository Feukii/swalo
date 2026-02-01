/**
 * useOfflineFirstQuery - Hook for offline-first data loading.
 *
 * Strategy:
 * 1. Read from local SQLite immediately (fast, works offline)
 * 2. If online, fetch from API in background
 * 3. Upsert API results into local DB
 * 4. Re-read local DB to update state
 *
 * This gives instant UI response from local data + eventual consistency with server.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { syncEngine } from '../db/sync';

interface UseOfflineFirstQueryOptions<TLocal, TRemote> {
  /** Read data from local SQLite DB */
  localQuery: () => Promise<TLocal[]>;
  /** Fetch data from remote API (optional - if omitted, only local reads) */
  remoteQuery?: () => Promise<TRemote[]>;
  /** Transform remote data to local format and upsert into SQLite */
  syncToLocal?: (remoteData: TRemote[]) => Promise<void>;
  /** Dependencies that should trigger a re-fetch */
  deps?: unknown[];
  /** Whether to skip the query entirely */
  skip?: boolean;
}

interface UseOfflineFirstQueryResult<T> {
  data: T[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isFromCache: boolean;
}

export function useOfflineFirstQuery<TLocal, TRemote = TLocal>(
  options: UseOfflineFirstQueryOptions<TLocal, TRemote>
): UseOfflineFirstQueryResult<TLocal> {
  const { localQuery, remoteQuery, syncToLocal, deps = [], skip = false } = options;
  const [data, setData] = useState<TLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadLocal = useCallback(async () => {
    try {
      const localData = await localQuery();
      if (mountedRef.current) {
        setData(localData);
        setError(null);
      }
      return localData;
    } catch (e: any) {
      if (mountedRef.current) {
        setError(e.message || 'Erreur de lecture locale');
      }
      return [];
    }
  }, [localQuery]);

  const loadRemoteAndSync = useCallback(async () => {
    if (!remoteQuery || !syncToLocal) return;
    if (!syncEngine.isOnline) return;

    try {
      const remoteData = await remoteQuery();
      await syncToLocal(remoteData);
      // Re-read local after sync
      const updatedLocal = await localQuery();
      if (mountedRef.current) {
        setData(updatedLocal);
        setIsFromCache(false);
      }
    } catch (e: any) {
      // Silent fail for background refresh - local data is still valid
      console.log('Background sync failed:', e.message);
    }
  }, [remoteQuery, syncToLocal, localQuery]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadLocal();
      await loadRemoteAndSync();
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [loadLocal, loadRemoteAndSync]);

  useEffect(() => {
    if (skip) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setIsFromCache(true);

      // Step 1: Read from local DB (instant)
      await loadLocal();

      if (!cancelled && mountedRef.current) {
        setLoading(false);
      }

      // Step 2: If we got local data, show it immediately
      // Then fetch from API in background
      if (!cancelled) {
        await loadRemoteAndSync();
      }
    };

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, ...deps]);

  return { data, loading, refreshing, error, refresh, isFromCache };
}

/**
 * Simpler version for single-entity queries (not arrays)
 */
interface UseOfflineFirstSingleOptions<TLocal, TRemote> {
  localQuery: () => Promise<TLocal | null>;
  remoteQuery?: () => Promise<TRemote>;
  syncToLocal?: (remoteData: TRemote) => Promise<void>;
  deps?: unknown[];
  skip?: boolean;
}

interface UseOfflineFirstSingleResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useOfflineFirstSingle<TLocal, TRemote = TLocal>(
  options: UseOfflineFirstSingleOptions<TLocal, TRemote>
): UseOfflineFirstSingleResult<TLocal> {
  const { localQuery, remoteQuery, syncToLocal, deps = [], skip = false } = options;
  const [data, setData] = useState<TLocal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const localData = await localQuery();
      if (mountedRef.current) {
        setData(localData);
        setError(null);
      }

      if (remoteQuery && syncToLocal && syncEngine.isOnline) {
        try {
          const remoteData = await remoteQuery();
          await syncToLocal(remoteData);
          const updated = await localQuery();
          if (mountedRef.current) {
            setData(updated);
          }
        } catch {
          // Silent fail
        }
      }
    } catch (e: any) {
      if (mountedRef.current) {
        setError(e.message);
      }
    }
  }, [localQuery, remoteQuery, syncToLocal]);

  useEffect(() => {
    if (skip) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh().finally(() => {
      if (mountedRef.current) setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, ...deps]);

  return { data, loading, error, refresh };
}
