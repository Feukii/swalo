/**
 * Entity-specific repositories for local SQLite database.
 * Each repository provides typed CRUD operations for its entity.
 */

import { LocalRepository, LocalRecord, generateId, nowISO } from './repository';
import { getDatabase } from './schema';

// ============================================================
// Product
// ============================================================

export interface LocalProduct extends LocalRecord {
  shop_id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  family: string | null;
  article_type: string | null;
  brand: string | null;
  reference: string | null;
  unit: string;
  tax_rate: number;
  cost_price: number;
  sell_price: number;
  is_active: number;
  alert_threshold: number;
  image_url: string | null;
  version: number;
  device_id: string | null;
  client_op_id: string | null;
}

class ProductRepository extends LocalRepository<LocalProduct> {
  constructor() {
    super('products');
  }

  async search(shopId: string, query: string): Promise<LocalProduct[]> {
    const db = await getDatabase();
    const pattern = `%${query}%`;
    return db.getAllAsync<LocalProduct>(
      `SELECT * FROM products WHERE shop_id = ? AND deleted = 0 AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?) ORDER BY name ASC LIMIT 50`,
      [shopId, pattern, pattern, pattern]
    );
  }

  async getByFamily(shopId: string, family: string): Promise<LocalProduct[]> {
    return this.getAll(shopId, { where: { family }, orderBy: 'name ASC' });
  }

  async getLowStock(shopId: string): Promise<LocalProduct[]> {
    const db = await getDatabase();
    // Products with total remaining stock below alert threshold
    return db.getAllAsync<LocalProduct>(
      `SELECT p.*, COALESCE(SUM(sb.remaining_quantity), 0) as total_stock
       FROM products p
       LEFT JOIN stock_batches sb ON sb.product_id = p.id AND sb.deleted = 0 AND sb.remaining_quantity > 0
       WHERE p.shop_id = ? AND p.deleted = 0 AND p.is_active = 1
       GROUP BY p.id
       HAVING total_stock <= p.alert_threshold
       ORDER BY total_stock ASC`,
      [shopId]
    );
  }
}

// ============================================================
// StockBatch
// ============================================================

export interface LocalStockBatch extends LocalRecord {
  shop_id: string;
  product_id: string;
  quantity: number;
  remaining_quantity: number;
  cost_price: number;
  sell_price: number;
  price_valid_from: string;
  price_valid_until: string | null;
  notes: string | null;
}

class StockBatchRepository extends LocalRepository<LocalStockBatch> {
  constructor() {
    super('stock_batches');
  }

  async getByProduct(
    shopId: string,
    productId: string,
    activeOnly = true
  ): Promise<LocalStockBatch[]> {
    const db = await getDatabase();
    const activeClause = activeOnly ? ' AND remaining_quantity > 0' : '';
    return db.getAllAsync<LocalStockBatch>(
      `SELECT * FROM stock_batches WHERE shop_id = ? AND product_id = ? AND deleted = 0${activeClause} ORDER BY created_at ASC`,
      [shopId, productId]
    );
  }

  async getTotalStock(shopId: string, productId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(remaining_quantity), 0) as total FROM stock_batches WHERE shop_id = ? AND product_id = ? AND deleted = 0 AND remaining_quantity > 0`,
      [shopId, productId]
    );
    return row?.total ?? 0;
  }

  /**
   * Deduct stock FIFO locally (for offline sales)
   */
  async deductFIFO(
    shopId: string,
    productId: string,
    qty: number
  ): Promise<{ batchId: string; deducted: number }[]> {
    const db = await getDatabase();
    const batches = await this.getByProduct(shopId, productId, true);

    let remaining = qty;
    const deductions: { batchId: string; deducted: number }[] = [];

    for (const batch of batches) {
      if (remaining <= 0) break;
      const toDeduct = Math.min(batch.remaining_quantity, remaining);

      await db.runAsync(
        `UPDATE stock_batches SET remaining_quantity = remaining_quantity - ?, updated_at = ?, _sync_status = 'pending' WHERE id = ?`,
        [toDeduct, nowISO(), batch.id]
      );

      deductions.push({ batchId: batch.id, deducted: toDeduct });
      remaining -= toDeduct;
    }

    return deductions;
  }

  /**
   * Deduct from a specific batch (for multi-price selection)
   */
  async deductFromBatch(batchId: string, qty: number): Promise<boolean> {
    const db = await getDatabase();
    const batch = await this.getById(batchId);
    if (!batch || batch.remaining_quantity < qty) return false;

    await db.runAsync(
      `UPDATE stock_batches SET remaining_quantity = remaining_quantity - ?, updated_at = ?, _sync_status = 'pending' WHERE id = ?`,
      [qty, nowISO(), batchId]
    );
    return true;
  }
}

// ============================================================
// Customer
// ============================================================

export interface LocalCustomer extends LocalRecord {
  shop_id: string;
  code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number;
  notes: string | null;
  is_active: number;
  version: number;
  first_name: string | null;
}

class CustomerRepository extends LocalRepository<LocalCustomer> {
  constructor() {
    super('customers');
  }

  async search(shopId: string, query: string): Promise<LocalCustomer[]> {
    const db = await getDatabase();
    const pattern = `%${query}%`;
    return db.getAllAsync<LocalCustomer>(
      `SELECT * FROM customers WHERE shop_id = ? AND deleted = 0 AND (name LIKE ? OR phone LIKE ? OR code LIKE ?) ORDER BY name ASC LIMIT 50`,
      [shopId, pattern, pattern, pattern]
    );
  }
}

// ============================================================
// Sale
// ============================================================

export interface LocalSale extends LocalRecord {
  shop_id: string;
  customer_id: string | null;
  cashier_id: string;
  status: string;
  payment_method: string;
  subtotal: number;
  discount: number;
  tax_total: number;
  net_total: number;
  grand_total: number;
  paid_total: number;
  change: number;
  notes: string | null;
  expected_total: number | null;
  pricing_notes: string | null;
  version: number;
  device_id: string | null;
  client_op_id: string | null;
}

export interface LocalSaleWithItems extends LocalSale {
  items: LocalSaleItem[];
}

class SaleRepository extends LocalRepository<LocalSale> {
  constructor() {
    super('sales');
  }

  async getWithItems(id: string): Promise<LocalSaleWithItems | null> {
    const sale = await this.getById(id);
    if (!sale) return null;

    const db = await getDatabase();
    const items = await db.getAllAsync<LocalSaleItem>(
      'SELECT * FROM sale_items WHERE sale_id = ? AND deleted = 0',
      [id]
    );

    return { ...sale, items };
  }

  async createWithItems(
    saleData: Partial<LocalSale>,
    items: Partial<LocalSaleItem>[]
  ): Promise<LocalSaleWithItems> {
    const db = await getDatabase();
    const now = nowISO();
    const saleId = saleData.id || generateId();

    const sale = {
      ...saleData,
      id: saleId,
      created_at: saleData.created_at || now,
      updated_at: now,
      deleted: 0,
      _sync_status: 'pending' as const,
      _server_id: null,
      _last_synced_at: null,
    };

    const saleItems: LocalSaleItem[] = [];

    await db.withExclusiveTransactionAsync(async tx => {
      // Insert sale
      const saleKeys = Object.keys(sale);
      const salePlaceholders = saleKeys.map(() => '?').join(', ');
      const saleValues = saleKeys.map(k => {
        const val = (sale as Record<string, unknown>)[k];
        if (typeof val === 'boolean') return val ? 1 : 0;
        if (val === undefined) return null;
        return val;
      });

      await tx.runAsync(
        `INSERT INTO sales (${saleKeys.join(', ')}) VALUES (${salePlaceholders})`,
        saleValues as (string | number | null)[]
      );

      // Insert items
      for (const item of items) {
        const saleItem = {
          ...item,
          id: item.id || generateId(),
          sale_id: saleId,
          created_at: now,
          updated_at: now,
          deleted: 0,
          _sync_status: 'pending' as const,
          _server_id: null,
          _last_synced_at: null,
        };

        const itemKeys = Object.keys(saleItem);
        const itemPlaceholders = itemKeys.map(() => '?').join(', ');
        const itemValues = itemKeys.map(k => {
          const val = (saleItem as Record<string, unknown>)[k];
          if (typeof val === 'boolean') return val ? 1 : 0;
          if (val === undefined) return null;
          return val;
        });

        await tx.runAsync(
          `INSERT INTO sale_items (${itemKeys.join(', ')}) VALUES (${itemPlaceholders})`,
          itemValues as (string | number | null)[]
        );

        saleItems.push(saleItem as LocalSaleItem);
      }
    });

    return { ...(sale as LocalSale), items: saleItems };
  }

  async getRecent(shopId: string, limit = 20): Promise<LocalSale[]> {
    return this.getAll(shopId, { orderBy: 'created_at DESC', limit });
  }
}

// ============================================================
// SaleItem
// ============================================================

export interface LocalSaleItem extends LocalRecord {
  sale_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  qty: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  subtotal: number;
  tax_total: number;
  total: number;
  batch_id: string | null;
  version: number;
}

class SaleItemRepository extends LocalRepository<LocalSaleItem> {
  constructor() {
    super('sale_items', 'sale_id');
  }

  async getBySale(saleId: string): Promise<LocalSaleItem[]> {
    const db = await getDatabase();
    return db.getAllAsync<LocalSaleItem>(
      'SELECT * FROM sale_items WHERE sale_id = ? AND deleted = 0',
      [saleId]
    );
  }
}

// ============================================================
// CashEntry
// ============================================================

export interface LocalCashEntry extends LocalRecord {
  shop_id: string;
  type: string;
  amount: number;
  note: string | null;
  cashier_id: string;
  device_id: string | null;
  client_op_id: string | null;
  version: number;
  category: string | null;
  supplier_id: string | null;
  customer_id: string | null;
}

class CashEntryRepository extends LocalRepository<LocalCashEntry> {
  constructor() {
    super('cash_entries');
  }

  async getToday(shopId: string): Promise<LocalCashEntry[]> {
    const db = await getDatabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return db.getAllAsync<LocalCashEntry>(
      `SELECT * FROM cash_entries WHERE shop_id = ? AND deleted = 0 AND created_at >= ? ORDER BY created_at DESC`,
      [shopId, today.toISOString()]
    );
  }

  async getBalance(shopId: string): Promise<{ totalIn: number; totalOut: number }> {
    const db = await getDatabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const inRow = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM cash_entries WHERE shop_id = ? AND deleted = 0 AND type = 'IN' AND created_at >= ?`,
      [shopId, today.toISOString()]
    );
    const outRow = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM cash_entries WHERE shop_id = ? AND deleted = 0 AND type = 'OUT' AND created_at >= ?`,
      [shopId, today.toISOString()]
    );

    return {
      totalIn: inRow?.total ?? 0,
      totalOut: outRow?.total ?? 0,
    };
  }
}

// ============================================================
// InventoryMovement
// ============================================================

export interface LocalInventoryMovement extends LocalRecord {
  shop_id: string;
  product_id: string;
  type: string;
  qty: number;
  reason: string | null;
  ref_type: string | null;
  ref_id: string | null;
  unit_cost: number | null;
  device_id: string;
  client_op_id: string;
  version: number;
}

class InventoryMovementRepository extends LocalRepository<LocalInventoryMovement> {
  constructor() {
    super('inventory_movements');
  }

  async getByProduct(
    shopId: string,
    productId: string,
    limit = 50
  ): Promise<LocalInventoryMovement[]> {
    const db = await getDatabase();
    return db.getAllAsync<LocalInventoryMovement>(
      `SELECT * FROM inventory_movements WHERE shop_id = ? AND product_id = ? AND deleted = 0 ORDER BY created_at DESC LIMIT ?`,
      [shopId, productId, limit]
    );
  }
}

// ============================================================
// Supplier
// ============================================================

export interface LocalSupplier extends LocalRecord {
  shop_id: string;
  code: string | null;
  name: string;
  first_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  borrowing_limit: number;
  notes: string | null;
  is_active: number;
  version: number;
}

class SupplierRepository extends LocalRepository<LocalSupplier> {
  constructor() {
    super('suppliers');
  }

  async search(shopId: string, query: string): Promise<LocalSupplier[]> {
    const db = await getDatabase();
    const pattern = `%${query}%`;
    return db.getAllAsync<LocalSupplier>(
      `SELECT * FROM suppliers WHERE shop_id = ? AND deleted = 0 AND (name LIKE ? OR phone LIKE ? OR code LIKE ?) ORDER BY name ASC LIMIT 50`,
      [shopId, pattern, pattern, pattern]
    );
  }
}

// ============================================================
// SupplierDebt
// ============================================================

export interface LocalSupplierDebt extends LocalRecord {
  shop_id: string;
  supplier_id: string;
  amount: number;
  paid_amount: number;
  balance: number;
  description: string | null;
  notes: string | null;
  status: string;
  version: number;
}

class SupplierDebtRepository extends LocalRepository<LocalSupplierDebt> {
  constructor() {
    super('supplier_debts');
  }

  async getBySupplier(shopId: string, supplierId: string): Promise<LocalSupplierDebt[]> {
    return this.getAll(shopId, {
      where: { supplier_id: supplierId },
      orderBy: 'created_at DESC',
    });
  }

  async getActiveDebts(shopId: string): Promise<LocalSupplierDebt[]> {
    const db = await getDatabase();
    return db.getAllAsync<LocalSupplierDebt>(
      `SELECT * FROM supplier_debts WHERE shop_id = ? AND deleted = 0 AND status IN ('PENDING', 'PARTIAL') ORDER BY created_at DESC`,
      [shopId]
    );
  }

  async getTotalBalance(shopId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(balance), 0) as total FROM supplier_debts WHERE shop_id = ? AND deleted = 0 AND status IN ('PENDING', 'PARTIAL')`,
      [shopId]
    );
    return row?.total ?? 0;
  }

  async getSupplierBalance(shopId: string, supplierId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(balance), 0) as total FROM supplier_debts WHERE shop_id = ? AND supplier_id = ? AND deleted = 0 AND status IN ('PENDING', 'PARTIAL')`,
      [shopId, supplierId]
    );
    return row?.total ?? 0;
  }
}

// ============================================================
// SupplierDebtPayment
// ============================================================

export interface LocalSupplierDebtPayment extends LocalRecord {
  debt_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  cashier_id: string | null;
  cash_exit_id: string | null;
  version: number;
}

class SupplierDebtPaymentRepository extends LocalRepository<LocalSupplierDebtPayment> {
  constructor() {
    super('supplier_debt_payments', 'debt_id');
  }

  async getByDebt(debtId: string): Promise<LocalSupplierDebtPayment[]> {
    const db = await getDatabase();
    return db.getAllAsync<LocalSupplierDebtPayment>(
      `SELECT * FROM supplier_debt_payments WHERE debt_id = ? AND deleted = 0 ORDER BY payment_date DESC`,
      [debtId]
    );
  }
}

// ============================================================
// SupplierInvoice
// ============================================================

export interface LocalSupplierInvoice extends LocalRecord {
  shop_id: string;
  supplier_id: string;
  number: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  subtotal: number;
  tax_total: number;
  total: number;
  paid_total: number;
  notes: string | null;
  version: number;
}

class SupplierInvoiceRepository extends LocalRepository<LocalSupplierInvoice> {
  constructor() {
    super('supplier_invoices');
  }

  async getBySupplier(shopId: string, supplierId: string): Promise<LocalSupplierInvoice[]> {
    return this.getAll(shopId, {
      where: { supplier_id: supplierId },
      orderBy: 'invoice_date DESC',
    });
  }
}

// ============================================================
// SupplierInvoiceItem
// ============================================================

export interface LocalSupplierInvoiceItem extends LocalRecord {
  invoice_id: string;
  product_id: string;
  description: string | null;
  qty: number;
  unit_cost: number;
  tax_rate: number;
  subtotal: number;
  tax_total: number;
  total: number;
  version: number;
}

class SupplierInvoiceItemRepository extends LocalRepository<LocalSupplierInvoiceItem> {
  constructor() {
    super('supplier_invoice_items', 'invoice_id');
  }

  async getByInvoice(invoiceId: string): Promise<LocalSupplierInvoiceItem[]> {
    const db = await getDatabase();
    return db.getAllAsync<LocalSupplierInvoiceItem>(
      `SELECT * FROM supplier_invoice_items WHERE invoice_id = ? AND deleted = 0 ORDER BY created_at ASC`,
      [invoiceId]
    );
  }
}

// ============================================================
// ClientReceivable
// ============================================================

export interface LocalClientReceivable extends LocalRecord {
  shop_id: string;
  customer_id: string;
  amount: number;
  paid_amount: number;
  balance: number;
  description: string | null;
  notes: string | null;
  status: string;
  version: number;
}

class ClientReceivableRepository extends LocalRepository<LocalClientReceivable> {
  constructor() {
    super('client_receivables');
  }

  async getByCustomer(shopId: string, customerId: string): Promise<LocalClientReceivable[]> {
    return this.getAll(shopId, {
      where: { customer_id: customerId },
      orderBy: 'created_at DESC',
    });
  }

  async getActiveReceivables(shopId: string): Promise<LocalClientReceivable[]> {
    const db = await getDatabase();
    return db.getAllAsync<LocalClientReceivable>(
      `SELECT * FROM client_receivables WHERE shop_id = ? AND deleted = 0 AND status IN ('PENDING', 'PARTIAL') ORDER BY created_at DESC`,
      [shopId]
    );
  }

  async getTotalBalance(shopId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(balance), 0) as total FROM client_receivables WHERE shop_id = ? AND deleted = 0 AND status IN ('PENDING', 'PARTIAL')`,
      [shopId]
    );
    return row?.total ?? 0;
  }

  async getCustomerBalance(shopId: string, customerId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(balance), 0) as total FROM client_receivables WHERE shop_id = ? AND customer_id = ? AND deleted = 0 AND status IN ('PENDING', 'PARTIAL')`,
      [shopId, customerId]
    );
    return row?.total ?? 0;
  }
}

// ============================================================
// ClientReceivablePayment
// ============================================================

export interface LocalClientReceivablePayment extends LocalRecord {
  receivable_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  cashier_id: string | null;
  cash_entry_id: string | null;
  version: number;
}

class ClientReceivablePaymentRepository extends LocalRepository<LocalClientReceivablePayment> {
  constructor() {
    super('client_receivable_payments', 'receivable_id');
  }

  async getByReceivable(receivableId: string): Promise<LocalClientReceivablePayment[]> {
    const db = await getDatabase();
    return db.getAllAsync<LocalClientReceivablePayment>(
      `SELECT * FROM client_receivable_payments WHERE receivable_id = ? AND deleted = 0 ORDER BY payment_date DESC`,
      [receivableId]
    );
  }
}

// ============================================================
// Payment
// ============================================================

export interface LocalPayment extends LocalRecord {
  shop_id: string;
  ref_type: string;
  ref_id: string;
  method: string;
  amount: number;
  receipt_ref: string | null;
  notes: string | null;
  cashier_id: string | null;
  device_id: string;
  client_op_id: string;
  version: number;
}

class PaymentRepository extends LocalRepository<LocalPayment> {
  constructor() {
    super('payments');
  }

  async getByRef(shopId: string, refType: string, refId: string): Promise<LocalPayment[]> {
    return this.getAll(shopId, {
      where: { ref_type: refType, ref_id: refId },
      orderBy: 'created_at DESC',
    });
  }
}

// ============================================================
// Invoice
// ============================================================

export interface LocalInvoice extends LocalRecord {
  shop_id: string;
  sale_id: string | null;
  customer_id: string | null;
  number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  discount: number;
  tax_total: number;
  grand_total: number;
  paid_total: number;
  balance_due: number;
  notes: string | null;
  pdf_url: string | null;
  version: number;
}

class InvoiceRepository extends LocalRepository<LocalInvoice> {
  constructor() {
    super('invoices');
  }

  async getByCustomer(shopId: string, customerId: string): Promise<LocalInvoice[]> {
    return this.getAll(shopId, {
      where: { customer_id: customerId },
      orderBy: 'issue_date DESC',
    });
  }

  async getBySale(saleId: string): Promise<LocalInvoice[]> {
    const db = await getDatabase();
    return db.getAllAsync<LocalInvoice>(
      `SELECT * FROM invoices WHERE sale_id = ? AND deleted = 0`,
      [saleId]
    );
  }
}

// ============================================================
// InvoiceItem
// ============================================================

export interface LocalInvoiceItem extends LocalRecord {
  invoice_id: string;
  product_id: string | null;
  description: string;
  qty: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  subtotal: number;
  tax_total: number;
  total: number;
  version: number;
}

class InvoiceItemRepository extends LocalRepository<LocalInvoiceItem> {
  constructor() {
    super('invoice_items', 'invoice_id');
  }

  async getByInvoice(invoiceId: string): Promise<LocalInvoiceItem[]> {
    const db = await getDatabase();
    return db.getAllAsync<LocalInvoiceItem>(
      `SELECT * FROM invoice_items WHERE invoice_id = ? AND deleted = 0 ORDER BY created_at ASC`,
      [invoiceId]
    );
  }
}

// ============================================================
// PackagingType
// ============================================================

export interface LocalPackagingType extends LocalRecord {
  shop_id: string;
  name: string;
  symbol: string | null;
  is_default: number;
}

class PackagingTypeRepository extends LocalRepository<LocalPackagingType> {
  constructor() {
    super('packaging_types');
  }
}

// ============================================================
// CashSession
// ============================================================

export interface LocalCashSession extends LocalRecord {
  shop_id: string;
  cashier_id: string;
  status: string;
  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  difference: number | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  version: number;
}

class CashSessionRepository extends LocalRepository<LocalCashSession> {
  constructor() {
    super('cash_sessions');
  }

  async getOpenSession(shopId: string, cashierId: string): Promise<LocalCashSession | null> {
    const db = await getDatabase();
    return (
      (await db.getFirstAsync<LocalCashSession>(
        `SELECT * FROM cash_sessions WHERE shop_id = ? AND cashier_id = ? AND status = 'OPEN' AND deleted = 0`,
        [shopId, cashierId]
      )) ?? null
    );
  }
}

// ============================================================
// InventorySession
// ============================================================

export interface LocalInventorySession extends LocalRecord {
  shop_id: string;
  user_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  version: number;
}

class InventorySessionRepository extends LocalRepository<LocalInventorySession> {
  constructor() {
    super('inventory_sessions');
  }

  async getActiveSession(shopId: string): Promise<LocalInventorySession | null> {
    const db = await getDatabase();
    return (
      (await db.getFirstAsync<LocalInventorySession>(
        `SELECT * FROM inventory_sessions WHERE shop_id = ? AND status = 'IN_PROGRESS' AND deleted = 0`,
        [shopId]
      )) ?? null
    );
  }
}

// ============================================================
// InventoryCount
// ============================================================

export interface LocalInventoryCount extends LocalRecord {
  session_id: string;
  product_id: string;
  expected_qty: number;
  counted_qty: number;
  difference: number;
  notes: string | null;
  version: number;
}

class InventoryCountRepository extends LocalRepository<LocalInventoryCount> {
  constructor() {
    super('inventory_counts', 'session_id');
  }

  async getBySession(sessionId: string): Promise<LocalInventoryCount[]> {
    const db = await getDatabase();
    return db.getAllAsync<LocalInventoryCount>(
      `SELECT * FROM inventory_counts WHERE session_id = ? AND deleted = 0 ORDER BY created_at ASC`,
      [sessionId]
    );
  }
}

// ============================================================
// Singleton instances
// ============================================================

export const productRepo = new ProductRepository();
export const stockBatchRepo = new StockBatchRepository();
export const customerRepo = new CustomerRepository();
export const saleRepo = new SaleRepository();
export const saleItemRepo = new SaleItemRepository();
export const cashEntryRepo = new CashEntryRepository();
export const inventoryMovementRepo = new InventoryMovementRepository();
export const supplierRepo = new SupplierRepository();
export const supplierDebtRepo = new SupplierDebtRepository();
export const supplierDebtPaymentRepo = new SupplierDebtPaymentRepository();
export const supplierInvoiceRepo = new SupplierInvoiceRepository();
export const supplierInvoiceItemRepo = new SupplierInvoiceItemRepository();
export const clientReceivableRepo = new ClientReceivableRepository();
export const clientReceivablePaymentRepo = new ClientReceivablePaymentRepository();
export const paymentRepo = new PaymentRepository();
export const invoiceRepo = new InvoiceRepository();
export const invoiceItemRepo = new InvoiceItemRepository();
export const packagingTypeRepo = new PackagingTypeRepository();
export const cashSessionRepo = new CashSessionRepository();
export const inventorySessionRepo = new InventorySessionRepository();
export const inventoryCountRepo = new InventoryCountRepository();
