import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Send monthly summary emails on the 1st of every month at 08:00 UTC
   * Covers the previous month's activity
   */
  @Cron('0 8 1 * *', { name: 'monthly-email-summaries' })
  async handleMonthlySummaries() {
    const now = new Date();
    // Calculate previous month
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // getMonth() is 0-indexed
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    this.logger.log(`CRON: Starting monthly summaries for ${String(prevMonth)}/${String(year)}`);

    try {
      const result = await this.notificationsService.sendMonthlyForAllShops(year, prevMonth);
      this.logger.log(
        `CRON: Monthly summaries complete - ${String(result.total_sent)} emails sent across ${String(result.total_shops)} shops`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`CRON: Monthly summaries failed - ${message}`, stack);
    }
  }

  /**
   * Scan all eligible shops for low-stock products and send digest emails, daily at 07:00 UTC.
   */
  @Cron('0 7 * * *', { name: 'daily-low-stock-alerts' })
  async handleLowStockAlerts() {
    this.logger.log('CRON: Starting low-stock alerts scan');
    try {
      const result = await this.notificationsService.scanLowStockForAllShops();
      this.logger.log(
        `CRON: Low-stock alerts complete - ${String(result.emails_sent)} emails, ${String(result.products_flagged)} products across ${String(result.shops_processed)} shops`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`CRON: Low-stock alerts failed - ${message}`, stack);
    }
  }

  /**
   * Scan all eligible shops for overdue receivables and send payment reminders, daily at 08:00 UTC.
   */
  @Cron('0 8 * * *', { name: 'daily-payment-reminders' })
  async handlePaymentReminders() {
    this.logger.log('CRON: Starting payment reminders scan');
    try {
      const result = await this.notificationsService.scanPaymentRemindersForAllShops();
      this.logger.log(
        `CRON: Payment reminders complete - ${String(result.reminders_sent)} sent, ${String(result.skipped)} skipped across ${String(result.shops_processed)} shops`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`CRON: Payment reminders failed - ${message}`, stack);
    }
  }
}
