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

  // Low stock (modèle carton-primary) : quand l'article est conditionné
  // (units_per_package > 1), le seuil d'alerte est exprimé en CARTONS → on compare
  // floor(pièces / units_per_package) au seuil. Sinon on compare les pièces.
  const lowStockRow = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM (
       SELECT p.id, p.alert_threshold, COALESCE(SUM(sb.remaining_quantity), 0) as total_qty
       FROM products p
       LEFT JOIN stock_batches sb ON sb.product_id = p.id AND sb.deleted = 0 AND sb.remaining_quantity > 0
       WHERE p.shop_id = ? AND p.deleted = 0 AND p.is_active = 1
       GROUP BY p.id
       HAVING total_qty > 0 AND (
         CASE WHEN p.units_per_package > 1
           THEN total_qty / p.units_per_package
           ELSE total_qty
         END
       ) <= p.alert_threshold
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

// ============================================================
// Comptabilité (offline accounting: bilan + résultat)
// ============================================================

export interface BalanceSheetReport {
  // Actif
  stockValue: number; // Stock marchandises
  receivables: number; // Créances clients
  cash: number; // Caisse
  totalActif: number;
  // Passif
  debts: number; // Dettes fournisseurs
  equity: number; // Capital & résultat (solde équilibrant)
  totalPassif: number;
}

export interface IncomeStatementReport {
  revenue: number; // Chiffre d'affaires
  cogs: number; // Coût des marchandises vendues
  grossMargin: number; // Marge brute
  rentCharges: number; // Loyers & charges
  salaries: number; // Salaires
  transportMisc: number; // Transport & divers
  netProfit: number; // Bénéfice net
}

/**
 * Current cash balance (all-time IN - OUT) for a shop.
 */
export async function getCashBalance(shopId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ balance: number | null }>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 0) as balance
     FROM cash_entries
     WHERE shop_id = ? AND deleted = 0`,
    [shopId]
  );
  return row?.balance ?? 0;
}

/**
 * Balance sheet (bilan) — point-in-time snapshot. Actif always equals Passif
 * because equity (capital & résultat) is computed as the balancing figure.
 */
export async function getBalanceSheet(shopId: string): Promise<BalanceSheetReport> {
  const [stock, receivables, debts, cash] = await Promise.all([
    getStockReport(shopId),
    getReceivablesReport(shopId),
    getDebtsReport(shopId),
    getCashBalance(shopId),
  ]);

  const stockValue = stock.totalStockValue;
  const receivableBalance = receivables.totalBalance;
  const debtBalance = debts.totalBalance;
  const totalActif = stockValue + receivableBalance + cash;
  // Capital & résultat = ce qui reste une fois les dettes déduites de l'actif.
  const equity = totalActif - debtBalance;

  return {
    stockValue,
    receivables: receivableBalance,
    cash,
    totalActif,
    debts: debtBalance,
    equity,
    totalPassif: debtBalance + equity,
  };
}

/**
 * Income statement (compte de résultat) for a date range.
 * COGS is approximated from the current product cost price (PMP) × quantities sold,
 * since sale_items do not store a historical cost snapshot locally.
 */
export async function getIncomeStatement(
  shopId: string,
  startDate: string,
  endDate: string
): Promise<IncomeStatementReport> {
  const db = await getDatabase();

  const revenueRow = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(grand_total), 0) as total
     FROM sales
     WHERE shop_id = ? AND deleted = 0 AND status != 'DRAFT'
       AND created_at >= ? AND created_at <= ?`,
    [shopId, startDate, endDate]
  );

  const cogsRow = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(si.qty * p.cost_price), 0) as total
     FROM sale_items si
     INNER JOIN sales s ON s.id = si.sale_id
     INNER JOIN products p ON p.id = si.product_id
     WHERE s.shop_id = ? AND s.deleted = 0 AND si.deleted = 0 AND s.status != 'DRAFT'
       AND s.created_at >= ? AND s.created_at <= ?`,
    [shopId, startDate, endDate]
  );

  const charges = await db.getAllAsync<{ category: string | null; total: number }>(
    `SELECT category, SUM(amount) as total
     FROM cash_entries
     WHERE shop_id = ? AND deleted = 0 AND type = 'OUT'
       AND created_at >= ? AND created_at <= ?
     GROUP BY category`,
    [shopId, startDate, endDate]
  );

  let rentCharges = 0;
  let salaries = 0;
  let transportMisc = 0;
  for (const c of charges) {
    const cat = (c.category ?? '').toLowerCase();
    if (cat.includes('salaire')) {
      salaries += c.total;
    } else if (
      cat.includes('loyer') ||
      cat.includes('electricite') ||
      cat.includes('eau') ||
      cat.includes('taxe')
    ) {
      rentCharges += c.total;
    } else if (cat.includes('transport') || cat.includes('divers') || cat.includes('retrait')) {
      transportMisc += c.total;
    }
    // achats_marchandises / reglement_fournisseur are stock/supplier flows, not P&L charges here.
  }

  const revenue = revenueRow?.total ?? 0;
  const cogs = cogsRow?.total ?? 0;
  const grossMargin = revenue - cogs;
  const netProfit = grossMargin - rentCharges - salaries - transportMisc;

  return { revenue, cogs, grossMargin, rentCharges, salaries, transportMisc, netProfit };
}

// ============================================================
// Supervision (offline anomaly journal)
// ============================================================

export type AlertSeverity = 'critical' | 'review';

export interface SupervisionAlert {
  id: string;
  kind: 'stock_out_no_sale' | 'cash_correction' | 'manual_stock_edit' | 'unusual_discount';
  severity: AlertSeverity;
  title: string;
  detail: string;
  /** id of the actor when available (cashier_id); resolve to a name in the UI. */
  authorId: string | null;
  createdAt: string;
}

/** Unusual discount threshold (percentage of the sale total). */
const UNUSUAL_DISCOUNT_PCT = 0.25;

/**
 * Derive a journal of anomalous actions from local data for a date range.
 * Real data only — no fabricated entries. Author names are resolved in the UI
 * from the shop users list (local tables hold ids/device ids, not names).
 */
export async function getSupervisionAlerts(
  shopId: string,
  startDate: string,
  endDate: string
): Promise<SupervisionAlert[]> {
  const db = await getDatabase();
  const alerts: SupervisionAlert[] = [];

  // 1. Stock movements: OUT not linked to a sale, and manual adjustments.
  const moves = await db.getAllAsync<{
    id: string;
    type: string;
    qty: number;
    reason: string | null;
    ref_type: string | null;
    created_at: string;
    product_name: string | null;
  }>(
    `SELECT m.id, m.type, m.qty, m.reason, m.ref_type, m.created_at, p.name as product_name
     FROM inventory_movements m
     LEFT JOIN products p ON p.id = m.product_id
     WHERE m.shop_id = ? AND m.deleted = 0
       AND m.created_at >= ? AND m.created_at <= ?`,
    [shopId, startDate, endDate]
  );
  for (const m of moves) {
    const product = m.product_name ?? 'Produit';
    const refType = (m.ref_type ?? '').toUpperCase();
    const reason = (m.reason ?? '').toLowerCase();
    if (m.type === 'OUT' && refType !== 'SALE') {
      alerts.push({
        id: `mv-${m.id}`,
        kind: 'stock_out_no_sale',
        severity: 'critical',
        title: 'Sortie de stock sans vente',
        detail: `${product} · −${Math.abs(m.qty)} unités${m.reason ? ` · motif « ${m.reason} »` : ''}`,
        authorId: null,
        createdAt: m.created_at,
      });
    } else if (
      refType === 'ADJUSTMENT' ||
      reason.includes('ajust') ||
      reason.includes('correction') ||
      reason.includes('inventaire')
    ) {
      alerts.push({
        id: `mv-${m.id}`,
        kind: 'manual_stock_edit',
        severity: 'review',
        title: 'Modification manuelle du stock',
        detail: `${product} · ${m.type === 'IN' ? '+' : '−'}${Math.abs(m.qty)} unités`,
        authorId: null,
        createdAt: m.created_at,
      });
    }
  }

  // 2. Negative cash corrections (OUT entries flagged as corrections/errors).
  const cashCorrections = await db.getAllAsync<{
    id: string;
    amount: number;
    note: string | null;
    cashier_id: string;
    created_at: string;
  }>(
    `SELECT id, amount, note, cashier_id, created_at
     FROM cash_entries
     WHERE shop_id = ? AND deleted = 0 AND type = 'OUT'
       AND (LOWER(COALESCE(note, '')) LIKE '%erreur%' OR LOWER(COALESCE(note, '')) LIKE '%correction%' OR LOWER(COALESCE(note, '')) LIKE '%négativ%')
       AND created_at >= ? AND created_at <= ?`,
    [shopId, startDate, endDate]
  );
  for (const c of cashCorrections) {
    alerts.push({
      id: `cc-${c.id}`,
      kind: 'cash_correction',
      severity: 'critical',
      title: 'Correction de caisse négative',
      detail: `−${c.amount} F${c.note ? ` · « ${c.note} »` : ''}`,
      authorId: c.cashier_id,
      createdAt: c.created_at,
    });
  }

  // 3. Unusual discounts on sales.
  const discounted = await db.getAllAsync<{
    id: string;
    discount: number;
    grand_total: number;
    cashier_id: string;
    created_at: string;
  }>(
    `SELECT id, discount, grand_total, cashier_id, created_at
     FROM sales
     WHERE shop_id = ? AND deleted = 0 AND status != 'DRAFT' AND discount > 0
       AND created_at >= ? AND created_at <= ?`,
    [shopId, startDate, endDate]
  );
  for (const s of discounted) {
    const base = s.grand_total + s.discount;
    const pct = base > 0 ? s.discount / base : 0;
    if (pct >= UNUSUAL_DISCOUNT_PCT) {
      alerts.push({
        id: `ds-${s.id}`,
        kind: 'unusual_discount',
        severity: 'review',
        title: 'Remise inhabituelle',
        detail: `Vente · −${Math.round(pct * 100)} % sur le total`,
        authorId: s.cashier_id,
        createdAt: s.created_at,
      });
    }
  }

  // Most recent first.
  // Exclure les alertes déjà acquittées (table locale).
  const acks = await db.getAllAsync<{ alert_id: string }>(
    `SELECT alert_id FROM alert_acknowledgements WHERE shop_id = ?`,
    [shopId]
  );
  const acknowledged = new Set(acks.map(a => a.alert_id));
  const active = alerts.filter(a => !acknowledged.has(a.id));

  active.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return active;
}

/** Acquittement local d'une alerte (instantané ; le backend fait foi via l'API en ligne). */
export async function acknowledgeAlertLocal(
  shopId: string,
  alertId: string,
  userId: string | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO alert_acknowledgements (id, shop_id, alert_id, acknowledged_by, acknowledged_at)
     VALUES (?, ?, ?, ?, ?)`,
    [`ack-${alertId}`, shopId, alertId, userId, new Date().toISOString()]
  );
}

export interface JournalEntry {
  id: string;
  createdAt: string;
  label: string;
  reference: string;
  amount: number; // signed: + débit caisse (encaissement), - décaissement
}

/**
 * Chronological journal of cash movements (encaissements / décaissements) for a range.
 */
export async function getJournalEntries(
  shopId: string,
  startDate: string,
  endDate: string,
  limit = 100
): Promise<JournalEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    created_at: string;
    type: string;
    amount: number;
    category: string | null;
    note: string | null;
  }>(
    `SELECT id, created_at, type, amount, category, note
     FROM cash_entries
     WHERE shop_id = ? AND deleted = 0 AND created_at >= ? AND created_at <= ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [shopId, startDate, endDate, limit]
  );
  return rows.map(r => ({
    id: r.id,
    createdAt: r.created_at,
    label: r.note?.trim() || (r.category ?? (r.type === 'IN' ? 'Encaissement' : 'Décaissement')),
    reference: r.type === 'IN' ? 'Caisse · Entrée' : 'Caisse · Sortie',
    amount: r.type === 'IN' ? r.amount : -r.amount,
  }));
}

/**
 * Distinct shop ids present in the local data (used by the multi-shop "périmètre"
 * selector to aggregate "Toutes les boutiques" across whatever is synced locally).
 */
export async function getLocalShopIds(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ shop_id: string }>(
    `SELECT DISTINCT shop_id FROM sales WHERE deleted = 0
     UNION SELECT DISTINCT shop_id FROM cash_entries WHERE deleted = 0
     UNION SELECT DISTINCT shop_id FROM products WHERE deleted = 0`
  );
  return rows.map(r => r.shop_id).filter(Boolean);
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
