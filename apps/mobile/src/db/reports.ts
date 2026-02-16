/**
 * Reports Module - Offline aggregate queries for KPIs and reports.
 * Uses SQLite aggregate functions (SUM, COUNT, GROUP BY) on local data.
 */

import { getDatabase } from './schema';

// ============================================================
// Types
// ============================================================

export interface DailySalesReport {
  totalSales: number;
  salesCount: number;
  cashSales: number;
  creditSales: number;
  averageSale: number;
}

export interface CashFlowReport {
  totalIn: number;
  totalOut: number;
  net: number;
  entriesCount: number;
  exitsCount: number;
  byCategory: Array<{ category: string; type: string; amount: number; count: number }>;
}

export interface StockReport {
  totalProducts: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface ReceivablesReport {
  totalBalance: number;
  activeCount: number;
  paidCount: number;
  totalAmount: number;
  totalPaid: number;
}

export interface DebtsReport {
  totalBalance: number;
  activeCount: number;
  paidCount: number;
  totalAmount: number;
  totalPaid: number;
}

export interface TopItem {
  id: string;
  name: string;
  value: number;
  count: number;
}

// ============================================================
// Report Functions
// ============================================================

/**
 * Get daily sales report for a given date
 */
export async function getDailySalesReport(shopId: string, date: string): Promise<DailySalesReport> {
  const db = await getDatabase();
  const startOfDay = date.split('T')[0] + 'T00:00:00.000Z';
  const endOfDay = date.split('T')[0] + 'T23:59:59.999Z';

  const salesRow = await db.getFirstAsync<{
    total: number | null;
    cnt: number;
    avg_sale: number | null;
  }>(
    `SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as cnt, AVG(grand_total) as avg_sale
     FROM sales
     WHERE shop_id = ? AND deleted = 0 AND status != 'DRAFT'
       AND created_at >= ? AND created_at <= ?`,
    [shopId, startOfDay, endOfDay]
  );

  // Cash sales = cash entries with category ventes/vente for the day
  const cashRow = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM cash_entries
     WHERE shop_id = ? AND deleted = 0 AND type = 'IN'
       AND (category = 'ventes' OR category = 'vente')
       AND created_at >= ? AND created_at <= ?`,
    [shopId, startOfDay, endOfDay]
  );

  // Credit sales = receivables created that day
  const creditRow = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM client_receivables
     WHERE shop_id = ? AND deleted = 0 AND amount > 0
       AND created_at >= ? AND created_at <= ?`,
    [shopId, startOfDay, endOfDay]
  );

  return {
    totalSales: salesRow?.total ?? 0,
    salesCount: salesRow?.cnt ?? 0,
    cashSales: cashRow?.total ?? 0,
    creditSales: creditRow?.total ?? 0,
    averageSale: salesRow?.avg_sale ?? 0,
  };
}

/**
 * Get cash flow report for a date range
 */
export async function getCashFlowReport(
  shopId: string,
  startDate: string,
  endDate: string
): Promise<CashFlowReport> {
  const db = await getDatabase();

  const summaryRow = await db.getFirstAsync<{
    total_in: number | null;
    total_out: number | null;
    in_count: number;
    out_count: number;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0) as total_in,
       COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) as total_out,
       SUM(CASE WHEN type = 'IN' THEN 1 ELSE 0 END) as in_count,
       SUM(CASE WHEN type = 'OUT' THEN 1 ELSE 0 END) as out_count
     FROM cash_entries
     WHERE shop_id = ? AND deleted = 0
       AND created_at >= ? AND created_at <= ?`,
    [shopId, startDate, endDate]
  );

  const byCategory = await db.getAllAsync<{
    category: string;
    type: string;
    amount: number;
    count: number;
  }>(
    `SELECT COALESCE(category, 'divers') as category, type,
            SUM(amount) as amount, COUNT(*) as count
     FROM cash_entries
     WHERE shop_id = ? AND deleted = 0
       AND created_at >= ? AND created_at <= ?
     GROUP BY category, type
     ORDER BY amount DESC`,
    [shopId, startDate, endDate]
  );

  const totalIn = summaryRow?.total_in ?? 0;
  const totalOut = summaryRow?.total_out ?? 0;

  return {
    totalIn,
    totalOut,
    net: totalIn - totalOut,
    entriesCount: summaryRow?.in_count ?? 0,
    exitsCount: summaryRow?.out_count ?? 0,
    byCategory,
  };
}

/**
 * Get stock report (current state, no date range)
 */
export async function getStockReport(shopId: string): Promise<StockReport> {
  const db = await getDatabase();

  const productRow = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM products WHERE shop_id = ? AND deleted = 0 AND is_active = 1`,
    [shopId]
  );

  const stockValueRow = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(sb.remaining_quantity * sb.cost_price), 0) as total
     FROM stock_batches sb
     INNER JOIN products p ON p.id = sb.product_id
     WHERE sb.shop_id = ? AND sb.deleted = 0 AND p.deleted = 0 AND sb.remaining_quantity > 0`,
    [shopId]
  );

  // Low stock: products where total remaining < alert_threshold
  const lowStockRow = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM (
       SELECT p.id, p.alert_threshold, COALESCE(SUM(sb.remaining_quantity), 0) as total_qty
       FROM products p
       LEFT JOIN stock_batches sb ON sb.product_id = p.id AND sb.deleted = 0 AND sb.remaining_quantity > 0
       WHERE p.shop_id = ? AND p.deleted = 0 AND p.is_active = 1
       GROUP BY p.id
       HAVING total_qty > 0 AND total_qty <= p.alert_threshold
     )`,
    [shopId]
  );

  // Out of stock: products with zero remaining
  const outOfStockRow = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM (
       SELECT p.id, COALESCE(SUM(sb.remaining_quantity), 0) as total_qty
       FROM products p
       LEFT JOIN stock_batches sb ON sb.product_id = p.id AND sb.deleted = 0 AND sb.remaining_quantity > 0
       WHERE p.shop_id = ? AND p.deleted = 0 AND p.is_active = 1
       GROUP BY p.id
       HAVING total_qty = 0
     )`,
    [shopId]
  );

  return {
    totalProducts: productRow?.cnt ?? 0,
    totalStockValue: stockValueRow?.total ?? 0,
    lowStockCount: lowStockRow?.cnt ?? 0,
    outOfStockCount: outOfStockRow?.cnt ?? 0,
  };
}

/**
 * Get receivables (client debts to us) report
 */
export async function getReceivablesReport(shopId: string): Promise<ReceivablesReport> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{
    total_balance: number | null;
    active_count: number;
    paid_count: number;
    total_amount: number | null;
    total_paid: number | null;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN status IN ('PENDING', 'PARTIAL') THEN balance ELSE 0 END), 0) as total_balance,
       SUM(CASE WHEN status IN ('PENDING', 'PARTIAL') THEN 1 ELSE 0 END) as active_count,
       SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid_count,
       COALESCE(SUM(amount), 0) as total_amount,
       COALESCE(SUM(paid_amount), 0) as total_paid
     FROM client_receivables
     WHERE shop_id = ? AND deleted = 0`,
    [shopId]
  );

  return {
    totalBalance: row?.total_balance ?? 0,
    activeCount: row?.active_count ?? 0,
    paidCount: row?.paid_count ?? 0,
    totalAmount: row?.total_amount ?? 0,
    totalPaid: row?.total_paid ?? 0,
  };
}

/**
 * Get supplier debts report
 */
export async function getDebtsReport(shopId: string): Promise<DebtsReport> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{
    total_balance: number | null;
    active_count: number;
    paid_count: number;
    total_amount: number | null;
    total_paid: number | null;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN status IN ('PENDING', 'PARTIAL') THEN balance ELSE 0 END), 0) as total_balance,
       SUM(CASE WHEN status IN ('PENDING', 'PARTIAL') THEN 1 ELSE 0 END) as active_count,
       SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid_count,
       COALESCE(SUM(amount), 0) as total_amount,
       COALESCE(SUM(paid_amount), 0) as total_paid
     FROM supplier_debts
     WHERE shop_id = ? AND deleted = 0`,
    [shopId]
  );

  return {
    totalBalance: row?.total_balance ?? 0,
    activeCount: row?.active_count ?? 0,
    paidCount: row?.paid_count ?? 0,
    totalAmount: row?.total_amount ?? 0,
    totalPaid: row?.total_paid ?? 0,
  };
}

/**
 * Get top products by revenue for a date range
 */
export async function getTopProductsReport(
  shopId: string,
  startDate: string,
  endDate: string,
  limit = 10
): Promise<TopItem[]> {
  const db = await getDatabase();

  return db.getAllAsync<TopItem>(
    `SELECT si.product_id as id, si.product_name as name,
            SUM(si.total) as value, SUM(si.qty) as count
     FROM sale_items si
     INNER JOIN sales s ON s.id = si.sale_id
     WHERE s.shop_id = ? AND s.deleted = 0 AND si.deleted = 0 AND s.status != 'DRAFT'
       AND s.created_at >= ? AND s.created_at <= ?
     GROUP BY si.product_id, si.product_name
     ORDER BY value DESC
     LIMIT ?`,
    [shopId, startDate, endDate, limit]
  );
}

/**
 * Get top customers by revenue for a date range
 */
export async function getTopCustomersReport(
  shopId: string,
  startDate: string,
  endDate: string,
  limit = 10
): Promise<TopItem[]> {
  const db = await getDatabase();

  return db.getAllAsync<TopItem>(
    `SELECT s.customer_id as id, COALESCE(c.name, 'Client anonyme') as name,
            SUM(s.grand_total) as value, COUNT(s.id) as count
     FROM sales s
     LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.shop_id = ? AND s.deleted = 0 AND s.status != 'DRAFT'
       AND s.customer_id IS NOT NULL
       AND s.created_at >= ? AND s.created_at <= ?
     GROUP BY s.customer_id
     ORDER BY value DESC
     LIMIT ?`,
    [shopId, startDate, endDate, limit]
  );
}

/**
 * Get the last sync timestamp from _sync_meta
 */
export async function getLastSyncAt(): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM _sync_meta WHERE key = 'last_sync_at'`
  );
  return row?.value ?? null;
}
