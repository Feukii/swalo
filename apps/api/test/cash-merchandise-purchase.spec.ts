import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CashService } from '../src/modules/cash/cash.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

interface CapturedCashEntry {
  shop_id: string;
  type: string;
  category: string;
  amount: number;
  note: string;
  supplier_id: string;
  cashier_id: string;
}

interface CapturedDebt {
  shop_id: string;
  supplier_id: string;
  amount: number;
  balance: number;
  paid_amount: number;
  status: string;
  description: string;
}

describe('CashService - Merchandise Purchase Functionality', () => {
  let service: CashService;
  let _prismaService: PrismaService;

  const mockPrismaService = {
    supplier: {
      findFirst: jest.fn(),
    },
    cashEntry: {
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    supplierDebt: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CashService>(CashService);
    _prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('createMerchandisePurchase', () => {
    const userId = 'user-123';
    const shopId = 'shop-123';
    const supplierId = 'supplier-123';

    const mockSupplier = {
      id: supplierId,
      name: 'Test Supplier',
      shop_id: shopId,
      deleted: false,
    };

    beforeEach(() => {
      // Mock supplier lookup
      mockPrismaService.supplier.findFirst.mockResolvedValue(mockSupplier);
    });

    it('should create merchandise purchase with cash payment (no debt)', async () => {
      // Mock sufficient cash balance
      jest
        .spyOn(service, 'getBalance')
        .mockResolvedValue({ balance: 100000, totalIn: 100000, totalOut: 0 });

      const mockCashEntry = {
        id: 'cash-123',
        shop_id: shopId,
        type: 'OUT',
        category: 'Achats Marchandises',
        amount: 50000,
      };

      mockPrismaService.$transaction.mockImplementation(callback =>
        callback({
          cashEntry: { create: jest.fn().mockResolvedValue(mockCashEntry) },
          supplierDebt: { create: jest.fn() },
        })
      );

      const purchaseDto = {
        supplier_id: supplierId,
        amount: 50000,
        description: 'Test purchase',
        payment_method: 'CASH' as const,
        create_debt: false,
      };

      const result = await service.createMerchandisePurchase(userId, shopId, purchaseDto);

      expect(result).toHaveProperty('cash_entry');
      expect(result.debt).toBeNull();
      expect(result.message).toBe('Achat enregistré avec succès');
    });

    it('should create merchandise purchase with debt creation', async () => {
      jest
        .spyOn(service, 'getBalance')
        .mockResolvedValue({ balance: 100000, totalIn: 100000, totalOut: 0 });

      const mockCashEntry = {
        id: 'cash-123',
        type: 'OUT',
        amount: 50000,
      };

      const mockDebt = {
        id: 'debt-123',
        supplier_id: supplierId,
        amount: 50000,
        balance: 50000,
      };

      mockPrismaService.$transaction.mockImplementation(callback =>
        callback({
          cashEntry: { create: jest.fn().mockResolvedValue(mockCashEntry) },
          supplierDebt: { create: jest.fn().mockResolvedValue(mockDebt) },
        })
      );

      const purchaseDto = {
        supplier_id: supplierId,
        amount: 50000,
        payment_method: 'CASH' as const,
        create_debt: true,
      };

      const result = await service.createMerchandisePurchase(userId, shopId, purchaseDto);

      expect(result).toHaveProperty('cash_entry');
      expect(result).toHaveProperty('debt');
      expect(result.message).toBe('Achat enregistré avec succès et dette créée');
    });

    it('should throw NotFoundException when supplier does not exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      const purchaseDto = {
        supplier_id: 'nonexistent-supplier',
        amount: 50000,
        payment_method: 'CASH' as const,
        create_debt: false,
      };

      await expect(service.createMerchandisePurchase(userId, shopId, purchaseDto)).rejects.toThrow(
        NotFoundException
      );
      await expect(service.createMerchandisePurchase(userId, shopId, purchaseDto)).rejects.toThrow(
        'Fournisseur non trouvé'
      );
    });

    it('should throw BadRequestException when cash balance is insufficient', async () => {
      // Mock insufficient cash balance
      jest
        .spyOn(service, 'getBalance')
        .mockResolvedValue({ balance: 10000, totalIn: 10000, totalOut: 0 });

      const purchaseDto = {
        supplier_id: supplierId,
        amount: 50000, // More than balance
        payment_method: 'CASH' as const,
        create_debt: false,
      };

      await expect(service.createMerchandisePurchase(userId, shopId, purchaseDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.createMerchandisePurchase(userId, shopId, purchaseDto)).rejects.toThrow(
        /Solde insuffisant/
      );
    });

    it('should not check cash balance for MOBILE_MONEY payment', async () => {
      // Mock low cash balance
      jest
        .spyOn(service, 'getBalance')
        .mockResolvedValue({ balance: 1000, totalIn: 1000, totalOut: 0 });

      const mockCashEntry = { id: 'cash-123', amount: 50000 };
      mockPrismaService.$transaction.mockImplementation(callback =>
        callback({
          cashEntry: { create: jest.fn().mockResolvedValue(mockCashEntry) },
          supplierDebt: { create: jest.fn() },
        })
      );

      const purchaseDto = {
        supplier_id: supplierId,
        amount: 50000,
        payment_method: 'MOBILE_MONEY' as const,
        create_debt: false,
      };

      // Should not throw despite low cash balance
      await expect(
        service.createMerchandisePurchase(userId, shopId, purchaseDto)
      ).resolves.toBeDefined();
    });

    it('should create cash entry with correct fields', async () => {
      jest
        .spyOn(service, 'getBalance')
        .mockResolvedValue({ balance: 100000, totalIn: 100000, totalOut: 0 });

      let capturedCashEntry!: CapturedCashEntry;
      mockPrismaService.$transaction.mockImplementation(callback =>
        callback({
          cashEntry: {
            create: jest.fn().mockImplementation((data: { data: CapturedCashEntry }) => {
              capturedCashEntry = data.data;
              return Promise.resolve({ id: 'cash-123', ...data.data });
            }),
          },
          supplierDebt: { create: jest.fn() },
        })
      );

      await service.createMerchandisePurchase(userId, shopId, {
        supplier_id: supplierId,
        amount: 50000,
        description: 'Custom description',
        payment_method: 'CASH',
        create_debt: false,
      });

      expect(capturedCashEntry.shop_id).toBe(shopId);
      expect(capturedCashEntry.type).toBe('OUT');
      expect(capturedCashEntry.category).toBe('Achats Marchandises');
      expect(capturedCashEntry.amount).toBe(50000);
      expect(capturedCashEntry.note).toBe('Custom description');
      expect(capturedCashEntry.supplier_id).toBe(supplierId);
      expect(capturedCashEntry.cashier_id).toBe(userId);
    });

    it('should use default description when none provided', async () => {
      jest
        .spyOn(service, 'getBalance')
        .mockResolvedValue({ balance: 100000, totalIn: 100000, totalOut: 0 });

      let capturedCashEntry!: CapturedCashEntry;
      mockPrismaService.$transaction.mockImplementation(callback =>
        callback({
          cashEntry: {
            create: jest.fn().mockImplementation((data: { data: CapturedCashEntry }) => {
              capturedCashEntry = data.data;
              return Promise.resolve({ id: 'cash-123', ...data.data });
            }),
          },
          supplierDebt: { create: jest.fn() },
        })
      );

      await service.createMerchandisePurchase(userId, shopId, {
        supplier_id: supplierId,
        amount: 50000,
        payment_method: 'CASH',
        create_debt: false,
      });

      expect(capturedCashEntry.note).toContain('Achat marchandise');
      expect(capturedCashEntry.note).toContain(mockSupplier.name);
    });

    it('should create debt with correct fields when create_debt is true', async () => {
      jest
        .spyOn(service, 'getBalance')
        .mockResolvedValue({ balance: 100000, totalIn: 100000, totalOut: 0 });

      let capturedDebt!: CapturedDebt;
      mockPrismaService.$transaction.mockImplementation(callback =>
        callback({
          cashEntry: { create: jest.fn().mockResolvedValue({ id: 'cash-123' }) },
          supplierDebt: {
            create: jest.fn().mockImplementation((data: { data: CapturedDebt }) => {
              capturedDebt = data.data;
              return Promise.resolve({ id: 'debt-123', ...data.data });
            }),
          },
        })
      );

      await service.createMerchandisePurchase(userId, shopId, {
        supplier_id: supplierId,
        amount: 50000,
        description: 'Purchase with debt',
        payment_method: 'CASH',
        create_debt: true,
      });

      expect(capturedDebt.shop_id).toBe(shopId);
      expect(capturedDebt.supplier_id).toBe(supplierId);
      expect(capturedDebt.amount).toBe(50000);
      expect(capturedDebt.balance).toBe(50000);
      expect(capturedDebt.paid_amount).toBe(0);
      expect(capturedDebt.status).toBe('PENDING');
      expect(capturedDebt.description).toBe('Purchase with debt');
    });
  });
});
