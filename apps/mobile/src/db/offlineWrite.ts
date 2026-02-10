/**
 * Offline-First Write Operations.
 *
 * These functions write to the local SQLite DB and enqueue mutations
 * for later sync to the server. They also trigger an immediate sync
 * attempt if online.
 *
 * Used by screens (SaleScreen, CashScreen, StockManagementScreen)
 * to enable offline-capable write operations.
 */

import { getDeviceId } from '../lib/deviceInfo';
import { generateId, nowISO } from './repository';
import {
  stockBatchRepo,
  saleRepo,
  cashEntryRepo,
  inventoryMovementRepo,
  LocalSaleItem,
  LocalCashEntry,
} from './repositories';
import { enqueueMutation, MutationOp } from './queue';
import { SyncableEntity } from './schema';
import { syncEngine } from './sync';

/**
 * Helper to generate a client_op_id
 */
async function generateClientOpId(
  prefix: string
): Promise<{ clientOpId: string; deviceId: string }> {
  const deviceId = await getDeviceId();
  const clientOpId = `${prefix}_${deviceId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return { clientOpId, deviceId };
}

/**
 * Enqueue a mutation and trigger sync
 */
async function enqueueAndSync(params: {
  entity: SyncableEntity;
  op: MutationOp;
  entityId: string;
  data: Record<string, unknown>;
  clientOpId: string;
  deviceId: string;
}): Promise<void> {
  await enqueueMutation(params);
  await syncEngine.updatePendingCount();

  // Trigger sync if online (fire and forget)
  if (syncEngine.isOnline) {
    syncEngine.fullSync().catch(() => undefined);
  }
}

// ============================================================
// Sale Creation (Offline-capable)
// ============================================================

export interface OfflineSaleInput {
  shopId: string;
  cashierId: string;
  customerId: string | null;
  paymentMethod: 'cash' | 'credit';
  grandTotal: number;
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    qty: number;
    unitPrice: number;
    batchId?: string;
  }>;
  note?: string;
  expectedTotal?: number;
  pricingNotes?: string;
}

export async function createSaleOffline(input: OfflineSaleInput): Promise<{ saleId: string }> {
  const { clientOpId, deviceId } = await generateClientOpId('sale');
  const saleId = generateId();

  // Calculate totals
  let subtotal = 0;
  const saleItems: Partial<LocalSaleItem>[] = [];

  for (const item of input.items) {
    const itemTotal = item.qty * item.unitPrice;
    subtotal += itemTotal;

    saleItems.push({
      id: generateId(),
      product_id: item.productId,
      product_name: item.productName,
      sku: item.sku,
      qty: item.qty,
      unit_price: item.unitPrice,
      discount: 0,
      tax_rate: 0,
      subtotal: itemTotal,
      tax_total: 0,
      total: itemTotal,
      batch_id: item.batchId || null,
      version: 1,
    });
  }

  // Create sale locally
  await saleRepo.createWithItems(
    {
      id: saleId,
      shop_id: input.shopId,
      customer_id: input.customerId,
      cashier_id: input.cashierId,
      status: 'completed',
      payment_method: input.paymentMethod,
      subtotal,
      discount: 0,
      tax_total: 0,
      net_total: input.grandTotal,
      grand_total: input.grandTotal,
      paid_total: input.paymentMethod === 'cash' ? input.grandTotal : 0,
      change: 0,
      notes: input.note || null,
      expected_total: input.expectedTotal || null,
      pricing_notes: input.pricingNotes || null,
      version: 1,
      device_id: deviceId,
      client_op_id: clientOpId,
    },
    saleItems
  );

  // Deduct stock locally (FIFO)
  for (const item of input.items) {
    if (item.batchId) {
      await stockBatchRepo.deductFromBatch(item.batchId, item.qty);
    } else {
      await stockBatchRepo.deductFIFO(input.shopId, item.productId, item.qty);
    }
  }

  // Enqueue sale mutation
  await enqueueAndSync({
    entity: 'sales',
    op: 'insert',
    entityId: saleId,
    data: {
      id: saleId,
      shop_id: input.shopId,
      customer_id: input.customerId,
      cashier_id: input.cashierId,
      status: 'completed',
      payment_method: input.paymentMethod,
      subtotal,
      discount: 0,
      tax_total: 0,
      net_total: input.grandTotal,
      grand_total: input.grandTotal,
      paid_total: input.paymentMethod === 'cash' ? input.grandTotal : 0,
      change: 0,
      notes: input.note || null,
      expected_total: input.expectedTotal || null,
      pricing_notes: input.pricingNotes || null,
      device_id: deviceId,
      client_op_id: clientOpId,
      items: saleItems.map(si => ({
        ...si,
        sale_id: saleId,
      })),
    },
    clientOpId,
    deviceId,
  });

  return { saleId };
}

// ============================================================
// Cash Entry Creation (Offline-capable)
// ============================================================

export interface OfflineCashEntryInput {
  shopId: string;
  cashierId: string;
  type: 'IN' | 'OUT';
  category: string;
  amount: number;
  note?: string;
  supplierId?: string;
  customerId?: string;
}

export async function createCashEntryOffline(
  input: OfflineCashEntryInput
): Promise<{ entryId: string }> {
  const { clientOpId, deviceId } = await generateClientOpId('cash');
  const entryId = generateId();

  // Create cash entry locally
  await cashEntryRepo.create({
    id: entryId,
    shop_id: input.shopId,
    type: input.type,
    category: input.category,
    amount: input.amount,
    note: input.note || null,
    cashier_id: input.cashierId,
    device_id: deviceId,
    client_op_id: clientOpId,
    version: 1,
    supplier_id: input.supplierId || null,
    customer_id: input.customerId || null,
  } as Partial<LocalCashEntry>);

  // Enqueue mutation
  await enqueueAndSync({
    entity: 'cash_entries',
    op: 'insert',
    entityId: entryId,
    data: {
      id: entryId,
      shop_id: input.shopId,
      type: input.type,
      category: input.category,
      amount: input.amount,
      note: input.note || null,
      cashier_id: input.cashierId,
      device_id: deviceId,
      client_op_id: clientOpId,
      supplier_id: input.supplierId || null,
      customer_id: input.customerId || null,
    },
    clientOpId,
    deviceId,
  });

  return { entryId };
}

// ============================================================
// Stock Batch Creation (Offline-capable)
// ============================================================

export interface OfflineStockBatchInput {
  shopId: string;
  productId: string;
  quantity: number;
  costPrice: number;
  sellPrice: number;
  notes?: string;
}

export async function createStockBatchOffline(
  input: OfflineStockBatchInput
): Promise<{ batchId: string }> {
  const { clientOpId, deviceId } = await generateClientOpId('batch');
  const batchId = generateId();
  const now = nowISO();

  // Create stock batch locally
  await stockBatchRepo.create({
    id: batchId,
    shop_id: input.shopId,
    product_id: input.productId,
    quantity: input.quantity,
    remaining_quantity: input.quantity,
    cost_price: input.costPrice,
    sell_price: input.sellPrice,
    price_valid_from: now,
    price_valid_until: null,
    notes: input.notes || null,
  } as any);

  // Also create inventory movement locally
  const movementId = generateId();
  const { clientOpId: movClientOpId } = await generateClientOpId('inv');

  await inventoryMovementRepo.create({
    id: movementId,
    shop_id: input.shopId,
    product_id: input.productId,
    type: 'IN',
    qty: input.quantity,
    reason: 'Approvisionnement',
    ref_type: 'stock_batch',
    ref_id: batchId,
    unit_cost: input.costPrice,
    device_id: deviceId,
    client_op_id: movClientOpId,
    version: 1,
  } as any);

  // Enqueue batch mutation
  await enqueueAndSync({
    entity: 'stock_batches',
    op: 'insert',
    entityId: batchId,
    data: {
      id: batchId,
      shop_id: input.shopId,
      product_id: input.productId,
      quantity: input.quantity,
      remaining_quantity: input.quantity,
      cost_price: input.costPrice,
      sell_price: input.sellPrice,
      price_valid_from: now,
      notes: input.notes || null,
      device_id: deviceId,
      client_op_id: clientOpId,
    },
    clientOpId,
    deviceId,
  });

  return { batchId };
}
