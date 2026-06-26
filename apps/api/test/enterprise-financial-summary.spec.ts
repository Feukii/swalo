import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EnterpriseService } from '../src/modules/enterprise/enterprise.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

const ENTERPRISE_ID = 'ent-1';
const OWNER_ID = 'owner-1';
const OTHER_USER_ID = 'intruder-1';
const SHOP_A = 'shop-a';
const SHOP_B = 'shop-b';

interface MockPrisma {
  enterprise: { findUnique: jest.Mock };
  sale: { groupBy: jest.Mock };
  cashEntry: { groupBy: jest.Mock };
  clientReceivable: { groupBy: jest.Mock };
  supplierDebt: { groupBy: jest.Mock };
  stockBatch: { findMany: jest.Mock };
  product: { findMany: jest.Mock };
}

describe('EnterpriseService - getFinancialSummary', () => {
  let service: EnterpriseService;

  const mockPrisma: MockPrisma = {
    enterprise: { findUnique: jest.fn() },
    sale: { groupBy: jest.fn() },
    cashEntry: { groupBy: jest.fn() },
    clientReceivable: { groupBy: jest.fn() },
    supplierDebt: { groupBy: jest.fn() },
    stockBatch: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnterpriseService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<EnterpriseService>(EnterpriseService);
    jest.clearAllMocks();
  });

  function mockEnterpriseWithTwoShops(): void {
    mockPrisma.enterprise.findUnique.mockResolvedValue({
      id: ENTERPRISE_ID,
      owner_id: OWNER_ID,
      deleted: false,
      shops: [
        { id: SHOP_A, name: 'Boutique A' },
        { id: SHOP_B, name: 'Boutique B' },
      ],
    });
  }

  function mockTwoShopFinancials(): void {
    // Shop A: revenue 100000, cashIn 80000 / cashOut 30000 -> balance 50000,
    //         receivables 20000, debts 10000, stock: 5*1000 + 2*2000 = 9000, low-stock 1
    // Shop B: revenue 40000, cashIn 25000 / cashOut 5000 -> balance 20000,
    //         receivables 0, debts 3000, stock: 10*500 = 5000, low-stock 0
    mockPrisma.sale.groupBy.mockResolvedValue([
      { shop_id: SHOP_A, _sum: { grand_total: 100000 } },
      { shop_id: SHOP_B, _sum: { grand_total: 40000 } },
    ]);
    mockPrisma.cashEntry.groupBy.mockResolvedValue([
      { shop_id: SHOP_A, type: 'IN', _sum: { amount: 80000 } },
      { shop_id: SHOP_A, type: 'OUT', _sum: { amount: 30000 } },
      { shop_id: SHOP_B, type: 'IN', _sum: { amount: 25000 } },
      { shop_id: SHOP_B, type: 'OUT', _sum: { amount: 5000 } },
    ]);
    mockPrisma.clientReceivable.groupBy.mockResolvedValue([
      { shop_id: SHOP_A, _sum: { balance: 20000 } },
    ]);
    mockPrisma.supplierDebt.groupBy.mockResolvedValue([
      { shop_id: SHOP_A, _sum: { balance: 10000 } },
      { shop_id: SHOP_B, _sum: { balance: 3000 } },
    ]);
    mockPrisma.stockBatch.findMany.mockResolvedValue([
      { shop_id: SHOP_A, remaining_quantity: 5, cost_price: 1000 },
      { shop_id: SHOP_A, remaining_quantity: 2, cost_price: 2000 },
      { shop_id: SHOP_B, remaining_quantity: 10, cost_price: 500 },
    ]);
    mockPrisma.product.findMany.mockResolvedValue([
      // Shop A: one product with stock 3 <= threshold 5 -> low stock
      { shop_id: SHOP_A, alert_threshold: 5, stock_batches: [{ remaining_quantity: 3 }] },
      // Shop A: one product well stocked
      { shop_id: SHOP_A, alert_threshold: 5, stock_batches: [{ remaining_quantity: 50 }] },
      // Shop B: one product well stocked
      { shop_id: SHOP_B, alert_threshold: 2, stock_batches: [{ remaining_quantity: 10 }] },
    ]);
  }

  it('throws ForbiddenException when a non-owner (cross-tenant) requests the summary', async () => {
    mockEnterpriseWithTwoShops();

    await expect(
      service.getFinancialSummary(ENTERPRISE_ID, OTHER_USER_ID, false, {})
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when the enterprise does not exist', async () => {
    mockPrisma.enterprise.findUnique.mockResolvedValue(null);

    await expect(service.getFinancialSummary(ENTERPRISE_ID, OWNER_ID, false, {})).rejects.toThrow(
      NotFoundException
    );
  });

  it('allows a SUPERADMIN even when not the owner', async () => {
    mockEnterpriseWithTwoShops();
    mockTwoShopFinancials();

    const result = await service.getFinancialSummary(ENTERPRISE_ID, OTHER_USER_ID, true, {});
    expect(result.enterprise.total_shops).toBe(2);
  });

  it('derives shopIds solely from the enterprise (never from the client)', async () => {
    mockEnterpriseWithTwoShops();
    mockTwoShopFinancials();

    await service.getFinancialSummary(ENTERPRISE_ID, OWNER_ID, false, {});

    // Every grouped query must be scoped to exactly the enterprise's two shops.
    const expectedShopIds = { in: [SHOP_A, SHOP_B] };
    expect(mockPrisma.sale.groupBy.mock.calls[0][0].where.shop_id).toEqual(expectedShopIds);
    expect(mockPrisma.cashEntry.groupBy.mock.calls[0][0].where.shop_id).toEqual(expectedShopIds);
    expect(mockPrisma.clientReceivable.groupBy.mock.calls[0][0].where.shop_id).toEqual(
      expectedShopIds
    );
    expect(mockPrisma.supplierDebt.groupBy.mock.calls[0][0].where.shop_id).toEqual(expectedShopIds);
    expect(mockPrisma.stockBatch.findMany.mock.calls[0][0].where.shop_id).toEqual(expectedShopIds);
    expect(mockPrisma.product.findMany.mock.calls[0][0].where.shop_id).toEqual(expectedShopIds);
  });

  it('computes correct per-shop financial math', async () => {
    mockEnterpriseWithTwoShops();
    mockTwoShopFinancials();

    const result = await service.getFinancialSummary(ENTERPRISE_ID, OWNER_ID, false, {});

    const shopA = result.per_shop.find(s => s.shop_id === SHOP_A);
    const shopB = result.per_shop.find(s => s.shop_id === SHOP_B);
    if (!shopA || !shopB) throw new Error('both shops should be present');

    expect(shopA).toMatchObject({
      shop_name: 'Boutique A',
      revenue: 100000,
      cash_balance: 50000, // 80000 - 30000
      net_cash_flow: 50000,
      receivables_outstanding: 20000,
      supplier_debts: 10000,
      stock_value: 9000, // 5*1000 + 2*2000
      low_stock_count: 1,
      // health = cash_balance + receivables + stock - debts = 50000 + 20000 + 9000 - 10000
      health_score: 69000,
    });

    expect(shopB).toMatchObject({
      shop_name: 'Boutique B',
      revenue: 40000,
      cash_balance: 20000, // 25000 - 5000
      receivables_outstanding: 0,
      supplier_debts: 3000,
      stock_value: 5000, // 10*500
      low_stock_count: 0,
      // health = 20000 + 0 + 5000 - 3000
      health_score: 22000,
    });
  });

  it('enterprise rollup equals the sum of per-shop values', async () => {
    mockEnterpriseWithTwoShops();
    mockTwoShopFinancials();

    const result = await service.getFinancialSummary(ENTERPRISE_ID, OWNER_ID, false, {});

    const keys = [
      'revenue',
      'cash_balance',
      'net_cash_flow',
      'receivables_outstanding',
      'supplier_debts',
      'stock_value',
      'low_stock_count',
      'health_score',
    ] as const;

    for (const key of keys) {
      const sum = result.per_shop.reduce((acc, s) => acc + s[key], 0);
      expect(result.enterprise[key]).toBe(sum);
    }
    expect(result.enterprise.total_shops).toBe(2);
  });

  it('returns zeros for an empty enterprise without querying financial tables', async () => {
    mockPrisma.enterprise.findUnique.mockResolvedValue({
      id: ENTERPRISE_ID,
      owner_id: OWNER_ID,
      deleted: false,
      shops: [],
    });

    const result = await service.getFinancialSummary(ENTERPRISE_ID, OWNER_ID, false, {});

    expect(result.enterprise).toEqual({
      total_shops: 0,
      revenue: 0,
      cash_balance: 0,
      net_cash_flow: 0,
      receivables_outstanding: 0,
      supplier_debts: 0,
      stock_value: 0,
      low_stock_count: 0,
      health_score: 0,
    });
    expect(result.per_shop).toEqual([]);
    expect(mockPrisma.sale.groupBy).not.toHaveBeenCalled();
    expect(mockPrisma.stockBatch.findMany).not.toHaveBeenCalled();
  });

  it('passes the date period filter through to revenue/cash queries and echoes it', async () => {
    mockEnterpriseWithTwoShops();
    mockTwoShopFinancials();

    const period = { start_date: '2026-01-01T00:00:00.000Z', end_date: '2026-01-31T23:59:59.999Z' };
    const result = await service.getFinancialSummary(ENTERPRISE_ID, OWNER_ID, false, period);

    expect(result.period).toEqual(period);
    const saleWhere = mockPrisma.sale.groupBy.mock.calls[0][0].where;
    expect(saleWhere.created_at.gte).toEqual(new Date(period.start_date));
    expect(saleWhere.created_at.lte).toEqual(new Date(period.end_date));
  });
});
