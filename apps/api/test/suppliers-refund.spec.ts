import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SuppliersService } from '../src/modules/suppliers/suppliers.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('SuppliersService - Refund Claim Functionality', () => {
  let service: SuppliersService;
  let _prismaService: PrismaService;

  const mockPrismaService = {
    supplier: {
      findFirst: jest.fn(),
    },
    supplierDebt: {
      aggregate: jest.fn(),
      create: jest.fn(),
    },
    cashEntry: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
    _prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('claimRefund', () => {
    const shopId = 'shop-123';
    const supplierId = 'supplier-123';
    const userId = 'user-123';
    const mockSupplier = {
      id: supplierId,
      name: 'Test Supplier',
      shop_id: shopId,
      deleted: false,
    };

    it('should successfully claim refund when supplier has negative balance', async () => {
      // Mock supplier with negative balance (supplier owes us 10000 centimes = 100 FCFA)
      const mockSupplierWithStats = {
        ...mockSupplier,
        stats: {
          total_balance: -10000,
          total_debts: 0,
          total_paid: 0,
        },
      };

      jest.spyOn(service, 'getOne').mockResolvedValue(mockSupplierWithStats as any);

      const mockCashEntry = {
        id: 'cash-123',
        shop_id: shopId,
        type: 'IN',
        category: 'Remboursement fournisseur',
        amount: 5000,
      };

      const mockDebt = {
        id: 'debt-123',
        shop_id: shopId,
        supplier_id: supplierId,
        amount: -5000,
        balance: -5000,
      };

      mockPrismaService.$transaction.mockImplementation(async callback => {
        return callback({
          cashEntry: { create: jest.fn().mockResolvedValue(mockCashEntry) },
          supplierDebt: { create: jest.fn().mockResolvedValue(mockDebt) },
        });
      });

      const refundDto = {
        amount: 5000, // 50 FCFA
        payment_method: 'CASH' as const,
        note: 'Test refund claim',
      };

      const result = await service.claimRefund(shopId, supplierId, userId, refundDto);

      expect(result).toHaveProperty('cash_entry');
      expect(result).toHaveProperty('debt');
      expect(result.message).toBe('Remboursement enregistré avec succès');
    });

    it('should throw BadRequestException when supplier balance is positive (we owe them)', async () => {
      const mockSupplierWithStats = {
        ...mockSupplier,
        stats: {
          total_balance: 10000, // We owe them 100 FCFA
        },
      };

      jest.spyOn(service, 'getOne').mockResolvedValue(mockSupplierWithStats as any);

      const refundDto = {
        amount: 5000,
        payment_method: 'CASH' as const,
      };

      await expect(service.claimRefund(shopId, supplierId, userId, refundDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.claimRefund(shopId, supplierId, userId, refundDto)).rejects.toThrow(
        /fournisseur ne vous doit pas de remboursement/
      );
    });

    it('should throw BadRequestException when supplier balance is zero', async () => {
      const mockSupplierWithStats = {
        ...mockSupplier,
        stats: {
          total_balance: 0,
        },
      };

      jest.spyOn(service, 'getOne').mockResolvedValue(mockSupplierWithStats as any);

      const refundDto = {
        amount: 5000,
        payment_method: 'CASH' as const,
      };

      await expect(service.claimRefund(shopId, supplierId, userId, refundDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException when refund amount exceeds amount owed by supplier', async () => {
      const mockSupplierWithStats = {
        ...mockSupplier,
        stats: {
          total_balance: -5000, // Supplier owes us 50 FCFA
        },
      };

      jest.spyOn(service, 'getOne').mockResolvedValue(mockSupplierWithStats as any);

      const refundDto = {
        amount: 10000, // Trying to claim 100 FCFA when they only owe 50 FCFA
        payment_method: 'CASH' as const,
      };

      await expect(service.claimRefund(shopId, supplierId, userId, refundDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.claimRefund(shopId, supplierId, userId, refundDto)).rejects.toThrow(
        /dépasse le montant dû/
      );
    });

    it('should create cash entry with correct category and type', async () => {
      const mockSupplierWithStats = {
        ...mockSupplier,
        stats: {
          total_balance: -10000,
        },
      };

      jest.spyOn(service, 'getOne').mockResolvedValue(mockSupplierWithStats as any);

      let capturedCashEntry: any;
      mockPrismaService.$transaction.mockImplementation(async callback => {
        return callback({
          cashEntry: {
            create: jest.fn().mockImplementation(data => {
              capturedCashEntry = data.data;
              return Promise.resolve({ id: 'cash-123', ...data.data });
            }),
          },
          supplierDebt: {
            create: jest.fn().mockResolvedValue({ id: 'debt-123' }),
          },
        });
      });

      await service.claimRefund(shopId, supplierId, userId, {
        amount: 5000,
        payment_method: 'CASH',
      });

      expect(capturedCashEntry.category).toBe('Remboursement fournisseur');
      expect(capturedCashEntry.type).toBe('IN'); // Cash IN because we're receiving money
      expect(capturedCashEntry.amount).toBe(5000);
    });

    it('should create positive debt to offset negative supplier balance', async () => {
      // With -10000 balance (supplier owes us), a refund of 5000 creates a +5000 debt
      // Result: -10000 + 5000 = -5000 (supplier still owes 5000)
      const mockSupplierWithStats = {
        ...mockSupplier,
        stats: {
          total_balance: -10000,
        },
      };

      jest.spyOn(service, 'getOne').mockResolvedValue(mockSupplierWithStats as any);

      let capturedDebt: any;
      mockPrismaService.$transaction.mockImplementation(async callback => {
        return callback({
          cashEntry: {
            create: jest.fn().mockResolvedValue({ id: 'cash-123' }),
          },
          supplierDebt: {
            create: jest.fn().mockImplementation(data => {
              capturedDebt = data.data;
              return Promise.resolve({ id: 'debt-123', ...data.data });
            }),
          },
        });
      });

      await service.claimRefund(shopId, supplierId, userId, {
        amount: 5000,
        payment_method: 'MOBILE_MONEY',
        note: 'Refund via mobile money',
      });

      expect(capturedDebt.amount).toBe(5000); // Positive amount to offset negative balance
      expect(capturedDebt.balance).toBe(5000);
      expect(capturedDebt.status).toBe('PAID');
    });
  });
});
