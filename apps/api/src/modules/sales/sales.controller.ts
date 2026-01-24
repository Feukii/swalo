import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SearchSaleDto } from './dto/search-sale.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  findAll(@CurrentUser() user: any, @Query() query: SearchSaleDto) {
    return this.salesService.findAll(user.shopId, query);
  }

  @Get('stats')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  getStats(@CurrentUser() user: any) {
    return this.salesService.getStats(user.shopId);
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.salesService.findOne(user.shopId, id);
  }

  @Post()
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  create(@CurrentUser() user: any, @Body() createSaleDto: CreateSaleDto) {
    return this.salesService.create(user.shopId, user.sub, createSaleDto);
  }

  @Put(':id/cancel')
  @Roles(Role.OWNER, Role.MANAGER)
  cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.salesService.cancel(user.shopId, id);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.salesService.remove(user.shopId, id);
  }
}
