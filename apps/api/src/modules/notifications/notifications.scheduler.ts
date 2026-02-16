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

    this.logger.log(`CRON: Starting monthly summaries for ${prevMonth}/${year}`);

    try {
      const result = await this.notificationsService.sendMonthlyForAllShops(year, prevMonth);
      this.logger.log(
        `CRON: Monthly summaries complete - ${result.total_sent} emails sent across ${result.total_shops} shops`
      );
    } catch (error: any) {
      this.logger.error(`CRON: Monthly summaries failed - ${error.message}`, error.stack);
    }
  }
}
