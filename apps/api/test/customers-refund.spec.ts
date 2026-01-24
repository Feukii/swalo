import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CustomersService } from '../src/modules/customers/customers.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('CustomersService - Refund Functionality', () => {
  let service: CustomersService;
  let _prismaService: PrismaService;

  const mockPrismaService = {
    customer: {
      findFirst: jest.fn(),
    },
    clientReceivable: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    cashEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    _prismaService = module.get<PrismaService>(PrismaService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('createRefund', () => {
    const shopId = 'shop-123';
    const customerId = 'customer-123';
    const userId = 'user-123';
    const mockCustomer = {
      id: customerId,
      name: 'Test Customer',
      shop_id: shopId,
      deleted: false,
    };

    it('should successfully create a refund when customer has negative balance', async () => {
      // Mock customer with negative balance (we owe them 10000 centimes = 100 FCFA)
      const mockCustomerWithStats = {
        ...mockCustomer,
        stats: {
          total_balance: -10000,
          total_receivables: 0,
          total_paid: 0,
        },
      };

      // Mock the getOne method to return customer with stats
      jest.spyOn(service, 'getOne').mockResolvedValue(mockCustomerWithStats as any);

      // Mock transaction implementation
      const mockCashEntry = {
        id: 'cash-123',
        shop_id: shopId,
        type: 'OUT',
        category: 'Remboursement client',
        amount: 5000,
      };

      const mockReceivable = {
        id: 'receivable-123',
        shop_id: shopId,
        customer_id: customerId,
        amount: -5000,
        balance: -5000,
      };

      mockPrismaService.$transaction.mockImplementation(async callback => {
        return callback({
          cashEntry: { create: jest.fn().mockResolvedValue(mockCashEntry) },
          clientReceivable: { create: jest.fn().mockResolvedValue(mockReceivable) },
        });
      });

      const refundDto = {
        amount: 5000, // 50 FCFA
        payment_method: 'CASH' as const,
        note: 'Test refund',
      };

      const result = await service.createRefund(shopId, customerId, userId, refundDto);

      expect(result).toHaveProperty('cash_entry');
      expect(result).toHaveProperty('receivable');
      expect(result.message).toBe('Remboursement enregistré avec succès');
    });

    it('should throw BadRequestException when customer has no refund owed (positive balance)', async () => {
      // Mock customer with positive balance (they owe us)
      const mockCustomerWithStats = {
        ...mockCustomer,
        stats: {
          total_balance: 10000, // They owe us 100 FCFA
        },
      };

      jest.spyOn(service, 'getOne').mockResolvedValue(mockCustomerWithStats as any);

      const refundDto = {
        amount: 5000,
        payment_method: 'CASH' as const,
      };

      await expect(service.createRefund(shopId, customerId, userId, refundDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.createRefund(shopId, customerId, userId, refundDto)).rejects.toThrow(
        "Ce client n'a pas de remboursement dû"
      );
    });

    it('should throw BadRequestException when customer has zero balance', async () => {
      const mockCustomerWithStats = {
        ...mockCustomer,
        stats: {
          total_balance: 0,
        },
      };

      jest.spyOn(service, 'getOne').mockResolvedValue(mockCustomerWithStats as any);

      const refundDto = {
        amount: 5000,
        payment_method: 'CASH' as const,
      };

      await expect(service.createRefund(shopId, customerId, userId, refundDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException when refund amount exceeds amount owed', async () => {
      // Customer balance: -5000 (we owe them 50 FCFA)
      const mockCustomerWithStats = {
        ...mockCustomer,
        stats: {
          total_balance: -5000,
        },
      };

      jest.spyOn(service, 'getOne').mockResolvedValue(mockCustomerWithStats as any);

      const refundDto = {
        amount: 10000, // Trying to refund 100 FCFA when we only owe 50 FCFA
        payment_method: 'CASH' as const,
      };

      await expect(service.createRefund(shopId, customerId, userId, refundDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.createRefund(shopId, customerId, userId, refundDto)).rejects.toThrow(
        /dépasse le montant dû/
      );
    });

    it('should create cash entry with correct category', async () => {
      const mockCustomerWithStats = {
        ...mockCustomer,
        stats: {
          total_balance: -10000,
        },
      };

      jest.spyOn(service, 'getOne').mockResolvedValue(mockCustomerWithStats as any);

      let capturedCashEntry: any;
      mockPrismaService.$transaction.mockImplementation(async callback => {
        return callback({
          cashEntry: {
            create: jest.fn().mockImplementation(data => {
              capturedCashEntry = data.data;
              return Promise.resolve({ id: 'cash-123', ...data.data });
            }),
          },
          clientReceivable: {
            create: jest.fn().mockResolvedValue({ id: 'receivable-123' }),
          },
        });
      });

      await service.createRefund(shopId, customerId, userId, {
        amount: 5000,
        payment_method: 'CASH',
      });

      expect(capturedCashEntry.category).toBe('Remboursement client');
      expect(capturedCashEntry.type).toBe('OUT');
      expect(capturedCashEntry.amount).toBe(5000);
    });

    it('should create positive receivable to offset negative balance', async () => {
      // With -10000 balance (we owe them), a refund of 5000 creates a +5000 receivable
      // Result: -10000 + 5000 = -5000 (we still owe 5000)
      const mockCustomerWithStats = {
        ...mockCustomer,
        stats: {
          total_balance: -10000,
        },
      };

      jest.spyOn(service, 'getOne').mockResolvedValue(mockCustomerWithStats as any);

      let capturedReceivable: any;
      mockPrismaService.$transaction.mockImplementation(async callback => {
        return callback({
          cashEntry: {
            create: jest.fn().mockResolvedValue({ id: 'cash-123' }),
          },
          clientReceivable: {
            create: jest.fn().mockImplementation(data => {
              capturedReceivable = data.data;
              return Promise.resolve({ id: 'receivable-123', ...data.data });
            }),
          },
        });
      });

      await service.createRefund(shopId, customerId, userId, {
        amount: 5000,
        payment_method: 'CASH',
      });

      expect(capturedReceivable.amount).toBe(5000); // Positive amount to offset negative balance
      expect(capturedReceivable.balance).toBe(5000);
      expect(capturedReceivable.status).toBe('PAID');
    });
  });

  describe('getRefundHistory', () => {
    const shopId = 'shop-123';
    const customerId = 'customer-123';
    const mockCustomer = {
      id: customerId,
      name: 'Test Customer',
      shop_id: shopId,
      deleted: false,
      receivables: [],
      sales: [],
      cash_entries: [],
    };

    it('should return refund history for a customer', async () => {
      // Mock customer exists
      mockPrismaService.customer.findFirst = jest.fn().mockResolvedValue(mockCustomer);

      const mockRefunds = [
        {
          id: 'refund-1',
          amount: -5000,
          balance: -5000,
          description: 'Remboursement effectué',
          created_at: new Date(),
        },
        {
          id: 'refund-2',
          amount: -3000,
          balance: -3000,
          description: 'Remboursement effectué',
          created_at: new Date(),
        },
      ];

      mockPrismaService.cashEntry.findMany = jest.fn().mockResolvedValue(mockRefunds);

      const result = await service.getRefundHistory(shopId, customerId);

      expect(result).toEqual(mockRefunds);
    });

    it('should return empty array when no refunds exist', async () => {
      // Mock customer exists
      mockPrismaService.customer.findFirst = jest.fn().mockResolvedValue(mockCustomer);
      mockPrismaService.cashEntry.findMany = jest.fn().mockResolvedValue([]);

      const result = await service.getRefundHistory(shopId, customerId);

      expect(result).toEqual([]);
    });
  });
});
