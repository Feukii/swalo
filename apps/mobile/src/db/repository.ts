/**
 * Generic local repository for SQLite entities.
 * Provides CRUD operations with sync status tracking.
 */

import { getDatabase, SyncStatus } from './schema';

export interface LocalRecord {
  id: string;
  _sync_status: SyncStatus;
  _server_id: string | null;
  _last_synced_at: string | null;
  deleted: number;
  created_at: string;
  updated_at: string;
}

export interface QueryOptions {
  where?: Record<string, unknown>;
  orderBy?: string;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
}

/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get current ISO timestamp
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Base repository providing CRUD operations on a local SQLite table.
 */
export class LocalRepository<T extends LocalRecord> {
  constructor(
    protected tableName: string,
    protected shopIdField: string = 'shop_id'
  ) {}

  /**
   * Get all records for a shop
   */
  async getAll(shopId: string, options: QueryOptions = {}): Promise<T[]> {
    const db = await getDatabase();
    const conditions: string[] = [`${this.shopIdField} = ?`];
    const params: unknown[] = [shopId];

    if (!options.includeDeleted) {
      conditions.push('deleted = 0');
    }

    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        if (value === null) {
          conditions.push(`${key} IS NULL`);
        } else {
          conditions.push(`${key} = ?`);
          params.push(value);
        }
      }
    }

    const whereClause = conditions.join(' AND ');
    const orderBy = options.orderBy || 'created_at DESC';
    const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
    const offsetClause = options.offset ? `OFFSET ${options.offset}` : '';

    const rows = await db.getAllAsync<T>(
      `SELECT * FROM ${this.tableName} WHERE ${whereClause} ORDER BY ${orderBy} ${limitClause} ${offsetClause}`,
      params as SQLite.SQLiteBindParams
    );

    return rows;
  }

  /**
   * Get a record by ID
   */
  async getById(id: string): Promise<T | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<T>(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
    return row ?? null;
  }

  /**
   * Insert a new record (marks as pending for sync)
   */
  async create(data: Partial<T> & { id?: string }): Promise<T> {
    const db = await getDatabase();
    const now = nowISO();
    const record = {
      ...data,
      id: data.id || generateId(),
      created_at: data.created_at || now,
      updated_at: now,
      deleted: 0,
      _sync_status: 'pending' as SyncStatus,
      _server_id: null,
      _last_synced_at: null,
    };

    const keys = Object.keys(record);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => {
      const val = (record as Record<string, unknown>)[k];
      // SQLite doesn't support booleans directly
      if (typeof val === 'boolean') return val ? 1 : 0;
      if (val === undefined) return null;
      return val;
    });

    await db.runAsync(
      `INSERT OR REPLACE INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`,
      values as SQLite.SQLiteBindParams
    );

    return { ...record } as T;
  }

  /**
   * Update a record (marks as pending for sync)
   */
  async update(id: string, data: Partial<T>): Promise<T | null> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) return null;

    const now = nowISO();
    const updates = {
      ...data,
      updated_at: now,
      _sync_status: 'pending' as SyncStatus,
      version: (((existing as Record<string, unknown>).version as number) || 1) + 1,
    };

    // Remove id from updates
    delete (updates as Record<string, unknown>).id;

    const keys = Object.keys(updates);
    const setClauses = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => {
      const val = (updates as Record<string, unknown>)[k];
      if (typeof val === 'boolean') return val ? 1 : 0;
      if (val === undefined) return null;
      return val;
    });

    await db.runAsync(`UPDATE ${this.tableName} SET ${setClauses} WHERE id = ?`, [
      ...values,
      id,
    ] as SQLite.SQLiteBindParams);

    return { ...existing, ...updates, id } as T;
  }

  /**
   * Soft-delete a record (marks as pending for sync)
   */
  async softDelete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const now = nowISO();
    const result = await db.runAsync(
      `UPDATE ${this.tableName} SET deleted = 1, deleted_at = ?, updated_at = ?, _sync_status = 'pending' WHERE id = ?`,
      [now, now, id]
    );
    return result.changes > 0;
  }

  /**
   * Upsert a record from server (marks as synced)
   */
  async upsertFromServer(data: Partial<T> & { id: string }): Promise<void> {
    const db = await getDatabase();
    const now = nowISO();
    const record = {
      ...data,
      _sync_status: 'synced' as SyncStatus,
      _server_id: data.id,
      _last_synced_at: now,
    };

    const keys = Object.keys(record);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => {
      const val = (record as Record<string, unknown>)[k];
      if (typeof val === 'boolean') return val ? 1 : 0;
      if (val === undefined) return null;
      return val;
    });

    // Use INSERT OR REPLACE for upsert
    await db.runAsync(
      `INSERT OR REPLACE INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`,
      values as SQLite.SQLiteBindParams
    );
  }

  /**
   * Bulk upsert from server (for sync pull)
   */
  async bulkUpsertFromServer(records: Array<Partial<T> & { id: string }>): Promise<void> {
    if (records.length === 0) return;
    const db = await getDatabase();
    const now = nowISO();

    await db.withExclusiveTransactionAsync(async tx => {
      for (const data of records) {
        const record = {
          ...data,
          _sync_status: 'synced' as SyncStatus,
          _server_id: data.id,
          _last_synced_at: now,
        };

        const keys = Object.keys(record);
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map(k => {
          const val = (record as Record<string, unknown>)[k];
          if (typeof val === 'boolean') return val ? 1 : 0;
          if (val === undefined) return null;
          return val;
        });

        await tx.runAsync(
          `INSERT OR REPLACE INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`,
          values as SQLite.SQLiteBindParams
        );
      }
    });
  }

  /**
   * Mark a record as synced
   */
  async markSynced(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE ${this.tableName} SET _sync_status = 'synced', _last_synced_at = ? WHERE id = ?`,
      [nowISO(), id]
    );
  }

  /**
   * Mark a record as conflict
   */
  async markConflict(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`UPDATE ${this.tableName} SET _sync_status = 'conflict' WHERE id = ?`, [id]);
  }

  /**
   * Get all pending records (not yet synced)
   */
  async getPending(shopId: string): Promise<T[]> {
    const db = await getDatabase();
    return db.getAllAsync<T>(
      `SELECT * FROM ${this.tableName} WHERE ${this.shopIdField} = ? AND _sync_status = 'pending' ORDER BY created_at ASC`,
      [shopId]
    );
  }

  /**
   * Count records
   */
  async count(shopId: string, includeDeleted = false): Promise<number> {
    const db = await getDatabase();
    const deletedClause = includeDeleted ? '' : ' AND deleted = 0';
    const row = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM ${this.tableName} WHERE ${this.shopIdField} = ?${deletedClause}`,
      [shopId]
    );
    return row?.cnt ?? 0;
  }

  /**
   * Get records updated after a certain timestamp
   */
  async getUpdatedSince(shopId: string, since: string): Promise<T[]> {
    const db = await getDatabase();
    return db.getAllAsync<T>(
      `SELECT * FROM ${this.tableName} WHERE ${this.shopIdField} = ? AND updated_at > ? ORDER BY updated_at ASC`,
      [shopId, since]
    );
  }
}

// We need SQLite type for params
import * as SQLite from 'expo-sqlite';
