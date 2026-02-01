import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, ShopType } from '@prisma/client';
import { EnterpriseService } from './enterprise.service';
import {
  CreateEnterpriseDto,
  UpdateEnterpriseDto,
  AddShopToEnterpriseDto,
} from './dto/create-enterprise.dto';

@Controller('enterprises')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnterpriseController {
  constructor(private readonly enterpriseService: EnterpriseService) {}

  @Post()
  @Roles(Role.OWNER, Role.SUPERADMIN)
  create(@CurrentUser() user: any, @Body() dto: CreateEnterpriseDto) {
    return this.enterpriseService.create(user.userId, dto);
  }

  @Get()
  @Roles(Role.OWNER, Role.SUPERADMIN)
  findAll(@CurrentUser() user: any) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.findAll(user.userId, isSuperAdmin);
  }

  @Get(':id')
  @Roles(Role.OWNER, Role.SUPERADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.findOne(id, user.userId, isSuperAdmin);
  }

  @Put(':id')
  @Roles(Role.OWNER, Role.SUPERADMIN)
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateEnterpriseDto) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.update(id, user.userId, isSuperAdmin, dto);
  }

  @Delete(':id')
  @Roles(Role.OWNER, Role.SUPERADMIN)
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.delete(id, user.userId, isSuperAdmin);
  }

  @Post(':id/shops')
  @Roles(Role.OWNER, Role.SUPERADMIN)
  addShop(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: AddShopToEnterpriseDto) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.addShop(
      id,
      dto.shop_id,
      user.userId,
      isSuperAdmin,
      dto.shop_type as ShopType | undefined
    );
  }

  @Delete(':id/shops/:shopId')
  @Roles(Role.OWNER, Role.SUPERADMIN)
  removeShop(@Param('id') id: string, @Param('shopId') shopId: string, @CurrentUser() user: any) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.removeShop(id, shopId, user.userId, isSuperAdmin);
  }

  @Get(':id/shops')
  @Roles(Role.OWNER, Role.MANAGER, Role.SUPERADMIN)
  getShops(@Param('id') id: string, @CurrentUser() user: any) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.getShops(id, user.userId, isSuperAdmin);
  }

  @Get(':id/stats')
  @Roles(Role.OWNER, Role.SUPERADMIN)
  getStats(@Param('id') id: string, @CurrentUser() user: any) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.getStats(id, user.userId, isSuperAdmin);
  }
}
