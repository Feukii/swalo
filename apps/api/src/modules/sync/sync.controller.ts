import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SyncService } from './sync.service';
import { SyncPullDto } from './dto/sync-pull.dto';
import { SyncPushDto } from './dto/sync-push.dto';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * POST /api/sync/pull
   * Pull changes from server since last sync
   */
  @Post('pull')
  async pull(@CurrentUser() user: any, @Body() dto: SyncPullDto) {
    return this.syncService.pull(user.shopId, dto);
  }

  /**
   * POST /api/sync/push
   * Push local mutations to server
   */
  @Post('push')
  async push(@CurrentUser() user: any, @Body() dto: SyncPushDto) {
    return this.syncService.push(user.shopId, user.userId, dto);
  }

  /**
   * GET /api/sync/status?device_id=xxx
   * Get sync status for a device
   */
  @Get('status')
  async status(@Query('device_id') deviceId: string) {
    return this.syncService.getDeviceStatus(deviceId);
  }
}
