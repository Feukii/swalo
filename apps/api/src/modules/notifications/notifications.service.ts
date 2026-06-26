import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  SellerTaskStatus,
  SellerTaskType,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';

/** Module code required for the notifications feature (entitlement gating). */
const NOTIFICATIONS_MODULE = 'notifications';

/** Re-alert window for a persistently-low product: skip if a SENT LOW_STOCK log exists within this window. */
const LOW_STOCK_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Day offsets (relative to the due date) at which a payment reminder is sent:
 * J-7, J-3 and J-0 (the due day itself).
 */
const PAYMENT_REMINDER_OFFSETS = [7, 3, 0] as const;

/** Milliseconds in a day, for due-date offset arithmetic. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface LowStockProductLine {
  name: string;
  current_stock: string;
  alert_threshold: string;
}

interface LowStockScanResult {
  shops_processed: number;
  emails_sent: number;
  products_flagged: number;
}

interface PaymentReminderScanResult {
  shops_processed: number;
  reminders_sent: number;
  tasks_created: number;
  skipped: number;
}

interface MovementLine {
  date: string;
  description: string;
  debit: string;
  credit: string;
}

interface MonthlySummaryData {
  customer_name: string;
  shop_name: string;
  shop_phone?: string;
  shop_email?: string;
  month_label: string;
  opening_balance: string;
  closing_balance: string;
  is_balance_positive: boolean;
  total_debits: string;
  total_credits: string;
  movements: MovementLine[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly dispatcher: NotificationDispatcherService
  ) {}

  /**
   * Format an amount in FCFA with space separators
   */
  private formatAmount(amount: number): string {
    return Math.abs(amount)
      .toFixed(0)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  /**
   * Get French month label from a date
   */
  private getMonthLabel(date: Date): string {
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  /**
   * Format a date as DD/MM/YYYY
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Send monthly summary email to a single customer
   */
  async sendMonthlySummary(
    customerId: string,
    shopId: string,
    year: number,
    month: number
  ): Promise<boolean> {
    try {
      // Fetch customer with shop info
      const customer = await this.prisma.customer.findFirst({
        where: {
          id: customerId,
          shop_id: shopId,
          deleted: false,
          is_active: true,
          email_notifications_enabled: true,
        },
        include: {
          shop: {
            select: { name: true, phone: true, email: true },
          },
        },
      });

      if (!customer?.email) {
        return false;
      }

      // Calculate date range for the month
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

      // Fetch all receivables for this customer in the month
      const receivables = await this.prisma.clientReceivable.findMany({
        where: {
          customer_id: customerId,
          shop_id: shopId,
          deleted: false,
          created_at: { gte: startOfMonth, lte: endOfMonth },
        },
        include: {
          payments: {
            where: {
              deleted: false,
              created_at: { gte: startOfMonth, lte: endOfMonth },
            },
            orderBy: { created_at: 'asc' },
          },
        },
        orderBy: { created_at: 'asc' },
      });

      // Also fetch payments on older receivables that happened this month
      const paymentsOnOlderReceivables = await this.prisma.clientReceivablePayment.findMany({
        where: {
          deleted: false,
          created_at: { gte: startOfMonth, lte: endOfMonth },
          receivable: {
            customer_id: customerId,
            shop_id: shopId,
            deleted: false,
            created_at: { lt: startOfMonth },
          },
        },
        include: {
          receivable: { select: { description: true } },
        },
        orderBy: { created_at: 'asc' },
      });

      // Build movements list
      const movements: MovementLine[] = [];
      let totalDebits = 0;
      let totalCredits = 0;

      for (const rec of receivables) {
        // Debit: new receivable
        if (rec.status !== 'CANCELLED') {
          totalDebits += rec.amount;
          movements.push({
            date: this.formatDate(rec.created_at),
            description: rec.description ?? 'Achat a credit',
            debit: this.formatAmount(rec.amount),
            credit: '',
          });
        }

        // Credits: payments on this receivable during the month
        for (const payment of rec.payments) {
          totalCredits += payment.amount;
          movements.push({
            date: this.formatDate(payment.created_at),
            description: `Paiement - ${rec.description ?? 'Creance'}`,
            debit: '',
            credit: this.formatAmount(payment.amount),
          });
        }
      }

      // Payments on older receivables
      for (const payment of paymentsOnOlderReceivables) {
        totalCredits += payment.amount;
        movements.push({
          date: this.formatDate(payment.created_at),
          description: `Paiement - ${payment.receivable.description ?? 'Creance anterieure'}`,
          debit: '',
          credit: this.formatAmount(payment.amount),
        });
      }

      // Sort movements by date
      movements.sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('');
        const dateB = b.date.split('/').reverse().join('');
        return dateA.localeCompare(dateB);
      });

      // Skip if no movements
      if (movements.length === 0) {
        this.logger.debug(
          `No movements for customer ${customer.name} (${customerId}) in ${String(month)}/${String(year)}`
        );
        return false;
      }

      // Calculate opening balance (sum of all outstanding receivables before this month)
      const preMonthReceivables = await this.prisma.clientReceivable.findMany({
        where: {
          customer_id: customerId,
          shop_id: shopId,
          deleted: false,
          status: { not: 'CANCELLED' },
          created_at: { lt: startOfMonth },
        },
        select: { balance: true },
      });
      const openingBalance = preMonthReceivables.reduce((sum, r) => sum + r.balance, 0);

      // Add this month's changes to calculate closing balance
      // Opening + new debits - payments received = Closing
      // But we need to recalculate by looking at current balance of all receivables
      const allActiveReceivables = await this.prisma.clientReceivable.findMany({
        where: {
          customer_id: customerId,
          shop_id: shopId,
          deleted: false,
          status: { not: 'CANCELLED' },
          created_at: { lte: endOfMonth },
        },
        select: { balance: true },
      });
      const closingBalance = allActiveReceivables.reduce((sum, r) => sum + r.balance, 0);

      const customerName = customer.first_name
        ? `${customer.first_name} ${customer.name}`
        : customer.name;

      const templateData: MonthlySummaryData = {
        customer_name: customerName,
        shop_name: customer.shop.name,
        shop_phone: customer.shop.phone ?? undefined,
        shop_email: customer.shop.email ?? undefined,
        month_label: this.getMonthLabel(startOfMonth),
        opening_balance: this.formatAmount(openingBalance),
        closing_balance: this.formatAmount(closingBalance),
        is_balance_positive: closingBalance > 0,
        total_debits: this.formatAmount(totalDebits),
        total_credits: this.formatAmount(totalCredits),
        movements,
      };

      await this.mailer.sendMail({
        to: customer.email,
        subject: `Recapitulatif ${this.getMonthLabel(startOfMonth)} - ${customer.shop.name}`,
        template: 'monthly-summary',
        context: templateData,
      });

      this.logger.log(`Monthly summary sent to ${customer.email} for ${customerName}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send monthly summary to customer ${customerId}: ${message}`);
      return false;
    }
  }

  /**
   * Send monthly summaries for all eligible customers in a shop
   * Returns the number of emails sent
   */
  async sendMonthlyBatch(shopId: string, year: number, month: number, limit = 50): Promise<number> {
    // Find all customers with email and notifications enabled
    const customers = await this.prisma.customer.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
        is_active: true,
        email_notifications_enabled: true,
        email: { not: null },
      },
      select: { id: true, name: true, email: true },
      take: limit,
    });

    let sentCount = 0;
    for (const customer of customers) {
      const sent = await this.sendMonthlySummary(customer.id, shopId, year, month);
      if (sent) sentCount++;
    }

    this.logger.log(
      `Monthly batch for shop ${shopId}: ${String(sentCount)}/${String(customers.length)} emails sent`
    );
    return sentCount;
  }

  /**
   * Send monthly summaries for ALL shops
   * Called by the CRON scheduler
   */
  async sendMonthlyForAllShops(
    year: number,
    month: number
  ): Promise<{ total_shops: number; total_sent: number }> {
    const shops = await this.prisma.shop.findMany({
      where: { deleted: false },
      select: { id: true, name: true },
    });

    let totalSent = 0;
    for (const shop of shops) {
      const sent = await this.sendMonthlyBatch(shop.id, year, month);
      totalSent += sent;
    }

    this.logger.log(
      `Monthly summaries complete: ${String(totalSent)} emails sent across ${String(shops.length)} shops`
    );
    return { total_shops: shops.length, total_sent: totalSent };
  }

  /**
   * Whether a shop's enabled_modules allow the notifications feature.
   * Empty array = all modules allowed (backwards compatibility), mirroring EntitlementGuard.
   */
  private notificationsAllowed(enabledModules: string[]): boolean {
    return enabledModules.length === 0 || enabledModules.includes(NOTIFICATIONS_MODULE);
  }

  /**
   * Resolve the recipient email for a shop-level digest.
   * Order: Shop.notification_email -> Shop.email -> owner User.email.
   */
  private async resolveShopRecipient(shop: {
    notification_email: string | null;
    email: string | null;
    owner_id: string;
  }): Promise<string | null> {
    if (shop.notification_email) return shop.notification_email;
    if (shop.email) return shop.email;

    const owner = await this.prisma.user.findUnique({
      where: { id: shop.owner_id },
      select: { email: true },
    });
    return owner?.email ?? null;
  }

  /**
   * Scan every eligible shop for low-stock products and send one digest email per shop.
   *
   * Eligibility: non-deleted shop with low_stock_alerts_enabled=true AND notifications module allowed.
   * Low-stock definition is reused from ProductsService.getLowStockProducts (stock <= alert_threshold).
   *
   * Dedup: a product is skipped if a SENT LOW_STOCK NotificationLog with dedup_key
   * `low_stock:{shop_id}:{product_id}` exists within the last 24h. This avoids re-alerting daily for
   * the same persistently-low product while still re-alerting once a day if it stays low (a low-stock
   * situation is actionable; a 24h window is the chosen balance between noise and visibility).
   *
   * Failures are caught per shop (never thrown out of the loop); a FAILED log is written and the scan continues.
   */
  async scanLowStockForAllShops(): Promise<LowStockScanResult> {
    const shops = await this.prisma.shop.findMany({
      where: { deleted: false, low_stock_alerts_enabled: true },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        notification_email: true,
        owner_id: true,
        enabled_modules: true,
      },
    });

    let emailsSent = 0;
    let productsFlagged = 0;

    for (const shop of shops) {
      try {
        if (!this.notificationsAllowed(shop.enabled_modules)) {
          continue;
        }

        const lowStock = await this.products.getLowStockProducts(shop.id);
        if (lowStock.length === 0) {
          continue;
        }

        const since = new Date(Date.now() - LOW_STOCK_DEDUP_WINDOW_MS);
        const newlyLow: typeof lowStock = [];
        for (const product of lowStock) {
          const recent = await this.prisma.notificationLog.findFirst({
            where: {
              shop_id: shop.id,
              type: NotificationType.LOW_STOCK,
              status: NotificationStatus.SENT,
              dedup_key: `low_stock:${shop.id}:${product.id}`,
              sent_at: { gte: since },
            },
            select: { id: true },
          });
          if (!recent) {
            newlyLow.push(product);
          }
        }

        if (newlyLow.length === 0) {
          continue;
        }

        const recipient = await this.resolveShopRecipient(shop);
        if (!recipient) {
          await this.prisma.notificationLog.create({
            data: {
              shop_id: shop.id,
              type: NotificationType.LOW_STOCK,
              target_type: 'shop',
              target_id: shop.id,
              recipient: '',
              status: NotificationStatus.SKIPPED,
              error: 'No recipient email (notification_email, shop email, owner email all empty)',
            },
          });
          continue;
        }

        const lines: LowStockProductLine[] = newlyLow.map(p => ({
          name: p.name,
          current_stock: this.formatAmount(p.current_stock),
          alert_threshold: this.formatAmount(p.alert_threshold),
        }));

        await this.mailer.sendMail({
          to: recipient,
          subject: `Alerte stock faible - ${shop.name} (${String(newlyLow.length)})`,
          template: 'low-stock-alert',
          context: {
            shop_name: shop.name,
            shop_phone: shop.phone ?? undefined,
            shop_email: shop.email ?? undefined,
            product_count: newlyLow.length,
            products: lines,
          },
        });
        emailsSent++;

        // Write one SENT log per product so per-product dedup works on the next scan.
        const now = new Date();
        await this.prisma.notificationLog.createMany({
          data: newlyLow.map(p => ({
            shop_id: shop.id,
            type: NotificationType.LOW_STOCK,
            target_type: 'product',
            target_id: p.id,
            recipient,
            status: NotificationStatus.SENT,
            dedup_key: `low_stock:${shop.id}:${p.id}`,
            sent_at: now,
          })),
        });
        productsFlagged += newlyLow.length;

        this.logger.log(
          `Low-stock digest sent to ${recipient} for shop ${shop.name} (${String(newlyLow.length)} products)`
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Low-stock scan failed for shop ${shop.id}: ${message}`);
        await this.prisma.notificationLog.create({
          data: {
            shop_id: shop.id,
            type: NotificationType.LOW_STOCK,
            target_type: 'shop',
            target_id: shop.id,
            recipient: '',
            status: NotificationStatus.FAILED,
            error: message,
          },
        });
      }
    }

    this.logger.log(
      `Low-stock scan complete: ${String(emailsSent)} emails, ${String(productsFlagged)} products across ${String(shops.length)} shops`
    );
    return {
      shops_processed: shops.length,
      emails_sent: emailsSent,
      products_flagged: productsFlagged,
    };
  }

  /**
   * Whole-day difference (in days) between the due date and "now", both
   * normalized to midnight, so a comparison against the J-7/J-3/J-0 offsets is
   * not affected by the time of day the scan runs.
   * Positive = days remaining before the due date; 0 = due today.
   */
  private daysUntilDue(dueDate: Date, now: Date): number {
    const dueMidnight = new Date(
      dueDate.getFullYear(),
      dueDate.getMonth(),
      dueDate.getDate()
    ).getTime();
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.round((dueMidnight - nowMidnight) / MS_PER_DAY);
  }

  /**
   * Scan every eligible shop for receivables approaching their due date and, at
   * J-7 / J-3 / J-0, (a) send a PAYMENT_REMINDER to the customer on every channel
   * they opted into and (b) create a seller follow-up task (SellerTask, type
   * DEBT_REMINDER) so a human can also chase the payment.
   *
   * Eligibility: non-deleted shop with payment_reminders_enabled=true AND notifications module allowed.
   * Receivable selection: status IN (PENDING, PARTIAL), balance > 0, deleted=false, due_date != null.
   * A receivable is processed only when its whole-day distance to the due date is exactly 7, 3 or 0.
   *
   * Anti-duplicate:
   *  - reminder dispatch dedup_key `reminder:{receivable_id}:{offset}` (per channel, enforced by the dispatcher);
   *  - seller task dedup_key `task:{receivable_id}:{offset}` (skipped if a task with that key already exists).
   *
   * Robustness: each receivable is wrapped in try/catch; a failure is logged and the
   * scan continues — the loop never throws.
   */
  async scanPaymentRemindersForAllShops(): Promise<PaymentReminderScanResult> {
    const shops = await this.prisma.shop.findMany({
      where: { deleted: false, payment_reminders_enabled: true },
      select: {
        id: true,
        name: true,
        enabled_modules: true,
      },
    });

    let remindersSent = 0;
    let tasksCreated = 0;
    let skipped = 0;
    const now = new Date();

    for (const shop of shops) {
      if (!this.notificationsAllowed(shop.enabled_modules)) {
        continue;
      }

      const receivables = await this.prisma.clientReceivable.findMany({
        where: {
          shop_id: shop.id,
          deleted: false,
          status: { in: ['PENDING', 'PARTIAL'] },
          balance: { gt: 0 },
          due_date: { not: null },
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              first_name: true,
              email: true,
              phone: true,
              email_notifications_enabled: true,
              sms_notifications_enabled: true,
              whatsapp_notifications_enabled: true,
            },
          },
        },
      });

      for (const receivable of receivables) {
        try {
          if (!receivable.due_date) {
            continue;
          }

          const offset = this.daysUntilDue(receivable.due_date, now);
          if (
            !PAYMENT_REMINDER_OFFSETS.includes(offset as (typeof PAYMENT_REMINDER_OFFSETS)[number])
          ) {
            continue;
          }

          const customer = receivable.customer;
          const customerName = customer.first_name
            ? `${customer.first_name} ${customer.name}`
            : customer.name;
          const dueDate = receivable.due_date;
          const dueLabel = this.formatDate(dueDate);

          // (a) Customer reminder, on each opted-in channel.
          const channels = this.dispatcher.resolveCustomerChannels(customer);
          const reminderBody =
            offset === 0
              ? `Rappel : votre dette de ${this.formatAmount(receivable.balance)} FCFA arrive à échéance aujourd'hui (${dueLabel}).`
              : `Rappel : votre dette de ${this.formatAmount(receivable.balance)} FCFA est à régler avant le ${dueLabel} (dans ${String(offset)} jours).`;

          if (channels.length === 0) {
            await this.prisma.notificationLog.create({
              data: {
                shop_id: shop.id,
                type: NotificationType.PAYMENT_REMINDER,
                channel: NotificationChannel.EMAIL,
                target_type: 'receivable',
                target_id: receivable.id,
                recipient: customer.email ?? '',
                status: NotificationStatus.SKIPPED,
                error: 'No opted-in notification channel for customer',
                dedup_key: `reminder:${receivable.id}:${String(offset)}`,
              },
            });
            skipped++;
          } else {
            for (const { channel, recipient } of channels) {
              const outcome = await this.dispatcher.dispatch({
                shopId: shop.id,
                type: NotificationType.PAYMENT_REMINDER,
                channel,
                recipient,
                subject: `Rappel de paiement - ${shop.name}`,
                body: reminderBody,
                targetType: 'receivable',
                targetId: receivable.id,
                dedupKey: `reminder:${receivable.id}:${String(offset)}`,
              });
              if (outcome === 'SENT' || outcome === 'QUEUED') {
                remindersSent++;
              } else if (outcome === 'SKIPPED') {
                skipped++;
              }
            }
          }

          // (b) Seller follow-up task (anti-duplicate via dedup_key).
          const taskDedupKey = `task:${receivable.id}:${String(offset)}`;
          const existingTask = await this.prisma.sellerTask.findFirst({
            where: { dedup_key: taskDedupKey },
            select: { id: true },
          });
          if (!existingTask) {
            await this.prisma.sellerTask.create({
              data: {
                shop_id: shop.id,
                type: SellerTaskType.DEBT_REMINDER,
                customer_id: customer.id,
                receivable_id: receivable.id,
                title: `Relancer ${customerName} — échéance ${dueLabel}`,
                message:
                  offset === 0
                    ? `Dette de ${this.formatAmount(receivable.balance)} FCFA à échéance aujourd'hui.`
                    : `Dette de ${this.formatAmount(receivable.balance)} FCFA, échéance dans ${String(offset)} jours.`,
                due_date: dueDate,
                status: SellerTaskStatus.PENDING,
                dedup_key: taskDedupKey,
              },
            });
            tasksCreated++;
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Payment reminder failed for receivable ${receivable.id}: ${message}`);
        }
      }
    }

    this.logger.log(
      `Payment reminders scan complete: ${String(remindersSent)} sent, ${String(tasksCreated)} tasks, ${String(skipped)} skipped across ${String(shops.length)} shops`
    );
    return {
      shops_processed: shops.length,
      reminders_sent: remindersSent,
      tasks_created: tasksCreated,
      skipped,
    };
  }
}
