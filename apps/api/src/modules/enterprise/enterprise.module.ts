import { Module } from '@nestjs/common';
import { EnterpriseService } from './enterprise.service';
import { EnterpriseController } from './enterprise.controller';

@Module({
  controllers: [EnterpriseController],
  providers: [EnterpriseService],
  exports: [EnterpriseService],
})
export class EnterpriseModule {}
