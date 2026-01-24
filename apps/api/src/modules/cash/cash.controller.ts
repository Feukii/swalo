import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CashService } from './cash.service';
import { CreateCashEntryDto } from './dto/create-cash-entry.dto';
import { CreateMerchandisePurchaseDto } from './dto/create-merchandise-purchase.dto';

@Controller('cash')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Post('entries')
  async createEntry(@Req() req: any, @Body() dto: CreateCashEntryDto) {
    return this.cashService.createEntry(req.user.userId, req.user.shopId, req.user.role, dto);
  }

  /**
   * POST /api/cash/merchandise-purchase
   * Enregistrer un achat de marchandise auprès d'un fournisseur
   */
  @Post('merchandise-purchase')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  async createMerchandisePurchase(@Req() req: any, @Body() dto: CreateMerchandisePurchaseDto) {
    return this.cashService.createMerchandisePurchase(req.user.userId, req.user.shopId, dto);
  }

  @Get('entries')
  async getAll(
    @Req() req: any,
    @Query('type') type?: 'IN' | 'OUT' | 'OPENING' | 'CLOSING',
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string
  ) {
    return this.cashService.getAll(req.user.shopId, { type, start_date, end_date });
  }

  @Get('entries/:id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    return this.cashService.getOne(req.user.shopId, id);
  }

  @Get('balance')
  async getBalance(@Req() req: any) {
    return this.cashService.getBalance(req.user.shopId);
  }

  @Get('stats')
  async getStats(
    @Req() req: any,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string
  ) {
    return this.cashService.getStats(req.user.shopId, { start_date, end_date });
  }

  @Delete('entries/:id')
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.cashService.delete(req.user.shopId, id);
  }
}
