/**
 * Comptabilité offline en partie double : construit les opérations depuis SQLite
 * et les passe au moteur partagé @swalo/core/accounting.
 * Montants en ENTIERS FCFA (aucune conversion).
 */
import { getDatabase } from './schema';
import { normalizeCashCategory } from '@swalo/core';
import {
  computeAccounting,
  getAccount,
  OperationInput,
  Treasury,
  ExpenseAccount,
  LedgerAccount,
  BalanceSheet,
  IncomeStatement,
} from '@swalo/core/accounting';

export interface JournalLine {
  account: string;
  name: string;
  debit: number;
  credit: number;
}
export interface JournalEcriture {
  date: string;
  libelle: string;
  lines: JournalLine[];
}
export interface AccountingData {
  journal: JournalEcriture[];
  grandLivre: LedgerAccount[];
  bilan: BalanceSheet;
  resultat: IncomeStatement;
}

function expenseAccountFor(category: string | null): ExpenseAccount {
  switch (normalizeCashCategory(category)) {
    case 'loyers':
    case 'electricite_eau':
      return '62';
    case 'taxes_impots':
      return '64';
    case 'salaires':
      return '641';
    case 'transport':
      return '61';
    default:
      return '658';
  }
}

function treasuryFor(method: string | null): Treasury {
  if (method === 'CARD') return 'BANQUE';
  if (method === 'MOBILE') return 'MOBILE';
  return 'CAISSE';
}

type DB = Awaited<ReturnType<typeof getDatabase>>;

async function buildPeriodOps(
  db: DB,
  shopId: string,
  start: string,
  end: string
): Promise<OperationInput[]> {
  const ops: OperationInput[] = [];

  // 1. Ventes COMPLETED + COGS.
  const sales = await db.getAllAsync<{
    id: string;
    grand_total: number;
    payment_method: string;
    created_at: string;
  }>(
    `SELECT id, grand_total, payment_method, created_at FROM sales
     WHERE shop_id = ? AND deleted = 0 AND status = 'COMPLETED' AND created_at >= ? AND created_at <= ?`,
    [shopId, start, end]
  );
  for (const s of sales) {
    if (s.payment_method === 'CREDIT') {
      ops.push({ kind: 'CREDIT_SALE', date: s.created_at, saleId: s.id, amount: s.grand_total });
    } else {
      ops.push({
        kind: 'CASH_SALE',
        date: s.created_at,
        saleId: s.id,
        amount: s.grand_total,
        treasury: treasuryFor(s.payment_method),
      });
    }
    const cogsRow = await db.getFirstAsync<{ cogs: number | null }>(
      `SELECT COALESCE(SUM(si.qty * p.cost_price), 0) as cogs
       FROM sale_items si INNER JOIN products p ON p.id = si.product_id
       WHERE si.sale_id = ? AND si.deleted = 0`,
      [s.id]
    );
    const cogs = cogsRow?.cogs ?? 0;
    if (cogs > 0) ops.push({ kind: 'COGS', date: s.created_at, saleId: s.id, amount: cogs });
  }

  // 2. Encaissements créances, paiements & créations de dettes.
  const recvPayments = await db.getAllAsync<{
    id: string;
    amount: number;
    payment_date: string;
    cash_entry_id: string | null;
  }>(
    `SELECT p.id, p.amount, p.payment_date, p.cash_entry_id
     FROM client_receivable_payments p
     INNER JOIN client_receivables r ON r.id = p.receivable_id
     WHERE r.shop_id = ? AND p.deleted = 0 AND p.payment_date >= ? AND p.payment_date <= ?`,
    [shopId, start, end]
  );
  const debtPayments = await db.getAllAsync<{
    id: string;
    amount: number;
    payment_date: string;
    cash_exit_id: string | null;
  }>(
    `SELECT p.id, p.amount, p.payment_date, p.cash_exit_id
     FROM supplier_debt_payments p
     INNER JOIN supplier_debts d ON d.id = p.debt_id
     WHERE d.shop_id = ? AND p.deleted = 0 AND p.payment_date >= ? AND p.payment_date <= ?`,
    [shopId, start, end]
  );
  const supplierDebts = await db.getAllAsync<{ id: string; amount: number; created_at: string }>(
    `SELECT id, amount, created_at FROM supplier_debts
     WHERE shop_id = ? AND deleted = 0 AND created_at >= ? AND created_at <= ?`,
    [shopId, start, end]
  );
  const linkedCashIds = new Set<string>();
  for (const p of recvPayments) {
    if (p.cash_entry_id) linkedCashIds.add(p.cash_entry_id);
    ops.push({
      kind: 'RECEIVABLE_SETTLEMENT',
      date: p.payment_date,
      refId: p.id,
      amount: p.amount,
      treasury: 'CAISSE',
    });
  }
  for (const p of debtPayments) {
    if (p.cash_exit_id) linkedCashIds.add(p.cash_exit_id);
    ops.push({
      kind: 'SUPPLIER_PAYMENT',
      date: p.payment_date,
      refId: p.id,
      amount: p.amount,
      treasury: 'CAISSE',
    });
  }
  for (const dbt of supplierDebts) {
    ops.push({
      kind: 'SUPPLIER_DEBT_CREATE',
      date: dbt.created_at,
      refId: dbt.id,
      amount: dbt.amount,
    });
  }

  // 3. Caisse (filtre anti-double-comptage).
  const cashEntries = await db.getAllAsync<{
    id: string;
    type: string;
    amount: number;
    category: string | null;
    created_at: string;
  }>(
    `SELECT id, type, amount, category, created_at FROM cash_entries
     WHERE shop_id = ? AND deleted = 0 AND created_at >= ? AND created_at <= ?`,
    [shopId, start, end]
  );
  for (const ce of cashEntries) {
    if (linkedCashIds.has(ce.id)) continue;
    if (ce.type === 'CLOSING') continue;
    if (ce.type === 'OPENING') {
      ops.push({
        kind: 'CAPITAL_INJECTION',
        date: ce.created_at,
        amount: ce.amount,
        treasury: 'CAISSE',
      });
      continue;
    }
    const cat = normalizeCashCategory(ce.category);
    if (cat === 'ventes' || cat === 'reglement_fournisseur') continue;
    if (cat === 'achats_marchandises') {
      ops.push({
        kind: 'CASH_PURCHASE_STOCK',
        date: ce.created_at,
        refId: ce.id,
        amount: ce.amount,
        treasury: 'CAISSE',
      });
    } else if (cat === 'retrait_personnel') {
      ops.push({
        kind: 'OWNER_DRAWING',
        date: ce.created_at,
        amount: ce.amount,
        treasury: 'CAISSE',
      });
    } else if (cat === 'remboursement_client') {
      ops.push({
        kind: 'CUSTOMER_REFUND',
        date: ce.created_at,
        amount: ce.amount,
        treasury: 'CAISSE',
      });
    } else if (cat === 'remboursement_fournisseur') {
      ops.push({
        kind: 'SUPPLIER_REFUND',
        date: ce.created_at,
        amount: ce.amount,
        treasury: 'CAISSE',
      });
    } else if (ce.type === 'OUT') {
      ops.push({
        kind: 'OPERATING_EXPENSE',
        date: ce.created_at,
        account: expenseAccountFor(ce.category),
        amount: ce.amount,
        treasury: 'CAISSE',
      });
    }
  }

  // 4. Ajustements de stock.
  const movements = await db.getAllAsync<{
    id: string;
    qty: number;
    unit_cost: number | null;
    created_at: string;
  }>(
    `SELECT id, qty, unit_cost, created_at FROM inventory_movements
     WHERE shop_id = ? AND deleted = 0 AND (type = 'ADJUSTMENT' OR type = 'INVENTORY')
       AND created_at >= ? AND created_at <= ?`,
    [shopId, start, end]
  );
  for (const m of movements) {
    const amount = Math.abs(m.qty) * (m.unit_cost ?? 0);
    if (amount <= 0) continue;
    ops.push({
      kind: 'STOCK_ADJUSTMENT',
      date: m.created_at,
      refId: m.id,
      amount,
      direction: m.qty >= 0 ? 'INCREASE' : 'DECREASE',
    });
  }

  return ops;
}

async function snapshotAggregates(db: DB, shopId: string) {
  const stock = await db.getFirstAsync<{ v: number | null }>(
    `SELECT COALESCE(SUM(remaining_quantity * cost_price), 0) as v
     FROM stock_batches WHERE shop_id = ? AND deleted = 0 AND remaining_quantity > 0`,
    [shopId]
  );
  const recv = await db.getFirstAsync<{ v: number | null }>(
    `SELECT COALESCE(SUM(balance), 0) as v FROM client_receivables
     WHERE shop_id = ? AND deleted = 0 AND status IN ('PENDING','PARTIAL')`,
    [shopId]
  );
  const debt = await db.getFirstAsync<{ v: number | null }>(
    `SELECT COALESCE(SUM(balance), 0) as v FROM supplier_debts
     WHERE shop_id = ? AND deleted = 0 AND status IN ('PENDING','PARTIAL')`,
    [shopId]
  );
  const cash = await db.getFirstAsync<{ v: number | null }>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 0) as v
     FROM cash_entries WHERE shop_id = ? AND deleted = 0`,
    [shopId]
  );
  return {
    stock: stock?.v ?? 0,
    receivables: recv?.v ?? 0,
    debts: debt?.v ?? 0,
    cash: cash?.v ?? 0,
  };
}

/** Comptabilité complète (multi-boutiques) : journal/grand-livre/résultat = période ; bilan = instantané. */
export async function getAccountingData(
  shopIds: string[],
  start: string,
  end: string
): Promise<AccountingData> {
  const db = await getDatabase();

  const periodOps: OperationInput[] = [];
  const snap = { stock: 0, receivables: 0, debts: 0, cash: 0 };
  for (const shopId of shopIds) {
    periodOps.push(...(await buildPeriodOps(db, shopId, start, end)));
    const a = await snapshotAggregates(db, shopId);
    snap.stock += a.stock;
    snap.receivables += a.receivables;
    snap.debts += a.debts;
    snap.cash += a.cash;
  }

  const periodResult = computeAccounting(periodOps);
  const snapshotResult = computeAccounting([
    {
      kind: 'OPENING_BALANCE',
      date: new Date().toISOString(),
      stock: snap.stock,
      caisse: snap.cash,
      banque: 0,
      mobile: 0,
      receivables: snap.receivables,
      debts: snap.debts,
    },
  ]);

  const journal: JournalEcriture[] = periodResult.journal.map(e => ({
    date: e.date,
    libelle: e.libelle,
    lines: e.lines.map(l => ({
      account: l.account,
      name: getAccount(l.account).name,
      debit: l.debit,
      credit: l.credit,
    })),
  }));

  return {
    journal,
    grandLivre: periodResult.ledger,
    bilan: snapshotResult.balanceSheet,
    resultat: periodResult.incomeStatement,
  };
}
