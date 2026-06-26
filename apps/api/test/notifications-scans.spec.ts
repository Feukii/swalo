import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { NotificationDispatcherService } from '../src/modules/notifications/notification-dispatcher.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ProductsService } from '../src/modules/products/products.service';

const SHOP_ID = 'shop-1';

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

/** Build a due date exactly `offset` whole days in the future (J-offset), at noon. */
function dueInDays(offset: number): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12, 0, 0);
  return d;
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
    due_date: dueInDays(7),
    customer: {
      id: 'cust-1',
      name: 'Dupont',
      first_name: 'Jean',
      email: 'jean@example.com',
      phone: '0102030405',
      email_notifications_enabled: true,
      sms_notifications_enabled: false,
      whatsapp_notifications_enabled: false,
    },
    ...overrides,
  };
}

describe('NotificationsService - scans (WS-3)', () => {
  let service: NotificationsService;

  const mockMailer = { sendMail: jest.fn() };
  const mockProducts = { getLowStockProducts: jest.fn() };

  // Real-shaped dispatcher mock: resolveCustomerChannels mirrors production logic.
  const mockDispatcher = {
    dispatch: jest.fn(),
    resolveCustomerChannels: jest.fn(
      (customer: {
        email: string | null;
        phone: string | null;
        email_notifications_enabled: boolean;
        sms_notifications_enabled: boolean;
        whatsapp_notifications_enabled: boolean;
      }) => {
        const channels: { channel: string; recipient: string }[] = [];
        if (customer.email_notifications_enabled && customer.email) {
          channels.push({ channel: 'EMAIL', recipient: customer.email });
        }
        if (customer.sms_notifications_enabled && customer.phone) {
          channels.push({ channel: 'SMS', recipient: customer.phone });
        }
        if (customer.whatsapp_notifications_enabled && customer.phone) {
          channels.push({ channel: 'WHATSAPP', recipient: customer.phone });
        }
        return channels;
      }
    ),
  };

  const mockPrisma = {
    shop: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    clientReceivable: { findMany: jest.fn() },
    sellerTask: { findFirst: jest.fn(), create: jest.fn() },
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
        { provide: NotificationDispatcherService, useValue: mockDispatcher },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
    // Sensible defaults: no prior logs, create/createMany succeed.
    mockPrisma.notificationLog.findFirst.mockResolvedValue(null);
    mockPrisma.notificationLog.findMany.mockResolvedValue([]);
    mockPrisma.notificationLog.create.mockResolvedValue({ id: 'log-1' });
    mockPrisma.notificationLog.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.sellerTask.findFirst.mockResolvedValue(null);
    mockPrisma.sellerTask.create.mockResolvedValue({ id: 'task-1' });
    mockMailer.sendMail.mockResolvedValue(undefined);
    mockDispatcher.dispatch.mockResolvedValue('SENT');
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

  describe('scanPaymentRemindersForAllShops (J-7 / J-3 / J-0)', () => {
    it('dispatches a reminder and creates a seller task at J-7', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
      mockPrisma.clientReceivable.findMany.mockResolvedValue([
        buildReceivable({ due_date: dueInDays(7) }),
      ]);

      const result = await service.scanPaymentRemindersForAllShops();

      // Selection filter: PENDING/PARTIAL, balance > 0, due_date not null (no lt filter now).
      const where = mockPrisma.clientReceivable.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: ['PENDING', 'PARTIAL'] });
      expect(where.balance).toEqual({ gt: 0 });
      expect(where.due_date).toEqual({ not: null });

      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
      const dispatchArg = mockDispatcher.dispatch.mock.calls[0][0];
      expect(dispatchArg.type).toBe('PAYMENT_REMINDER');
      expect(dispatchArg.channel).toBe('EMAIL');
      expect(dispatchArg.recipient).toBe('jean@example.com');
      expect(dispatchArg.dedupKey).toBe('reminder:rec-1:7');

      expect(mockPrisma.sellerTask.create).toHaveBeenCalledTimes(1);
      const taskArg = mockPrisma.sellerTask.create.mock.calls[0][0].data;
      expect(taskArg.type).toBe('DEBT_REMINDER');
      expect(taskArg.dedup_key).toBe('task:rec-1:7');
      expect(taskArg.title).toContain('Jean Dupont');

      expect(result.reminders_sent).toBe(1);
      expect(result.tasks_created).toBe(1);
    });

    it('also fires at J-3 and J-0 with the matching offset dedup keys', async () => {
      for (const offset of [3, 0]) {
        jest.clearAllMocks();
        mockPrisma.notificationLog.create.mockResolvedValue({ id: 'log-1' });
        mockPrisma.sellerTask.findFirst.mockResolvedValue(null);
        mockPrisma.sellerTask.create.mockResolvedValue({ id: 'task-1' });
        mockDispatcher.dispatch.mockResolvedValue('SENT');
        mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
        mockPrisma.clientReceivable.findMany.mockResolvedValue([
          buildReceivable({ due_date: dueInDays(offset) }),
        ]);

        await service.scanPaymentRemindersForAllShops();

        expect(mockDispatcher.dispatch.mock.calls[0][0].dedupKey).toBe(
          `reminder:rec-1:${String(offset)}`
        );
        expect(mockPrisma.sellerTask.create.mock.calls[0][0].data.dedup_key).toBe(
          `task:rec-1:${String(offset)}`
        );
      }
    });

    it('does nothing for receivables whose due date is not at an offset boundary', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
      mockPrisma.clientReceivable.findMany.mockResolvedValue([
        buildReceivable({ due_date: dueInDays(5) }),
      ]);

      const result = await service.scanPaymentRemindersForAllShops();

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockPrisma.sellerTask.create).not.toHaveBeenCalled();
      expect(result.reminders_sent).toBe(0);
      expect(result.tasks_created).toBe(0);
    });

    it('dispatches on every opted-in channel (email + sms + whatsapp)', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
      mockPrisma.clientReceivable.findMany.mockResolvedValue([
        buildReceivable({
          due_date: dueInDays(0),
          customer: {
            id: 'cust-1',
            name: 'Dupont',
            first_name: 'Jean',
            email: 'jean@example.com',
            phone: '0102030405',
            email_notifications_enabled: true,
            sms_notifications_enabled: true,
            whatsapp_notifications_enabled: true,
          },
        }),
      ]);

      await service.scanPaymentRemindersForAllShops();

      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(3);
      const channels = mockDispatcher.dispatch.mock.calls.map(c => c[0].channel);
      expect(channels).toEqual(['EMAIL', 'SMS', 'WHATSAPP']);
    });

    it('does not recreate a seller task when one already exists for the same offset', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
      mockPrisma.clientReceivable.findMany.mockResolvedValue([
        buildReceivable({ due_date: dueInDays(7) }),
      ]);
      mockPrisma.sellerTask.findFirst.mockResolvedValue({ id: 'existing-task' });

      const result = await service.scanPaymentRemindersForAllShops();

      expect(mockPrisma.sellerTask.create).not.toHaveBeenCalled();
      expect(result.tasks_created).toBe(0);
    });

    it('logs SKIPPED and counts no reminder when the customer has no opted-in channel', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
      mockPrisma.clientReceivable.findMany.mockResolvedValue([
        buildReceivable({
          due_date: dueInDays(7),
          customer: {
            id: 'cust-1',
            name: 'X',
            first_name: null,
            email: null,
            phone: null,
            email_notifications_enabled: true,
            sms_notifications_enabled: false,
            whatsapp_notifications_enabled: false,
          },
        }),
      ]);

      const result = await service.scanPaymentRemindersForAllShops();

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      const logged = mockPrisma.notificationLog.create.mock.calls[0][0].data;
      expect(logged.status).toBe('SKIPPED');
      expect(result.skipped).toBe(1);
      // The seller task is still created so a human can follow up offline.
      expect(mockPrisma.sellerTask.create).toHaveBeenCalledTimes(1);
    });

    it('skips shops where the notifications module is disabled', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop({ enabled_modules: ['products'] })]);

      const result = await service.scanPaymentRemindersForAllShops();

      expect(mockPrisma.clientReceivable.findMany).not.toHaveBeenCalled();
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(result.reminders_sent).toBe(0);
    });

    it('continues when processing a receivable throws', async () => {
      mockPrisma.shop.findMany.mockResolvedValue([buildShop()]);
      mockPrisma.clientReceivable.findMany.mockResolvedValue([
        buildReceivable({ due_date: dueInDays(7) }),
      ]);
      mockDispatcher.dispatch.mockRejectedValue(new Error('boom'));

      const result = await service.scanPaymentRemindersForAllShops();

      // The loop swallows the error and returns a result (does not throw).
      expect(result.shops_processed).toBe(1);
      expect(result.reminders_sent).toBe(0);
    });
  });
});
