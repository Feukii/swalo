import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /api/reports/sales
   * Rapport des ventes avec filtrage par date
   */
  @Get('sales')
  @Roles(Role.BOSS, Role.MANAGER)
  getSalesReport(
    @CurrentUser() user: any,
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
  getStockReport(@CurrentUser() user: any) {
    return this.reportsService.getStockReport(user.shopId);
  }

  /**
   * GET /api/reports/cash
   * Rapport de tresorerie avec filtrage par date
   */
  @Get('cash')
  @Roles(Role.BOSS, Role.MANAGER)
  getCashReport(
    @CurrentUser() user: any,
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
    @CurrentUser() user: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string
  ) {
    const filters: { start_date?: string; end_date?: string } = {};
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    return this.reportsService.getOverview(user.shopId, filters);
  }
}
