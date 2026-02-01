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
        saleValues
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
          itemValues
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
// Singleton instances
// ============================================================

export const productRepo = new ProductRepository();
export const stockBatchRepo = new StockBatchRepository();
export const customerRepo = new CustomerRepository();
export const saleRepo = new SaleRepository();
export const saleItemRepo = new SaleItemRepository();
export const cashEntryRepo = new CashEntryRepository();
export const inventoryMovementRepo = new InventoryMovementRepository();
