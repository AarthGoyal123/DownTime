import { Controller, Post, Body } from '@nestjs/common';
import { RiskService } from './risk.service';

class CalculateRiskDto {
  workerId?: string;
  city: string;
  zone: string;
  dailyIncome?: number;
  workingHours?: number;
  date?: string;
}

@Controller('api/risk')
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Post('calculate')
  async calculateRisk(@Body() dto: CalculateRiskDto) {
    const result = await this.riskService.calculateRisk({
      city: dto.city,
      zone: dto.zone,
      dailyIncome: dto.dailyIncome ?? 700,
      workingHours: dto.workingHours ?? 8,
      date: dto.date,
    });
    return { risk_score: result.risk_score, risk_breakdown: result };
  }
}
