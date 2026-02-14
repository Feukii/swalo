/**
 * Database Maintenance - Data retention and pruning.
 * Removes old synced transactional data to keep the SQLite DB lean.
 * Reference data (products, customers, suppliers) is NEVER pruned.
 */

import { getDatabase } from './schema';

const DEFAULT_RETENTION_DAYS = 90;

/**
 * Tables eligible for pruning (transactional data only).
 * Order matters: children must be deleted before parents (FK constraints).
 */
const PRUNABLE_TABLES = [
  // Children first
  'sale_items',
  'invoice_items',
  'supplier_invoice_items',
  'client_receivable_payments',
  'supplier_debt_payments',
  'inventory_counts',
  // Then parents
  'sales',
  'invoices',
  'supplier_invoices',
  'cash_entries',
  'inventory_movements',
  'payments',
  'inventory_sessions',
] as const;

/**
 * Prune old synced records from transactional tables.
 * Only deletes records that:
 * 1. Are older than retentionDays
 * 2. Have been synced (_sync_status = 'synced')
 * 3. Are not referenced by pending mutations
 *
 * Reference data (products, customers, suppliers, stock_batches, packaging_types,
 * client_receivables, supplier_debts, cash_sessions) is NEVER pruned.
 */
export async function pruneOldData(
  shopId: string,
  retentionDays: number = DEFAULT_RETENTION_DAYS
): Promise<{ totalPruned: number; byTable: Record<string, number> }> {
  const db = await getDatabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffISO = cutoffDate.toISOString();

  const byTable: Record<string, number> = {};
  let totalPruned = 0;

  // Get all entity_ids that have pending mutations (must not be pruned)
  const pendingMutations = await db.getAllAsync<{ entity_id: string }>(
    `SELECT DISTINCT entity_id FROM _mutation_queue WHERE status IN ('pending', 'processing')`
  );
  const pendingIds = new Set(pendingMutations.map(m => m.entity_id));

  await db.withExclusiveTransactionAsync(async tx => {
    for (const table of PRUNABLE_TABLES) {
      // Different tables have different shop_id access patterns
      const hasShopId = ![
        'sale_items',
        'invoice_items',
        'supplier_invoice_items',
        'client_receivable_payments',
        'supplier_debt_payments',
        'inventory_counts',
      ].includes(table);

      let query: string;
      let params: unknown[];

      if (hasShopId) {
        query = `SELECT id FROM ${table}
                 WHERE shop_id = ? AND _sync_status = 'synced' AND created_at < ?`;
        params = [shopId, cutoffISO];
      } else {
        // Child tables: need to join to check parent's shop_id
        // For simplicity, just check sync status and age
        query = `SELECT id FROM ${table}
                 WHERE _sync_status = 'synced' AND created_at < ?`;
        params = [cutoffISO];
      }

      const rows = await tx.getAllAsync<{ id: string }>(query, params);

      // Filter out records with pending mutations
      const toPrune = rows.filter(r => !pendingIds.has(r.id));

      if (toPrune.length > 0) {
        // Delete in batches of 100 to avoid oversized queries
        for (let i = 0; i < toPrune.length; i += 100) {
          const batch = toPrune.slice(i, i + 100);
          const placeholders = batch.map(() => '?').join(', ');
          const ids = batch.map(r => r.id);
          await tx.runAsync(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ids);
        }
        byTable[table] = toPrune.length;
        totalPruned += toPrune.length;
      }
    }
  });

  // Clean up old applied mutations from the queue
  const queueResult = await db.runAsync(
    `DELETE FROM _mutation_queue WHERE status IN ('applied', 'failed') AND created_at < ?`,
    [cutoffISO]
  );
  if (queueResult.changes > 0) {
    byTable['_mutation_queue'] = queueResult.changes;
    totalPruned += queueResult.changes;
  }

  // Clean up old resolved conflicts
  const conflictResult = await db.runAsync(
    `DELETE FROM _sync_conflicts WHERE resolved = 1 AND created_at < ?`,
    [cutoffISO]
  );
  if (conflictResult.changes > 0) {
    byTable['_sync_conflicts'] = conflictResult.changes;
    totalPruned += conflictResult.changes;
  }

  return { totalPruned, byTable };
}

/**
 * Run daily maintenance at app startup.
 * Only runs once per day (tracks last run date in _sync_meta).
 */
export async function runDailyMaintenance(shopId: string): Promise<void> {
  const db = await getDatabase();
  const today = new Date().toISOString().split('T')[0];

  const lastRun = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM _sync_meta WHERE key = 'last_maintenance_date'`
  );

  if (lastRun?.value === today) {
    return; // Already ran today
  }

  try {
    const result = await pruneOldData(shopId);
    if (result.totalPruned > 0) {
      console.log(`[Maintenance] Pruned ${result.totalPruned} old records:`, result.byTable);
    }

    // Record that we ran maintenance today
    await db.runAsync(
      `INSERT OR REPLACE INTO _sync_meta (key, value) VALUES ('last_maintenance_date', ?)`,
      [today]
    );
  } catch (error) {
    console.error('[Maintenance] Pruning failed:', error);
  }
}
