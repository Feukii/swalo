import { Controller, Post, Get, Param, Body, Query, Request } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminControlsService } from './admin-controls.service';
import { BlockEntityDto } from './dto/block-entity.dto';

@Controller('admin')
@Roles('SUPERADMIN')
export class AdminControlsController {
  constructor(private readonly adminControlsService: AdminControlsService) {}

  // ==================== SHOP BLOCKING ====================

  @Post('shops/:id/block')
  async blockShop(@Param('id') id: string, @Body() dto: BlockEntityDto, @Request() req: any) {
    return this.adminControlsService.blockShop(id, req.user.userId, dto.reason);
  }

  @Post('shops/:id/unblock')
  async unblockShop(@Param('id') id: string, @Request() req: any) {
    return this.adminControlsService.unblockShop(id, req.user.userId);
  }

  // ==================== USER BLOCKING ====================

  @Post('users/:id/block')
  async blockUser(@Param('id') id: string, @Body() dto: BlockEntityDto, @Request() req: any) {
    return this.adminControlsService.blockUser(id, req.user.userId, dto.reason);
  }

  @Post('users/:id/unblock')
  async unblockUser(@Param('id') id: string, @Request() req: any) {
    return this.adminControlsService.unblockUser(id, req.user.userId);
  }

  // ==================== ENTERPRISE BLOCKING ====================

  @Post('enterprises/:id/block')
  async blockEnterprise(@Param('id') id: string, @Body() dto: BlockEntityDto, @Request() req: any) {
    return this.adminControlsService.blockEnterprise(id, req.user.userId, dto.reason);
  }

  @Post('enterprises/:id/unblock')
  async unblockEnterprise(@Param('id') id: string, @Request() req: any) {
    return this.adminControlsService.unblockEnterprise(id, req.user.userId);
  }

  // ==================== AUDIT LOGS ====================

  @Get('audit-logs')
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('entity_type') entity_type?: string,
    @Query('admin_id') admin_id?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.adminControlsService.getAuditLogs({
      action,
      entity_type,
      admin_id,
      start_date,
      end_date,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ==================== SYSTEM STATS ====================

  @Get('system/stats')
  async getEnhancedSystemStats() {
    return this.adminControlsService.getEnhancedSystemStats();
  }

  // ==================== MODULE MANAGEMENT ====================

  @Get('shops/:id/modules')
  async getShopModules(@Param('id') id: string) {
    return this.adminControlsService.getShopModules(id);
  }

  @Post('shops/:id/modules')
  async updateShopModules(
    @Param('id') id: string,
    @Body() body: { modules: string[] },
    @Request() req: any
  ) {
    return this.adminControlsService.updateShopModules(id, req.user.userId, body.modules);
  }
}
