import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface RiskBreakdown {
  risk_score: number;
  weather_risk: number;
  location_risk: number;
  seasonal_risk: number;
  historical_risk: number;
  risk_label: string;
}

@Injectable()
export class RiskService {
  private aiServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
  }

  async calculateRisk(params: {
    city: string;
    zone: string;
    dailyIncome: number;
    workingHours: number;
    date?: string;
    rainMmHr?: number;
    temperatureC?: number;
    aqi?: number;
    disruptionCount30d?: number;
  }): Promise<RiskBreakdown> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/risk/calculate`, {
          city: params.city,
          zone: params.zone,
          daily_income: params.dailyIncome,
          working_hours: params.workingHours,
          date: params.date || new Date().toISOString().split('T')[0],
          rain_mm_hr: params.rainMmHr ?? 0,
          temperature_c: params.temperatureC ?? 30,
          aqi: params.aqi ?? 100,
          disruption_count_30d: params.disruptionCount30d ?? 0,
        }),
      );
      return response.data;
    } catch (error) {
      // Fallback: calculate risk locally if AI service is unavailable
      return this.calculateRiskFallback(params);
    }
  }

  private calculateRiskFallback(params: {
    city: string;
    zone: string;
    rainMmHr?: number;
    temperatureC?: number;
    aqi?: number;
    disruptionCount30d?: number;
  }): RiskBreakdown {
    const weatherRisk = this.calcWeatherRisk(
      params.rainMmHr ?? 0,
      params.temperatureC ?? 30,
      params.aqi ?? 100,
    );
    const locationRisk = this.getLocationRisk(params.city, params.zone);
    const seasonalRisk = this.calcSeasonalRisk(params.city);
    const historicalRisk = this.calcHistoricalRisk(params.disruptionCount30d ?? 0);

    let riskScore =
      weatherRisk * 0.4 +
      locationRisk * 0.3 +
      seasonalRisk * 0.2 +
      historicalRisk * 0.1;

    riskScore = Math.round(Math.max(0.1, Math.min(0.9, riskScore)) * 1000) / 1000;

    const riskLabel =
      riskScore < 0.3 ? 'Low' :
      riskScore < 0.55 ? 'Medium' :
      riskScore < 0.75 ? 'High' : 'Very High';

    return {
      risk_score: riskScore,
      weather_risk: weatherRisk,
      location_risk: locationRisk,
      seasonal_risk: seasonalRisk,
      historical_risk: historicalRisk,
      risk_label: riskLabel,
    };
  }

  private calcWeatherRisk(rainMmHr: number, tempC: number, aqi: number): number {
    let rainRisk = rainMmHr < 2.5 ? 0.1 : rainMmHr < 7.5 ? 0.3 : rainMmHr < 15 ? 0.6 : rainMmHr < 20 ? 0.8 : 1.0;
    let heatRisk = tempC < 35 ? 0 : tempC < 38 ? 0.2 : tempC < 40 ? 0.5 : tempC < 42 ? 0.7 : 1.0;
    let aqiRisk = aqi < 100 ? 0 : aqi < 200 ? 0.2 : aqi < 300 ? 0.5 : 1.0;
    return Math.round(Math.min(1.0, rainRisk * 0.5 + heatRisk * 0.3 + aqiRisk * 0.2) * 1000) / 1000;
  }

  private getLocationRisk(city: string, zone: string): number {
    const map: Record<string, Record<string, number>> = {
      hyderabad: { kondapur: 0.55, hitech_city: 0.4, secunderabad: 0.65, gachibowli: 0.35, default: 0.5 },
      mumbai: { dharavi: 0.85, bandra: 0.6, andheri: 0.7, default: 0.65 },
      bangalore: { whitefield: 0.45, koramangala: 0.5, default: 0.48 },
      delhi: { connaught_place: 0.55, dwarka: 0.45, rohini: 0.5, default: 0.5 },
    };
    const cityData = map[city.toLowerCase()] || { default: 0.5 };
    return cityData[zone.toLowerCase().replace(/ /g, '_')] || cityData.default || 0.5;
  }

  private calcSeasonalRisk(city: string): number {
    const month = new Date().getMonth() + 1;
    const monsoonCities = ['hyderabad', 'mumbai', 'chennai', 'kolkata', 'bhubaneswar'];
    if (monsoonCities.includes(city.toLowerCase())) {
      if ([6, 7, 8, 9].includes(month)) return 0.85;
      if ([5, 10].includes(month)) return 0.55;
      if ([3, 4].includes(month)) return 0.4;
      return 0.15;
    }
    if ([6, 7, 8].includes(month)) return 0.7;
    if ([12, 1].includes(month)) return 0.5;
    if ([4, 5].includes(month)) return 0.45;
    return 0.2;
  }

  private calcHistoricalRisk(count: number): number {
    if (count === 0) return 0.1;
    if (count <= 2) return 0.25;
    if (count <= 5) return 0.5;
    if (count <= 8) return 0.7;
    return 0.9;
  }
}
