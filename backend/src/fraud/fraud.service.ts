import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Rule 1: GPS / Location Validation
   * Check if worker's location is within 15 km of their declared zone
   */
  validateLocation(
    workerLat: number,
    workerLng: number,
    zoneCenterLat: number,
    zoneCenterLng: number,
  ): { valid: boolean; flag?: string; distance?: number } {
    const distanceKm = this.haversine(workerLat, workerLng, zoneCenterLat, zoneCenterLng);
    if (distanceKm > 15) {
      this.logger.warn(`LOCATION_MISMATCH: distance=${distanceKm.toFixed(2)}km`);
      return { valid: false, flag: 'LOCATION_MISMATCH', distance: distanceKm };
    }
    return { valid: true };
  }

  /**
   * Rule 2: Duplicate Claim Prevention
   * A worker cannot receive two payouts for the same trigger event on the same day
   */
  async checkDuplicateClaim(
    workerId: string,
    triggerType: string,
    eventDate: Date,
  ): Promise<{ valid: boolean; flag?: string }> {
    const startOfDay = new Date(eventDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(eventDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await this.prisma.claim.findFirst({
      where: {
        workerId,
        triggerType,
        eventDate: { gte: startOfDay, lte: endOfDay },
        status: { in: ['APPROVED', 'PAID'] },
      },
    });

    if (existing) {
      this.logger.warn(`DUPLICATE_CLAIM: worker=${workerId}, trigger=${triggerType}`);
      return { valid: false, flag: 'DUPLICATE_CLAIM' };
    }
    return { valid: true };
  }

  /**
   * Rule 3: Anomaly Detection
   * Flag unusual claim patterns
   */
  async checkAnomalies(
    workerId: string,
    hoursLost: number,
    payout: number,
    coverageLimit: number,
  ): Promise<{ valid: boolean; flags: string[] }> {
    const flags: string[] = [];

    // Check 1: hours_lost > 6 hours in a single event
    if (hoursLost > 6) {
      flags.push('EXCESSIVE_HOURS');
    }

    // Check 2: Worker claims payout on more than 4 days in a single week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentClaims = await this.prisma.claim.findMany({
      where: {
        workerId,
        createdAt: { gte: oneWeekAgo },
        status: { in: ['APPROVED', 'PAID'] },
      },
    });
    const uniqueDays = new Set(
      recentClaims.map((c) => c.eventDate.toISOString().split('T')[0]),
    );
    if (uniqueDays.size > 4) {
      flags.push('HIGH_FREQUENCY');
    }

    // Check 3: Payout exceeds 80% of coverage_limit in a single event
    if (payout > coverageLimit * 0.8) {
      flags.push('LARGE_SINGLE_PAYOUT');
    }

    if (flags.length > 0) {
      this.logger.warn(`ANOMALY_FLAGS: worker=${workerId}, flags=${flags.join(',')}`);
    }

    return { valid: flags.length === 0, flags };
  }

  /**
   * Run all fraud checks
   */
  async runAllChecks(params: {
    workerId: string;
    triggerType: string;
    eventDate: Date;
    hoursLost: number;
    payout: number;
    coverageLimit: number;
    workerLat?: number;
    workerLng?: number;
    zoneCenterLat?: number;
    zoneCenterLng?: number;
  }): Promise<{ passed: boolean; flags: string[] }> {
    const allFlags: string[] = [];

    // Rule 1: Location validation (mock coords in Phase 1)
    if (params.workerLat && params.zoneCenterLat) {
      const locResult = this.validateLocation(
        params.workerLat,
        params.workerLng!,
        params.zoneCenterLat,
        params.zoneCenterLng!,
      );
      if (!locResult.valid && locResult.flag) allFlags.push(locResult.flag);
    }

    // Rule 2: Duplicate claim
    const dupResult = await this.checkDuplicateClaim(
      params.workerId,
      params.triggerType,
      params.eventDate,
    );
    if (!dupResult.valid && dupResult.flag) allFlags.push(dupResult.flag);

    // Rule 3: Anomaly detection
    const anomalyResult = await this.checkAnomalies(
      params.workerId,
      params.hoursLost,
      params.payout,
      params.coverageLimit,
    );
    allFlags.push(...anomalyResult.flags);

    return { passed: allFlags.length === 0, flags: allFlags };
  }

  /**
   * Haversine formula for distance between two GPS coordinates
   */
  private haversine(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
