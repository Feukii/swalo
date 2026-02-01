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
  LocalProduct,
  LocalStockBatch,
  LocalCustomer,
  LocalSale,
  LocalSaleWithItems,
  LocalCashEntry,
  LocalInventoryMovement,
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
