import { Injectable } from '@nestjs/common';
import { RiskService } from '../risk/risk.service';

// Actuarial constants
const BASE_RATE = 0.025;
const MIN_PREMIUM = 15;
const MAX_PREMIUM = 600;

// Seasonal adjustment multipliers (month -> multiplier)
const SEASONAL_MULTIPLIER: Record<number, number> = {
  1: 0.85, 2: 0.80, 3: 0.90, 4: 1.00, 5: 1.10,
  6: 1.30, 7: 1.45, 8: 1.40, 9: 1.25, 10: 1.15,
  11: 1.05, 12: 0.90,
};

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
    wind_risk: number;
    humidity_risk: number;
    uv_risk: number;
    visibility_risk: number;
    flood_risk: number;
    cyclone_risk: number;
    time_of_day_risk: number;
  };
  premiumBreakdown: {
    baseComponent: number;
    riskMultiplier: number;
    seasonalAdjustment: number;
    coverageFactor: number;
    noclaimDiscount: number;
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
    experienceDays?: number;
    noClaimStreak?: number;
    totalClaims?: number;
    platform?: string;
  }): Promise<PremiumCalculation> {
    // Get risk score from AI service (heuristic)
    const risk = await this.riskService.calculateRisk({
      city: params.city,
      zone: params.zone,
      dailyIncome: params.dailyIncome,
      workingHours: params.workingHours ?? 8,
      date: params.date,
    });

    const weeklyIncome = params.dailyIncome * 7;
    const coverageLimit = Math.round(weeklyIncome * params.coveragePct);

    // ─── Try ML Model First ───
    let mlPremium: number | null = null;
    let mlModelUsed = false;
    let mlFeatureImportances: Record<string, number> = {};
    let mlModelConfidence = 0;

    try {
      const axios = require('axios');
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const mlResp = await axios.post(`${aiUrl}/ml/predict-premium`, {
        city: params.city,
        zone: params.zone,
        daily_income: params.dailyIncome,
        coverage_pct: params.coveragePct,
        working_hours: params.workingHours ?? 8,
        experience_days: params.experienceDays ?? 30,
        no_claim_streak: params.noClaimStreak ?? 0,
        claims_30d: params.totalClaims ?? 0,
        platform: params.platform ?? 'zomato',
      }, { timeout: 5000 });

      if (mlResp.data?.weekly_premium) {
        mlPremium = mlResp.data.weekly_premium;
        mlModelUsed = true;
        mlFeatureImportances = mlResp.data.feature_importances || {};
        mlModelConfidence = mlResp.data.model_confidence || 0;
      }
    } catch (err) {
      // ML service unavailable, fall back to heuristic
    }

    // ─── Heuristic Premium Calculation (fallback) ───
    const baseComponent = coverageLimit * BASE_RATE;
    const riskMultiplier = 1 + Math.pow(risk.risk_score, 1.5) * 2.5;
    const month = new Date().getMonth() + 1;
    const seasonalAdjustment = SEASONAL_MULTIPLIER[month] ?? 1.0;
    const coverageFactor = params.coveragePct <= 0.5 ? 0.90 : params.coveragePct <= 0.7 ? 1.0 : 1.15;

    // No-claim discount from worker history
    const streak = params.noClaimStreak ?? 0;
    const noclaimDiscount = Math.max(0.80, 1.0 - streak * 0.015); // Max 20% discount

    let heuristicPremium = baseComponent * riskMultiplier * seasonalAdjustment * coverageFactor * noclaimDiscount;
    heuristicPremium = Math.max(MIN_PREMIUM, Math.min(MAX_PREMIUM, heuristicPremium));
    heuristicPremium = Math.round(heuristicPremium * 100) / 100;

    // Use ML premium if available, otherwise heuristic
    const weeklyPremium = mlModelUsed ? mlPremium! : heuristicPremium;

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
        wind_risk: risk.wind_risk,
        humidity_risk: risk.humidity_risk,
        uv_risk: risk.uv_risk,
        visibility_risk: risk.visibility_risk,
        flood_risk: risk.flood_risk,
        cyclone_risk: risk.cyclone_risk,
        time_of_day_risk: risk.time_of_day_risk,
      },
      premiumBreakdown: {
        baseComponent: Math.round(baseComponent * 100) / 100,
        riskMultiplier: Math.round(riskMultiplier * 100) / 100,
        seasonalAdjustment,
        coverageFactor,
        noclaimDiscount: Math.round(noclaimDiscount * 100) / 100,
      },
      ...(mlModelUsed ? {
        mlPricing: {
          mlPremium,
          heuristicPremium,
          mlModelUsed: true,
          mlModelConfidence,
          mlFeatureImportances,
        },
      } : {}),
    } as any;
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
