/**
 * Mutation Queue - Persistent offline operation queue.
 * Stores operations performed offline for later sync to the server.
 * Operations are replayed in FIFO order (by timestamp).
 */

import { getDatabase, SyncableEntity } from './schema';
import { generateId, nowISO } from './repository';

export type MutationOp = 'insert' | 'upsert' | 'update' | 'delete';
export type MutationStatus = 'pending' | 'processing' | 'applied' | 'failed';

export interface MutationRecord {
  id: string;
  entity: SyncableEntity;
  op: MutationOp;
  entity_id: string;
  data: string; // JSON serialized entity data
  client_op_id: string;
  device_id: string;
  timestamp: string;
  status: MutationStatus;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

/**
 * Enqueue a new mutation for later sync
 */
export async function enqueueMutation(params: {
  entity: SyncableEntity;
  op: MutationOp;
  entityId: string;
  data: Record<string, unknown>;
  clientOpId: string;
  deviceId: string;
}): Promise<MutationRecord> {
  const db = await getDatabase();
  const now = nowISO();

  const mutation: MutationRecord = {
    id: generateId(),
    entity: params.entity,
    op: params.op,
    entity_id: params.entityId,
    data: JSON.stringify(params.data),
    client_op_id: params.clientOpId,
    device_id: params.deviceId,
    timestamp: now,
    status: 'pending',
    error_message: null,
    retry_count: 0,
    created_at: now,
  };

  await db.runAsync(
    `INSERT INTO _mutation_queue (id, entity, op, entity_id, data, client_op_id, device_id, timestamp, status, error_message, retry_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      mutation.id,
      mutation.entity,
      mutation.op,
      mutation.entity_id,
      mutation.data,
      mutation.client_op_id,
      mutation.device_id,
      mutation.timestamp,
      mutation.status,
      mutation.error_message,
      mutation.retry_count,
      mutation.created_at,
    ]
  );

  return mutation;
}

/**
 * Get all pending mutations in FIFO order (oldest first)
 */
export async function dequeuePending(limit = 100): Promise<MutationRecord[]> {
  const db = await getDatabase();
  return db.getAllAsync<MutationRecord>(
    `SELECT * FROM _mutation_queue WHERE status = 'pending' ORDER BY timestamp ASC LIMIT ?`,
    [limit]
  );
}

/**
 * Get all failed mutations
 */
export async function getFailedMutations(): Promise<MutationRecord[]> {
  const db = await getDatabase();
  return db.getAllAsync<MutationRecord>(
    `SELECT * FROM _mutation_queue WHERE status = 'failed' ORDER BY timestamp ASC`
  );
}

/**
 * Mark a mutation as processing (being sent to server)
 */
export async function markProcessing(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE _mutation_queue SET status = 'processing' WHERE id = ?`, [id]);
}

/**
 * Mark a batch of mutations as processing
 */
export async function markBatchProcessing(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE _mutation_queue SET status = 'processing' WHERE id IN (${placeholders})`,
    ids
  );
}

/**
 * Mark a mutation as applied (successfully synced)
 */
export async function markApplied(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM _mutation_queue WHERE id = ?`, [id]);
}

/**
 * Mark multiple mutations as applied (batch delete)
 */
export async function markBatchApplied(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(`DELETE FROM _mutation_queue WHERE id IN (${placeholders})`, ids);
}

/**
 * Mark a mutation as failed
 */
export async function markFailed(id: string, errorMessage: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE _mutation_queue SET status = 'failed', error_message = ?, retry_count = retry_count + 1 WHERE id = ?`,
    [errorMessage, id]
  );
}

/**
 * Retry a failed mutation (reset to pending)
 */
export async function retryMutation(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE _mutation_queue SET status = 'pending', error_message = NULL WHERE id = ?`,
    [id]
  );
}

/**
 * Reset all processing mutations back to pending
 * (e.g., after app crash during sync)
 */
export async function resetProcessingToPending(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE _mutation_queue SET status = 'pending' WHERE status = 'processing'`);
}

/**
 * Get count of pending mutations
 */
export async function getPendingCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM _mutation_queue WHERE status IN ('pending', 'processing')`
  );
  return row?.cnt ?? 0;
}

/**
 * Get count of failed mutations
 */
export async function getFailedCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM _mutation_queue WHERE status = 'failed'`
  );
  return row?.cnt ?? 0;
}

/**
 * Get total count of all mutations in queue
 */
export async function getTotalQueueCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM _mutation_queue`
  );
  return row?.cnt ?? 0;
}

/**
 * Clear all applied mutations (cleanup)
 */
export async function clearApplied(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM _mutation_queue WHERE status = 'applied'`);
}

/**
 * Clear the entire queue (for full reset)
 */
export async function clearQueue(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM _mutation_queue`);
}

/**
 * Group pending mutations by entity for sync push
 */
export async function getPendingGroupedByEntity(): Promise<Record<string, MutationRecord[]>> {
  const pending = await dequeuePending();
  const grouped: Record<string, MutationRecord[]> = {};

  for (const mutation of pending) {
    if (!grouped[mutation.entity]) {
      grouped[mutation.entity] = [];
    }
    grouped[mutation.entity].push(mutation);
  }

  return grouped;
}
