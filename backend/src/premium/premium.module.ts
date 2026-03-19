import { Module } from '@nestjs/common';
import { PremiumController } from './premium.controller';
import { PremiumService } from './premium.service';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [RiskModule],
  controllers: [PremiumController],
  providers: [PremiumService],
  exports: [PremiumService],
})
export class PremiumModule {}
