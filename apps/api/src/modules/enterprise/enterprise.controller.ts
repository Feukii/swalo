import { Controller, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { EnterpriseService } from './enterprise.service';
import { UpdateEnterpriseDto } from './dto/create-enterprise.dto';
import { RequireModule } from '../../common/decorators/require-module.decorator';

interface AuthenticatedUser {
  userId: string;
  shopId: string;
  role: Role;
}

@Controller('enterprises')
@RequireModule('enterprise')
export class EnterpriseController {
  constructor(private readonly enterpriseService: EnterpriseService) {}

  @Get()
  @Roles(Role.BOSS, Role.SUPERADMIN)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.findAll(user.userId, isSuperAdmin);
  }

  @Get(':id')
  @Roles(Role.BOSS, Role.SUPERADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.findOne(id, user.userId, isSuperAdmin);
  }

  @Put(':id')
  @Roles(Role.BOSS, Role.SUPERADMIN)
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateEnterpriseDto
  ) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.update(id, user.userId, isSuperAdmin, dto);
  }

  @Delete(':id')
  @Roles(Role.BOSS, Role.SUPERADMIN)
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.delete(id, user.userId, isSuperAdmin);
  }

  @Get(':id/shops')
  @Roles(Role.BOSS, Role.MANAGER, Role.SUPERADMIN)
  getShops(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.getShops(id, user.userId, isSuperAdmin);
  }

  @Get(':id/stats')
  @Roles(Role.BOSS, Role.SUPERADMIN)
  getStats(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.getStats(id, user.userId, isSuperAdmin);
  }

  /**
   * Recapitulatif financier consolide (PDG) : rollup entreprise + sante par boutique.
   *
   * GOTCHA (entitlement): `@RequireModule('enterprise')` (au niveau du controleur) verifie
   * le module de la boutique ACTIVE du JWT, pas l'entreprise. Un PDG dont la boutique courante
   * n'a pas le module `enterprise` pourrait etre bloque (403) de son propre tableau de bord.
   * Comportement laisse inchange ici (a trancher cote produit). Voir enterprise.service.ts.
   */
  @Get(':id/financial-summary')
  @Roles(Role.BOSS, Role.SUPERADMIN)
  getFinancialSummary(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string
  ) {
    const isSuperAdmin = user.role === Role.SUPERADMIN;
    return this.enterpriseService.getFinancialSummary(id, user.userId, isSuperAdmin, {
      start_date: startDate,
      end_date: endDate,
    });
  }
}
