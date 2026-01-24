import { Module } from '@nestjs/common';
import { PackagingTypesController } from './packaging-types.controller';
import { PackagingTypesService } from './packaging-types.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PackagingTypesController],
  providers: [PackagingTypesService],
  exports: [PackagingTypesService],
})
export class PackagingTypesModule {}
