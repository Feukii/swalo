import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ReceivablesService } from './receivables.service';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('receivables')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceivablesController {
  constructor(private readonly receivablesService: ReceivablesService) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER)
  async create(@Req() req: any, @Body() dto: CreateReceivableDto) {
    return this.receivablesService.create(req.user.shopId, dto);
  }

  @Get()
  async getAll(
    @Req() req: any,
    @Query('customer_id') customerId?: string,
    @Query('status') status?: 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED'
  ) {
    return this.receivablesService.getAll(req.user.shopId, {
      customer_id: customerId,
      status,
    });
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    return this.receivablesService.getStats(req.user.shopId);
  }

  @Get(':id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    return this.receivablesService.getOne(req.user.shopId, id);
  }

  @Post(':id/payments')
  async addPayment(@Req() req: any, @Param('id') id: string, @Body() dto: CreatePaymentDto) {
    return this.receivablesService.addPayment(req.user.shopId, id, dto);
  }

  @Put(':id/cancel')
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER)
  async cancel(@Req() req: any, @Param('id') id: string) {
    return this.receivablesService.cancel(req.user.shopId, id);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.receivablesService.delete(req.user.shopId, id);
  }
}
