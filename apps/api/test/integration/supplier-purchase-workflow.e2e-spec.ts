import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
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
describe('Supplier Purchase Workflow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let shopId: string;
  let supplierId: string;
  let userId: string;
  let enterpriseId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Setup: Create test user, enterprise, shop, role and a real JWT
    const user = await prisma.user.create({
      data: {
        id: `test-user-${Date.now()}`,
        email: `test-${Date.now()}@example.com`,
        password_hash: 'hashed_password',
        display_name: 'Test User',
      },
    });
    userId = user.id;

    const enterprise = await prisma.enterprise.create({
      data: {
        code: `TE${Math.floor(Math.random() * 1000000)}`,
        name: 'Test Enterprise',
        owner_id: userId,
        license_tier: 'ENTERPRISE',
      },
    });
    enterpriseId = enterprise.id;

    const shop = await prisma.shop.create({
      data: {
        id: `test-shop-${Date.now()}`,
        name: 'Test Shop',
        code: `TS${Math.floor(Math.random() * 1000000)}`,
        address: 'Test Address',
        owner_id: userId,
        enterprise_id: enterpriseId,
        enabled_modules: [
          'auth',
          'products',
          'customers',
          'sales',
          'cash',
          'inventory',
          'suppliers',
          'receivables',
          'debts',
          'payments',
          'reports',
        ],
      },
    });
    shopId = shop.id;

    await prisma.userRole.create({
      data: {
        user_id: userId,
        shop_id: shopId,
        role: 'MANAGER',
      },
    });

    // Real JWT matching jwt.strategy ({ sub, shopId } signed with JWT_SECRET)
    const config = app.get(ConfigService);
    const token = new JwtService().sign(
      { sub: userId, shopId },
      { secret: config.get<string>('JWT_SECRET'), expiresIn: '24h' }
    );
    authToken = `Bearer ${token}`;
  });

  afterAll(async () => {
    // Cleanup (FK-safe order)
    await prisma.supplierDebtPayment.deleteMany({ where: { debt: { shop_id: shopId } } });
    await prisma.supplierDebt.deleteMany({ where: { shop_id: shopId } });
    await prisma.cashEntry.deleteMany({ where: { shop_id: shopId } });
    await prisma.supplier.deleteMany({ where: { shop_id: shopId } });
    await prisma.userRole.deleteMany({ where: { shop_id: shopId } });
    await prisma.shop.deleteMany({ where: { id: shopId } });
    await prisma.enterprise.deleteMany({ where: { id: enterpriseId } });
    await prisma.user.deleteMany({ where: { id: userId } });

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

      // Step 5: Pay the debt 70,000 (overpayment by 20,000) via the debts endpoint
      const debtId = purchaseResponse.body.debt.id;
      const paymentResponse = await request(app.getHttpServer())
        .post(`/debts/${debtId}/payments`)
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

      // Step 9: Verify net cash balance (amounts are stored positive; type gives direction)
      const [inSum, outSum] = await Promise.all([
        prisma.cashEntry.aggregate({
          where: { shop_id: shopId, type: 'IN', deleted: false },
          _sum: { amount: true },
        }),
        prisma.cashEntry.aggregate({
          where: { shop_id: shopId, type: 'OUT', deleted: false },
          _sum: { amount: true },
        }),
      ]);
      const netBalance = (inSum._sum.amount || 0) - (outSum._sum.amount || 0);

      // Initial: +200,000 (IN)
      // Purchase: -50,000 (cash OUT)
      // Debt payment: no cash movement (recorded against the debt only)
      // Refund claim: +15,000 (cash IN)
      // Expected net: 165,000
      const expectedBalance = 200000 - 50000 + 15000;
      expect(netBalance).toBe(expectedBalance);
    });

    it('should prevent merchandise purchase when cash balance insufficient', async () => {
      // Create supplier
      const supplier = await prisma.supplier.create({
        data: {
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

    it('should reject merchandise purchase with an unsupported payment method (CASH only)', async () => {
      // Create supplier
      const supplier = await prisma.supplier.create({
        data: {
          shop_id: shopId,
          name: 'Test Supplier 3',
        },
      });

      // The merchandise-purchase endpoint only supports payment_method CASH
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
        .expect(400);

      expect(JSON.stringify(purchaseResponse.body.message)).toContain('CASH');

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
