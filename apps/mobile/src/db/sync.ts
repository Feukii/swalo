/**
 * Sync Engine - Handles synchronization between local SQLite and remote API.
 * Implements push (local → server) and pull (server → local) operations.
 * Manages connectivity detection and automatic sync scheduling.
 */

import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, initDatabase, resetLocalDatabase } from './schema';
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
  supplierRepo,
  supplierDebtRepo,
  supplierDebtPaymentRepo,
  supplierInvoiceRepo,
  supplierInvoiceItemRepo,
  clientReceivableRepo,
  clientReceivablePaymentRepo,
  paymentRepo,
  invoiceRepo,
  invoiceItemRepo,
  packagingTypeRepo,
  cashSessionRepo,
  inventorySessionRepo,
  inventoryCountRepo,
} from './repositories';

const SYNC_META_LAST_SYNC = 'sync_last_sync_at';
const SYNC_META_CURSOR = 'sync_cursor';
const SYNC_INTERVAL_NORMAL_MS = 60_000; // 60 seconds
const SYNC_INTERVAL_LOW_BATTERY_MS = 300_000; // 5 minutes

/** Entities considered "reference data" (safe for auto-resolution via LWW) */
const REFERENCE_ENTITIES = new Set(['products', 'customers', 'suppliers', 'packaging_types']);

/**
 * Champs monétaires par entité. Les montants sont des ENTIERS FCFA de bout en bout
 * (serveur == local) : le FCFA n'a pas de centimes, donc AUCUNE conversion d'échelle
 * à la sync. On normalise seulement en entier par sécurité.
 */
const MONEY_FIELDS: Record<string, string[]> = {
  products: ['cost_price', 'sell_price', 'package_price'],
  stock_batches: ['cost_price', 'sell_price'],
  customers: ['credit_limit'],
  suppliers: ['borrowing_limit'],
  sales: [
    'subtotal',
    'discount',
    'tax_total',
    'net_total',
    'grand_total',
    'paid_total',
    'change',
    'expected_total',
  ],
  sale_items: ['unit_price', 'discount', 'subtotal', 'tax_total', 'total'],
  cash_entries: ['amount'],
  client_receivables: ['amount', 'paid_amount', 'balance'],
  client_receivable_payments: ['amount'],
  supplier_debts: ['amount', 'paid_amount', 'balance'],
  supplier_debt_payments: ['amount'],
  payments: ['amount'],
  invoices: ['subtotal', 'discount', 'tax_total', 'grand_total', 'paid_total', 'balance_due'],
  invoice_items: ['unit_price', 'discount', 'subtotal', 'tax_total', 'total'],
  inventory_movements: ['unit_cost'],
};

/** Normalise les champs monétaires en entiers FCFA. Aucune conversion d'échelle (pas de centimes). */
function convertMoneyFields<T extends Record<string, unknown>>(
  entity: string,
  data: T,
  _direction: 'toLocal' | 'toServer'
): T {
  const fields = MONEY_FIELDS[entity];
  if (!fields) return data;
  const out: Record<string, unknown> = { ...data };
  for (const f of fields) {
    const v = out[f];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[f] = Math.round(v);
    }
  }
  return out as T;
}

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

/** A stored, unresolved sync conflict row (from the _sync_conflicts table). */
export interface StoredSyncConflict {
  id: string;
  entity: string;
  entity_id: string;
  reason: string;
  client_data: string | null;
  server_data: string | null;
  mutation_id: string | null;
  resolved: number;
  resolved_at: string | null;
  resolution: string | null;
  auto_resolved: number;
  created_at: string;
}

/** A single change pushed to the server during sync. */
interface PushChange {
  op: MutationRecord['op'];
  id: string;
  data: Record<string, unknown>;
  client_op_id: string;
  device_id: string;
  timestamp: string;
  [key: string]: unknown;
}

/** A server record received during pull, before conversion to local format. */
type ServerRecord = Record<string, unknown>;

/**
 * Minimal repository surface used by the sync engine (write paths only).
 * Lets us index a repo map without coupling to each concrete row type.
 */
interface SyncWriteRepo {
  bulkUpsertFromServer(records: Array<Record<string, unknown> & { id: string }>): Promise<void>;
  upsertFromServer(data: Record<string, unknown> & { id: string }): Promise<void>;
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
  private _isLowBattery = false;
  private _maintenanceRan = false;
  /** Diagnostic du dernier pull : nb d'enregistrements reçus par entité + erreurs d'écriture. */
  private lastPullSummary: { received: Record<string, number>; errors: string[] } = {
    received: {},
    errors: [],
  };

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

    // Check initial connectivity and battery
    await this.checkConnectivity();
    await this.checkBatteryLevel();

    // Update pending count
    await this.updatePendingCount();

    // Start periodic sync with adaptive interval
    this.schedulePeriodicSync();

    // If online, do an initial sync
    if (this._isOnline) {
      this.fullSync().catch(() => undefined);
    }
  }

  /**
   * Schedule periodic sync with adaptive interval based on battery level
   */
  private schedulePeriodicSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    const interval = this._isLowBattery ? SYNC_INTERVAL_LOW_BATTERY_MS : SYNC_INTERVAL_NORMAL_MS;
    this.intervalId = setInterval(() => {
      this.periodicSync();
    }, interval);
  }

  /**
   * Check battery level and adjust sync interval if needed
   */
  private async checkBatteryLevel(): Promise<void> {
    try {
      // Try to use expo-battery if available (optional dependency)
      const Battery = await import('expo-battery').catch(() => null);
      if (Battery) {
        const level = await Battery.getBatteryLevelAsync();
        const wasLowBattery = this._isLowBattery;
        this._isLowBattery = level >= 0 && level < 0.3; // < 30%
        if (wasLowBattery !== this._isLowBattery && this.isRunning) {
          this.schedulePeriodicSync();
        }
      }
    } catch {
      // expo-battery not available, keep normal interval
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

      // Offline-first : "en ligne" dès qu'une connexion réseau est disponible.
      // On NE dépend PAS de isInternetReachable (le serveur peut être en LAN sans
      // Internet public, et certains réseaux bloquent le test Internet de l'OS).
      // S'il y a un réseau -> en ligne, et la synchro s'exécute (les échecs d'API
      // sont gérés proprement : push qui n'empêche pas le pull, retries, etc.).
      this._isOnline = networkState.isConnected === true;

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
    await this.checkBatteryLevel();
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

      // Push first (local changes to server). Un échec de push ne doit PAS
      // empêcher le pull : on doit toujours pouvoir lire les données du serveur
      // (sinon une mutation locale en erreur bloque tout le catalogue).
      let pushResult: { applied?: Record<string, string[]>; conflicts?: SyncConflict[] } | null =
        null;
      try {
        pushResult = await this.push();
      } catch (pushErr) {
        console.log(
          '[Sync] push échoué, on poursuit le pull:',
          pushErr instanceof Error ? pushErr.message : String(pushErr)
        );
      }

      // Then pull (server changes to local)
      await this.pull();

      // Ensure a fresh timestamp even if pull() didn't return a serverTime
      await AsyncStorage.setItem(SYNC_META_LAST_SYNC, new Date().toISOString());

      // Update pending count
      await this.updatePendingCount();

      this.emit({
        type: 'sync_complete',
        applied: pushResult?.applied,
        conflicts: pushResult?.conflicts,
        pendingCount: this._pendingCount,
      });

      // Run daily maintenance after first successful sync
      if (!this._maintenanceRan) {
        this._maintenanceRan = true;
        this.runMaintenance().catch(() => undefined);
      }
    } catch (error: unknown) {
      this.emit({
        type: 'sync_error',
        error: error instanceof Error ? error.message : 'Sync failed',
      });
    } finally {
      this.syncLock = false;
    }
  }

  /**
   * Resynchronisation COMPLÈTE forcée : supprime la base locale + le curseur,
   * recrée le schéma, puis re-télécharge TOUTES les données du serveur.
   * Renvoie le nombre de produits réellement écrits en local (ou l'erreur exacte).
   * Utilisé par le bouton "Forcer la resynchronisation" — répare + diagnostique.
   */
  async forceFullResync(): Promise<{
    ok: boolean;
    products: number;
    error?: string;
    detail?: string;
  }> {
    try {
      this.emit({ type: 'sync_start' });
      await resetLocalDatabase();
      await initDatabase();
      this._isOnline = true; // on force ; le pull validera réellement la connexion
      await this.pull();
      await AsyncStorage.setItem(SYNC_META_LAST_SYNC, new Date().toISOString());
      await this.updatePendingCount();
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) as n FROM products WHERE deleted = 0'
      );
      const products = row?.n ?? 0;
      this.emit({ type: 'sync_complete', pendingCount: this._pendingCount });
      const received = this.lastPullSummary.received.products ?? 0;
      let detail = `Reçu du serveur : ${received} produit(s).`;
      if (this.lastPullSummary.errors.length > 0) {
        detail += `\n\nErreurs d'écriture locale :\n- ${this.lastPullSummary.errors.join('\n- ')}`;
      }
      return { ok: true, products, detail };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit({ type: 'sync_error', error: message });
      return { ok: false, products: 0, error: message };
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
    const changes: Record<string, PushChange[]> = {};
    for (const mutation of pending) {
      if (!changes[mutation.entity]) {
        changes[mutation.entity] = [];
      }
      changes[mutation.entity].push({
        op: mutation.op,
        id: mutation.entity_id,
        // Conversion FCFA (local) -> centimes (serveur) sur les champs monétaires.
        data: convertMoneyFields(
          mutation.entity,
          JSON.parse(mutation.data) as Record<string, unknown>,
          'toServer'
        ),
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
    } catch (error: unknown) {
      // Network error — reset all to pending for retry
      const message = error instanceof Error ? error.message : 'Network error';
      for (const id of ids) {
        await markFailed(id, message);
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
    const repoMap: Record<string, SyncWriteRepo> = {
      products: productRepo,
      stock_batches: stockBatchRepo,
      packaging_types: packagingTypeRepo,
      customers: customerRepo,
      suppliers: supplierRepo,
      sales: saleRepo,
      sale_items: saleItemRepo,
      cash_entries: cashEntryRepo,
      cash_sessions: cashSessionRepo,
      inventory_movements: inventoryMovementRepo,
      inventory_sessions: inventorySessionRepo,
      inventory_counts: inventoryCountRepo,
      client_receivables: clientReceivableRepo,
      client_receivable_payments: clientReceivablePaymentRepo,
      supplier_debts: supplierDebtRepo,
      supplier_debt_payments: supplierDebtPaymentRepo,
      supplier_invoices: supplierInvoiceRepo,
      supplier_invoice_items: supplierInvoiceItemRepo,
      payments: paymentRepo,
      invoices: invoiceRepo,
      invoice_items: invoiceItemRepo,
    };

    const changesByEntity: Record<string, ServerRecord[]> = result.changes || {};
    this.lastPullSummary = { received: {}, errors: [] };
    for (const [entity, records] of Object.entries(changesByEntity)) {
      const repo = repoMap[entity];
      if (!repo || !Array.isArray(records) || records.length === 0) continue;
      this.lastPullSummary.received[entity] = records.length;

      // Convert server records to local format
      const localRecords = records.map((r: ServerRecord) => {
        const createdAt = r.created_at;
        const updatedAt = r.updated_at;
        const deletedAt = r.deleted_at;
        return {
          ...r,
          id: String(r.id),
          // Convert Date objects to ISO strings for SQLite
          created_at: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
          updated_at: updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt,
          deleted_at: deletedAt instanceof Date ? deletedAt.toISOString() : deletedAt || null,
          // Convert booleans to integers for SQLite
          deleted: r.deleted ? 1 : 0,
          is_active: r.is_active !== undefined ? (r.is_active ? 1 : 0) : undefined,
          is_default: r.is_default !== undefined ? (r.is_default ? 1 : 0) : undefined,
        } as Record<string, unknown> & { id: string };
      });

      // Conversion centimes (serveur) -> FCFA (local) sur les champs monétaires.
      const converted = localRecords.map(r => convertMoneyFields(entity, r, 'toLocal'));

      // Résilience : l'échec d'une entité ne doit pas bloquer les autres
      // (ex. les produits doivent s'écrire même si une autre table échoue).
      try {
        await repo.bulkUpsertFromServer(converted);
      } catch (applyErr) {
        const msg = applyErr instanceof Error ? applyErr.message : String(applyErr);
        this.lastPullSummary.errors.push(`${entity}: ${msg}`);
        console.log(`[Sync] échec application "${entity}":`, msg);
      }
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

    // Auto-resolve reference data conflicts (Last-Write-Wins: accept server version)
    if (REFERENCE_ENTITIES.has(conflict.entity)) {
      // Accept server version: apply the server data locally
      const repoMap: Record<string, SyncWriteRepo> = {
        products: productRepo,
        customers: customerRepo,
        suppliers: supplierRepo,
        packaging_types: packagingTypeRepo,
      };

      const repo = repoMap[conflict.entity];
      if (repo && conflict.serverVersion) {
        try {
          await repo.upsertFromServer({
            ...conflict.serverVersion,
            id: conflict.id,
          });
        } catch {
          // If auto-resolution fails, store as manual conflict
        }
      }

      // Store as auto-resolved conflict for audit trail
      await db.runAsync(
        `INSERT OR REPLACE INTO _sync_conflicts (id, entity, entity_id, reason, client_data, server_data, mutation_id, resolved, resolved_at, resolution, auto_resolved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'accept_server', 1, ?)`,
        [
          id,
          conflict.entity,
          conflict.id,
          conflict.reason,
          JSON.stringify(conflict.clientVersion || null),
          JSON.stringify(conflict.serverVersion || null),
          mutation.id,
          now,
          now,
        ]
      );
      return;
    }

    // Financial and other data: store for manual resolution
    await db.runAsync(
      `INSERT OR REPLACE INTO _sync_conflicts (id, entity, entity_id, reason, client_data, server_data, mutation_id, resolved, auto_resolved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
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
  async getConflicts(): Promise<StoredSyncConflict[]> {
    const db = await getDatabase();
    return db.getAllAsync<StoredSyncConflict>(
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

  /**
   * Run daily maintenance (data retention/pruning).
   * Gets shopId from the stored auth token.
   */
  private async runMaintenance(): Promise<void> {
    try {
      // Try shop first, then user for shop_id
      const shopStr = await AsyncStorage.getItem('shop');
      const userStr = await AsyncStorage.getItem('user');
      let shopId: string | null = null;

      if (shopStr) {
        const shop = JSON.parse(shopStr);
        shopId = shop?.id;
      }
      if (!shopId && userStr) {
        const user = JSON.parse(userStr);
        shopId = user?.shop_id;
      }
      if (!shopId) return;

      const { runDailyMaintenance } = await import('./maintenance');
      await runDailyMaintenance(shopId);
    } catch (error) {
      console.error('[SyncEngine] Maintenance error:', error);
    }
  }
}

// Singleton instance
export const syncEngine = new SyncEngine();
