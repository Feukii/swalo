import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SyncPullDto } from './dto/sync-pull.dto';
import { SyncPushDto, SyncMutationDto } from './dto/sync-push.dto';

/**
 * A generic synced record. All synced models share these mutable fields;
 * any other column is accessed dynamically.
 */
type SyncRecord = Record<string, unknown> & {
  id?: string;
  version?: number;
};

/**
 * Minimal subset of a Prisma model delegate used by the sync engine.
 * Args are loosely typed because the sync engine operates generically over
 * many models; the data has already been validated/sanitized before use.
 */
interface SyncModelDelegate {
  findMany(args: {
    where: Record<string, unknown>;
    take?: number;
    orderBy?: Record<string, unknown>;
  }): Promise<SyncRecord[]>;
  findUnique(args: { where: Record<string, unknown> }): Promise<SyncRecord | null>;
  findFirst(args: { where: Record<string, unknown> }): Promise<SyncRecord | null>;
  create(args: { data: Record<string, unknown> }): Promise<SyncRecord>;
  update(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<SyncRecord>;
}

/**
 * The Prisma delegate property names for every syncable entity.
 */
type PrismaModelName = (typeof SYNC_ENTITIES)[SyncEntityKey];

/**
 * A Prisma client (or transaction client) restricted to the model delegates
 * the sync engine touches. Indexing by a known model name yields the concrete
 * Prisma delegate, which we then view through {@link SyncModelDelegate}.
 */
type SyncClient = Pick<Prisma.TransactionClient, PrismaModelName>;

/**
 * Resolve a delegate from a Prisma client or transaction client by model name.
 *
 * Prisma generates a distinctly-typed (generic) delegate per model, so a value
 * selected dynamically by model name is a union of 21 incompatible delegate
 * types that TypeScript cannot reconcile with a single static interface. This
 * is the one unavoidable dynamic-dispatch boundary in the sync engine: we view
 * the concrete delegate through the narrow {@link SyncModelDelegate} surface it
 * actually calls. Everything downstream of this function is fully typed, and
 * the data has already been validated/sanitized before reaching the delegate.
 */
function getDelegate(client: SyncClient, prismaModel: PrismaModelName): SyncModelDelegate {
  return client[prismaModel] as unknown as SyncModelDelegate;
}

/**
 * Coerce an unknown version field to a number (defaults to 0).
 */
function toVersion(value: unknown): number {
  return typeof value === 'number' ? value : Number(value) || 0;
}

const MAX_RECORDS_PER_ENTITY = 500;

/**
 * Entities that can be synced, mapped to their Prisma model names
 */
const SYNC_ENTITIES = {
  products: 'product',
  stock_batches: 'stockBatch',
  packaging_types: 'packagingType',
  customers: 'customer',
  suppliers: 'supplier',
  sales: 'sale',
  sale_items: 'saleItem',
  cash_entries: 'cashEntry',
  cash_sessions: 'cashSession',
  inventory_movements: 'inventoryMovement',
  inventory_sessions: 'inventorySession',
  inventory_counts: 'inventoryCount',
  client_receivables: 'clientReceivable',
  client_receivable_payments: 'clientReceivablePayment',
  supplier_debts: 'supplierDebt',
  supplier_debt_payments: 'supplierDebtPayment',
  supplier_invoices: 'supplierInvoice',
  supplier_invoice_items: 'supplierInvoiceItem',
  payments: 'payment',
  invoices: 'invoice',
  invoice_items: 'invoiceItem',
} as const;

type SyncEntityKey = keyof typeof SYNC_ENTITIES;

/**
 * Runtime guard: is the given string a known syncable entity key?
 */
function isSyncEntityKey(key: string): key is SyncEntityKey {
  return Object.prototype.hasOwnProperty.call(SYNC_ENTITIES, key);
}

export interface SyncConflict {
  entity: string;
  id: string;
  reason: string;
  serverVersion?: Record<string, unknown>;
  clientVersion?: Record<string, unknown>;
}

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pull changes from server since last sync
   */
  async pull(shopId: string, dto: SyncPullDto) {
    const since = dto.last_sync_at ? new Date(dto.last_sync_at) : null;
    const changes: Record<string, unknown[]> = {};
    const serverTime = new Date().toISOString();

    for (const [entityKey, prismaModel] of Object.entries(SYNC_ENTITIES) as [
      SyncEntityKey,
      PrismaModelName,
    ][]) {
      const model = getDelegate(this.prisma, prismaModel);

      // Build where clause: filter by shop_id and optionally by updated_at
      const where: Record<string, unknown> = {};

      // shop_id filtering (some child entities don't have direct shop_id)
      const parentRelationEntities: Partial<Record<SyncEntityKey, Record<string, unknown>>> = {
        sale_items: { sale: { shop_id: shopId } },
        invoice_items: { invoice: { shop_id: shopId } },
        supplier_invoice_items: { invoice: { shop_id: shopId } },
        supplier_debt_payments: { debt: { shop_id: shopId } },
        client_receivable_payments: { receivable: { shop_id: shopId } },
        inventory_counts: { session: { shop_id: shopId } },
      };

      const parentRelation = parentRelationEntities[entityKey];
      if (parentRelation) {
        Object.assign(where, parentRelation);
      } else {
        where.shop_id = shopId;
      }

      // Incremental sync: only records updated since last sync
      if (since) {
        where.updated_at = { gt: since };
      }

      // Fetch records (include soft-deleted so client knows to remove them)
      const records = await model.findMany({
        where,
        take: MAX_RECORDS_PER_ENTITY,
        orderBy: { updated_at: 'asc' },
      });

      if (records.length > 0) {
        changes[entityKey] = records;
      }
    }

    // Update or create DeviceSyncState
    await this.prisma.deviceSyncState.upsert({
      where: { device_id: dto.device_id },
      update: {
        last_sync_at: new Date(),
        cursor: serverTime,
        entity_versions: dto.entity_versions ?? {},
      },
      create: {
        device_id: dto.device_id,
        shop_id: shopId,
        last_sync_at: new Date(),
        cursor: serverTime,
        entity_versions: dto.entity_versions ?? {},
      },
    });

    return {
      changes,
      newCursor: serverTime,
      serverTime,
    };
  }

  /**
   * Push client mutations to server
   */
  async push(shopId: string, userId: string, dto: SyncPushDto) {
    const applied: Record<string, string[]> = {};
    const conflicts: SyncConflict[] = [];
    const serverTime = new Date().toISOString();

    await this.prisma.$transaction(async tx => {
      for (const [entityKey, mutations] of Object.entries(dto.changes)) {
        if (!isSyncEntityKey(entityKey)) {
          continue; // Skip unknown entities
        }

        const appliedIds: string[] = [];
        applied[entityKey] = appliedIds;

        for (const mutation of mutations) {
          try {
            const result = await this.applyMutation(tx, shopId, userId, entityKey, mutation);

            if (result.applied) {
              appliedIds.push(mutation.id);
            } else if (result.conflict) {
              conflicts.push(result.conflict);
            }
          } catch (error) {
            const rawReason = error instanceof Error ? error.message : String(error);
            conflicts.push({
              entity: entityKey,
              id: mutation.id,
              reason: rawReason.length > 0 ? rawReason : 'Unknown error',
              clientVersion: mutation.data,
            });
          }
        }
      }
    });

    // Update DeviceSyncState
    await this.prisma.deviceSyncState.upsert({
      where: { device_id: dto.device_id },
      update: {
        last_sync_at: new Date(),
        cursor: serverTime,
      },
      create: {
        device_id: dto.device_id,
        shop_id: shopId,
        last_sync_at: new Date(),
        cursor: serverTime,
      },
    });

    return {
      applied,
      conflicts,
      newCursor: serverTime,
      serverTime,
    };
  }

  /**
   * Apply a single mutation within a transaction
   */
  private async applyMutation(
    tx: Prisma.TransactionClient,
    shopId: string,
    userId: string,
    entityKey: SyncEntityKey,
    mutation: SyncMutationDto
  ): Promise<{ applied: boolean; conflict?: SyncConflict }> {
    const prismaModel = SYNC_ENTITIES[entityKey];
    const model = getDelegate(tx, prismaModel);

    // Check idempotency: skip if client_op_id already exists
    if (mutation.client_op_id && entityKey !== 'sale_items') {
      const existing = await this.findByClientOpId(tx, entityKey, mutation.client_op_id);
      if (existing) {
        // Already applied — idempotent success
        return { applied: true };
      }
    }

    switch (mutation.op) {
      case 'insert':
      case 'upsert':
        return this.applyInsertOrUpsert(tx, model, shopId, userId, entityKey, mutation);
      case 'update':
        return this.applyUpdate(tx, model, shopId, entityKey, mutation);
      case 'delete':
        return this.applySoftDelete(tx, model, shopId, entityKey, mutation);
      default:
        return {
          applied: false,
          conflict: {
            entity: entityKey,
            id: mutation.id,
            reason: `Unknown operation: ${String(mutation.op)}`,
          },
        };
    }
  }

  /**
   * Apply insert or upsert mutation
   */
  private async applyInsertOrUpsert(
    _tx: Prisma.TransactionClient,
    model: SyncModelDelegate,
    shopId: string,
    userId: string,
    entityKey: SyncEntityKey,
    mutation: SyncMutationDto
  ): Promise<{ applied: boolean; conflict?: SyncConflict }> {
    const data = this.sanitizeData(entityKey, mutation.data, shopId, userId);

    // Check if record already exists
    const existing = await model.findUnique({
      where: { id: mutation.id },
    });

    if (existing) {
      // Upsert: check version for conflict
      const clientVersion = data.version;
      if (
        mutation.op === 'upsert' &&
        existing.version !== undefined &&
        clientVersion != null &&
        existing.version > toVersion(clientVersion)
      ) {
        // Server has newer version — conflict
        return {
          applied: false,
          conflict: {
            entity: entityKey,
            id: mutation.id,
            reason: 'Version conflict: server has newer version',
            serverVersion: existing,
            clientVersion: mutation.data,
          },
        };
      }

      // Update existing
      await model.update({
        where: { id: mutation.id },
        data: {
          ...data,
          version: toVersion(existing.version) + 1,
        },
      });
    } else {
      // Insert new
      await model.create({
        data: {
          ...data,
          id: mutation.id,
        },
      });
    }

    return { applied: true };
  }

  /**
   * Apply update mutation
   */
  private async applyUpdate(
    _tx: Prisma.TransactionClient,
    model: SyncModelDelegate,
    shopId: string,
    entityKey: SyncEntityKey,
    mutation: SyncMutationDto
  ): Promise<{ applied: boolean; conflict?: SyncConflict }> {
    const existing = await model.findUnique({
      where: { id: mutation.id },
    });

    if (!existing) {
      return {
        applied: false,
        conflict: {
          entity: entityKey,
          id: mutation.id,
          reason: 'Record not found on server',
          clientVersion: mutation.data,
        },
      };
    }

    // Version conflict check
    if (
      existing.version !== undefined &&
      mutation.data.version !== undefined &&
      existing.version > toVersion(mutation.data.version)
    ) {
      return {
        applied: false,
        conflict: {
          entity: entityKey,
          id: mutation.id,
          reason: 'Version conflict: server has newer version',
          serverVersion: existing,
          clientVersion: mutation.data,
        },
      };
    }

    const data = this.sanitizeUpdateData(entityKey, mutation.data);

    await model.update({
      where: { id: mutation.id },
      data: {
        ...data,
        version: toVersion(existing.version) + 1,
      },
    });

    return { applied: true };
  }

  /**
   * Apply soft delete mutation
   */
  private async applySoftDelete(
    _tx: Prisma.TransactionClient,
    model: SyncModelDelegate,
    shopId: string,
    entityKey: SyncEntityKey,
    mutation: SyncMutationDto
  ): Promise<{ applied: boolean; conflict?: SyncConflict }> {
    const existing = await model.findUnique({
      where: { id: mutation.id },
    });

    if (!existing) {
      // Already deleted or never existed — idempotent success
      return { applied: true };
    }

    await model.update({
      where: { id: mutation.id },
      data: {
        deleted: true,
        deleted_at: new Date(),
        version: toVersion(existing.version) + 1,
      },
    });

    return { applied: true };
  }

  /**
   * Find a record by client_op_id for idempotency check
   */
  private async findByClientOpId(
    tx: Prisma.TransactionClient,
    entityKey: SyncEntityKey,
    clientOpId: string
  ): Promise<SyncRecord | null> {
    const prismaModel = SYNC_ENTITIES[entityKey];
    const model = getDelegate(tx, prismaModel);

    // Only some entities have client_op_id
    const entitiesWithClientOpId = [
      'products',
      'sales',
      'cash_entries',
      'inventory_movements',
      'payments',
    ];
    if (!entitiesWithClientOpId.includes(entityKey)) return null;

    try {
      if (entityKey === 'inventory_movements') {
        // Unique constraint on client_op_id
        return await model.findFirst({
          where: { client_op_id: clientOpId },
        });
      }
      return await model.findFirst({
        where: { client_op_id: clientOpId },
      });
    } catch {
      return null;
    }
  }

  /**
   * Sanitize data for insert, adding required fields
   */
  private sanitizeData(
    entityKey: SyncEntityKey,
    data: Record<string, unknown>,
    shopId: string,
    userId: string
  ): Record<string, unknown> {
    const sanitized = { ...data };

    // Remove local-only fields
    delete sanitized._sync_status;
    delete sanitized._server_id;
    delete sanitized._last_synced_at;
    delete sanitized.id;

    // Ensure shop_id is set for shop-scoped entities (skip child entities)
    const childEntities = [
      'sale_items',
      'invoice_items',
      'supplier_invoice_items',
      'supplier_debt_payments',
      'client_receivable_payments',
      'inventory_counts',
    ];
    if (!childEntities.includes(entityKey)) {
      sanitized.shop_id = shopId;
    }

    // Ensure cashier_id for entities that require it
    const cashierEntities = ['sales', 'cash_entries', 'cash_sessions'];
    if (cashierEntities.includes(entityKey) && !sanitized.cashier_id) {
      sanitized.cashier_id = userId;
    }

    // Ensure user_id for inventory sessions
    if (entityKey === 'inventory_sessions' && !sanitized.user_id) {
      sanitized.user_id = userId;
    }

    // Convert date strings to Date objects
    for (const key of [
      'created_at',
      'updated_at',
      'deleted_at',
      'price_valid_from',
      'price_valid_until',
      'payment_date',
      'invoice_date',
      'due_date',
      'issue_date',
      'opened_at',
      'closed_at',
      'started_at',
      'completed_at',
    ]) {
      if (sanitized[key] && typeof sanitized[key] === 'string') {
        sanitized[key] = new Date(sanitized[key]);
      }
    }

    // Convert boolean fields from 0/1 to true/false
    for (const key of ['deleted', 'is_active', 'is_default']) {
      if (key in sanitized) {
        sanitized[key] = Boolean(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Sanitize data for update (no shop_id override needed)
   */
  private sanitizeUpdateData(
    entityKey: SyncEntityKey,
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const sanitized = { ...data };

    // Remove immutable/local fields
    delete sanitized._sync_status;
    delete sanitized._server_id;
    delete sanitized._last_synced_at;
    delete sanitized.id;
    delete sanitized.shop_id;
    delete sanitized.version;

    // Convert dates
    for (const key of [
      'created_at',
      'updated_at',
      'deleted_at',
      'price_valid_from',
      'price_valid_until',
      'payment_date',
      'invoice_date',
      'due_date',
      'issue_date',
      'opened_at',
      'closed_at',
      'started_at',
      'completed_at',
    ]) {
      if (sanitized[key] && typeof sanitized[key] === 'string') {
        sanitized[key] = new Date(sanitized[key]);
      }
    }

    // Convert booleans
    for (const key of ['deleted', 'is_active', 'is_default']) {
      if (key in sanitized) {
        sanitized[key] = Boolean(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Get sync status for a device
   */
  async getDeviceStatus(deviceId: string) {
    return this.prisma.deviceSyncState.findUnique({
      where: { device_id: deviceId },
    });
  }
}
