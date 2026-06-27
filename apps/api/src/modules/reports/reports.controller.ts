import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
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
  @Roles(Role.BOSS)
  acknowledgeAlert(@CurrentUser() user: AuthenticatedUser, @Body() dto: AcknowledgeAlertDto) {
    return this.reportsService.acknowledgeAlert(user.shopId, dto.alert_id, user.userId, dto.note);
  }
}
