import { Controller, Post, Body, Logger } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { IsInt, Min, Max } from 'class-validator';
import { RequireModule } from '../../common/decorators/require-module.decorator';

export class TriggerMonthlyDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}

@Controller('notifications')
@RequireModule('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Manually trigger monthly summary emails for all shops
   * Restricted to SUPERADMIN and OWNER roles
   */
  @Post('monthly-summary/trigger')
  @Roles(Role.SUPERADMIN, Role.BOSS)
  async triggerMonthlySummary(@Body() dto: TriggerMonthlyDto) {
    this.logger.log(
      `Manual trigger: monthly summaries for ${String(dto.month)}/${String(dto.year)}`
    );
    const result = await this.notificationsService.sendMonthlyForAllShops(dto.year, dto.month);
    return {
      message: `Recapitulatifs mensuels envoyes: ${String(result.total_sent)} emails pour ${String(result.total_shops)} boutiques`,
      ...result,
    };
  }

  /**
   * Manually trigger the low-stock alert scan for all eligible shops.
   * Restricted to SUPERADMIN and BOSS roles.
   */
  @Post('low-stock/trigger')
  @Roles(Role.SUPERADMIN, Role.BOSS)
  async triggerLowStock() {
    this.logger.log('Manual trigger: low-stock alerts scan');
    const result = await this.notificationsService.scanLowStockForAllShops();
    return {
      message: `Alertes stock faible: ${String(result.emails_sent)} emails pour ${String(result.products_flagged)} produits sur ${String(result.shops_processed)} boutiques`,
      ...result,
    };
  }

  /**
   * Manually trigger the payment-reminder scan for all eligible shops.
   * Restricted to SUPERADMIN and BOSS roles.
   */
  @Post('payment-reminders/trigger')
  @Roles(Role.SUPERADMIN, Role.BOSS)
  async triggerPaymentReminders() {
    this.logger.log('Manual trigger: payment reminders scan');
    const result = await this.notificationsService.scanPaymentRemindersForAllShops();
    return {
      message: `Rappels de paiement: ${String(result.reminders_sent)} envoyes, ${String(result.skipped)} ignores sur ${String(result.shops_processed)} boutiques`,
      ...result,
    };
  }
}
