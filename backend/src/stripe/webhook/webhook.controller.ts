import { Controller, Post, Headers, Req, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from '../stripe.service';
import { PolicyService } from '../../policy/policy.service';

@Controller('api/webhooks/stripe')
export class WebhookController {
  constructor(
    private stripeService: StripeService,
    private policyService: PolicyService,
  ) {}

  @Post()
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = (req as any).rawBody || req.body;

    try {
      const event = this.stripeService.constructEvent(rawBody, signature);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const policyId = session.metadata?.policyId;

        if (policyId) {
          await this.policyService.activatePolicy(policyId, session.id);
        }
      }

      return { received: true };
    } catch (err) {
      console.error(`Webhook Error: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }
  }
}
