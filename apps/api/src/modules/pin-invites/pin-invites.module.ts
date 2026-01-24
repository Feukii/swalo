import { Module } from '@nestjs/common';
import { PinInvitesController } from './pin-invites.controller';
import { PinInvitesService } from './pin-invites.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PinInvitesController],
  providers: [PinInvitesService],
  exports: [PinInvitesService],
})
export class PinInvitesModule {}
