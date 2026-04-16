import { Module, forwardRef } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { WebhookController } from './webhook/webhook.controller';
import { PolicyModule } from '../policy/policy.module';

@Module({
  imports: [forwardRef(() => PolicyModule)],
  providers: [StripeService],
  controllers: [WebhookController],
  exports: [StripeService],
})
export class StripeModule {}
