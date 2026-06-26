import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { IsBoolean, IsEmail, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

type AuthenticatedRequest = Request & {
  user: { userId: string; shopId: string; role: Role };
};

/**
 * Fixed day offsets (relative to the due date) at which payment reminders are
 * sent. Mirrors PAYMENT_REMINDER_OFFSETS in notifications.service.ts and is
 * exposed read-only so the client can display the reminder schedule.
 */
const PAYMENT_REMINDER_OFFSETS = [7, 3, 0] as const;

/** Body for PUT /shops/me/reminder-settings. All fields optional (partial update). */
export class UpdateReminderSettingsDto {
  @IsOptional()
  @IsBoolean()
  payment_reminders_enabled?: boolean;

  @IsOptional()
  @IsEmail({}, { message: "L'adresse e-mail de notification est invalide" })
  notification_email?: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'La cadence doit etre comprise entre 1 et 90 jours' })
  @Max(90, { message: 'La cadence doit etre comprise entre 1 et 90 jours' })
  payment_reminder_cadence_days?: number;
}

/** Shape returned by both endpoints. */
interface ReminderSettings {
  payment_reminders_enabled: boolean;
  notification_email: string | null;
  payment_reminder_cadence_days: number;
  offsets: readonly number[];
}

/**
 * Per-shop payment-reminder settings, scoped to the authenticated user's shop.
 * Protected by the global JwtAuthGuard; restricted to BOSS / MANAGER via RolesGuard.
 */
@Controller('shops/me/reminder-settings')
export class ShopReminderSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(Role.BOSS, Role.MANAGER)
  async getReminderSettings(@Req() req: AuthenticatedRequest): Promise<ReminderSettings> {
    const shop = await this.prisma.shop.findUniqueOrThrow({
      where: { id: req.user.shopId },
      select: {
        payment_reminders_enabled: true,
        notification_email: true,
        payment_reminder_cadence_days: true,
      },
    });

    return {
      payment_reminders_enabled: shop.payment_reminders_enabled,
      notification_email: shop.notification_email,
      payment_reminder_cadence_days: shop.payment_reminder_cadence_days,
      offsets: PAYMENT_REMINDER_OFFSETS,
    };
  }

  @Put()
  @Roles(Role.BOSS, Role.MANAGER)
  async updateReminderSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateReminderSettingsDto
  ): Promise<ReminderSettings> {
    const shop = await this.prisma.shop.update({
      where: { id: req.user.shopId },
      data: {
        payment_reminders_enabled: dto.payment_reminders_enabled,
        notification_email: dto.notification_email,
        payment_reminder_cadence_days: dto.payment_reminder_cadence_days,
      },
      select: {
        payment_reminders_enabled: true,
        notification_email: true,
        payment_reminder_cadence_days: true,
      },
    });

    return {
      payment_reminders_enabled: shop.payment_reminders_enabled,
      notification_email: shop.notification_email,
      payment_reminder_cadence_days: shop.payment_reminder_cadence_days,
      offsets: PAYMENT_REMINDER_OFFSETS,
    };
  }
}
