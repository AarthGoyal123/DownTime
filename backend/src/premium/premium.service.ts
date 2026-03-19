import { Injectable } from '@nestjs/common';
import { RiskService } from '../risk/risk.service';

const BASE_RATE = 0.025;
const MIN_PREMIUM = 20;
const MAX_PREMIUM = 500;

export interface PremiumCalculation {
  weeklyIncome: number;
  coverageLimit: number;
  weeklyPremium: number;
  riskScore: number;
  riskLabel: string;
  coveragePct: number;
  riskBreakdown: {
    weather_risk: number;
    location_risk: number;
    seasonal_risk: number;
    historical_risk: number;
  };
}

@Injectable()
export class PremiumService {
  constructor(private readonly riskService: RiskService) {}

  async calculatePremium(params: {
    dailyIncome: number;
    city: string;
    zone: string;
    coveragePct: number;
    workingHours?: number;
    date?: string;
  }): Promise<PremiumCalculation> {
    // Get risk score from AI service
    const risk = await this.riskService.calculateRisk({
      city: params.city,
      zone: params.zone,
      dailyIncome: params.dailyIncome,
      workingHours: params.workingHours ?? 8,
      date: params.date,
    });

    const weeklyIncome = params.dailyIncome * 7;
    const coverageLimit = weeklyIncome * params.coveragePct;

    // Premium formula: coverage_limit × risk_score × base_rate
    let weeklyPremium = coverageLimit * risk.risk_score * BASE_RATE;

    // Enforce bounds: ₹20 – ₹500
    weeklyPremium = Math.max(MIN_PREMIUM, Math.min(MAX_PREMIUM, weeklyPremium));
    weeklyPremium = Math.round(weeklyPremium * 100) / 100;

    return {
      weeklyIncome,
      coverageLimit,
      weeklyPremium,
      riskScore: risk.risk_score,
      riskLabel: risk.risk_label,
      coveragePct: params.coveragePct,
      riskBreakdown: {
        weather_risk: risk.weather_risk,
        location_risk: risk.location_risk,
        seasonal_risk: risk.seasonal_risk,
        historical_risk: risk.historical_risk,
      },
    };
  }

  async calculateAllTiers(params: {
    dailyIncome: number;
    city: string;
    zone: string;
    workingHours?: number;
    date?: string;
  }) {
    const tiers = [
      { name: 'Basic', coveragePct: 0.5 },
      { name: 'Standard', coveragePct: 0.7 },
      { name: 'Premium', coveragePct: 0.9 },
    ];

    const results = await Promise.all(
      tiers.map(async (tier) => ({
        tierName: tier.name,
        ...(await this.calculatePremium({
          ...params,
          coveragePct: tier.coveragePct,
        })),
      })),
    );

    return results;
  }
}
