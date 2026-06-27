import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

class AcknowledgeAlertDto {
  @IsString()
  alert_id!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

interface AuthenticatedUser {
  userId: string;
  shopId: string;
  role: Role;
}

@Controller('reports')
@RequireModule('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /api/reports/network
   * Rapports réseau (multi-boutiques) du propriétaire : performance par boutique.
   */
  @Get('network')
  @Roles(Role.BOSS)
  getNetworkReports(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getNetworkReports(user.shopId);
  }

  /**
   * GET /api/reports/sales
   * Rapport des ventes avec filtrage par date
   */
  @Get('sales')
  @Roles(Role.BOSS, Role.MANAGER)
  getSalesReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string
  ) {
    const filters: { start_date?: string; end_date?: string } = {};
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    return this.reportsService.getSalesReport(user.shopId, filters);
  }

  /**
   * GET /api/reports/stock
   * Rapport du stock
   */
  @Get('stock')
  @Roles(Role.BOSS, Role.MANAGER)
  getStockReport(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getStockReport(user.shopId);
  }

  /**
   * GET /api/reports/cash
   * Rapport de tresorerie avec filtrage par date
   */
  @Get('cash')
  @Roles(Role.BOSS, Role.MANAGER)
  getCashReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string
  ) {
    const filters: { start_date?: string; end_date?: string } = {};
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    return this.reportsService.getCashReport(user.shopId, filters);
  }

  /**
   * GET /api/reports/cash-flow
   * Flux de caisse de la boutique : totaux (période), tendance 7 jours, et
   * répartition des encaissements (catégories IN). Vue business mobile.
   */
  @Get('cash-flow')
  @Roles(Role.BOSS, Role.MANAGER)
  getCashFlow(
    @CurrentUser() user: AuthenticatedUser,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string
  ) {
    const filters: { start_date?: string; end_date?: string } = {};
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    return this.reportsService.getCashFlowReport(user.shopId, filters);
  }

  /**
   * GET /api/reports/top-products
   * Top produits de la boutique par chiffre d'affaires sur la période.
   */
  @Get('top-products')
  @Roles(Role.BOSS, Role.MANAGER)
  getTopProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit?: string
  ) {
    const filters: { start_date?: string; end_date?: string } = {};
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 5;
    const safeLimit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 5;
    return this.reportsService.getTopProducts(user.shopId, filters, safeLimit);
  }

  /**
   * GET /api/reports/overview
   * Vue d'ensemble consolidée (dashboard)
   */
  @Get('overview')
  @Roles(Role.BOSS, Role.MANAGER)
  getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string
  ) {
    const filters: { start_date?: string; end_date?: string } = {};
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    return this.reportsService.getOverview(user.shopId, filters);
  }

  /**
   * GET /api/reports/accounting
   * Comptabilité : bilan + compte de résultat + journal (filtré par période)
   */
  @Get('accounting')
  @RequireModule('accounting')
  @Roles(Role.BOSS, Role.MANAGER)
  getAccountingReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string
  ) {
    const filters: { start_date?: string; end_date?: string } = {};
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    return this.reportsService.getAccountingReport(user.shopId, filters);
  }

  /**
   * GET /api/reports/supervision
   * Supervision : journal des actions anormales (par défaut le jour)
   */
  @Get('supervision')
  @RequireModule('supervision')
  @Roles(Role.BOSS, Role.MANAGER)
  getSupervisionReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string
  ) {
    const filters: { start_date?: string; end_date?: string } = {};
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    return this.reportsService.getSupervisionReport(user.shopId, filters);
  }

  /**
   * POST /api/reports/supervision/ack
   * Acquitter une alerte de supervision (réservé au boss).
   */
  @Post('supervision/ack')
  @RequireModule('supervision')
  @Roles(Role.BOSS)
  acknowledgeAlert(@CurrentUser() user: AuthenticatedUser, @Body() dto: AcknowledgeAlertDto) {
    return this.reportsService.acknowledgeAlert(user.shopId, dto.alert_id, user.userId, dto.note);
  }
}
