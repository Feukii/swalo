import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

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
}
