import { Module } from '@nestjs/common';
import { ClaimController } from './claims.controller';
import { ClaimService } from './claims.service';
import { TriggerModule } from '../trigger/trigger.module';

@Module({
  imports: [TriggerModule],
  controllers: [ClaimController],
  providers: [ClaimService],
  exports: [ClaimService],
})
export class ClaimsModule {}
