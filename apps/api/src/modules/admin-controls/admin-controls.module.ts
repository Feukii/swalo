import { Module } from '@nestjs/common';
import { AdminControlsController } from './admin-controls.controller';
import { AdminControlsService } from './admin-controls.service';
import { AdminControlsScheduler } from './admin-controls.scheduler';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminControlsController],
  providers: [AdminControlsService, AdminControlsScheduler],
  exports: [AdminControlsService],
})
export class AdminControlsModule {}
