import { Controller, Get, Post, Delete, Body, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { PinInvitesService } from './pin-invites.service';
import { CreatePinInviteDto } from './dto/create-pin-invite.dto';

type AuthenticatedRequest = Request & {
  user: { userId: string; shopId: string; role: Role };
};

@Controller('pin-invites')
export class PinInvitesController {
  constructor(private readonly pinInvitesService: PinInvitesService) {}

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreatePinInviteDto) {
    return this.pinInvitesService.create(req.user.userId, req.user.shopId, dto);
  }

  @Get()
  async getAll(
    @Req() req: AuthenticatedRequest,
    @Query('is_used') isUsed?: string,
    @Query('is_expired') isExpired?: string
  ) {
    return this.pinInvitesService.getAll(req.user.shopId, {
      is_used: isUsed === 'true' ? true : isUsed === 'false' ? false : undefined,
      is_expired: isExpired === 'true' ? true : isExpired === 'false' ? false : undefined,
    });
  }

  @Get('stats')
  async getStats(@Req() req: AuthenticatedRequest) {
    return this.pinInvitesService.getStats(req.user.shopId);
  }

  @Get(':id')
  async getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.pinInvitesService.getOne(req.user.shopId, id);
  }

  @Delete(':id')
  async revoke(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.pinInvitesService.revoke(req.user.shopId, id);
  }
}
