import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { IsInt, Min, Max } from 'class-validator';

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
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Manually trigger monthly summary emails for all shops
   * Restricted to SUPERADMIN and OWNER roles
   */
  @Post('monthly-summary/trigger')
  @Roles(Role.SUPERADMIN, Role.OWNER)
  async triggerMonthlySummary(@Body() dto: TriggerMonthlyDto) {
    this.logger.log(`Manual trigger: monthly summaries for ${dto.month}/${dto.year}`);
    const result = await this.notificationsService.sendMonthlyForAllShops(dto.year, dto.month);
    return {
      message: `Recapitulatifs mensuels envoyes: ${result.total_sent} emails pour ${result.total_shops} boutiques`,
      ...result,
    };
  }
}
