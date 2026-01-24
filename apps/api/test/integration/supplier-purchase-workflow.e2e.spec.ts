import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * E2E Test: Supplier Purchase and Refund Workflow
 *
 * This test validates the complete supplier interaction lifecycle:
 * 1. Create supplier
 * 2. Record merchandise purchase with debt creation
 * 3. Pay supplier (overpayment creates negative balance)
 * 4. Claim refund from supplier
 * 5. Verify all balances and transactions
 */
// TODO: Fix e2e test to work with current Prisma schema (requires owner relation for Shop, etc.)
describe.skip('Supplier Purchase Workflow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let shopId: string;
  let supplierId: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Setup test environment
    const shop = await prisma.shop.create({
      data: {
        id: `test-shop-${Date.now()}`,
        name: 'Test Shop',
        code: `TS${Math.floor(Math.random() * 1000000)}`,
        address: 'Test Address',
        currency: 'FCFA',
      },
    });
    shopId = shop.id;

    const user = await prisma.user.create({
      data: {
        id: `test-user-${Date.now()}`,
        email: `test-${Date.now()}@example.com`,
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
      },
    });
    userId = user.id;

    await prisma.userRole.create({
      data: {
        user_id: userId,
        shop_id: shopId,
        role: 'MANAGER',
      },
    });

    authToken = 'Bearer test-token';
  });

  afterAll(async () => {
    // Cleanup
    if (supplierId) {
      await prisma.supplierDebt.deleteMany({ where: { supplier_id: supplierId } });
      await prisma.cashEntry.deleteMany({ where: { supplier_id: supplierId } });
      await prisma.supplier.deleteMany({ where: { id: supplierId } });
    }
    await prisma.userRole.deleteMany({ where: { shop_id: shopId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.shop.deleteMany({ where: { id: shopId } });

    await app.close();
  });

  describe('Complete Purchase and Refund Workflow', () => {
    it('should complete full supplier purchase with debt workflow', async () => {
      // Step 1: Create supplier
      const createSupplierResponse = await request(app.getHttpServer())
        .post('/suppliers')
        .set('Authorization', authToken)
        .send({
          name: 'Test Supplier Ltd',
          phone: '9876543210',
          email: 'supplier@test.com',
        })
        .expect(201);

      supplierId = createSupplierResponse.body.id;
      expect(supplierId).toBeDefined();

      // Step 2: Create initial cash balance (to enable cash purchases)
      await prisma.cashEntry.create({
        data: {
          shop_id: shopId,
          type: 'IN',
          category: 'Ventes',
          amount: 200000, // 2,000 FCFA initial balance
          cashier_id: userId,
        },
      });

      // Step 3: Record merchandise purchase (50,000 FCFA) with debt creation
      const purchaseResponse = await request(app.getHttpServer())
        .post('/cash/merchandise-purchase')
        .set('Authorization', authToken)
        .send({
          supplier_id: supplierId,
          amount: 50000,
          description: 'Stock purchase - smartphones',
          payment_method: 'CASH',
          create_debt: true,
        })
        .expect(201);

      expect(purchaseResponse.body.cash_entry).toBeDefined();
      expect(purchaseResponse.body.debt).toBeDefined();
      expect(purchaseResponse.body.message).toContain('dette créée');

      // Verify cash entry
      expect(purchaseResponse.body.cash_entry.type).toBe('OUT');
      expect(purchaseResponse.body.cash_entry.category).toBe('Achats Marchandises');
      expect(purchaseResponse.body.cash_entry.amount).toBe(50000);

      // Verify debt created
      expect(purchaseResponse.body.debt.amount).toBe(50000);
      expect(purchaseResponse.body.debt.balance).toBe(50000);
      expect(purchaseResponse.body.debt.status).toBe('PENDING');

      // Step 4: Verify supplier balance shows we owe them 50,000
      const supplierDetailsResponse = await request(app.getHttpServer())
        .get(`/suppliers/${supplierId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(supplierDetailsResponse.body.stats.total_balance).toBe(50000);

      // Step 5: Pay supplier 70,000 (overpayment by 20,000)
      const paymentResponse = await request(app.getHttpServer())
        .post(`/suppliers/${supplierId}/payments`)
        .set('Authorization', authToken)
        .send({
          amount: 70000,
          payment_method: 'CASH',
          note: 'Payment with overpayment',
        })
        .expect(201);

      expect(paymentResponse.body).toBeDefined();

      // Step 6: Verify supplier balance is now negative (they owe us 20,000)
      const updatedSupplierResponse = await request(app.getHttpServer())
        .get(`/suppliers/${supplierId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(updatedSupplierResponse.body.stats.total_balance).toBe(-20000);

      // Step 7: Claim refund from supplier (15,000)
      const refundClaimResponse = await request(app.getHttpServer())
        .post(`/suppliers/${supplierId}/claim-refund`)
        .set('Authorization', authToken)
        .send({
          amount: 15000,
          payment_method: 'CASH',
          note: 'Refund claim for overpayment',
        })
        .expect(201);

      expect(refundClaimResponse.body.cash_entry).toBeDefined();
      expect(refundClaimResponse.body.debt).toBeDefined();
      expect(refundClaimResponse.body.message).toContain('succès');

      // Verify cash entry is IN (we received money)
      expect(refundClaimResponse.body.cash_entry.type).toBe('IN');
      expect(refundClaimResponse.body.cash_entry.category).toBe('Remboursement fournisseur');

      // Step 8: Verify final supplier balance (-5,000, still owe us 5,000)
      const finalSupplierResponse = await request(app.getHttpServer())
        .get(`/suppliers/${supplierId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(finalSupplierResponse.body.stats.total_balance).toBe(-5000);

      // Step 9: Verify cash balance calculation
      const cashBalance = await prisma.cashEntry.aggregate({
        where: { shop_id: shopId, deleted: false },
        _sum: {
          amount: true,
        },
      });

      // Initial: +200,000
      // Purchase: -50,000
      // Payment: -70,000
      // Refund claim: +15,000
      // Expected: 95,000
      const expectedBalance = 200000 - 50000 - 70000 + 15000;
      expect(cashBalance._sum.amount).toBe(expectedBalance);
    });

    it('should prevent merchandise purchase when cash balance insufficient', async () => {
      // Create supplier
      const supplier = await prisma.supplier.create({
        data: {
          id: `supplier-${Date.now()}`,
          shop_id: shopId,
          name: 'Test Supplier 2',
        },
      });

      // Clear existing cash (create negative balance scenario)
      await prisma.cashEntry.create({
        data: {
          shop_id: shopId,
          type: 'OUT',
          category: 'Divers',
          amount: 1000000, // Large withdrawal to ensure low balance
          cashier_id: userId,
        },
      });

      // Try to purchase with insufficient cash
      const purchaseResponse = await request(app.getHttpServer())
        .post('/cash/merchandise-purchase')
        .set('Authorization', authToken)
        .send({
          supplier_id: supplier.id,
          amount: 50000,
          payment_method: 'CASH',
          create_debt: false,
        })
        .expect(400);

      expect(purchaseResponse.body.message).toContain('Solde insuffisant');

      // Cleanup
      await prisma.supplier.delete({ where: { id: supplier.id } });
    });

    it('should allow mobile money purchase regardless of cash balance', async () => {
      // Create supplier
      const supplier = await prisma.supplier.create({
        data: {
          id: `supplier-${Date.now()}`,
          shop_id: shopId,
          name: 'Test Supplier 3',
        },
      });

      // Purchase via mobile money should work even with low cash
      const purchaseResponse = await request(app.getHttpServer())
        .post('/cash/merchandise-purchase')
        .set('Authorization', authToken)
        .send({
          supplier_id: supplier.id,
          amount: 30000,
          description: 'Mobile money purchase',
          payment_method: 'MOBILE_MONEY',
          create_debt: false,
        })
        .expect(201);

      expect(purchaseResponse.body.cash_entry).toBeDefined();
      expect(purchaseResponse.body.message).toContain('succès');

      // Cleanup
      await prisma.cashEntry.deleteMany({ where: { supplier_id: supplier.id } });
      await prisma.supplier.delete({ where: { id: supplier.id } });
    });

    it('should reject refund claim when supplier does not owe us', async () => {
      // Create supplier with positive balance (we owe them)
      const supplier = await prisma.supplier.create({
        data: {
          id: `supplier-${Date.now()}`,
          shop_id: shopId,
          name: 'Test Supplier 4',
        },
      });

      await prisma.supplierDebt.create({
        data: {
          shop_id: shopId,
          supplier_id: supplier.id,
          amount: 10000,
          balance: 10000,
          paid_amount: 0,
          status: 'PENDING',
          description: 'Outstanding debt',
        },
      });

      // Try to claim refund
      const refundResponse = await request(app.getHttpServer())
        .post(`/suppliers/${supplier.id}/claim-refund`)
        .set('Authorization', authToken)
        .send({
          amount: 5000,
          payment_method: 'CASH',
        })
        .expect(400);

      expect(refundResponse.body.message).toContain('ne vous doit pas');

      // Cleanup
      await prisma.supplierDebt.deleteMany({ where: { supplier_id: supplier.id } });
      await prisma.supplier.delete({ where: { id: supplier.id } });
    });
  });
});
