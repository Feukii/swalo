import { Controller, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { EnterpriseService } from './enterprise.service';
import { UpdateEnterpriseDto } from './dto/create-enterprise.dto';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@Controller('enterprises')
@RequireModule('enterprise')
export class EnterpriseController {
  constructor(private readonly enterpriseService: EnterpriseService) {}

  @Get()
  @Roles(Role.BOSS, Role.SUPERADMIN)
  findAll(@CurrentUser() user: any) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.findAll(user.userId, isSuperAdmin);
  }

  @Get(':id')
  @Roles(Role.BOSS, Role.SUPERADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.findOne(id, user.userId, isSuperAdmin);
  }

  @Put(':id')
  @Roles(Role.BOSS, Role.SUPERADMIN)
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateEnterpriseDto) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.update(id, user.userId, isSuperAdmin, dto);
  }

  @Delete(':id')
  @Roles(Role.BOSS, Role.SUPERADMIN)
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.delete(id, user.userId, isSuperAdmin);
  }

  @Get(':id/shops')
  @Roles(Role.BOSS, Role.MANAGER, Role.SUPERADMIN)
  getShops(@Param('id') id: string, @CurrentUser() user: any) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.getShops(id, user.userId, isSuperAdmin);
  }

  @Get(':id/stats')
  @Roles(Role.BOSS, Role.SUPERADMIN)
  getStats(@Param('id') id: string, @CurrentUser() user: any) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.getStats(id, user.userId, isSuperAdmin);
  }
}
