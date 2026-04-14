import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require('stripe');

@Injectable()
export class StripeService {
  private stripeClient: any;
  private readonly logger = new Logger(StripeService.name);

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY') || 'sk_test_placeholder';
    this.stripeClient = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * Create a hosted Checkout Session for a policy premium payment
   */
  async createCheckoutSession(params: {
    workerId: string;
    policyId: string;
    amount: number;
    successUrl: string;
    cancelUrl: string;
  }) {
    try {
      const session = await this.stripeClient.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'inr',
              product_data: {
                name: 'DownTime Weekly Premium',
                description: 'Parametric Income Protection Coverage for Gig Workers',
              },
              unit_amount: Math.round(params.amount * 100), // Stripe expects amounts in paise
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: {
          workerId: params.workerId,
          policyId: params.policyId,
        },
      });

      return { sessionId: session.id, url: session.url };
    } catch (error) {
      this.logger.error(`Error creating Checkout Session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Construct and verify a Stripe webhook event
   */
  constructEvent(payload: Buffer | string, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    return this.stripeClient.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
