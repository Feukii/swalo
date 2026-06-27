import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface SupervisionAlert {
  id: string;
  kind: string;
  severity: 'critical' | 'review';
  title: string;
  detail: string;
  author: string | null;
  created_at: Date;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Rapports réseau (multi-boutiques) pour le propriétaire : agrège, par boutique
   * de son entreprise, le CA du jour, la marge, la trésorerie et les créances.
   */
  async getNetworkReports(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { enterprise_id: true },
    });

    const shops = await this.prisma.shop.findMany({
      where: shop?.enterprise_id
        ? { enterprise_id: shop.enterprise_id, deleted: false }
        : { id: shopId, deleted: false },
      select: { id: true, name: true },
    });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const shopReports = await Promise.all(
      shops.map(async s => {
        const [salesToday, saleItemsToday, cashEntries, receivables] = await Promise.all([
          this.prisma.sale.findMany({
            where: { shop_id: s.id, deleted: false, created_at: { gte: startOfDay } },
            select: { grand_total: true },
          }),
          this.prisma.saleItem.findMany({
            where: {
              deleted: false,
              sale: { shop_id: s.id, deleted: false, created_at: { gte: startOfDay } },
            },
            select: { total: true, qty: true, product: { select: { cost_price: true } } },
          }),
          this.prisma.cashEntry.findMany({
            where: { shop_id: s.id, deleted: false },
            select: { type: true, amount: true },
          }),
          this.prisma.clientReceivable.findMany({
            where: { shop_id: s.id, deleted: false },
            select: { balance: true },
          }),
        ]);

        const ca_jour = salesToday.reduce((sum, sale) => sum + sale.grand_total, 0);
        const marge = saleItemsToday.reduce(
          (sum, item) => sum + (item.total - Math.round(item.product.cost_price * item.qty)),
          0
        );
        const caisse = cashEntries.reduce(
          (sum, e) => (e.type === 'IN' || e.type === 'OPENING' ? sum + e.amount : sum - e.amount),
          0
        );
        const creances = receivables.reduce((sum, r) => sum + r.balance, 0);

        let etat: 'Sain' | 'A surveiller' | 'En difficulte';
        if (ca_jour <= 0) {
          etat = creances > 0 ? 'A surveiller' : 'Sain';
        } else {
          const ratio = creances / ca_jour;
          etat = ratio < 1 ? 'Sain' : ratio < 3 ? 'A surveiller' : 'En difficulte';
        }

        return { id: s.id, name: s.name, ca_jour, marge, caisse, creances, etat };
      })
    );

    const totals = shopReports.reduce(
      (acc, s) => ({
        ca_reseau: acc.ca_reseau + s.ca_jour,
        tresorerie_reseau: acc.tresorerie_reseau + s.caisse,
        creances_reseau: acc.creances_reseau + s.creances,
        marge_reseau: acc.marge_reseau + s.marge,
      }),
      { ca_reseau: 0, tresorerie_reseau: 0, creances_reseau: 0, marge_reseau: 0 }
    );
    const marge_moyenne =
      shopReports.length > 0 ? Math.round(totals.marge_reseau / shopReports.length) : 0;

    return { shops: shopReports, totals: { ...totals, marge_moyenne } };
  }

  /**
   * Rapport de ventes consolidé avec filtrage par date
   */
  async getSalesReport(shopId: string, filters?: { start_date?: string; end_date?: string }) {
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (filters?.start_date) {
      createdAtFilter.gte = new Date(filters.start_date);
    }
    if (filters?.end_date) {
      createdAtFilter.lte = new Date(filters.end_date);
    }
    const hasDateFilter = createdAtFilter.gte !== undefined || createdAtFilter.lte !== undefined;

    const where: Prisma.SaleWhereInput = {
      shop_id: shopId,
      deleted: false,
      ...(hasDateFilter ? { created_at: createdAtFilter } : {}),
    };

    const [totalCount, completedCount, cancelledCount, completedRevenue, byPaymentMethod] =
      await Promise.all([
        this.prisma.sale.count({ where }),
        this.prisma.sale.count({ where: { ...where, status: 'COMPLETED' } }),
        this.prisma.sale.count({ where: { ...where, status: 'CANCELLED' } }),
        this.prisma.sale.aggregate({
          where: { ...where, status: 'COMPLETED' },
          _sum: { grand_total: true },
        }),
        this.prisma.sale.groupBy({
          by: ['payment_method'],
          where: { ...where, status: 'COMPLETED' },
          _sum: { grand_total: true },
          _count: true,
        }),
      ]);

    const avgTicket =
      completedCount > 0
        ? Math.round((completedRevenue._sum.grand_total ?? 0) / completedCount)
        : 0;

    return {
      total_sales: totalCount,
      completed_sales: completedCount,
      cancelled_sales: cancelledCount,
      total_revenue: completedRevenue._sum.grand_total ?? 0,
      average_ticket: avgTicket,
      by_payment_method: byPaymentMethod.map(pm => ({
        method: pm.payment_method,
        count: pm._count,
        total: pm._sum.grand_total ?? 0,
      })),
    };
  }

  /**
   * Rapport stock consolidé
   */
  async getStockReport(shopId: string) {
    const [totalProducts, activeProducts] = await Promise.all([
      this.prisma.product.count({
        where: { shop_id: shopId, deleted: false },
      }),
      this.prisma.product.count({
        where: { shop_id: shopId, deleted: false, is_active: true },
      }),
    ]);

    // Lots actifs avec stock restant
    const batches = await this.prisma.stockBatch.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
        remaining_quantity: { gt: 0 },
      },
      select: {
        remaining_quantity: true,
        cost_price: true,
      },
    });

    const totalStockQuantity = batches.reduce((sum, b) => sum + b.remaining_quantity, 0);
    const totalStockValue = batches.reduce(
      (sum, b) => sum + b.remaining_quantity * b.cost_price,
      0
    );

    // Produits en alerte stock (stock <= seuil d'alerte)
    const products = await this.prisma.product.findMany({
      where: { shop_id: shopId, deleted: false, is_active: true },
      select: {
        id: true,
        alert_threshold: true,
        stock_batches: {
          where: { deleted: false, remaining_quantity: { gt: 0 } },
          select: { remaining_quantity: true },
        },
      },
    });
    const lowStockCount = products.filter(p => {
      const stock = p.stock_batches.reduce((s, b) => s + b.remaining_quantity, 0);
      return stock <= p.alert_threshold;
    }).length;

    return {
      total_products: totalProducts,
      active_products: activeProducts,
      low_stock_count: lowStockCount,
      total_stock_quantity: totalStockQuantity,
      total_stock_value: totalStockValue,
    };
  }

  /**
   * Rapport tresorerie consolidé avec filtrage par date
   */
  async getCashReport(shopId: string, filters?: { start_date?: string; end_date?: string }) {
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (filters?.start_date) {
      createdAtFilter.gte = new Date(filters.start_date);
    }
    if (filters?.end_date) {
      createdAtFilter.lte = new Date(filters.end_date);
    }
    const hasDateFilter = createdAtFilter.gte !== undefined || createdAtFilter.lte !== undefined;

    const where: Prisma.CashEntryWhereInput = {
      shop_id: shopId,
      deleted: false,
      ...(hasDateFilter ? { created_at: createdAtFilter } : {}),
    };

    const [entriesStats, exitsStats, receivablesStats, debtsStats] = await Promise.all([
      this.prisma.cashEntry.aggregate({
        where: { ...where, type: 'IN' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.cashEntry.aggregate({
        where: { ...where, type: 'OUT' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.clientReceivable.aggregate({
        where: { shop_id: shopId, deleted: false, status: { in: ['PENDING', 'PARTIAL'] } },
        _sum: { balance: true },
        _count: true,
      }),
      this.prisma.supplierDebt.aggregate({
        where: { shop_id: shopId, deleted: false, status: { in: ['PENDING', 'PARTIAL'] } },
        _sum: { balance: true },
        _count: true,
      }),
    ]);

    // Balance totale (tous les temps, pas filtré)
    const [allIn, allOut] = await Promise.all([
      this.prisma.cashEntry.aggregate({
        where: { shop_id: shopId, deleted: false, type: 'IN' },
        _sum: { amount: true },
      }),
      this.prisma.cashEntry.aggregate({
        where: { shop_id: shopId, deleted: false, type: 'OUT' },
        _sum: { amount: true },
      }),
    ]);

    const totalIn = entriesStats._sum.amount ?? 0;
    const totalOut = exitsStats._sum.amount ?? 0;

    return {
      total_entries: totalIn,
      total_exits: totalOut,
      net_flow: totalIn - totalOut,
      entries_count: entriesStats._count,
      exits_count: exitsStats._count,
      cash_balance: (allIn._sum.amount ?? 0) - (allOut._sum.amount ?? 0),
      pending_receivables: receivablesStats._sum.balance ?? 0,
      pending_receivables_count: receivablesStats._count,
      pending_debts: debtsStats._sum.balance ?? 0,
      pending_debts_count: debtsStats._count,
    };
  }

  /**
   * Vue d'ensemble consolidée (dashboard)
   */
  async getOverview(shopId: string, filters?: { start_date?: string; end_date?: string }) {
    const [sales, stock, cash] = await Promise.all([
      this.getSalesReport(shopId, filters),
      this.getStockReport(shopId),
      this.getCashReport(shopId, filters),
    ]);

    return {
      sales,
      stock,
      cash,
    };
  }

  /**
   * Comptabilité : bilan (instantané) + compte de résultat (sur période) + journal.
   * Montants en centimes (comme les autres rapports).
   */
  async getAccountingReport(shopId: string, filters?: { start_date?: string; end_date?: string }) {
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (filters?.start_date) createdAtFilter.gte = new Date(filters.start_date);
    if (filters?.end_date) createdAtFilter.lte = new Date(filters.end_date);
    const hasDateFilter = createdAtFilter.gte !== undefined || createdAtFilter.lte !== undefined;
    const dateClause = hasDateFilter ? { created_at: createdAtFilter } : {};

    // --- Compte de résultat (sur la période) ---
    const saleWhere: Prisma.SaleWhereInput = {
      shop_id: shopId,
      deleted: false,
      status: 'COMPLETED',
      ...dateClause,
    };

    const [revenueAgg, saleItems, cashOutByCategory] = await Promise.all([
      this.prisma.sale.aggregate({ where: saleWhere, _sum: { grand_total: true } }),
      this.prisma.saleItem.findMany({
        where: { deleted: false, sale: saleWhere },
        select: { qty: true, product: { select: { cost_price: true } } },
      }),
      this.prisma.cashEntry.groupBy({
        by: ['category'],
        where: { shop_id: shopId, deleted: false, type: 'OUT', ...dateClause },
        _sum: { amount: true },
      }),
    ]);

    const revenue = revenueAgg._sum.grand_total ?? 0;
    const cogs = saleItems.reduce((sum, i) => sum + i.product.cost_price * i.qty, 0);
    const grossMargin = revenue - cogs;

    let rentCharges = 0;
    let salaries = 0;
    let transportMisc = 0;
    for (const c of cashOutByCategory) {
      const cat = (c.category ?? '').toLowerCase();
      const amount = c._sum.amount ?? 0;
      if (cat.includes('salaire')) salaries += amount;
      else if (
        cat.includes('loyer') ||
        cat.includes('electricite') ||
        cat.includes('eau') ||
        cat.includes('taxe')
      )
        rentCharges += amount;
      else if (cat.includes('transport') || cat.includes('divers') || cat.includes('retrait'))
        transportMisc += amount;
    }
    const netProfit = grossMargin - rentCharges - salaries - transportMisc;

    // --- Bilan (instantané) ---
    const [stock, receivablesAgg, debtsAgg, allIn, allOut, journalRows] = await Promise.all([
      this.getStockReport(shopId),
      this.prisma.clientReceivable.aggregate({
        where: { shop_id: shopId, deleted: false, status: { in: ['PENDING', 'PARTIAL'] } },
        _sum: { balance: true },
      }),
      this.prisma.supplierDebt.aggregate({
        where: { shop_id: shopId, deleted: false, status: { in: ['PENDING', 'PARTIAL'] } },
        _sum: { balance: true },
      }),
      this.prisma.cashEntry.aggregate({
        where: { shop_id: shopId, deleted: false, type: 'IN' },
        _sum: { amount: true },
      }),
      this.prisma.cashEntry.aggregate({
        where: { shop_id: shopId, deleted: false, type: 'OUT' },
        _sum: { amount: true },
      }),
      this.prisma.cashEntry.findMany({
        where: { shop_id: shopId, deleted: false, ...dateClause },
        orderBy: { created_at: 'desc' },
        take: 100,
        select: {
          id: true,
          created_at: true,
          type: true,
          amount: true,
          category: true,
          note: true,
        },
      }),
    ]);

    const stockValue = stock.total_stock_value;
    const receivables = receivablesAgg._sum.balance ?? 0;
    const debts = debtsAgg._sum.balance ?? 0;
    const cash = (allIn._sum.amount ?? 0) - (allOut._sum.amount ?? 0);
    const totalActif = stockValue + receivables + cash;
    const equity = totalActif - debts;

    const journal = journalRows.map(r => ({
      id: r.id,
      created_at: r.created_at,
      label:
        (r.note ?? '').trim() || r.category || (r.type === 'IN' ? 'Encaissement' : 'Décaissement'),
      reference: r.type === 'IN' ? 'Caisse · Entrée' : 'Caisse · Sortie',
      amount: r.type === 'IN' ? r.amount : -r.amount,
    }));

    return {
      balance_sheet: {
        stock_value: stockValue,
        receivables,
        cash,
        total_actif: totalActif,
        debts,
        equity,
        total_passif: debts + equity,
      },
      income_statement: {
        revenue,
        cogs,
        gross_margin: grossMargin,
        rent_charges: rentCharges,
        salaries,
        transport_misc: transportMisc,
        net_profit: netProfit,
      },
      journal,
    };
  }

  /**
   * Supervision : journal des actions anormales sur une période (par défaut le jour).
   * Chaque alerte porte un auteur (quand disponible) et une heure.
   */
  async getSupervisionReport(shopId: string, filters?: { start_date?: string; end_date?: string }) {
    const start = filters?.start_date
      ? new Date(filters.start_date)
      : new Date(new Date().setHours(0, 0, 0, 0));
    const end = filters?.end_date
      ? new Date(filters.end_date)
      : new Date(new Date().setHours(23, 59, 59, 999));
    const dateClause = { created_at: { gte: start, lte: end } };

    const UNUSUAL_DISCOUNT_PCT = 0.25;

    const [movements, cashCorrections, discountedSales] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where: { shop_id: shopId, deleted: false, ...dateClause },
        select: {
          id: true,
          type: true,
          qty: true,
          reason: true,
          ref_type: true,
          created_at: true,
          product: { select: { name: true } },
        },
      }),
      this.prisma.cashEntry.findMany({
        where: {
          shop_id: shopId,
          deleted: false,
          type: 'OUT',
          ...dateClause,
          OR: [
            { note: { contains: 'erreur', mode: 'insensitive' } },
            { note: { contains: 'correction', mode: 'insensitive' } },
            { note: { contains: 'négativ', mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          amount: true,
          note: true,
          created_at: true,
          cashier: { select: { display_name: true } },
        },
      }),
      this.prisma.sale.findMany({
        where: {
          shop_id: shopId,
          deleted: false,
          status: 'COMPLETED',
          discount: { gt: 0 },
          ...dateClause,
        },
        select: {
          id: true,
          discount: true,
          grand_total: true,
          created_at: true,
          cashier: { select: { display_name: true } },
        },
      }),
    ]);

    const alerts: SupervisionAlert[] = [];

    for (const m of movements) {
      const product = m.product?.name ?? 'Produit';
      const refType = (m.ref_type ?? '').toUpperCase();
      const reason = (m.reason ?? '').toLowerCase();
      const reducesStock = m.qty < 0;
      const isManual = m.type === 'ADJUSTMENT' || m.type === 'INVENTORY';
      if (reducesStock && m.type !== 'SALE' && refType !== 'SALE') {
        alerts.push({
          id: `mv-${m.id}`,
          kind: 'stock_out_no_sale',
          severity: 'critical',
          title: 'Sortie de stock sans vente',
          detail: `${product} · −${Math.abs(m.qty)} unités${m.reason ? ` · motif « ${m.reason} »` : ''}`,
          author: null,
          created_at: m.created_at,
        });
      } else if (
        isManual ||
        reason.includes('ajust') ||
        reason.includes('correction') ||
        reason.includes('inventaire')
      ) {
        alerts.push({
          id: `mv-${m.id}`,
          kind: 'manual_stock_edit',
          severity: 'review',
          title: 'Modification manuelle du stock',
          detail: `${product} · ${m.qty >= 0 ? '+' : '−'}${Math.abs(m.qty)} unités`,
          author: null,
          created_at: m.created_at,
        });
      }
    }

    for (const c of cashCorrections) {
      alerts.push({
        id: `cc-${c.id}`,
        kind: 'cash_correction',
        severity: 'critical',
        title: 'Correction de caisse négative',
        detail: `−${c.amount} · « ${c.note ?? ''} »`,
        author: c.cashier?.display_name ?? null,
        created_at: c.created_at,
      });
    }

    for (const s of discountedSales) {
      const base = s.grand_total + s.discount;
      const pct = base > 0 ? s.discount / base : 0;
      if (pct >= UNUSUAL_DISCOUNT_PCT) {
        alerts.push({
          id: `ds-${s.id}`,
          kind: 'unusual_discount',
          severity: 'review',
          title: 'Remise inhabituelle',
          detail: `Vente · −${Math.round(pct * 100)} % sur le total`,
          author: s.cashier?.display_name ?? null,
          created_at: s.created_at,
        });
      }
    }

    alerts.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    return {
      alerts,
      critical_count: alerts.filter(a => a.severity === 'critical').length,
      review_count: alerts.filter(a => a.severity === 'review').length,
      total: alerts.length,
    };
  }
}
