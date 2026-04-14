import { Module, forwardRef } from '@nestjs/common';
import { PolicyController } from './policy.controller';
import { PolicyService } from './policy.service';
import { PremiumModule } from '../premium/premium.module';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [PremiumModule, forwardRef(() => StripeModule)],
  controllers: [PolicyController],
  providers: [PolicyService],
  exports: [PolicyService],
})
export class PolicyModule {}
