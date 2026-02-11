import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { PrismaService } from '../../common/prisma/prisma.service';

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
    private readonly prisma: PrismaService
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
            description: rec.description || 'Achat a credit',
            debit: this.formatAmount(rec.amount),
            credit: '',
          });
        }

        // Credits: payments on this receivable during the month
        for (const payment of rec.payments) {
          totalCredits += payment.amount;
          movements.push({
            date: this.formatDate(payment.created_at),
            description: `Paiement - ${rec.description || 'Creance'}`,
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
          description: `Paiement - ${payment.receivable.description || 'Creance anterieure'}`,
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
          `No movements for customer ${customer.name} (${customerId}) in ${month}/${year}`
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
        shop_phone: customer.shop.phone || undefined,
        shop_email: customer.shop.email || undefined,
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
    } catch (error: any) {
      this.logger.error(
        `Failed to send monthly summary to customer ${customerId}: ${error.message}`
      );
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
      `Monthly batch for shop ${shopId}: ${sentCount}/${customers.length} emails sent`
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
      `Monthly summaries complete: ${totalSent} emails sent across ${shops.length} shops`
    );
    return { total_shops: shops.length, total_sent: totalSent };
  }
}
