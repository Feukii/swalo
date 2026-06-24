import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { AdminService } from './admin.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CreateEnterpriseDto } from './dto/create-enterprise.dto';
import { UpdateEnterpriseDto } from './dto/update-enterprise.dto';
import { CreateShopAdminDto } from './dto/create-shop-admin.dto';
import { UpdateLicenseDto } from './dto/update-license.dto';
import { UpdateSystemConfigDto } from './dto/system-config.dto';

type AuthenticatedRequest = ExpressRequest & {
  user: { userId: string; shopId: string; role: Role };
};

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============================================
  // ENTERPRISE CRUD (SUPERADMIN only)
  // ============================================

  @Post('enterprises')
  @Roles(Role.SUPERADMIN)
  async createEnterprise(@Body() dto: CreateEnterpriseDto, @Request() req: AuthenticatedRequest) {
    return this.adminService.createEnterprise(req.user.userId, dto);
  }

  @Get('enterprises')
  @Roles(Role.SUPERADMIN)
  async getAllEnterprises() {
    return this.adminService.getAllEnterprises();
  }

  @Get('enterprises/:id')
  @Roles(Role.SUPERADMIN)
  async getEnterpriseDetails(@Param('id') id: string) {
    return this.adminService.getEnterpriseDetails(id);
  }

  @Put('enterprises/:id')
  @Roles(Role.SUPERADMIN)
  async updateEnterprise(
    @Param('id') id: string,
    @Body() dto: UpdateEnterpriseDto,
    @Request() req: AuthenticatedRequest
  ) {
    return this.adminService.updateEnterprise(id, req.user.userId, dto);
  }

  @Delete('enterprises/:id')
  @Roles(Role.SUPERADMIN)
  async deleteEnterprise(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.adminService.deleteEnterprise(id, req.user.userId);
  }

  // ============================================
  // ENTERPRISE <-> SHOP ASSIGNMENT
  // ============================================

  @Post('enterprises/:id/shops/:shopId')
  @Roles(Role.SUPERADMIN)
  async addShopToEnterprise(
    @Param('id') enterpriseId: string,
    @Param('shopId') shopId: string,
    @Request() req: AuthenticatedRequest
  ) {
    return this.adminService.addShopToEnterprise(enterpriseId, shopId, req.user.userId);
  }

  @Put('shops/:shopId/move-to-enterprise/:enterpriseId')
  @Roles(Role.SUPERADMIN)
  async moveShopToEnterprise(
    @Param('shopId') shopId: string,
    @Param('enterpriseId') enterpriseId: string,
    @Request() req: AuthenticatedRequest
  ) {
    return this.adminService.moveShopToEnterprise(shopId, enterpriseId, req.user.userId);
  }

  // ============================================
  // LICENSE MANAGEMENT
  // ============================================

  @Put('enterprises/:id/license')
  @Roles(Role.SUPERADMIN)
  async updateLicense(
    @Param('id') enterpriseId: string,
    @Body() dto: UpdateLicenseDto,
    @Request() req: AuthenticatedRequest
  ) {
    return this.adminService.updateLicense(enterpriseId, req.user.userId, dto);
  }

  // ============================================
  // LICENSE CONFIG (tier ↔ module mapping)
  // ============================================

  @Get('license-config')
  @Roles(Role.SUPERADMIN)
  async getLicenseConfig() {
    return this.adminService.getLicenseConfig();
  }

  @Put('license-config')
  @Roles(Role.SUPERADMIN)
  async updateLicenseConfig(
    @Body() body: { overrides: { code: string; minimumLicenseTier: string }[] },
    @Request() req: AuthenticatedRequest
  ) {
    return this.adminService.updateLicenseConfig(req.user.userId, body.overrides);
  }

  // ============================================
  // SHOP MANAGEMENT (SUPERADMIN)
  // ============================================

  @Post('shops')
  @Roles(Role.SUPERADMIN)
  async createShop(@Body() dto: CreateShopAdminDto, @Request() req: AuthenticatedRequest) {
    return this.adminService.createShopAdmin(req.user.userId, dto);
  }

  @Get('shops')
  @Roles(Role.SUPERADMIN)
  async getAllShops() {
    return this.adminService.getAllShops();
  }

  @Get('shops/:shopId')
  @Roles(Role.SUPERADMIN)
  async getShopDetails(@Param('shopId') shopId: string) {
    return this.adminService.getShopDetails(shopId);
  }

  @Delete('shops/:shopId')
  @Roles(Role.SUPERADMIN)
  async deleteShop(@Param('shopId') shopId: string, @Request() req: AuthenticatedRequest) {
    return this.adminService.deleteShop(shopId, req.user.userId);
  }

  // ============================================
  // GLOBAL USERS (SUPERADMIN)
  // ============================================

  @Get('users/global')
  @Roles(Role.SUPERADMIN)
  async getGlobalUsers(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.adminService.getGlobalUsers({
      search,
      role,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ============================================
  // SYSTEM STATS (SUPERADMIN)
  // ============================================

  @Get('stats/system')
  @Roles(Role.SUPERADMIN)
  async getSystemStats() {
    return this.adminService.getSystemStats();
  }

  // ============================================
  // SYSTEM CONFIG (SUPERADMIN)
  // ============================================

  @Get('system-config')
  @Roles(Role.SUPERADMIN)
  async getSystemConfigs() {
    return this.adminService.getSystemConfigs();
  }

  @Get('system-config/:key')
  @Roles(Role.SUPERADMIN)
  async getSystemConfig(@Param('key') key: string) {
    return this.adminService.getSystemConfig(key);
  }

  @Put('system-config/:key')
  @Roles(Role.SUPERADMIN)
  async setSystemConfig(
    @Param('key') key: string,
    @Body() dto: UpdateSystemConfigDto,
    @Request() req: AuthenticatedRequest
  ) {
    return this.adminService.setSystemConfig(key, dto, req.user.userId);
  }

  @Delete('system-config/:key')
  @Roles(Role.SUPERADMIN)
  async deleteSystemConfig(@Param('key') key: string, @Request() req: AuthenticatedRequest) {
    return this.adminService.deleteSystemConfig(key, req.user.userId);
  }

  // ============================================
  // AUDIT LOG EXPORT (SUPERADMIN)
  // ============================================

  @Get('audit-logs/export')
  @Roles(Role.SUPERADMIN)
  async exportAuditLogs(
    @Query('action') action: string,
    @Query('entity_type') entityType: string,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Res() res: Response
  ) {
    const csv = await this.adminService.exportAuditLogs({
      action: action || undefined,
      entity_type: entityType || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    res.send(csv);
  }

  // ============================================
  // SHOP OWNER / ADMIN ENDPOINTS
  // ============================================

  @Get('users')
  @Roles(Role.BOSS, Role.MANAGER, Role.SUPERADMIN)
  async getShopUsers(@Request() req: AuthenticatedRequest) {
    return this.adminService.getShopUsers(req.user.shopId);
  }

  @Get('users/:userId/devices')
  @Roles(Role.BOSS, Role.MANAGER, Role.SUPERADMIN)
  async getUserDevices(@Param('userId') userId: string, @Request() req: AuthenticatedRequest) {
    return this.adminService.getUserDevices(userId, req.user.shopId);
  }

  @Delete('devices/:deviceId')
  @Roles(Role.BOSS, Role.MANAGER, Role.SUPERADMIN)
  async revokeDeviceAccess(
    @Param('deviceId') deviceId: string,
    @Request() req: AuthenticatedRequest
  ) {
    return this.adminService.revokeDeviceAccess(deviceId, req.user.shopId, req.user.userId);
  }

  @Post('users/:userId/revoke-devices')
  @Roles(Role.BOSS, Role.MANAGER, Role.SUPERADMIN)
  async revokeAllUserDevices(
    @Param('userId') userId: string,
    @Body('currentDeviceId') currentDeviceId: string,
    @Request() req: AuthenticatedRequest
  ) {
    return this.adminService.revokeAllUserDevices(
      userId,
      req.user.shopId,
      currentDeviceId,
      req.user.userId
    );
  }

  @Put('users/:userId/role')
  @Roles(Role.BOSS, Role.MANAGER, Role.SUPERADMIN)
  async updateUserRole(
    @Param('userId') userId: string,
    @Body()
    data: {
      role?: Role;
      work_start_time?: string;
      work_end_time?: string;
      work_days?: string;
    },
    @Request() req: AuthenticatedRequest
  ) {
    if (data.role === Role.SUPERADMIN && req.user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only superadmins can create or modify superadmin roles');
    }
    return this.adminService.updateUserRole(userId, req.user.shopId, data);
  }

  @Delete('users/:userId')
  @Roles(Role.BOSS, Role.MANAGER, Role.SUPERADMIN)
  async deactivateUserAccess(
    @Param('userId') userId: string,
    @Request() req: AuthenticatedRequest
  ) {
    if (userId === req.user.userId) {
      throw new ForbiddenException('You cannot deactivate your own access');
    }
    return this.adminService.deactivateUserAccess(userId, req.user.shopId);
  }
}
