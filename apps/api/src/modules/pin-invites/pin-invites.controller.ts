import { Controller, Get, Post, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { PinInvitesService } from './pin-invites.service';
import { CreatePinInviteDto } from './dto/create-pin-invite.dto';

@Controller('pin-invites')
export class PinInvitesController {
  constructor(private readonly pinInvitesService: PinInvitesService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreatePinInviteDto) {
    return this.pinInvitesService.create(req.user.userId, req.user.shopId, dto);
  }

  @Get()
  async getAll(
    @Req() req: any,
    @Query('is_used') isUsed?: string,
    @Query('is_expired') isExpired?: string
  ) {
    return this.pinInvitesService.getAll(req.user.shopId, {
      is_used: isUsed === 'true' ? true : isUsed === 'false' ? false : undefined,
      is_expired: isExpired === 'true' ? true : isExpired === 'false' ? false : undefined,
    });
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    return this.pinInvitesService.getStats(req.user.shopId);
  }

  @Get(':id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    return this.pinInvitesService.getOne(req.user.shopId, id);
  }

  @Delete(':id')
  async revoke(@Req() req: any, @Param('id') id: string) {
    return this.pinInvitesService.revoke(req.user.shopId, id);
  }
}
