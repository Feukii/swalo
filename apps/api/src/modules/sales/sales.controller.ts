import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SearchSaleDto } from './dto/search-sale.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

interface AuthUser {
  userId: string;
  shopId: string;
  role: Role;
}

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  findAll(@CurrentUser() user: AuthUser, @Query() query: SearchSaleDto) {
    return this.salesService.findAll(user.shopId, query);
  }

  @Get('stats')
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  getStats(@CurrentUser() user: AuthUser) {
    return this.salesService.getStats(user.shopId);
  }

  @Get(':id')
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salesService.findOne(user.shopId, id);
  }

  @Post()
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  create(@CurrentUser() user: AuthUser, @Body() createSaleDto: CreateSaleDto) {
    return this.salesService.create(user.shopId, user.userId, createSaleDto);
  }

  @Put(':id/cancel')
  @Roles(Role.BOSS, Role.MANAGER)
  @RequireCapability('sales', 'refund')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salesService.cancel(user.shopId, id);
  }

  @Delete(':id')
  @Roles(Role.BOSS, Role.MANAGER)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salesService.remove(user.shopId, id);
  }
}
