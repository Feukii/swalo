import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SyncService } from './sync.service';
import { SyncPullDto } from './dto/sync-pull.dto';
import { SyncPushDto } from './dto/sync-push.dto';

interface AuthUser {
  userId: string;
  shopId: string;
  role: string;
}

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * POST /api/sync/pull
   * Pull changes from server since last sync
   */
  @Post('pull')
  async pull(@CurrentUser() user: AuthUser, @Body() dto: SyncPullDto) {
    return this.syncService.pull(user.shopId, dto);
  }

  /**
   * POST /api/sync/push
   * Push local mutations to server
   */
  @Post('push')
  async push(@CurrentUser() user: AuthUser, @Body() dto: SyncPushDto) {
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
