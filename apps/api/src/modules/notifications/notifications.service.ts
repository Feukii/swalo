import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { NotificationStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductsService } from '../products/products.service';

/** Module code required for the notifications feature (entitlement gating). */
const NOTIFICATIONS_MODULE = 'notifications';

/** Re-alert window for a persistently-low product: skip if a SENT LOW_STOCK log exists within this window. */
const LOW_STOCK_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Anti-spam: never send more than one reminder per receivable within this window. */
const PAYMENT_REMINDER_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Hard cap on the number of reminders ever sent for a single receivable. */
const PAYMENT_REMINDER_MAX_COUNT = 5;

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
    private readonly products: ProductsService
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
   * Scan every eligible shop for overdue receivables and send individual payment-reminder emails.
   *
   * Eligibility: non-deleted shop with payment_reminders_enabled=true AND notifications module allowed.
   * Receivable selection: status IN (PENDING, PARTIAL), balance > 0, deleted=false, due_date != null AND due_date < now.
   * Recipient: customer.email, gated by customer.email_notifications_enabled.
   *
   * Cadence / anti-spam (dedup_key `payment_reminder:{receivable_id}`):
   *  - never send more than one reminder per receivable within 24h;
   *  - stop after PAYMENT_REMINDER_MAX_COUNT (5) reminders sent for a receivable;
   *  - only re-send if the last SENT PAYMENT_REMINDER for that receivable is older than the shop's
   *    payment_reminder_cadence_days (the 24h floor and the cadence are both enforced; cadence usually dominates).
   *
   * Missing email -> SKIPPED log. Opted-out customer -> SKIPPED log.
   * Failures are caught per receivable (never thrown out of the loop); a FAILED log is written and the scan continues.
   */
  async scanPaymentRemindersForAllShops(): Promise<PaymentReminderScanResult> {
    const shops = await this.prisma.shop.findMany({
      where: { deleted: false, payment_reminders_enabled: true },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        enabled_modules: true,
        payment_reminder_cadence_days: true,
      },
    });

    let remindersSent = 0;
    let skipped = 0;
    const now = new Date();

    for (const shop of shops) {
      if (!this.notificationsAllowed(shop.enabled_modules)) {
        continue;
      }

      const cadenceMs = shop.payment_reminder_cadence_days * 24 * 60 * 60 * 1000;

      const receivables = await this.prisma.clientReceivable.findMany({
        where: {
          shop_id: shop.id,
          deleted: false,
          status: { in: ['PENDING', 'PARTIAL'] },
          balance: { gt: 0 },
          due_date: { not: null, lt: now },
        },
        include: {
          customer: {
            select: {
              name: true,
              first_name: true,
              email: true,
              email_notifications_enabled: true,
            },
          },
        },
      });

      for (const receivable of receivables) {
        const dedupKey = `payment_reminder:${receivable.id}`;
        try {
          const customer = receivable.customer;

          if (!customer.email || !customer.email_notifications_enabled) {
            await this.prisma.notificationLog.create({
              data: {
                shop_id: shop.id,
                type: NotificationType.PAYMENT_REMINDER,
                target_type: 'receivable',
                target_id: receivable.id,
                recipient: customer.email ?? '',
                status: NotificationStatus.SKIPPED,
                error: !customer.email
                  ? 'No customer email'
                  : 'Customer opted out of email notifications',
                dedup_key: dedupKey,
              },
            });
            skipped++;
            continue;
          }

          const sentLogs = await this.prisma.notificationLog.findMany({
            where: {
              shop_id: shop.id,
              type: NotificationType.PAYMENT_REMINDER,
              status: NotificationStatus.SENT,
              dedup_key: dedupKey,
            },
            orderBy: { sent_at: 'desc' },
          });

          // Hard cap on total reminders.
          if (sentLogs.length >= PAYMENT_REMINDER_MAX_COUNT) {
            skipped++;
            continue;
          }

          if (sentLogs.length > 0) {
            const lastSent = sentLogs[0].sent_at;
            const elapsed = now.getTime() - lastSent.getTime();
            // Respect both the 24h floor and the shop cadence.
            if (elapsed < PAYMENT_REMINDER_MIN_INTERVAL_MS || elapsed < cadenceMs) {
              skipped++;
              continue;
            }
          }

          const customerName = customer.first_name
            ? `${customer.first_name} ${customer.name}`
            : customer.name;

          await this.mailer.sendMail({
            to: customer.email,
            subject: `Rappel de paiement - ${shop.name}`,
            template: 'payment-reminder',
            context: {
              customer_name: customerName,
              shop_name: shop.name,
              shop_phone: shop.phone ?? undefined,
              shop_email: shop.email ?? undefined,
              balance: this.formatAmount(receivable.balance),
              due_date: receivable.due_date ? this.formatDate(receivable.due_date) : '',
              description: receivable.description ?? undefined,
            },
          });

          await this.prisma.notificationLog.create({
            data: {
              shop_id: shop.id,
              type: NotificationType.PAYMENT_REMINDER,
              target_type: 'receivable',
              target_id: receivable.id,
              recipient: customer.email,
              status: NotificationStatus.SENT,
              dedup_key: dedupKey,
            },
          });
          remindersSent++;

          this.logger.log(
            `Payment reminder sent to ${customer.email} for receivable ${receivable.id} (shop ${shop.name})`
          );
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Payment reminder failed for receivable ${receivable.id}: ${message}`);
          await this.prisma.notificationLog.create({
            data: {
              shop_id: shop.id,
              type: NotificationType.PAYMENT_REMINDER,
              target_type: 'receivable',
              target_id: receivable.id,
              recipient: receivable.customer.email ?? '',
              status: NotificationStatus.FAILED,
              error: message,
              dedup_key: dedupKey,
            },
          });
        }
      }
    }

    this.logger.log(
      `Payment reminders scan complete: ${String(remindersSent)} sent, ${String(skipped)} skipped across ${String(shops.length)} shops`
    );
    return {
      shops_processed: shops.length,
      reminders_sent: remindersSent,
      skipped,
    };
  }
}
