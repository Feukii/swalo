import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * E2E Test: Complete Customer Refund Workflow
 *
 * This test validates the entire customer refund lifecycle:
 * 1. Create customer
 * 2. Create overpayment (negative balance)
 * 3. Verify balance is negative
 * 4. Create refund
 * 5. Verify balance updated
 * 6. Verify cash entry created
 * 7. Verify refund history
 */
// TODO: Fix e2e test to work with current Prisma schema (requires owner relation for Shop, etc.)
describe.skip('Customer Refund Workflow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let shopId: string;
  let customerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Setup: Create test shop and user, get auth token
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

    await prisma.userRole.create({
      data: {
        user_id: user.id,
        shop_id: shopId,
        role: 'OWNER',
      },
    });

    // Mock auth token (in real test, you'd call login endpoint)
    authToken = 'Bearer test-token';
  });

  afterAll(async () => {
    // Cleanup
    if (customerId) {
      await prisma.clientReceivable.deleteMany({ where: { customer_id: customerId } });
      await prisma.cashEntry.deleteMany({ where: { customer_id: customerId } });
      await prisma.customer.deleteMany({ where: { id: customerId } });
    }
    await prisma.userRole.deleteMany({ where: { shop_id: shopId } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test-' } } });
    await prisma.shop.deleteMany({ where: { id: shopId } });

    await app.close();
  });

  describe('Complete Refund Workflow', () => {
    it('should complete full customer refund lifecycle', async () => {
      // Step 1: Create customer
      const createCustomerResponse = await request(app.getHttpServer())
        .post('/customers')
        .set('Authorization', authToken)
        .send({
          name: 'Test Customer',
          phone: '1234567890',
          email: 'customer@test.com',
        })
        .expect(201);

      customerId = createCustomerResponse.body.id;
      expect(customerId).toBeDefined();

      // Step 2: Create overpayment (customer pays without receivable)
      // This simulates receiving 10,000 FCFA from customer with no debt
      const receivableResponse = await request(app.getHttpServer())
        .post('/receivables')
        .set('Authorization', authToken)
        .send({
          customer_id: customerId,
          amount: -10000, // Negative amount = overpayment
          description: 'Overpayment test',
          status: 'PAID',
        })
        .expect(201);

      expect(receivableResponse.body.amount).toBe(-10000);
      expect(receivableResponse.body.balance).toBe(-10000);

      // Step 3: Get customer details and verify negative balance
      const customerDetailsResponse = await request(app.getHttpServer())
        .get(`/customers/${customerId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(customerDetailsResponse.body.stats.total_balance).toBe(-10000);

      // Step 4: Create refund for 6,000 FCFA (partial)
      const refundResponse = await request(app.getHttpServer())
        .post(`/customers/${customerId}/refund`)
        .set('Authorization', authToken)
        .send({
          amount: 6000,
          payment_method: 'CASH',
          note: 'Partial refund test',
        })
        .expect(201);

      expect(refundResponse.body.cash_entry).toBeDefined();
      expect(refundResponse.body.receivable).toBeDefined();
      expect(refundResponse.body.message).toContain('succès');

      // Step 5: Verify balance updated to -4,000 (still owe 4,000)
      const updatedCustomerResponse = await request(app.getHttpServer())
        .get(`/customers/${customerId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(updatedCustomerResponse.body.stats.total_balance).toBe(-4000);

      // Step 6: Verify cash entry created with correct details
      const cashEntry = refundResponse.body.cash_entry;
      expect(cashEntry.type).toBe('OUT');
      expect(cashEntry.category).toBe('Remboursement client');
      expect(cashEntry.amount).toBe(6000);
      expect(cashEntry.customer_id).toBe(customerId);

      // Step 7: Verify refund appears in history
      const refundHistoryResponse = await request(app.getHttpServer())
        .get(`/customers/${customerId}/refunds`)
        .set('Authorization', authToken)
        .expect(200);

      expect(refundHistoryResponse.body).toHaveLength(1);
      expect(refundHistoryResponse.body[0].amount).toBe(-6000);
      expect(refundHistoryResponse.body[0].description).toContain('Remboursement');

      // Step 8: Create second refund to fully clear balance
      const finalRefundResponse = await request(app.getHttpServer())
        .post(`/customers/${customerId}/refund`)
        .set('Authorization', authToken)
        .send({
          amount: 4000,
          payment_method: 'MOBILE_MONEY',
          note: 'Final refund',
        })
        .expect(201);

      expect(finalRefundResponse.body.message).toContain('succès');

      // Step 9: Verify balance is now 0
      const finalCustomerResponse = await request(app.getHttpServer())
        .get(`/customers/${customerId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(finalCustomerResponse.body.stats.total_balance).toBe(0);

      // Step 10: Verify refund history shows both refunds
      const finalHistoryResponse = await request(app.getHttpServer())
        .get(`/customers/${customerId}/refunds`)
        .set('Authorization', authToken)
        .expect(200);

      expect(finalHistoryResponse.body).toHaveLength(2);
    });

    it('should reject refund when amount exceeds balance owed', async () => {
      // Setup: Create customer with -1,000 balance
      const customer = await prisma.customer.create({
        data: {
          id: `customer-${Date.now()}`,
          shop_id: shopId,
          name: 'Test Customer 2',
        },
      });

      await prisma.clientReceivable.create({
        data: {
          shop_id: shopId,
          customer_id: customer.id,
          amount: -1000,
          balance: -1000,
          paid_amount: 0,
          status: 'PAID',
          description: 'Overpayment',
        },
      });

      // Try to refund 5,000 (more than owed)
      const refundResponse = await request(app.getHttpServer())
        .post(`/customers/${customer.id}/refund`)
        .set('Authorization', authToken)
        .send({
          amount: 5000,
          payment_method: 'CASH',
        })
        .expect(400);

      expect(refundResponse.body.message).toContain('dépasse');

      // Cleanup
      await prisma.clientReceivable.deleteMany({ where: { customer_id: customer.id } });
      await prisma.customer.delete({ where: { id: customer.id } });
    });

    it('should reject refund when customer has no negative balance', async () => {
      // Setup: Create customer with positive balance (they owe us)
      const customer = await prisma.customer.create({
        data: {
          id: `customer-${Date.now()}`,
          shop_id: shopId,
          name: 'Test Customer 3',
        },
      });

      await prisma.clientReceivable.create({
        data: {
          shop_id: shopId,
          customer_id: customer.id,
          amount: 5000,
          balance: 5000,
          paid_amount: 0,
          status: 'PENDING',
          description: 'Credit sale',
        },
      });

      // Try to refund
      const refundResponse = await request(app.getHttpServer())
        .post(`/customers/${customer.id}/refund`)
        .set('Authorization', authToken)
        .send({
          amount: 1000,
          payment_method: 'CASH',
        })
        .expect(400);

      expect(refundResponse.body.message).toContain("n'a pas de remboursement");

      // Cleanup
      await prisma.clientReceivable.deleteMany({ where: { customer_id: customer.id } });
      await prisma.customer.delete({ where: { id: customer.id } });
    });
  });
});
