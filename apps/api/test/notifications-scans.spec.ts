import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ProductsService } from '../src/modules/products/products.service';

const SHOP_ID = 'shop-1';
const DAY_MS = 24 * 60 * 60 * 1000;

interface LowStockProduct {
  id: string;
  name: string;
  current_stock: number;
  alert_threshold: number;
  is_low_stock: boolean;
}

function buildShop(overrides: Record<string, unknown> = {}) {
  return {
    id: SHOP_ID,
    name: 'Ma Boutique',
    phone: '0102030405',
    email: 'shop@example.com',
    notification_email: 'notify@example.com',
    owner_id: 'owner-1',
    enabled_modules: [],
    payment_reminder_cadence_days: 7,
    ...overrides,
  };
}

function buildReceivable(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    shop_id: SHOP_ID,
    customer_id: 'cust-1',
    amount: 10000,
    paid_amount: 0,
    balance: 10000,
    description: 'Achat a credit',
    status: 'PENDING',
    due_date: new Date(Date.now() - DAY_MS),
    customer: {
      name: 'Dupont',
      first_name: 'Jean',
      email: 'jean@example.com',
      email_notifications_enabled: true,
    },
    ...overrides,
  };
}

describe('NotificationsService - scans (WS-3)', () => {
  let service: NotificationsService;

  const mockMailer = { sendMail: jest.fn() };
  const mockProducts = { getLowStockProducts: jest.fn() };

  const mockPrisma = {
    shop: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    clientReceivable: { findMany: jest.fn() },
    notificationLog: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: MailerService, useValue: mockMailer },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProductsService, useValue: mockProducts },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
    // Sensible defaults: no prior logs, create/createMany succeed.
    mockPrisma.notificationLog.findFirst.mockResolvedValue(null);
    mockPrisma.notificationLog.findMany.mockResolvedValue([]);
    mockPrisma.notificationLog.create.mockResolvedValue({ id: 'log-1' });
    mockPrisma.notificationLog.createMany.mockResolvedValue({ count: 1 });
    mockMailer.sendMail.mockResolvedValue(undefined);
  });

  describe('scanLowStockForAllShops', () => {
    it('sends a digest for low-stock products and logs one SENT per product', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
      const products: LowStockProduct[] = [
        { id: 'p1', name: 'Coque', current_stock: 2, alert_threshold: 5, is_low_stock: true },
        { id: 'p2', name: 'Chargeur', current_stock: 0, alert_threshold: 3, is_low_stock: true },
      ];
      mockProducts.getLowStockProducts.mockResolvedValue(products);

      const result = await service.scanLowStockForAllShops();

      expect(mockMailer.sendMail).toHaveBeenCalledTimes(1);
      const mailArg = mockMailer.sendMail.mock.calls[0][0];
      expect(mailArg.to).toBe('notify@example.com'); // resolution order: notification_email first
      expect(mailArg.template).toBe('low-stock-alert');
      expect(mailArg.context.products).toHaveLength(2);
      expect(mockPrisma.notificationLog.createMany).toHaveBeenCalledTimes(1);
      const created = mockPrisma.notificationLog.createMany.mock.calls[0][0].data;
      expect(created).toHaveLength(2);
      expect(created[0].dedup_key).toBe('low_stock:shop-1:p1');
      expect(created[0].status).toBe('SENT');
      expect(result).toEqual({ shops_processed: 1, emails_sent: 1, products_flagged: 2 });
    });

    it('falls back through recipient resolution order (shop email then owner email)', async () => {
      // No notification_email, no shop email -> owner email
      mockPrisma.shop.findMany.mockResolvedValue([
        buildShop({ notification_email: null, email: null }),
      ]);
      mockProducts.getLowStockProducts.mockResolvedValue([
        { id: 'p1', name: 'Coque', current_stock: 1, alert_threshold: 5, is_low_stock: true },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'owner@example.com' });

      await service.scanLowStockForAllShops();

      expect(mockMailer.sendMail.mock.calls[0][0].to).toBe('owner@example.com');
    });

    it('uses shop email when notification_email is absent', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop({ notification_email: null })]);
      mockProducts.getLowStockProducts.mockResolvedValue([
        { id: 'p1', name: 'Coque', current_stock: 1, alert_threshold: 5, is_low_stock: true },
      ]);

      await service.scanLowStockForAllShops();

      expect(mockMailer.sendMail.mock.calls[0][0].to).toBe('shop@example.com');
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('writes a SKIPPED log and does not email when no recipient resolves', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([
        buildShop({ notification_email: null, email: null }),
      ]);
      mockProducts.getLowStockProducts.mockResolvedValue([
        { id: 'p1', name: 'Coque', current_stock: 1, alert_threshold: 5, is_low_stock: true },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({ email: null });

      const result = await service.scanLowStockForAllShops();

      expect(mockMailer.sendMail).not.toHaveBeenCalled();
      const logged = mockPrisma.notificationLog.create.mock.calls[0][0].data;
      expect(logged.status).toBe('SKIPPED');
      expect(result.emails_sent).toBe(0);
    });

    it('dedups: does not re-send for a product with a recent SENT log', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
      mockProducts.getLowStockProducts.mockResolvedValue([
        { id: 'p1', name: 'Coque', current_stock: 1, alert_threshold: 5, is_low_stock: true },
      ]);
      // A recent log exists for the only low product -> nothing newly low.
      mockPrisma.notificationLog.findFirst.mockResolvedValue({ id: 'existing-log' });

      const result = await service.scanLowStockForAllShops();

      expect(mockMailer.sendMail).not.toHaveBeenCalled();
      expect(result).toEqual({ shops_processed: 1, emails_sent: 0, products_flagged: 0 });
    });

    it('skips shops where notifications module is disabled (opt-in gating)', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([
        buildShop({ enabled_modules: ['products', 'sales'] }),
      ]);

      const result = await service.scanLowStockForAllShops();

      expect(mockProducts.getLowStockProducts).not.toHaveBeenCalled();
      expect(mockMailer.sendMail).not.toHaveBeenCalled();
      expect(result.emails_sent).toBe(0);
    });

    it('continues and logs FAILED when sending throws for a shop', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
      mockProducts.getLowStockProducts.mockResolvedValue([
        { id: 'p1', name: 'Coque', current_stock: 1, alert_threshold: 5, is_low_stock: true },
      ]);
      mockMailer.sendMail.mockRejectedValue(new Error('SMTP down'));

      const result = await service.scanLowStockForAllShops();

      const logged = mockPrisma.notificationLog.create.mock.calls[0][0].data;
      expect(logged.status).toBe('FAILED');
      expect(logged.error).toBe('SMTP down');
      expect(result.shops_processed).toBe(1);
    });
  });

  describe('scanPaymentRemindersForAllShops', () => {
    it('sends a reminder for an overdue receivable with balance > 0 and right status', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
      mockPrisma.clientReceivable.findMany.mockResolvedValue([buildReceivable()]);

      const result = await service.scanPaymentRemindersForAllShops();

      // Verify the selection filter passed to Prisma.
      const where = mockPrisma.clientReceivable.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: ['PENDING', 'PARTIAL'] });
      expect(where.balance).toEqual({ gt: 0 });
      expect(where.deleted).toBe(false);
      expect(where.due_date.not).toBeNull();
      expect(where.due_date.lt).toBeInstanceOf(Date);

      expect(mockMailer.sendMail).toHaveBeenCalledTimes(1);
      const mailArg = mockMailer.sendMail.mock.calls[0][0];
      expect(mailArg.to).toBe('jean@example.com');
      expect(mailArg.template).toBe('payment-reminder');
      expect(mailArg.context.customer_name).toBe('Jean Dupont');
      const logged = mockPrisma.notificationLog.create.mock.calls[0][0].data;
      expect(logged.status).toBe('SENT');
      expect(logged.dedup_key).toBe('payment_reminder:rec-1');
      expect(result).toEqual({ shops_processed: 1, reminders_sent: 1, skipped: 0 });
    });

    it('skips (SKIPPED log) when the customer has no email', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
      mockPrisma.clientReceivable.findMany.mockResolvedValue([
        buildReceivable({
          customer: { name: 'X', first_name: null, email: null, email_notifications_enabled: true },
        }),
      ]);

      const result = await service.scanPaymentRemindersForAllShops();

      expect(mockMailer.sendMail).not.toHaveBeenCalled();
      const logged = mockPrisma.notificationLog.create.mock.calls[0][0].data;
      expect(logged.status).toBe('SKIPPED');
      expect(logged.error).toBe('No customer email');
      expect(result.skipped).toBe(1);
    });

    it('skips (SKIPPED log) when the customer opted out of email notifications', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
      mockPrisma.clientReceivable.findMany.mockResolvedValue([
        buildReceivable({
          customer: {
            name: 'X',
            first_name: null,
            email: 'x@example.com',
            email_notifications_enabled: false,
          },
        }),
      ]);

      const result = await service.scanPaymentRemindersForAllShops();

      expect(mockMailer.sendMail).not.toHaveBeenCalled();
      const logged = mockPrisma.notificationLog.create.mock.calls[0][0].data;
      expect(logged.status).toBe('SKIPPED');
      expect(logged.error).toBe('Customer opted out of email notifications');
      expect(result.skipped).toBe(1);
    });

    it('respects cadence: does not re-send when last reminder is within cadence days', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop({ payment_reminder_cadence_days: 7 })]);
      mockPrisma.clientReceivable.findMany.mockResolvedValue([buildReceivable()]);
      // Last reminder sent 2 days ago, cadence is 7 days -> too soon.
      mockPrisma.notificationLog.findMany.mockResolvedValue([
        { id: 'l1', sent_at: new Date(Date.now() - 2 * DAY_MS) },
      ]);

      const result = await service.scanPaymentRemindersForAllShops();

      expect(mockMailer.sendMail).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
      expect(result.reminders_sent).toBe(0);
    });

    it('re-sends when the last reminder is older than the cadence', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop({ payment_reminder_cadence_days: 7 })]);
      mockPrisma.clientReceivable.findMany.mockResolvedValue([buildReceivable()]);
      mockPrisma.notificationLog.findMany.mockResolvedValue([
        { id: 'l1', sent_at: new Date(Date.now() - 10 * DAY_MS) },
      ]);

      const result = await service.scanPaymentRemindersForAllShops();

      expect(mockMailer.sendMail).toHaveBeenCalledTimes(1);
      expect(result.reminders_sent).toBe(1);
    });

    it('stops after the max reminder count', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
      mockPrisma.clientReceivable.findMany.mockResolvedValue([buildReceivable()]);
      // 5 previous reminders already sent.
      mockPrisma.notificationLog.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          id: `l${String(i)}`,
          sent_at: new Date(Date.now() - (i + 30) * DAY_MS),
        }))
      );

      const result = await service.scanPaymentRemindersForAllShops();

      expect(mockMailer.sendMail).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });

    it('skips shops where the notifications module is disabled', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop({ enabled_modules: ['products'] })]);

      const result = await service.scanPaymentRemindersForAllShops();

      expect(mockPrisma.clientReceivable.findMany).not.toHaveBeenCalled();
      expect(mockMailer.sendMail).not.toHaveBeenCalled();
      expect(result.reminders_sent).toBe(0);
    });

    it('continues and logs FAILED when sending throws for a receivable', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
      mockPrisma.clientReceivable.findMany.mockResolvedValue([buildReceivable()]);
      mockMailer.sendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await service.scanPaymentRemindersForAllShops();

      const logged = mockPrisma.notificationLog.create.mock.calls[0][0].data;
      expect(logged.status).toBe('FAILED');
      expect(logged.error).toBe('SMTP error');
      expect(result.reminders_sent).toBe(0);
    });
  });
});
