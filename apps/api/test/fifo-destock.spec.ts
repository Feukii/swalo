import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from '../src/modules/sales/sales.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductsService } from '../src/modules/products/products.service';

/**
 * Tests pour le destockage FIFO et le multi-prix
 */

// ============================================================
// SalesService - FIFO destocking integration
// ============================================================
describe('SalesService - FIFO Destocking', () => {
  let service: SalesService;

  const shopId = 'shop-123';
  const cashierId = 'cashier-456';

  const mockProduct = {
    id: 'prod-1',
    shop_id: shopId,
    name: 'Glass Samsung A10',
    sku: 'GL-SA10',
    sell_price: 5000,
    cost_price: 3000,
    tax_rate: 0,
    deleted: false,
  };

  // Helper to create batch mock data
  const makeBatch = (
    id: string,
    remaining: number,
    sellPrice: number,
    createdAt: Date = new Date()
  ) => ({
    id,
    shop_id: shopId,
    product_id: 'prod-1',
    quantity: remaining + 5, // original was bigger
    remaining_quantity: remaining,
    sell_price: sellPrice,
    cost_price: 3000,
    price_valid_from: createdAt,
    price_valid_until: null,
    deleted: false,
    created_at: createdAt,
  });

  const mockPrisma = {
    product: { findMany: jest.fn(), findFirst: jest.fn() },
    stockBatch: { findMany: jest.fn(), update: jest.fn() },
    inventoryMovement: { aggregate: jest.fn(), create: jest.fn() },
    sale: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SalesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SalesService>(SalesService);
    jest.clearAllMocks();

    // Make $transaction execute the callback with the same mock
    mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
  });

  describe('create - FIFO stock check', () => {
    it('should throw when batch stock is insufficient for COMPLETED sale', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.stockBatch.findMany.mockResolvedValue([
        makeBatch('batch-1', 3, 5000), // Only 3 available
      ]);

      await expect(
        service.create(shopId, cashierId, {
          items: [{ product_id: 'prod-1', qty: 5, unit_price: 5000 }],
          status: 'COMPLETED',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow DRAFT sale without stock check', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      // No stock check for DRAFT - stockBatch.findMany should NOT be called

      const createdSale = {
        id: 'sale-1',
        status: 'DRAFT',
        items: [{ id: 'si-1', product_id: 'prod-1', qty: 5, batch_id: null }],
        customer: null,
        cashier: { id: cashierId, display_name: 'Test' },
      };
      mockPrisma.sale.create.mockResolvedValue(createdSale);

      const result = await service.create(shopId, cashierId, {
        items: [{ product_id: 'prod-1', qty: 5, unit_price: 5000 }],
        status: 'DRAFT',
      });

      expect(result.status).toBe('DRAFT');
      expect(mockPrisma.stockBatch.findMany).not.toHaveBeenCalled();
    });
  });

  describe('create - FIFO deduction', () => {
    it('should deduct from oldest batch first (FIFO order)', async () => {
      const oldBatch = makeBatch('batch-old', 10, 4000, new Date('2025-01-01'));
      const newBatch = makeBatch('batch-new', 10, 5000, new Date('2026-01-01'));

      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      // First call: stock check; Second call (in tx): FIFO deduction
      mockPrisma.stockBatch.findMany
        .mockResolvedValueOnce([oldBatch, newBatch]) // stock check
        .mockResolvedValueOnce([oldBatch, newBatch]); // FIFO deduction in tx

      const createdSale = {
        id: 'sale-1',
        status: 'COMPLETED',
        items: [{ id: 'si-1', product_id: 'prod-1', qty: 5, batch_id: 'batch-old' }],
        customer: null,
        cashier: { id: cashierId, display_name: 'Test' },
      };
      mockPrisma.sale.create.mockResolvedValue(createdSale);
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      await service.create(shopId, cashierId, {
        items: [{ product_id: 'prod-1', qty: 5, unit_price: 5000 }],
        status: 'COMPLETED',
      });

      // Should deduct from old batch first
      expect(mockPrisma.stockBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-old' },
        data: { remaining_quantity: 5 }, // 10 - 5
      });
      // New batch should not be touched
      expect(mockPrisma.stockBatch.update).toHaveBeenCalledTimes(1);
    });

    it('should split across multiple batches when first is insufficient', async () => {
      const batch1 = makeBatch('batch-1', 3, 4000, new Date('2025-01-01'));
      const batch2 = makeBatch('batch-2', 10, 5000, new Date('2026-01-01'));

      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.stockBatch.findMany
        .mockResolvedValueOnce([batch1, batch2]) // stock check
        .mockResolvedValueOnce([batch1, batch2]); // FIFO

      const createdSale = {
        id: 'sale-1',
        status: 'COMPLETED',
        items: [{ id: 'si-1', product_id: 'prod-1', qty: 7, batch_id: 'batch-1' }],
        customer: null,
        cashier: { id: cashierId, display_name: 'Test' },
      };
      mockPrisma.sale.create.mockResolvedValue(createdSale);
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      await service.create(shopId, cashierId, {
        items: [{ product_id: 'prod-1', qty: 7, unit_price: 5000 }],
        status: 'COMPLETED',
      });

      // batch-1: 3 remaining, all 3 deducted
      expect(mockPrisma.stockBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: { remaining_quantity: 0 },
      });
      // batch-2: 10 remaining, 4 deducted (7 total - 3 from batch-1)
      expect(mockPrisma.stockBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-2' },
        data: { remaining_quantity: 6 },
      });
    });

    it('should assign batch_id to sale items', async () => {
      const batch = makeBatch('batch-abc', 20, 5000);

      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.stockBatch.findMany.mockResolvedValue([batch]);
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      // Capture the create call to verify batch_id in items
      mockPrisma.sale.create.mockImplementation((args: any) => {
        const items = args.data.items.create;
        expect(items[0].batch_id).toBe('batch-abc');
        return {
          id: 'sale-1',
          status: 'COMPLETED',
          items: items.map((i: any) => ({ ...i, id: 'si-1' })),
          customer: null,
          cashier: { id: cashierId, display_name: 'Test' },
        };
      });

      await service.create(shopId, cashierId, {
        items: [{ product_id: 'prod-1', qty: 3, unit_price: 5000 }],
        status: 'COMPLETED',
      });

      expect(mockPrisma.sale.create).toHaveBeenCalled();
    });

    it('should create SALE inventory movement with FIFO reason', async () => {
      const batch = makeBatch('batch-1', 10, 5000);

      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.stockBatch.findMany.mockResolvedValue([batch]);

      mockPrisma.sale.create.mockResolvedValue({
        id: 'sale-new',
        status: 'COMPLETED',
        items: [{ id: 'si-1', product_id: 'prod-1', qty: 2, batch_id: 'batch-1' }],
        customer: null,
        cashier: { id: cashierId, display_name: 'Test' },
      });
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      await service.create(shopId, cashierId, {
        items: [{ product_id: 'prod-1', qty: 2, unit_price: 5000 }],
        status: 'COMPLETED',
      });

      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          product_id: 'prod-1',
          type: 'SALE',
          qty: -2,
          reason: 'Vente (FIFO)',
          ref_type: 'SALE',
          ref_id: 'sale-new',
        }),
      });
    });
  });

  describe('cancel - batch restoration', () => {
    it('should restore batch remaining_quantity on cancel', async () => {
      const existingSale = {
        id: 'sale-1',
        shop_id: shopId,
        status: 'COMPLETED',
        deleted: false,
        items: [
          {
            id: 'si-1',
            product_id: 'prod-1',
            qty: 5,
            batch_id: 'batch-abc',
          },
        ],
      };

      mockPrisma.sale.findFirst.mockResolvedValue(existingSale);
      mockPrisma.sale.update.mockResolvedValue({
        ...existingSale,
        status: 'CANCELLED',
        customer: null,
        cashier: { id: cashierId, display_name: 'Test' },
      });
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      await service.cancel(shopId, 'sale-1');

      // Should restore batch
      expect(mockPrisma.stockBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-abc' },
        data: { remaining_quantity: { increment: 5 } },
      });
    });

    it('should create reverse ADJUSTMENT movement on cancel', async () => {
      const existingSale = {
        id: 'sale-1',
        shop_id: shopId,
        status: 'COMPLETED',
        deleted: false,
        items: [{ id: 'si-1', product_id: 'prod-1', qty: 5, batch_id: 'batch-1' }],
      };

      mockPrisma.sale.findFirst.mockResolvedValue(existingSale);
      mockPrisma.sale.update.mockResolvedValue({
        ...existingSale,
        status: 'CANCELLED',
        customer: null,
        cashier: { id: cashierId, display_name: 'Test' },
      });
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      await service.cancel(shopId, 'sale-1');

      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          product_id: 'prod-1',
          type: 'ADJUSTMENT',
          qty: 5,
          ref_type: 'CANCEL',
          ref_id: 'sale-1',
        }),
      });
    });

    it('should not restore batch when batch_id is null (legacy sale)', async () => {
      const existingSale = {
        id: 'sale-old',
        shop_id: shopId,
        status: 'COMPLETED',
        deleted: false,
        items: [{ id: 'si-1', product_id: 'prod-1', qty: 5, batch_id: null }],
      };

      mockPrisma.sale.findFirst.mockResolvedValue(existingSale);
      mockPrisma.sale.update.mockResolvedValue({
        ...existingSale,
        status: 'CANCELLED',
        customer: null,
        cashier: { id: cashierId, display_name: 'Test' },
      });
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      await service.cancel(shopId, 'sale-old');

      // Movement should still be created
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalled();
      // But batch should NOT be updated
      expect(mockPrisma.stockBatch.update).not.toHaveBeenCalled();
    });
  });
});

// ============================================================
// ProductsService - Available prices endpoint
// ============================================================
describe('ProductsService - Available Prices', () => {
  let service: ProductsService;

  const shopId = 'shop-123';

  const mockPrisma = {
    product: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    stockBatch: { findMany: jest.fn() },
    inventoryMovement: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  describe('getAvailablePrices', () => {
    it('should return grouped prices from active batches', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        name: 'Glass Samsung A10',
        sell_price: 5000,
      });

      mockPrisma.stockBatch.findMany.mockResolvedValue([
        {
          id: 'b1',
          sell_price: 4000,
          cost_price: 2500,
          remaining_quantity: 5,
          created_at: new Date(),
        },
        {
          id: 'b2',
          sell_price: 5000,
          cost_price: 3000,
          remaining_quantity: 10,
          created_at: new Date(),
        },
        {
          id: 'b3',
          sell_price: 4000,
          cost_price: 2500,
          remaining_quantity: 3,
          created_at: new Date(),
        },
      ]);

      const result = await service.getAvailablePrices('prod-1', shopId);

      expect(result.product_id).toBe('prod-1');
      expect(result.default_price).toBe(5000);
      expect(result.total_stock).toBe(18);
      expect(result.prices).toHaveLength(2); // 4000 and 5000
      expect(result.prices[0]).toEqual({
        sell_price: 4000,
        total_quantity: 8, // 5 + 3
        batch_count: 2,
      });
      expect(result.prices[1]).toEqual({
        sell_price: 5000,
        total_quantity: 10,
        batch_count: 1,
      });
    });

    it('should return empty prices when no batches have stock', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'prod-1',
        name: 'Glass Samsung A10',
        sell_price: 5000,
      });

      mockPrisma.stockBatch.findMany.mockResolvedValue([]);

      const result = await service.getAvailablePrices('prod-1', shopId);

      expect(result.prices).toHaveLength(0);
      expect(result.total_stock).toBe(0);
    });

    it('should throw NotFoundException for unknown product', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(service.getAvailablePrices('nonexistent', shopId)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
