import { Controller, Get, Post, Delete, Put, Body, Param, Query, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { DebtsService } from './debts.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { CreateDebtPaymentDto } from './dto/create-debt-payment.dto';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@Controller('debts')
@RequireModule('debts')
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Post()
  @Roles(Role.BOSS, Role.MANAGER)
  async create(@Req() req: any, @Body() dto: CreateDebtDto) {
    return this.debtsService.create(req.user.shopId, dto);
  }

  @Get()
  async getAll(
    @Req() req: any,
    @Query('supplier_id') supplierId?: string,
    @Query('status') status?: 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED'
  ) {
    return this.debtsService.getAll(req.user.shopId, {
      supplier_id: supplierId,
      status,
    });
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    return this.debtsService.getStats(req.user.shopId);
  }

  @Get(':id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    return this.debtsService.getOne(req.user.shopId, id);
  }

  @Post(':id/payments')
  async addPayment(@Req() req: any, @Param('id') id: string, @Body() dto: CreateDebtPaymentDto) {
    return this.debtsService.addPayment(req.user.shopId, id, dto);
  }

  @Put(':id/cancel')
  @Roles(Role.BOSS, Role.MANAGER)
  async cancel(@Req() req: any, @Param('id') id: string) {
    return this.debtsService.cancel(req.user.shopId, id);
  }

  @Delete(':id')
  @Roles(Role.BOSS, Role.MANAGER)
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.debtsService.delete(req.user.shopId, id);
  }
}
