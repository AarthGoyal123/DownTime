import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Worker dashboard data — enriched with real-time stats
   */
  async getWorkerDashboard(workerId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
    });

    const activePolicy = await this.prisma.policy.findFirst({
      where: {
        workerId,
        status: 'ACTIVE',
        weekEndDate: { gte: new Date() },
      },
    });

    const recentClaims = await this.prisma.claim.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { payment: true },
    });

    // Stats
    const paidClaims = recentClaims.filter((c) => c.status === 'PAID');
    const totalPayouts = paidClaims.reduce((sum, c) => sum + c.finalPayout, 0);
    
    // Protected days = unique dates with paid claims
    const protectedDays = new Set(
      paidClaims.map((c) => c.eventDate.toISOString().split('T')[0]),
    ).size;

    // Active triggers (last 24h)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const activeTriggers = await this.prisma.triggerEvent.count({
      where: { createdAt: { gte: oneDayAgo }, isActive: true },
    });

    // Coverage utilization
    const coverageUtilization = activePolicy
      ? Math.round(((activePolicy.coverageLimit - activePolicy.remainingLimit) / activePolicy.coverageLimit) * 100)
      : 0;

    // Get latest active trigger event for this worker's zone
    let activeEvent = null;
    if (worker) {
      const latestEvent = await this.prisma.triggerEvent.findFirst({
        where: {
          city: worker.city,
          zone: worker.zone,
          isActive: true,
          createdAt: { gte: oneDayAgo },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (latestEvent) {
        activeEvent = {
          triggerType: latestEvent.triggerType,
          city: latestEvent.city,
          zone: latestEvent.zone,
          startTime: latestEvent.startTime.toISOString(),
          value: latestEvent.triggerValue,
        };
      }
    }

    return {
      worker,
      activePolicy,
      claims: recentClaims,
      activeEvent,
      stats: {
        totalPayouts: Math.round(totalPayouts * 100) / 100,
        protectedDays,
        activeTriggers,
        coverageUtilization,
        totalClaims: recentClaims.length,
        approvedClaims: recentClaims.filter((c) => ['APPROVED', 'PAID'].includes(c.status)).length,
        flaggedClaims: recentClaims.filter((c) => c.status === 'FLAGGED').length,
      },
    };
  }

  /**
   * Admin/insurer dashboard — comprehensive analytics
   */
  async getAdminDashboard() {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      activePoliciesCount,
      totalWorkers,
      weeklyPolicies,
      weeklyClaims,
      flaggedClaimsCount,
      activeTriggerEvents,
      allClaims,
    ] = await Promise.all([
      this.prisma.policy.count({ where: { status: 'ACTIVE', weekEndDate: { gte: now } } }),
      this.prisma.worker.count(),
      this.prisma.policy.findMany({ where: { status: 'ACTIVE', createdAt: { gte: weekAgo } } }),
      this.prisma.claim.findMany({ where: { status: 'PAID', createdAt: { gte: weekAgo } } }),
      this.prisma.claim.count({ where: { status: 'FLAGGED' } }),
      this.prisma.triggerEvent.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.claim.findMany({ where: { createdAt: { gte: weekAgo } }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);

    const totalPremiumsThisWeek = weeklyPolicies.reduce((sum, p) => sum + p.weeklyPremium, 0);
    const totalPayoutsThisWeek = weeklyClaims.reduce((sum, c) => sum + c.finalPayout, 0);
    const lossRatio = totalPremiumsThisWeek > 0
      ? Math.round((totalPayoutsThisWeek / totalPremiumsThisWeek) * 100 * 100) / 100
      : 0;

    // Trigger type distribution
    const triggerDistribution: Record<string, number> = {};
    allClaims.forEach((c) => {
      triggerDistribution[c.triggerType] = (triggerDistribution[c.triggerType] || 0) + 1;
    });

    return {
      activePolicies: activePoliciesCount,
      totalWorkers,
      totalPremiumsThisWeek: Math.round(totalPremiumsThisWeek * 100) / 100,
      totalPayoutsThisWeek: Math.round(totalPayoutsThisWeek * 100) / 100,
      lossRatio,
      activeTriggerEvents,
      flaggedClaims: flaggedClaimsCount,
      weeklyClaimsCount: weeklyClaims.length,
      triggerDistribution,
      profitability: totalPremiumsThisWeek > 0
        ? Math.round((totalPremiumsThisWeek - totalPayoutsThisWeek) * 100) / 100
        : 0,
    };
  }

  /**
   * Fraud detection statistics for admin dashboard
   */
  async getFraudStats() {
    const flaggedClaims = await this.prisma.claim.findMany({
      where: { status: 'FLAGGED' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { worker: true },
    });

    const totalFlagged = await this.prisma.claim.count({ where: { status: 'FLAGGED' } });
    const totalApproved = await this.prisma.claim.count({ where: { status: { in: ['APPROVED', 'PAID'] } } });
    const totalRejected = await this.prisma.claim.count({ where: { status: 'REJECTED' } });

    // Flag distribution
    const flagCounts: Record<string, number> = {};
    flaggedClaims.forEach(c => {
      const flags: string[] = JSON.parse(c.fraudFlags || '[]');
      flags.forEach(flag => {
        flagCounts[flag] = (flagCounts[flag] || 0) + 1;
      });
    });

    return {
      totalFlagged,
      totalApproved,
      totalRejected,
      fraudRate: totalApproved + totalFlagged > 0
        ? Math.round((totalFlagged / (totalApproved + totalFlagged)) * 100 * 100) / 100
        : 0,
      flagDistribution: flagCounts,
      recentFlaggedClaims: flaggedClaims.map(c => ({
        id: c.id,
        workerName: (c.worker as any)?.name || 'Unknown',
        triggerType: c.triggerType,
        amount: c.rawPayout,
        flags: JSON.parse(c.fraudFlags || '[]'),
        date: c.createdAt,
      })),
    };
  }

  /**
   * Trend data for charts (last 14 days)
   */
  async getTrendData() {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const claims = await this.prisma.claim.findMany({
      where: { createdAt: { gte: fourteenDaysAgo } },
      orderBy: { createdAt: 'asc' },
    });

    const policies = await this.prisma.policy.findMany({
      where: { createdAt: { gte: fourteenDaysAgo } },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const dailyData: Record<string, { claims: number; payouts: number; premiums: number; flagged: number }> = {};

    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const key = d.toISOString().split('T')[0];
      dailyData[key] = { claims: 0, payouts: 0, premiums: 0, flagged: 0 };
    }

    claims.forEach(c => {
      const key = c.createdAt.toISOString().split('T')[0];
      if (dailyData[key]) {
        dailyData[key].claims++;
        dailyData[key].payouts += c.finalPayout;
        if (c.status === 'FLAGGED') dailyData[key].flagged++;
      }
    });

    policies.forEach(p => {
      const key = p.createdAt.toISOString().split('T')[0];
      if (dailyData[key]) {
        dailyData[key].premiums += p.weeklyPremium;
      }
    });

    return {
      daily: Object.entries(dailyData).map(([date, data]) => ({
        date,
        ...data,
        payouts: Math.round(data.payouts * 100) / 100,
        premiums: Math.round(data.premiums * 100) / 100,
      })),
    };
  }
}
