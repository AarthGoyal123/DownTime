import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Worker dashboard data
   */
  async getWorkerDashboard(workerId: string) {
    // Get worker info
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
    });

    // Get active policy
    const activePolicy = await this.prisma.policy.findFirst({
      where: {
        workerId,
        status: 'ACTIVE',
        weekEndDate: { gte: new Date() },
      },
    });

    // Get recent claims
    const recentClaims = await this.prisma.claim.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { payment: true },
    });

    // Calculate total protected earnings
    const totalPayouts = recentClaims
      .filter((c) => c.status === 'PAID')
      .reduce((sum, c) => sum + c.finalPayout, 0);

    return {
      worker,
      activePolicy,
      recentClaims,
      stats: {
        totalEarningsProtected: totalPayouts,
        totalClaims: recentClaims.length,
        approvedClaims: recentClaims.filter((c) => ['APPROVED', 'PAID'].includes(c.status)).length,
        flaggedClaims: recentClaims.filter((c) => c.status === 'FLAGGED').length,
      },
    };
  }

  /**
   * Admin/insurer dashboard data
   */
  async getAdminDashboard() {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Total active policies
    const activePolicies = await this.prisma.policy.count({
      where: { status: 'ACTIVE', weekEndDate: { gte: now } },
    });

    // Total premium collected this week
    const weeklyPolicies = await this.prisma.policy.findMany({
      where: { status: 'ACTIVE', createdAt: { gte: weekAgo } },
    });
    const totalPremiumsThisWeek = weeklyPolicies.reduce(
      (sum, p) => sum + p.weeklyPremium,
      0,
    );

    // Total claims paid this week
    const weeklyClaims = await this.prisma.claim.findMany({
      where: {
        status: 'PAID',
        createdAt: { gte: weekAgo },
      },
    });
    const totalPayoutsThisWeek = weeklyClaims.reduce(
      (sum, c) => sum + c.finalPayout,
      0,
    );

    // Loss ratio
    const lossRatio =
      totalPremiumsThisWeek > 0
        ? Math.round((totalPayoutsThisWeek / totalPremiumsThisWeek) * 100 * 100) / 100
        : 0;

    // Active trigger events
    const activeTriggerEvents = await this.prisma.triggerEvent.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // All workers count
    const totalWorkers = await this.prisma.worker.count();

    // Flagged claims
    const flaggedClaims = await this.prisma.claim.count({
      where: { status: 'FLAGGED' },
    });

    return {
      activePolicies,
      totalWorkers,
      totalPremiumsThisWeek: Math.round(totalPremiumsThisWeek * 100) / 100,
      totalPayoutsThisWeek: Math.round(totalPayoutsThisWeek * 100) / 100,
      lossRatio,
      activeTriggerEvents,
      flaggedClaims,
      weeklyClaimsCount: weeklyClaims.length,
    };
  }
}
