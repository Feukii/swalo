import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============================================
  // SUPER ADMIN ENDPOINTS
  // ============================================

  /**
   * Get all shops in the system (SUPERADMIN only)
   */
  @Get('shops')
  @Roles(Role.SUPERADMIN)
  async getAllShops() {
    return this.adminService.getAllShops();
  }

  /**
   * Get shop details with all users (SUPERADMIN only)
   */
  @Get('shops/:shopId')
  @Roles(Role.SUPERADMIN)
  async getShopDetails(@Param('shopId') shopId: string) {
    return this.adminService.getShopDetails(shopId);
  }

  /**
   * Get system statistics (SUPERADMIN only)
   */
  @Get('stats/system')
  @Roles(Role.SUPERADMIN)
  async getSystemStats() {
    return this.adminService.getSystemStats();
  }

  /**
   * Delete shop (SUPERADMIN only)
   */
  @Delete('shops/:shopId')
  @Roles(Role.SUPERADMIN)
  async deleteShop(@Param('shopId') shopId: string, @Request() req: any) {
    const deletedBy = req.user.sub;
    return this.adminService.deleteShop(shopId, deletedBy);
  }

  // ============================================
  // SHOP OWNER / ADMIN ENDPOINTS
  // ============================================

  /**
   * Get all users in current shop (ADMIN or SUPERADMIN)
   */
  @Get('users')
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.OWNER, Role.MANAGER)
  async getShopUsers(@Request() req: any) {
    const shopId = req.user.shopId;
    return this.adminService.getShopUsers(shopId);
  }

  /**
   * Get user devices (ADMIN or SUPERADMIN)
   */
  @Get('users/:userId/devices')
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.OWNER, Role.MANAGER)
  async getUserDevices(@Param('userId') userId: string, @Request() req: any) {
    const shopId = req.user.shopId;
    return this.adminService.getUserDevices(userId, shopId);
  }

  /**
   * Revoke specific device access (ADMIN or SUPERADMIN)
   */
  @Delete('devices/:deviceId')
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.OWNER, Role.MANAGER)
  async revokeDeviceAccess(@Param('deviceId') deviceId: string, @Request() req: any) {
    const shopId = req.user.shopId;
    const revokedBy = req.user.sub;
    return this.adminService.revokeDeviceAccess(deviceId, shopId, revokedBy);
  }

  /**
   * Revoke all user devices except current (ADMIN or SUPERADMIN)
   */
  @Post('users/:userId/revoke-devices')
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.OWNER, Role.MANAGER)
  async revokeAllUserDevices(
    @Param('userId') userId: string,
    @Body('currentDeviceId') currentDeviceId: string,
    @Request() req: any
  ) {
    const shopId = req.user.shopId;
    const revokedBy = req.user.sub;
    return this.adminService.revokeAllUserDevices(userId, shopId, currentDeviceId, revokedBy);
  }

  /**
   * Update user role and work schedule (ADMIN or SUPERADMIN)
   */
  @Put('users/:userId/role')
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.OWNER, Role.MANAGER)
  async updateUserRole(
    @Param('userId') userId: string,
    @Body()
    data: {
      role?: Role;
      work_start_time?: string;
      work_end_time?: string;
      work_days?: string;
    },
    @Request() req: any
  ) {
    const shopId = req.user.shopId;

    // Prevent non-superadmins from creating or modifying superadmins
    if (data.role === Role.SUPERADMIN && req.user.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only superadmins can create or modify superadmin roles');
    }

    return this.adminService.updateUserRole(userId, shopId, data);
  }

  /**
   * Deactivate user access (ADMIN or SUPERADMIN)
   */
  @Delete('users/:userId')
  @Roles(Role.ADMIN, Role.SUPERADMIN, Role.OWNER, Role.MANAGER)
  async deactivateUserAccess(@Param('userId') userId: string, @Request() req: any) {
    const shopId = req.user.shopId;

    // Prevent users from deactivating themselves
    if (userId === req.user.sub) {
      throw new ForbiddenException('You cannot deactivate your own access');
    }

    return this.adminService.deactivateUserAccess(userId, shopId);
  }
}
