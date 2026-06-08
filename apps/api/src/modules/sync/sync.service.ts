import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SyncPullDto } from './dto/sync-pull.dto';
import { SyncPushDto, SyncMutationDto } from './dto/sync-push.dto';

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

    for (const [entityKey, prismaModel] of Object.entries(SYNC_ENTITIES)) {
      const model = (this.prisma as any)[prismaModel];
      if (!model) continue;

      // Build where clause: filter by shop_id and optionally by updated_at
      const where: any = {};

      // shop_id filtering (some child entities don't have direct shop_id)
      const parentRelationEntities: Record<string, Record<string, unknown>> = {
        sale_items: { sale: { shop_id: shopId } },
        invoice_items: { invoice: { shop_id: shopId } },
        supplier_invoice_items: { invoice: { shop_id: shopId } },
        supplier_debt_payments: { debt: { shop_id: shopId } },
        client_receivable_payments: { receivable: { shop_id: shopId } },
        inventory_counts: { session: { shop_id: shopId } },
      };

      if (parentRelationEntities[entityKey]) {
        Object.assign(where, parentRelationEntities[entityKey]);
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
        entity_versions: dto.entity_versions || {},
      },
      create: {
        device_id: dto.device_id,
        shop_id: shopId,
        last_sync_at: new Date(),
        cursor: serverTime,
        entity_versions: dto.entity_versions || {},
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
        if (!SYNC_ENTITIES[entityKey as SyncEntityKey]) {
          continue; // Skip unknown entities
        }

        applied[entityKey] = [];

        for (const mutation of mutations) {
          try {
            const result = await this.applyMutation(
              tx,
              shopId,
              userId,
              entityKey as SyncEntityKey,
              mutation
            );

            if (result.applied) {
              applied[entityKey].push(mutation.id);
            } else if (result.conflict) {
              conflicts.push(result.conflict);
            }
          } catch (error: any) {
            conflicts.push({
              entity: entityKey,
              id: mutation.id,
              reason: error.message || 'Unknown error',
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
    tx: any,
    shopId: string,
    userId: string,
    entityKey: SyncEntityKey,
    mutation: SyncMutationDto
  ): Promise<{ applied: boolean; conflict?: SyncConflict }> {
    const prismaModel = SYNC_ENTITIES[entityKey];
    const model = tx[prismaModel];

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
            reason: `Unknown operation: ${mutation.op}`,
          },
        };
    }
  }

  /**
   * Apply insert or upsert mutation
   */
  private async applyInsertOrUpsert(
    tx: any,
    model: any,
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
      if (
        mutation.op === 'upsert' &&
        existing.version !== undefined &&
        data.version != null &&
        existing.version > data.version
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
          version: (Number(existing.version) || 0) + 1,
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
    tx: any,
    model: any,
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
      existing.version > (mutation.data.version as number)
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
        version: (Number(existing.version) || 0) + 1,
      },
    });

    return { applied: true };
  }

  /**
   * Apply soft delete mutation
   */
  private async applySoftDelete(
    tx: any,
    model: any,
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
        version: (Number(existing.version) || 0) + 1,
      },
    });

    return { applied: true };
  }

  /**
   * Find a record by client_op_id for idempotency check
   */
  private async findByClientOpId(
    tx: any,
    entityKey: SyncEntityKey,
    clientOpId: string
  ): Promise<any> {
    const prismaModel = SYNC_ENTITIES[entityKey];
    const model = tx[prismaModel];

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
