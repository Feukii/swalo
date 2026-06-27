import { Controller, Get, Post, Delete, Body, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CashService } from './cash.service';
import { CreateCashEntryDto } from './dto/create-cash-entry.dto';
import { CreateMerchandisePurchaseDto } from './dto/create-merchandise-purchase.dto';
import { RequireModule } from '../../common/decorators/require-module.decorator';

type AuthenticatedRequest = Request & {
  user: { userId: string; shopId: string; role: Role };
};

@Controller('cash')
@RequireModule('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Post('entries')
  async createEntry(@Req() req: AuthenticatedRequest, @Body() dto: CreateCashEntryDto) {
    return this.cashService.createEntry(req.user.userId, req.user.shopId, req.user.role, dto);
  }

  /**
   * POST /api/cash/merchandise-purchase
   * Enregistrer un achat de marchandise auprès d'un fournisseur
   */
  @Post('merchandise-purchase')
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  async createMerchandisePurchase(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateMerchandisePurchaseDto
  ) {
    return this.cashService.createMerchandisePurchase(req.user.userId, req.user.shopId, dto);
  }

  @Get('entries')
  async getAll(
    @Req() req: AuthenticatedRequest,
    @Query('type') type?: 'IN' | 'OUT' | 'OPENING' | 'CLOSING',
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string
  ) {
    return this.cashService.getAll(req.user.shopId, { type, start_date, end_date });
  }

  @Get('entries/:id')
  async getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.cashService.getOne(req.user.shopId, id);
  }

  @Get('balance')
  async getBalance(@Req() req: AuthenticatedRequest) {
    return this.cashService.getBalance(req.user.shopId);
  }

  @Get('stats')
  async getStats(
    @Req() req: AuthenticatedRequest,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string
  ) {
    return this.cashService.getStats(req.user.shopId, { start_date, end_date });
  }

  @Delete('entries/:id')
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.cashService.delete(req.user.shopId, id);
  }
}
