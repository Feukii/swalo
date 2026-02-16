import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SearchSaleDto } from './dto/search-sale.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  findAll(@CurrentUser() user: any, @Query() query: SearchSaleDto) {
    return this.salesService.findAll(user.shopId, query);
  }

  @Get('stats')
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  getStats(@CurrentUser() user: any) {
    return this.salesService.getStats(user.shopId);
  }

  @Get(':id')
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.salesService.findOne(user.shopId, id);
  }

  @Post()
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  create(@CurrentUser() user: any, @Body() createSaleDto: CreateSaleDto) {
    return this.salesService.create(user.shopId, user.userId, createSaleDto);
  }

  @Put(':id/cancel')
  @Roles(Role.BOSS, Role.MANAGER)
  cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.salesService.cancel(user.shopId, id);
  }

  @Delete(':id')
  @Roles(Role.BOSS, Role.MANAGER)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.salesService.remove(user.shopId, id);
  }
}
