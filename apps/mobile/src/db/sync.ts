/**
 * Sync Engine - Handles synchronization between local SQLite and remote API.
 * Implements push (local → server) and pull (server → local) operations.
 * Manages connectivity detection and automatic sync scheduling.
 */

import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from './schema';
import {
  dequeuePending,
  markBatchProcessing,
  markBatchApplied,
  markFailed,
  getPendingCount,
  resetProcessingToPending,
  MutationRecord,
} from './queue';
import {
  productRepo,
  stockBatchRepo,
  customerRepo,
  saleRepo,
  saleItemRepo,
  cashEntryRepo,
  inventoryMovementRepo,
} from './repositories';

const SYNC_META_LAST_SYNC = 'sync_last_sync_at';
const SYNC_META_CURSOR = 'sync_cursor';
const SYNC_INTERVAL_MS = 60_000; // 60 seconds

type SyncListener = (event: SyncEvent) => void;

export interface SyncEvent {
  type:
    | 'sync_start'
    | 'sync_complete'
    | 'sync_error'
    | 'connectivity_change'
    | 'pending_count_change';
  isOnline?: boolean;
  pendingCount?: number;
  error?: string;
  applied?: Record<string, string[]>;
  conflicts?: SyncConflict[];
}

export interface SyncConflict {
  entity: string;
  id: string;
  reason: string;
  serverVersion?: Record<string, unknown>;
  clientVersion?: Record<string, unknown>;
}

/**
 * Get the API client for sync operations
 * This lazy-imports to avoid circular dependencies
 */
async function getSyncApiClient() {
  // Dynamic import to break circular dependency with api.ts
  const { syncApi } = await import('../lib/api');
  return syncApi;
}

/**
 * Sync Engine singleton
 */
class SyncEngine {
  private isRunning = false;
  private syncLock = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<SyncListener>();
  private _isOnline = true;
  private _pendingCount = 0;

  get isOnline(): boolean {
    return this._isOnline;
  }

  get pendingCount(): number {
    return this._pendingCount;
  }

  /**
   * Subscribe to sync events
   */
  addListener(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SyncEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Start the sync engine
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Reset any stuck processing mutations
    await resetProcessingToPending();

    // Check initial connectivity
    await this.checkConnectivity();

    // Update pending count
    await this.updatePendingCount();

    // Start periodic sync
    this.intervalId = setInterval(() => {
      this.periodicSync();
    }, SYNC_INTERVAL_MS);

    // If online, do an initial sync
    if (this._isOnline) {
      this.fullSync().catch(() => undefined);
    }
  }

  /**
   * Stop the sync engine
   */
  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check current connectivity
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      const networkState = await Network.getNetworkStateAsync();
      const wasOnline = this._isOnline;
      this._isOnline =
        networkState.isConnected === true && networkState.isInternetReachable !== false;

      if (wasOnline !== this._isOnline) {
        this.emit({
          type: 'connectivity_change',
          isOnline: this._isOnline,
        });

        // If we just came back online, trigger sync
        if (this._isOnline && !wasOnline) {
          this.fullSync().catch(() => undefined);
        }
      }

      return this._isOnline;
    } catch {
      return this._isOnline;
    }
  }

  /**
   * Periodic sync check (called by interval timer)
   */
  private async periodicSync(): Promise<void> {
    await this.checkConnectivity();
    if (this._isOnline) {
      await this.fullSync();
    }
  }

  /**
   * Full sync: push local changes then pull server changes
   */
  async fullSync(): Promise<void> {
    if (this.syncLock) return;
    this.syncLock = true;

    try {
      this.emit({ type: 'sync_start' });

      // Push first (local changes to server)
      const pushResult = await this.push();

      // Then pull (server changes to local)
      await this.pull();

      // Update pending count
      await this.updatePendingCount();

      this.emit({
        type: 'sync_complete',
        applied: pushResult?.applied,
        conflicts: pushResult?.conflicts,
        pendingCount: this._pendingCount,
      });
    } catch (error: any) {
      this.emit({
        type: 'sync_error',
        error: error.message || 'Sync failed',
      });
    } finally {
      this.syncLock = false;
    }
  }

  /**
   * Push local mutations to server
   */
  async push(): Promise<{
    applied: Record<string, string[]>;
    conflicts: SyncConflict[];
  } | null> {
    const pending = await dequeuePending(100);
    if (pending.length === 0) return null;

    const api = await getSyncApiClient();

    // Mark as processing
    const ids = pending.map(m => m.id);
    await markBatchProcessing(ids);

    // Group by entity
    const changes: Record<string, any[]> = {};
    for (const mutation of pending) {
      if (!changes[mutation.entity]) {
        changes[mutation.entity] = [];
      }
      changes[mutation.entity].push({
        op: mutation.op,
        id: mutation.entity_id,
        data: JSON.parse(mutation.data),
        client_op_id: mutation.client_op_id,
        device_id: mutation.device_id,
        timestamp: mutation.timestamp,
      });
    }

    try {
      const result = await api.push({
        device_id: pending[0].device_id,
        changes,
      });

      // Mark applied mutations
      const appliedIds: string[] = [];
      for (const [entity, entityIds] of Object.entries(result.applied || {})) {
        for (const entityId of entityIds) {
          const mutation = pending.find(m => m.entity === entity && m.entity_id === entityId);
          if (mutation) appliedIds.push(mutation.id);
        }
      }
      if (appliedIds.length > 0) {
        await markBatchApplied(appliedIds);
      }

      // Mark failed mutations (conflicts)
      for (const conflict of result.conflicts || []) {
        const mutation = pending.find(
          m => m.entity === conflict.entity && m.entity_id === conflict.id
        );
        if (mutation) {
          await markFailed(mutation.id, conflict.reason);
          // Store conflict for user resolution
          await this.storeConflict(conflict, mutation);
        }
      }

      // Mark remaining as applied (not in conflicts)
      const conflictMutationIds = (result.conflicts || [])
        .map((c: SyncConflict) => {
          const m = pending.find(m => m.entity === c.entity && m.entity_id === c.id);
          return m?.id;
        })
        .filter(Boolean) as string[];

      const remainingApplied = ids.filter(
        id => !appliedIds.includes(id) && !conflictMutationIds.includes(id)
      );
      if (remainingApplied.length > 0) {
        await markBatchApplied(remainingApplied);
      }

      return {
        applied: result.applied || {},
        conflicts: result.conflicts || [],
      };
    } catch (error: any) {
      // Network error — reset all to pending for retry
      for (const id of ids) {
        await markFailed(id, error.message || 'Network error');
      }
      // Reset failed back to pending for retry on next cycle
      await resetProcessingToPending();
      throw error;
    }
  }

  /**
   * Pull server changes to local database
   */
  async pull(): Promise<void> {
    const api = await getSyncApiClient();

    const lastSyncAt = await AsyncStorage.getItem(SYNC_META_LAST_SYNC);
    const deviceId = await this.getDeviceId();

    const result = await api.pull({
      device_id: deviceId,
      last_sync_at: lastSyncAt || undefined,
    });

    // Apply server changes to local database
    const repoMap: Record<string, any> = {
      products: productRepo,
      stock_batches: stockBatchRepo,
      customers: customerRepo,
      sales: saleRepo,
      sale_items: saleItemRepo,
      cash_entries: cashEntryRepo,
      inventory_movements: inventoryMovementRepo,
    };

    for (const [entity, records] of Object.entries(result.changes || {})) {
      const repo = repoMap[entity];
      if (!repo || !Array.isArray(records) || records.length === 0) continue;

      // Convert server records to local format
      const localRecords = records.map((r: any) => ({
        ...r,
        // Convert Date objects to ISO strings for SQLite
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
        updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
        deleted_at:
          r.deleted_at instanceof Date ? r.deleted_at.toISOString() : r.deleted_at || null,
        // Convert booleans to integers for SQLite
        deleted: r.deleted ? 1 : 0,
        is_active: r.is_active !== undefined ? (r.is_active ? 1 : 0) : undefined,
      }));

      await repo.bulkUpsertFromServer(localRecords);
    }

    // Save sync metadata
    await AsyncStorage.setItem(SYNC_META_LAST_SYNC, result.serverTime);
    if (result.newCursor) {
      await AsyncStorage.setItem(SYNC_META_CURSOR, result.newCursor);
    }
  }

  /**
   * Store a sync conflict for user resolution
   */
  private async storeConflict(conflict: SyncConflict, mutation: MutationRecord): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    await db.runAsync(
      `INSERT OR REPLACE INTO _sync_conflicts (id, entity, entity_id, reason, client_data, server_data, mutation_id, resolved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        id,
        conflict.entity,
        conflict.id,
        conflict.reason,
        JSON.stringify(conflict.clientVersion || null),
        JSON.stringify(conflict.serverVersion || null),
        mutation.id,
        now,
      ]
    );
  }

  /**
   * Get unresolved conflicts
   */
  async getConflicts(): Promise<any[]> {
    const db = await getDatabase();
    return db.getAllAsync(
      `SELECT * FROM _sync_conflicts WHERE resolved = 0 ORDER BY created_at DESC`
    );
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'accept_server' | 'force_client'
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE _sync_conflicts SET resolved = 1, resolved_at = ?, resolution = ? WHERE id = ?`,
      [new Date().toISOString(), resolution, conflictId]
    );
  }

  /**
   * Update pending count and notify listeners
   */
  async updatePendingCount(): Promise<void> {
    const count = await getPendingCount();
    if (count !== this._pendingCount) {
      this._pendingCount = count;
      this.emit({
        type: 'pending_count_change',
        pendingCount: count,
      });
    }
  }

  /**
   * Get device ID from secure storage
   */
  private async getDeviceId(): Promise<string> {
    const { getDeviceId } = await import('../lib/deviceInfo');
    return getDeviceId();
  }
}

// Singleton instance
export const syncEngine = new SyncEngine();
