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
  productRepo,
  stockBatchRepo,
  customerRepo,
  saleRepo,
  cashEntryRepo,
  inventoryMovementRepo,
  supplierRepo,
  supplierDebtRepo,
  supplierDebtPaymentRepo,
  clientReceivableRepo,
  clientReceivablePaymentRepo,
  paymentRepo,
  invoiceRepo,
  invoiceItemRepo,
  cashSessionRepo,
  inventorySessionRepo,
  inventoryCountRepo,
  LocalProduct,
  LocalSaleItem,
  LocalCashEntry,
  LocalCustomer,
  LocalSupplier,
  LocalSupplierDebt,
  LocalClientReceivable,
  LocalPayment,
  LocalInvoice,
  LocalCashSession,
  LocalInventorySession,
  LocalStockBatch,
  LocalInventoryMovement,
  LocalSupplierDebtPayment,
  LocalClientReceivablePayment,
  LocalInvoiceItem,
  LocalInventoryCount,
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
  /** Date d'échéance ISO — obligatoire côté serveur pour une vente à crédit. */
  dueDate?: string;
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
      // Échéance de la vente à crédit — requise côté serveur (déclenche les notifications).
      // Non stockée localement (la table `sales` n'a pas cette colonne), seulement dans le payload de sync.
      due_date: input.dueDate || null,
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
  /** Date de prise en compte du lot (ISO). Par défaut: maintenant. Propagée au serveur (price_valid_from). */
  priceValidFrom?: string;
}

export async function createStockBatchOffline(
  input: OfflineStockBatchInput
): Promise<{ batchId: string }> {
  const { clientOpId, deviceId } = await generateClientOpId('batch');
  const batchId = generateId();
  const now = nowISO();
  // Date de prise en compte du lot (réception datée) — défaut: maintenant
  const validFrom = input.priceValidFrom ?? now;

  // Create stock batch locally
  await stockBatchRepo.create({
    id: batchId,
    shop_id: input.shopId,
    product_id: input.productId,
    quantity: input.quantity,
    remaining_quantity: input.quantity,
    cost_price: input.costPrice,
    sell_price: input.sellPrice,
    price_valid_from: validFrom,
    created_at: validFrom,
    price_valid_until: null,
    notes: input.notes || null,
  } as Partial<LocalStockBatch>);

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
  } as Partial<LocalInventoryMovement>);

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
      price_valid_from: validFrom,
      created_at: validFrom,
      notes: input.notes || null,
      device_id: deviceId,
      client_op_id: clientOpId,
    },
    clientOpId,
    deviceId,
  });

  return { batchId };
}

// ============================================================
// Supplier CRUD (Offline-capable)
// ============================================================

export interface OfflineSupplierInput {
  shopId: string;
  name: string;
  firstName?: string;
  code?: string;
  phone?: string;
  email?: string;
  address?: string;
  borrowingLimit?: number;
  notes?: string;
}

export async function createSupplierOffline(
  input: OfflineSupplierInput
): Promise<{ supplierId: string }> {
  const { deviceId } = await generateClientOpId('supplier');
  const supplierId = generateId();

  await supplierRepo.create({
    id: supplierId,
    shop_id: input.shopId,
    name: input.name,
    first_name: input.firstName || null,
    code: input.code || null,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
    borrowing_limit: input.borrowingLimit ?? 0,
    notes: input.notes || null,
    is_active: 1,
    version: 1,
  } as Partial<LocalSupplier>);

  await enqueueAndSync({
    entity: 'suppliers',
    op: 'insert',
    entityId: supplierId,
    data: {
      id: supplierId,
      shop_id: input.shopId,
      name: input.name,
      first_name: input.firstName || null,
      code: input.code || null,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      borrowing_limit: input.borrowingLimit ?? 0,
      notes: input.notes || null,
      is_active: true,
    },
    clientOpId: `supplier_${supplierId}`,
    deviceId,
  });

  return { supplierId };
}

export async function updateSupplierOffline(
  supplierId: string,
  data: Partial<OfflineSupplierInput>
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.firstName !== undefined) updateData.first_name = data.firstName;
  if (data.code !== undefined) updateData.code = data.code;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.borrowingLimit !== undefined) updateData.borrowing_limit = data.borrowingLimit;
  if (data.notes !== undefined) updateData.notes = data.notes;

  await supplierRepo.update(supplierId, updateData as Partial<LocalSupplier>);

  const { deviceId } = await generateClientOpId('supplier_upd');
  await enqueueAndSync({
    entity: 'suppliers',
    op: 'update',
    entityId: supplierId,
    data: { id: supplierId, ...updateData },
    clientOpId: `supplier_upd_${supplierId}_${Date.now()}`,
    deviceId,
  });
}

// ============================================================
// Supplier Debt (Offline-capable)
// ============================================================

export interface OfflineSupplierDebtInput {
  shopId: string;
  supplierId: string;
  amount: number;
  description?: string;
  notes?: string;
}

export async function createSupplierDebtOffline(
  input: OfflineSupplierDebtInput
): Promise<{ debtId: string }> {
  const { deviceId } = await generateClientOpId('debt');
  const debtId = generateId();

  await supplierDebtRepo.create({
    id: debtId,
    shop_id: input.shopId,
    supplier_id: input.supplierId,
    amount: input.amount,
    paid_amount: 0,
    balance: input.amount,
    description: input.description || null,
    notes: input.notes || null,
    status: 'PENDING',
    version: 1,
  } as Partial<LocalSupplierDebt>);

  await enqueueAndSync({
    entity: 'supplier_debts',
    op: 'insert',
    entityId: debtId,
    data: {
      id: debtId,
      shop_id: input.shopId,
      supplier_id: input.supplierId,
      amount: input.amount,
      paid_amount: 0,
      balance: input.amount,
      description: input.description || null,
      notes: input.notes || null,
      status: 'PENDING',
    },
    clientOpId: `debt_${debtId}`,
    deviceId,
  });

  return { debtId };
}

export async function paySupplierDebtOffline(input: {
  debtId: string;
  amount: number;
  cashierId: string;
  notes?: string;
}): Promise<{ paymentId: string }> {
  const { deviceId } = await generateClientOpId('debt_pay');
  const paymentId = generateId();
  const now = nowISO();

  // Create payment record
  await supplierDebtPaymentRepo.create({
    id: paymentId,
    debt_id: input.debtId,
    amount: input.amount,
    payment_date: now,
    notes: input.notes || null,
    cashier_id: input.cashierId,
    cash_exit_id: null,
    version: 1,
  } as Partial<LocalSupplierDebtPayment>);

  // Update debt balance locally
  const debt = await supplierDebtRepo.getById(input.debtId);
  if (debt) {
    const newPaidAmount = debt.paid_amount + input.amount;
    const newBalance = debt.amount - newPaidAmount;
    const newStatus = newBalance <= 0 ? 'PAID' : newPaidAmount > 0 ? 'PARTIAL' : 'PENDING';
    await supplierDebtRepo.update(input.debtId, {
      paid_amount: newPaidAmount,
      balance: Math.max(0, newBalance),
      status: newStatus,
    } as Partial<LocalSupplierDebt>);
  }

  await enqueueAndSync({
    entity: 'supplier_debt_payments',
    op: 'insert',
    entityId: paymentId,
    data: {
      id: paymentId,
      debt_id: input.debtId,
      amount: input.amount,
      payment_date: now,
      notes: input.notes || null,
      cashier_id: input.cashierId,
    },
    clientOpId: `debt_pay_${paymentId}`,
    deviceId,
  });

  return { paymentId };
}

// ============================================================
// Client Receivable (Offline-capable)
// ============================================================

export interface OfflineReceivableInput {
  shopId: string;
  customerId: string;
  amount: number;
  description?: string;
  notes?: string;
  /** Date d'échéance ISO — obligatoire côté serveur pour une créance. */
  dueDate?: string;
}

export async function createReceivableOffline(
  input: OfflineReceivableInput
): Promise<{ receivableId: string }> {
  const { deviceId } = await generateClientOpId('recv');
  const receivableId = generateId();

  await clientReceivableRepo.create({
    id: receivableId,
    shop_id: input.shopId,
    customer_id: input.customerId,
    amount: input.amount,
    paid_amount: 0,
    balance: input.amount,
    description: input.description || null,
    notes: input.notes || null,
    status: 'PENDING',
    version: 1,
  } as Partial<LocalClientReceivable>);

  await enqueueAndSync({
    entity: 'client_receivables',
    op: 'insert',
    entityId: receivableId,
    data: {
      id: receivableId,
      shop_id: input.shopId,
      customer_id: input.customerId,
      amount: input.amount,
      paid_amount: 0,
      balance: input.amount,
      description: input.description || null,
      notes: input.notes || null,
      // Échéance — requise côté serveur (déclenche les notifications).
      // Non stockée localement (la table `client_receivables` n'a pas cette colonne).
      due_date: input.dueDate || null,
      status: 'PENDING',
    },
    clientOpId: `recv_${receivableId}`,
    deviceId,
  });

  return { receivableId };
}

export async function payReceivableOffline(input: {
  receivableId: string;
  amount: number;
  cashierId: string;
  notes?: string;
}): Promise<{ paymentId: string }> {
  const { deviceId } = await generateClientOpId('recv_pay');
  const paymentId = generateId();
  const now = nowISO();

  await clientReceivablePaymentRepo.create({
    id: paymentId,
    receivable_id: input.receivableId,
    amount: input.amount,
    payment_date: now,
    notes: input.notes || null,
    cashier_id: input.cashierId,
    cash_entry_id: null,
    version: 1,
  } as Partial<LocalClientReceivablePayment>);

  // Update receivable balance locally
  const receivable = await clientReceivableRepo.getById(input.receivableId);
  if (receivable) {
    const newPaidAmount = receivable.paid_amount + input.amount;
    const newBalance = receivable.amount - newPaidAmount;
    const newStatus = newBalance <= 0 ? 'PAID' : newPaidAmount > 0 ? 'PARTIAL' : 'PENDING';
    await clientReceivableRepo.update(input.receivableId, {
      paid_amount: newPaidAmount,
      balance: Math.max(0, newBalance),
      status: newStatus,
    } as Partial<LocalClientReceivable>);
  }

  await enqueueAndSync({
    entity: 'client_receivable_payments',
    op: 'insert',
    entityId: paymentId,
    data: {
      id: paymentId,
      receivable_id: input.receivableId,
      amount: input.amount,
      payment_date: now,
      notes: input.notes || null,
      cashier_id: input.cashierId,
    },
    clientOpId: `recv_pay_${paymentId}`,
    deviceId,
  });

  return { paymentId };
}

// ============================================================
// Payment (Offline-capable)
// ============================================================

export interface OfflinePaymentInput {
  shopId: string;
  refType: string;
  refId: string;
  method: string;
  amount: number;
  cashierId?: string;
  receiptRef?: string;
  notes?: string;
}

export async function createPaymentOffline(
  input: OfflinePaymentInput
): Promise<{ paymentId: string }> {
  const { clientOpId, deviceId } = await generateClientOpId('pay');
  const paymentId = generateId();

  await paymentRepo.create({
    id: paymentId,
    shop_id: input.shopId,
    ref_type: input.refType,
    ref_id: input.refId,
    method: input.method,
    amount: input.amount,
    cashier_id: input.cashierId || null,
    receipt_ref: input.receiptRef || null,
    notes: input.notes || null,
    device_id: deviceId,
    client_op_id: clientOpId,
    version: 1,
  } as Partial<LocalPayment>);

  await enqueueAndSync({
    entity: 'payments',
    op: 'insert',
    entityId: paymentId,
    data: {
      id: paymentId,
      shop_id: input.shopId,
      ref_type: input.refType,
      ref_id: input.refId,
      method: input.method,
      amount: input.amount,
      cashier_id: input.cashierId || null,
      receipt_ref: input.receiptRef || null,
      notes: input.notes || null,
      device_id: deviceId,
      client_op_id: clientOpId,
    },
    clientOpId,
    deviceId,
  });

  return { paymentId };
}

// ============================================================
// Cash Session (Offline-capable)
// ============================================================

export async function openCashSessionOffline(input: {
  shopId: string;
  cashierId: string;
  openingBalance: number;
  notes?: string;
}): Promise<{ sessionId: string }> {
  const { deviceId } = await generateClientOpId('csess');
  const sessionId = generateId();
  const now = nowISO();

  await cashSessionRepo.create({
    id: sessionId,
    shop_id: input.shopId,
    cashier_id: input.cashierId,
    status: 'OPEN',
    opening_balance: input.openingBalance,
    closing_balance: null,
    expected_balance: null,
    difference: null,
    opened_at: now,
    closed_at: null,
    notes: input.notes || null,
    version: 1,
  } as Partial<LocalCashSession>);

  await enqueueAndSync({
    entity: 'cash_sessions',
    op: 'insert',
    entityId: sessionId,
    data: {
      id: sessionId,
      shop_id: input.shopId,
      cashier_id: input.cashierId,
      status: 'OPEN',
      opening_balance: input.openingBalance,
      opened_at: now,
      notes: input.notes || null,
    },
    clientOpId: `csess_${sessionId}`,
    deviceId,
  });

  return { sessionId };
}

export async function closeCashSessionOffline(input: {
  sessionId: string;
  closingBalance: number;
  expectedBalance: number;
  notes?: string;
}): Promise<void> {
  const now = nowISO();
  const difference = input.closingBalance - input.expectedBalance;

  await cashSessionRepo.update(input.sessionId, {
    status: 'CLOSED',
    closing_balance: input.closingBalance,
    expected_balance: input.expectedBalance,
    difference,
    closed_at: now,
    notes: input.notes || null,
  } as Partial<LocalCashSession>);

  const { deviceId } = await generateClientOpId('csess_close');
  await enqueueAndSync({
    entity: 'cash_sessions',
    op: 'update',
    entityId: input.sessionId,
    data: {
      id: input.sessionId,
      status: 'CLOSED',
      closing_balance: input.closingBalance,
      expected_balance: input.expectedBalance,
      difference,
      closed_at: now,
      notes: input.notes || null,
    },
    clientOpId: `csess_close_${input.sessionId}_${Date.now()}`,
    deviceId,
  });
}

// ============================================================
// Invoice (Offline-capable)
// ============================================================

export interface OfflineInvoiceInput {
  shopId: string;
  saleId?: string;
  customerId?: string;
  number: string;
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  discount: number;
  taxTotal: number;
  grandTotal: number;
  notes?: string;
  items: Array<{
    productId?: string;
    description: string;
    qty: number;
    unitPrice: number;
    discount: number;
    taxRate: number;
  }>;
}

export async function createInvoiceOffline(
  input: OfflineInvoiceInput
): Promise<{ invoiceId: string }> {
  const { deviceId } = await generateClientOpId('inv');
  const invoiceId = generateId();

  await invoiceRepo.create({
    id: invoiceId,
    shop_id: input.shopId,
    sale_id: input.saleId || null,
    customer_id: input.customerId || null,
    number: input.number,
    status: 'DRAFT',
    issue_date: input.issueDate,
    due_date: input.dueDate || null,
    subtotal: input.subtotal,
    discount: input.discount,
    tax_total: input.taxTotal,
    grand_total: input.grandTotal,
    paid_total: 0,
    balance_due: input.grandTotal,
    notes: input.notes || null,
    pdf_url: null,
    version: 1,
  } as Partial<LocalInvoice>);

  // Create invoice items
  for (const item of input.items) {
    const itemSubtotal = item.qty * item.unitPrice - item.discount;
    const itemTaxTotal = Math.round(itemSubtotal * item.taxRate);
    const itemTotal = itemSubtotal + itemTaxTotal;

    await invoiceItemRepo.create({
      id: generateId(),
      invoice_id: invoiceId,
      product_id: item.productId || null,
      description: item.description,
      qty: item.qty,
      unit_price: item.unitPrice,
      discount: item.discount,
      tax_rate: item.taxRate,
      subtotal: itemSubtotal,
      tax_total: itemTaxTotal,
      total: itemTotal,
      version: 1,
    } as Partial<LocalInvoiceItem>);
  }

  await enqueueAndSync({
    entity: 'invoices',
    op: 'insert',
    entityId: invoiceId,
    data: {
      id: invoiceId,
      shop_id: input.shopId,
      sale_id: input.saleId || null,
      customer_id: input.customerId || null,
      number: input.number,
      status: 'DRAFT',
      issue_date: input.issueDate,
      due_date: input.dueDate || null,
      subtotal: input.subtotal,
      discount: input.discount,
      tax_total: input.taxTotal,
      grand_total: input.grandTotal,
      paid_total: 0,
      balance_due: input.grandTotal,
      notes: input.notes || null,
    },
    clientOpId: `inv_${invoiceId}`,
    deviceId,
  });

  return { invoiceId };
}

// ============================================================
// Inventory Session (Offline-capable)
// ============================================================

export async function startInventorySessionOffline(input: {
  shopId: string;
  userId: string;
  notes?: string;
}): Promise<{ sessionId: string }> {
  const { deviceId } = await generateClientOpId('isess');
  const sessionId = generateId();
  const now = nowISO();

  await inventorySessionRepo.create({
    id: sessionId,
    shop_id: input.shopId,
    user_id: input.userId,
    status: 'IN_PROGRESS',
    started_at: now,
    completed_at: null,
    notes: input.notes || null,
    version: 1,
  } as Partial<LocalInventorySession>);

  await enqueueAndSync({
    entity: 'inventory_sessions',
    op: 'insert',
    entityId: sessionId,
    data: {
      id: sessionId,
      shop_id: input.shopId,
      user_id: input.userId,
      status: 'IN_PROGRESS',
      started_at: now,
      notes: input.notes || null,
    },
    clientOpId: `isess_${sessionId}`,
    deviceId,
  });

  return { sessionId };
}

export async function addInventoryCountOffline(input: {
  sessionId: string;
  productId: string;
  expectedQty: number;
  countedQty: number;
  notes?: string;
}): Promise<{ countId: string }> {
  const { deviceId } = await generateClientOpId('icount');
  const countId = generateId();

  await inventoryCountRepo.create({
    id: countId,
    session_id: input.sessionId,
    product_id: input.productId,
    expected_qty: input.expectedQty,
    counted_qty: input.countedQty,
    difference: input.countedQty - input.expectedQty,
    notes: input.notes || null,
    version: 1,
  } as Partial<LocalInventoryCount>);

  await enqueueAndSync({
    entity: 'inventory_counts',
    op: 'insert',
    entityId: countId,
    data: {
      id: countId,
      session_id: input.sessionId,
      product_id: input.productId,
      expected_qty: input.expectedQty,
      counted_qty: input.countedQty,
      difference: input.countedQty - input.expectedQty,
      notes: input.notes || null,
    },
    clientOpId: `icount_${countId}`,
    deviceId,
  });

  return { countId };
}

export async function completeInventorySessionOffline(input: {
  sessionId: string;
  notes?: string;
}): Promise<void> {
  const now = nowISO();

  await inventorySessionRepo.update(input.sessionId, {
    status: 'COMPLETED',
    completed_at: now,
    notes: input.notes || null,
  } as Partial<LocalInventorySession>);

  const { deviceId } = await generateClientOpId('isess_done');
  await enqueueAndSync({
    entity: 'inventory_sessions',
    op: 'update',
    entityId: input.sessionId,
    data: {
      id: input.sessionId,
      status: 'COMPLETED',
      completed_at: now,
      notes: input.notes || null,
    },
    clientOpId: `isess_done_${input.sessionId}_${Date.now()}`,
    deviceId,
  });
}

// ============================================================
// Product CRUD (Offline-capable)
// ============================================================

export interface OfflineProductInput {
  shopId: string;
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  category?: string;
  family?: string;
  articleType?: string;
  brand?: string;
  reference?: string;
  unit?: string;
  packagingTypeId?: string | null;
  unitsPerPackage?: number | null;
  packagePrice?: number | null;
  taxRate?: number;
  costPrice: number;
  sellPrice: number;
  alertThreshold?: number;
  imageUrl?: string;
}

/**
 * Generate a local SKU if none provided (device-prefixed to avoid collisions)
 */
async function generateLocalSku(shopId: string): Promise<string> {
  const count = await productRepo.count(shopId);
  const deviceId = await getDeviceId();
  const shortDevice = deviceId.slice(-4).toUpperCase();
  return `LOC-${shortDevice}-${String(count + 1).padStart(4, '0')}`;
}

export async function createProductOffline(
  input: OfflineProductInput
): Promise<{ productId: string }> {
  const { clientOpId, deviceId } = await generateClientOpId('prod');
  const productId = generateId();
  const sku = input.sku || (await generateLocalSku(input.shopId));

  await productRepo.create({
    id: productId,
    shop_id: input.shopId,
    sku,
    barcode: input.barcode || null,
    name: input.name,
    description: input.description || null,
    category: input.category || null,
    family: input.family || null,
    article_type: input.articleType || null,
    brand: input.brand || null,
    reference: input.reference || null,
    unit: input.unit || 'unit',
    packaging_type_id: input.packagingTypeId || null,
    units_per_package: input.unitsPerPackage ?? null,
    package_price: input.packagePrice ?? null,
    tax_rate: input.taxRate ?? 0,
    cost_price: input.costPrice,
    sell_price: input.sellPrice,
    is_active: 1,
    alert_threshold: input.alertThreshold ?? 5,
    image_url: input.imageUrl || null,
    version: 1,
    device_id: deviceId,
    client_op_id: clientOpId,
  } as Partial<LocalProduct>);

  await enqueueAndSync({
    entity: 'products',
    op: 'insert',
    entityId: productId,
    data: {
      id: productId,
      shop_id: input.shopId,
      sku,
      barcode: input.barcode || null,
      name: input.name,
      description: input.description || null,
      category: input.category || null,
      family: input.family || null,
      article_type: input.articleType || null,
      brand: input.brand || null,
      reference: input.reference || null,
      unit: input.unit || 'unit',
      packaging_type_id: input.packagingTypeId || null,
      units_per_package: input.unitsPerPackage ?? null,
      package_price: input.packagePrice ?? null,
      tax_rate: input.taxRate ?? 0,
      cost_price: input.costPrice,
      sell_price: input.sellPrice,
      is_active: true,
      alert_threshold: input.alertThreshold ?? 5,
      image_url: input.imageUrl || null,
      device_id: deviceId,
      client_op_id: clientOpId,
    },
    clientOpId,
    deviceId,
  });

  return { productId };
}

export async function updateProductOffline(
  productId: string,
  data: Partial<OfflineProductInput>
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.sku !== undefined) updateData.sku = data.sku;
  if (data.barcode !== undefined) updateData.barcode = data.barcode;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.family !== undefined) updateData.family = data.family;
  if (data.articleType !== undefined) updateData.article_type = data.articleType;
  if (data.brand !== undefined) updateData.brand = data.brand;
  if (data.reference !== undefined) updateData.reference = data.reference;
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.packagingTypeId !== undefined) updateData.packaging_type_id = data.packagingTypeId;
  if (data.unitsPerPackage !== undefined) updateData.units_per_package = data.unitsPerPackage;
  if (data.packagePrice !== undefined) updateData.package_price = data.packagePrice;
  if (data.taxRate !== undefined) updateData.tax_rate = data.taxRate;
  if (data.costPrice !== undefined) updateData.cost_price = data.costPrice;
  if (data.sellPrice !== undefined) updateData.sell_price = data.sellPrice;
  if (data.alertThreshold !== undefined) updateData.alert_threshold = data.alertThreshold;
  if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;

  await productRepo.update(productId, updateData as Partial<LocalProduct>);

  const { deviceId } = await generateClientOpId('prod_upd');
  await enqueueAndSync({
    entity: 'products',
    op: 'update',
    entityId: productId,
    data: { id: productId, ...updateData },
    clientOpId: `prod_upd_${productId}_${Date.now()}`,
    deviceId,
  });
}

export async function deleteProductOffline(productId: string): Promise<void> {
  await productRepo.softDelete(productId);

  const { deviceId } = await generateClientOpId('prod_del');
  await enqueueAndSync({
    entity: 'products',
    op: 'delete',
    entityId: productId,
    data: { id: productId },
    clientOpId: `prod_del_${productId}_${Date.now()}`,
    deviceId,
  });
}

// ============================================================
// Customer CRUD (Offline-capable)
// ============================================================

export interface OfflineCustomerInput {
  shopId: string;
  name: string;
  firstName?: string;
  code?: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit?: number;
  notes?: string;
  /** Canaux de notification d'échéance/relance (gérés côté serveur). */
  smsNotificationsEnabled?: boolean;
  whatsappNotificationsEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
}

export async function createCustomerOffline(
  input: OfflineCustomerInput
): Promise<{ customerId: string }> {
  const { deviceId } = await generateClientOpId('cust');
  const customerId = generateId();

  await customerRepo.create({
    id: customerId,
    shop_id: input.shopId,
    name: input.name,
    first_name: input.firstName || null,
    code: input.code || null,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
    credit_limit: input.creditLimit ?? 0,
    notes: input.notes || null,
    is_active: 1,
    version: 1,
  } as Partial<LocalCustomer>);

  await enqueueAndSync({
    entity: 'customers',
    op: 'insert',
    entityId: customerId,
    data: {
      id: customerId,
      shop_id: input.shopId,
      name: input.name,
      first_name: input.firstName || null,
      code: input.code || null,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      credit_limit: input.creditLimit ?? 0,
      notes: input.notes || null,
      is_active: true,
      // Préférences de notification — appliquées côté serveur à la synchro.
      // Non stockées localement (la table `customers` n'a pas ces colonnes).
      ...(input.smsNotificationsEnabled !== undefined && {
        sms_notifications_enabled: input.smsNotificationsEnabled,
      }),
      ...(input.whatsappNotificationsEnabled !== undefined && {
        whatsapp_notifications_enabled: input.whatsappNotificationsEnabled,
      }),
      ...(input.emailNotificationsEnabled !== undefined && {
        email_notifications_enabled: input.emailNotificationsEnabled,
      }),
    },
    clientOpId: `cust_${customerId}`,
    deviceId,
  });

  return { customerId };
}

export async function updateCustomerOffline(
  customerId: string,
  data: Partial<OfflineCustomerInput>
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.firstName !== undefined) updateData.first_name = data.firstName;
  if (data.code !== undefined) updateData.code = data.code;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.creditLimit !== undefined) updateData.credit_limit = data.creditLimit;
  if (data.notes !== undefined) updateData.notes = data.notes;

  // Préférences de notification — appliquées côté serveur uniquement.
  // Les colonnes n'existent pas dans la table locale `customers`, on ne les
  // envoie donc que dans le payload de sync (pas dans customerRepo.update).
  const notificationData: Record<string, unknown> = {};
  if (data.smsNotificationsEnabled !== undefined)
    notificationData.sms_notifications_enabled = data.smsNotificationsEnabled;
  if (data.whatsappNotificationsEnabled !== undefined)
    notificationData.whatsapp_notifications_enabled = data.whatsappNotificationsEnabled;
  if (data.emailNotificationsEnabled !== undefined)
    notificationData.email_notifications_enabled = data.emailNotificationsEnabled;

  await customerRepo.update(customerId, updateData as Partial<LocalCustomer>);

  const { deviceId } = await generateClientOpId('cust_upd');
  await enqueueAndSync({
    entity: 'customers',
    op: 'update',
    entityId: customerId,
    data: { id: customerId, ...updateData, ...notificationData },
    clientOpId: `cust_upd_${customerId}_${Date.now()}`,
    deviceId,
  });
}

export async function deleteCustomerOffline(customerId: string): Promise<void> {
  await customerRepo.softDelete(customerId);

  const { deviceId } = await generateClientOpId('cust_del');
  await enqueueAndSync({
    entity: 'customers',
    op: 'delete',
    entityId: customerId,
    data: { id: customerId },
    clientOpId: `cust_del_${customerId}_${Date.now()}`,
    deviceId,
  });
}

export async function deleteSupplierOffline(supplierId: string): Promise<void> {
  await supplierRepo.softDelete(supplierId);

  const { deviceId } = await generateClientOpId('supplier_del');
  await enqueueAndSync({
    entity: 'suppliers',
    op: 'delete',
    entityId: supplierId,
    data: { id: supplierId },
    clientOpId: `supplier_del_${supplierId}_${Date.now()}`,
    deviceId,
  });
}
