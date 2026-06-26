import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NotificationChannel, Role } from '@prisma/client';
import { SellerTasksService } from './seller-tasks.service';

type AuthenticatedRequest = Request & {
  user: { userId: string; shopId: string; role: Role };
};

/** Body for POST /seller-tasks/:id/remind. */
interface RemindDto {
  channel?: NotificationChannel;
}

/**
 * Seller follow-up tasks (debt reminders, ...).
 * Protected by the global JwtAuthGuard; accessible to any authenticated user
 * of the shop (seller / manager / boss) — no extra role restriction.
 */
@Controller('seller-tasks')
export class SellerTasksController {
  constructor(private readonly sellerTasksService: SellerTasksService) {}

  @Get()
  async getPending(@Req() req: AuthenticatedRequest) {
    return this.sellerTasksService.getPending(req.user.shopId);
  }

  @Get('count')
  async count(@Req() req: AuthenticatedRequest) {
    return this.sellerTasksService.countPending(req.user.shopId);
  }

  @Get(':id/preview')
  async preview(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sellerTasksService.preview(req.user.shopId, id);
  }

  @Post(':id/remind')
  async remind(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: RemindDto) {
    return this.sellerTasksService.sendReminder(req.user.shopId, id, body.channel);
  }

  @Post(':id/done')
  async markDone(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sellerTasksService.markDone(req.user.shopId, id, req.user.userId);
  }
}
