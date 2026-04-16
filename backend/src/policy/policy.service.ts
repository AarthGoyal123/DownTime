import { Injectable, NotFoundException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PremiumService } from '../premium/premium.service';
import { Cron } from '@nestjs/schedule';
import { StripeService } from '../stripe/stripe.service';

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(
    private prisma: PrismaService,
    private premiumService: PremiumService,
    @Inject(forwardRef(() => StripeService))
    private stripeService: StripeService,
  ) {}

  async createPolicy(params: { workerId: string; coveragePct: number }) {
    // Fetch worker
    const worker = await this.prisma.worker.findUnique({
      where: { id: params.workerId },
    });
    if (!worker) throw new NotFoundException('Worker not found');

    // Calculate premium
    const premium = await this.premiumService.calculatePremium({
      dailyIncome: worker.dailyIncome,
      city: worker.city,
      zone: worker.zone,
      coveragePct: params.coveragePct,
      workingHours: worker.workingHours,
    });

    // Create policy with week boundaries
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Create policy in PENDING_PAYMENT state
    const policy = await this.prisma.policy.create({
      data: {
        workerId: params.workerId,
        coveragePct: params.coveragePct,
        coverageLimit: premium.coverageLimit,
        weeklyPremium: premium.weeklyPremium,
        riskScore: premium.riskScore,
        status: 'PENDING_PAYMENT',
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        remainingLimit: premium.coverageLimit,
      },
    });

    // Create Stripe Checkout Session
    const session = await this.stripeService.createCheckoutSession({
      workerId: params.workerId,
      policyId: policy.id,
      amount: premium.weeklyPremium,
      successUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/?payment=success&id=${policy.id}`,
      cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/?payment=cancelled`,
    });

    // Update policy with session ID
    await this.prisma.policy.update({
      where: { id: policy.id },
      data: { stripeSessionId: session.sessionId } as any,
    });

    return {
      policy,
      checkoutUrl: session.url,
    };
  }

  async activatePolicy(policyId: string, stripeSessionId: string) {
    this.logger.log(`Activating policy ${policyId} after successful payment.`);
    return this.prisma.policy.update({
      where: { id: policyId },
      data: {
        status: 'ACTIVE',
        stripeSessionId: stripeSessionId,
      } as any,
    });
  }

  async getActivePolicy(workerId: string) {
    const now = new Date();
    // Return ACTIVE or PENDING_PAYMENT — the frontend will handle display differently
    const policy = await this.prisma.policy.findFirst({
      where: {
        workerId,
        status: { in: ['ACTIVE', 'PENDING_PAYMENT'] },
        weekEndDate: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    return policy;
  }

  async activatePolicyBySession(stripeSessionId: string) {
    return this.prisma.policy.updateMany({
      where: { stripeSessionId, status: 'PENDING_PAYMENT' } as any,
      data: { status: 'ACTIVE' },
    });
  }

  async getPolicyById(id: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id },
      include: { claims: true },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    return policy;
  }

  /**
   * Reset remaining_limit every Monday at 00:00 IST for all active policies
   */
  @Cron('0 0 * * 1', { timeZone: 'Asia/Kolkata' })
  async resetWeeklyLimits() {
    this.logger.log('Running weekly policy limit reset...');

    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Reset all active policies
    const result = await this.prisma.policy.updateMany({
      where: { status: 'ACTIVE' },
      data: {
        remainingLimit: undefined, // Will be set per-policy below
        weekStartDate: now,
        weekEndDate: weekEnd,
      },
    });

    // Reset remaining limit to coverage limit for each policy individually
    const activePolicies = await this.prisma.policy.findMany({
      where: { status: 'ACTIVE' },
    });

    for (const policy of activePolicies) {
      await this.prisma.policy.update({
        where: { id: policy.id },
        data: { remainingLimit: policy.coverageLimit },
      });
    }

    this.logger.log(`Reset ${activePolicies.length} policies`);
  }
}
