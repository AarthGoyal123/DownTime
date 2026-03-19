import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FraudService } from '../fraud/fraud.service';
import { TriggerService } from '../trigger/trigger.service';

@Injectable()
export class ClaimService {
  private readonly logger = new Logger(ClaimService.name);

  constructor(
    private prisma: PrismaService,
    private fraudService: FraudService,
    private triggerService: TriggerService,
  ) {}

  /**
   * Get all claims for a worker
   */
  async getWorkerClaims(workerId: string) {
    return this.prisma.claim.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
      include: { payment: true },
    });
  }

  /**
   * Get a single claim by ID
   */
  async getClaimById(id: string) {
    const claim = await this.prisma.claim.findUnique({
      where: { id },
      include: { payment: true, policy: true },
    });
    if (!claim) throw new NotFoundException('Claim not found');
    return claim;
  }

  /**
   * Simulate a trigger for demo purposes (Phase 1 only)
   */
  async simulateTrigger(params: {
    workerId: string;
    triggerType: string;
    hoursLost?: number;
    triggerValue?: number;
  }) {
    const worker = await this.prisma.worker.findUnique({
      where: { id: params.workerId },
    });
    if (!worker) throw new NotFoundException('Worker not found');

    // Get active policy
    const policy = await this.prisma.policy.findFirst({
      where: {
        workerId: params.workerId,
        status: 'ACTIVE',
        weekEndDate: { gte: new Date() },
      },
    });
    if (!policy) throw new NotFoundException('No active policy found');

    // Calculate hours lost (default 3.5 for demo)
    const hoursLost = params.hoursLost ?? 3.5;
    const hourlyIncome = worker.dailyIncome / worker.workingHours;
    const rawPayout = hourlyIncome * hoursLost;

    // Apply caps
    let finalPayout = Math.min(rawPayout, policy.coverageLimit);
    finalPayout = Math.min(finalPayout, policy.remainingLimit);
    finalPayout = Math.round(finalPayout * 100) / 100;

    const now = new Date();
    const triggerStart = new Date(now);
    triggerStart.setHours(triggerStart.getHours() - Math.ceil(hoursLost));

    // Run fraud checks
    const fraudResult = await this.fraudService.runAllChecks({
      workerId: params.workerId,
      triggerType: params.triggerType,
      eventDate: now,
      hoursLost,
      payout: finalPayout,
      coverageLimit: policy.coverageLimit,
    });

    const status = fraudResult.passed ? 'APPROVED' : 'FLAGGED';

    // Create claim
    const claim = await this.prisma.claim.create({
      data: {
        workerId: params.workerId,
        policyId: policy.id,
        triggerType: params.triggerType,
        triggerStart,
        triggerEnd: now,
        hoursLost,
        hourlyIncome,
        rawPayout,
        finalPayout: fraudResult.passed ? finalPayout : 0,
        status,
        fraudFlags: fraudResult.flags,
        eventDate: now,
      },
    });

    // If approved, create payment and update remaining limit
    if (fraudResult.passed && finalPayout > 0) {
      await this.prisma.payment.create({
        data: {
          claimId: claim.id,
          amount: finalPayout,
          method: 'UPI_MOCK',
          transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          status: 'SUCCESS',
        },
      });

      await this.prisma.policy.update({
        where: { id: policy.id },
        data: { remainingLimit: policy.remainingLimit - finalPayout },
      });

      // Update claim to PAID
      await this.prisma.claim.update({
        where: { id: claim.id },
        data: { status: 'PAID' },
      });
    }

    // Record trigger event
    await this.triggerService.recordTriggerEvent({
      city: worker.city,
      zone: worker.zone,
      triggerType: params.triggerType,
      triggerValue: params.triggerValue ?? (params.triggerType === 'RAIN' ? 25 : params.triggerType === 'AQI' ? 350 : params.triggerType === 'HEAT' ? 44 : 1),
      thresholdValue: params.triggerType === 'RAIN' ? 20 : params.triggerType === 'AQI' ? 300 : params.triggerType === 'HEAT' ? 42 : 1,
      startTime: triggerStart,
      endTime: now,
      dataSource: params.triggerType === 'ZONE_CLOSURE' ? 'MockAPI' : 'OpenWeatherMap',
    });

    return {
      claim: await this.prisma.claim.findUnique({
        where: { id: claim.id },
        include: { payment: true },
      }),
      fraudChecks: fraudResult,
    };
  }
}
