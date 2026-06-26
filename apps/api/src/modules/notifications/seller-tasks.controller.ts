import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { SellerTasksService } from './seller-tasks.service';

type AuthenticatedRequest = Request & {
  user: { userId: string; shopId: string; role: Role };
};

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

  @Post(':id/done')
  async markDone(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sellerTasksService.markDone(req.user.shopId, id, req.user.userId);
  }
}
