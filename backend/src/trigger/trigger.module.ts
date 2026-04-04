import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TriggerController } from './trigger.controller';
import { TriggerService } from './trigger.service';
import { ClaimsModule } from '../claims/claims.module';

@Module({
  imports: [
    HttpModule,
    forwardRef(() => ClaimsModule),
  ],
  controllers: [TriggerController],
  providers: [TriggerService],
  exports: [TriggerService],
})
export class TriggerModule {}
