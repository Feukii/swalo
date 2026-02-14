/**
 * React hooks for reading data from the local SQLite database.
 * These hooks replace direct API calls in screens, enabling offline-first reads.
 * Data is kept in sync via the SyncEngine (push/pull in background).
 */

import { useState, useEffect, useCallback } from 'react';
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
  invoiceRepo,
  cashSessionRepo,
  paymentRepo,
  LocalProduct,
  LocalStockBatch,
  LocalCustomer,
  LocalSale,
  LocalSaleWithItems,
  LocalCashEntry,
  LocalInventoryMovement,
  LocalSupplier,
  LocalSupplierDebt,
  LocalSupplierDebtPayment,
  LocalClientReceivable,
  LocalClientReceivablePayment,
  LocalInvoice,
  LocalCashSession,
  LocalPayment,
} from '../db/repositories';

interface UseLocalDataResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ============================================================
// Products
// ============================================================

export function useLocalProducts(
  shopId: string | null,
  options?: { search?: string; family?: string; isActive?: boolean }
): UseLocalDataResult<LocalProduct[]> {
  const [data, setData] = useState<LocalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      let products: LocalProduct[];

      if (options?.search) {
        products = await productRepo.search(shopId, options.search);
      } else if (options?.family) {
        products = await productRepo.getByFamily(shopId, options.family);
      } else {
        const where: Record<string, unknown> = {};
        if (options?.isActive !== undefined) {
          where.is_active = options.isActive ? 1 : 0;
        }
        products = await productRepo.getAll(shopId, {
          where,
          orderBy: 'name ASC',
        });
      }

      setData(products);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des produits');
    } finally {
      setLoading(false);
    }
  }, [shopId, options?.search, options?.family, options?.isActive]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// ============================================================
// Stock Batches
// ============================================================

export function useLocalStockBatches(
  shopId: string | null,
  productId: string | null
): UseLocalDataResult<LocalStockBatch[]> {
  const [data, setData] = useState<LocalStockBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId || !productId) return;
    try {
      setLoading(true);
      const batches = await stockBatchRepo.getByProduct(shopId, productId);
      setData(batches);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des lots');
    } finally {
      setLoading(false);
    }
  }, [shopId, productId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// ============================================================
// Customers
// ============================================================

export function useLocalCustomers(
  shopId: string | null,
  options?: { search?: string }
): UseLocalDataResult<LocalCustomer[]> {
  const [data, setData] = useState<LocalCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      let customers: LocalCustomer[];

      if (options?.search) {
        customers = await customerRepo.search(shopId, options.search);
      } else {
        customers = await customerRepo.getAll(shopId, {
          orderBy: 'name ASC',
        });
      }

      setData(customers);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des clients');
    } finally {
      setLoading(false);
    }
  }, [shopId, options?.search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// ============================================================
// Sales
// ============================================================

export function useLocalSales(
  shopId: string | null,
  options?: { limit?: number }
): UseLocalDataResult<LocalSale[]> {
  const [data, setData] = useState<LocalSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      const sales = await saleRepo.getRecent(shopId, options?.limit || 20);
      setData(sales);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des ventes');
    } finally {
      setLoading(false);
    }
  }, [shopId, options?.limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useLocalSaleWithItems(
  saleId: string | null
): UseLocalDataResult<LocalSaleWithItems | null> {
  const [data, setData] = useState<LocalSaleWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!saleId) return;
    try {
      setLoading(true);
      const sale = await saleRepo.getWithItems(saleId);
      setData(sale);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement de la vente');
    } finally {
      setLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// ============================================================
// Cash Entries
// ============================================================

export function useLocalCashEntries(shopId: string | null): UseLocalDataResult<LocalCashEntry[]> {
  const [data, setData] = useState<LocalCashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      const entries = await cashEntryRepo.getToday(shopId);
      setData(entries);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement de la caisse');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useLocalCashBalance(
  shopId: string | null
): UseLocalDataResult<{ totalIn: number; totalOut: number; balance: number }> {
  const [data, setData] = useState({ totalIn: 0, totalOut: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      const { totalIn, totalOut } = await cashEntryRepo.getBalance(shopId);
      setData({ totalIn, totalOut, balance: totalIn - totalOut });
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de calcul du solde');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// ============================================================
// Inventory Movements
// ============================================================

export function useLocalInventoryMovements(
  shopId: string | null,
  productId: string | null,
  limit = 50
): UseLocalDataResult<LocalInventoryMovement[]> {
  const [data, setData] = useState<LocalInventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId || !productId) return;
    try {
      setLoading(true);
      const movements = await inventoryMovementRepo.getByProduct(shopId, productId, limit);
      setData(movements);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des mouvements');
    } finally {
      setLoading(false);
    }
  }, [shopId, productId, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// ============================================================
// Suppliers
// ============================================================

export function useLocalSuppliers(
  shopId: string | null,
  options?: { search?: string }
): UseLocalDataResult<LocalSupplier[]> {
  const [data, setData] = useState<LocalSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      let suppliers: LocalSupplier[];

      if (options?.search) {
        suppliers = await supplierRepo.search(shopId, options.search);
      } else {
        suppliers = await supplierRepo.getAll(shopId, { orderBy: 'name ASC' });
      }

      setData(suppliers);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des fournisseurs');
    } finally {
      setLoading(false);
    }
  }, [shopId, options?.search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// ============================================================
// Supplier Debts
// ============================================================

export function useLocalSupplierDebts(
  shopId: string | null,
  supplierId?: string
): UseLocalDataResult<LocalSupplierDebt[]> {
  const [data, setData] = useState<LocalSupplierDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      let debts: LocalSupplierDebt[];

      if (supplierId) {
        debts = await supplierDebtRepo.getBySupplier(shopId, supplierId);
      } else {
        debts = await supplierDebtRepo.getActiveDebts(shopId);
      }

      setData(debts);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des dettes');
    } finally {
      setLoading(false);
    }
  }, [shopId, supplierId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useLocalSupplierDebtPayments(
  debtId: string | null
): UseLocalDataResult<LocalSupplierDebtPayment[]> {
  const [data, setData] = useState<LocalSupplierDebtPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!debtId) return;
    try {
      setLoading(true);
      const payments = await supplierDebtPaymentRepo.getByDebt(debtId);
      setData(payments);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des paiements');
    } finally {
      setLoading(false);
    }
  }, [debtId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useLocalSupplierDebtTotal(shopId: string | null): UseLocalDataResult<number> {
  const [data, setData] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      const total = await supplierDebtRepo.getTotalBalance(shopId);
      setData(total);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de calcul des dettes');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// ============================================================
// Client Receivables
// ============================================================

export function useLocalClientReceivables(
  shopId: string | null,
  customerId?: string
): UseLocalDataResult<LocalClientReceivable[]> {
  const [data, setData] = useState<LocalClientReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      let receivables: LocalClientReceivable[];

      if (customerId) {
        receivables = await clientReceivableRepo.getByCustomer(shopId, customerId);
      } else {
        receivables = await clientReceivableRepo.getActiveReceivables(shopId);
      }

      setData(receivables);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des creances');
    } finally {
      setLoading(false);
    }
  }, [shopId, customerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useLocalReceivablePayments(
  receivableId: string | null
): UseLocalDataResult<LocalClientReceivablePayment[]> {
  const [data, setData] = useState<LocalClientReceivablePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!receivableId) return;
    try {
      setLoading(true);
      const payments = await clientReceivablePaymentRepo.getByReceivable(receivableId);
      setData(payments);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des paiements');
    } finally {
      setLoading(false);
    }
  }, [receivableId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useLocalReceivableTotal(shopId: string | null): UseLocalDataResult<number> {
  const [data, setData] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      const total = await clientReceivableRepo.getTotalBalance(shopId);
      setData(total);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de calcul des creances');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// ============================================================
// Invoices
// ============================================================

export function useLocalInvoices(
  shopId: string | null,
  options?: { customerId?: string }
): UseLocalDataResult<LocalInvoice[]> {
  const [data, setData] = useState<LocalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      let invoices: LocalInvoice[];

      if (options?.customerId) {
        invoices = await invoiceRepo.getByCustomer(shopId, options.customerId);
      } else {
        invoices = await invoiceRepo.getAll(shopId, { orderBy: 'issue_date DESC' });
      }

      setData(invoices);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des factures');
    } finally {
      setLoading(false);
    }
  }, [shopId, options?.customerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// ============================================================
// Cash Sessions
// ============================================================

export function useLocalOpenCashSession(
  shopId: string | null,
  cashierId: string | null
): UseLocalDataResult<LocalCashSession | null> {
  const [data, setData] = useState<LocalCashSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId || !cashierId) return;
    try {
      setLoading(true);
      const session = await cashSessionRepo.getOpenSession(shopId, cashierId);
      setData(session);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement de la session');
    } finally {
      setLoading(false);
    }
  }, [shopId, cashierId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// ============================================================
// Payments
// ============================================================

export function useLocalPayments(
  shopId: string | null,
  options?: { refType?: string; refId?: string }
): UseLocalDataResult<LocalPayment[]> {
  const [data, setData] = useState<LocalPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      let payments: LocalPayment[];

      if (options?.refType && options?.refId) {
        payments = await paymentRepo.getByRef(shopId, options.refType, options.refId);
      } else {
        payments = await paymentRepo.getAll(shopId, { orderBy: 'created_at DESC' });
      }

      setData(payments);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement des paiements');
    } finally {
      setLoading(false);
    }
  }, [shopId, options?.refType, options?.refId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
