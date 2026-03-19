import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { PremiumService } from './premium.service';

@Controller('api/premium')
export class PremiumController {
  constructor(private readonly premiumService: PremiumService) {}

  @Post('calculate')
  async calculatePremium(
    @Body()
    body: {
      workerId?: string;
      dailyIncome: number;
      city: string;
      zone: string;
      coveragePct: number;
      workingHours?: number;
    },
  ) {
    return this.premiumService.calculatePremium({
      dailyIncome: body.dailyIncome,
      city: body.city,
      zone: body.zone,
      coveragePct: body.coveragePct,
      workingHours: body.workingHours,
    });
  }

  @Get('calculate')
  async calculatePremiumGet(
    @Query('income') income: string,
    @Query('city') city: string,
    @Query('zone') zone: string,
    @Query('coverage') coverage: string,
    @Query('workingHours') workingHours?: string,
  ) {
    return this.premiumService.calculatePremium({
      dailyIncome: Number(income),
      city,
      zone,
      coveragePct: Number(coverage),
      workingHours: workingHours ? Number(workingHours) : 8,
    });
  }

  @Post('calculate-all')
  async calculateAllTiers(
    @Body()
    body: {
      dailyIncome: number;
      city: string;
      zone: string;
      workingHours?: number;
    },
  ) {
    return this.premiumService.calculateAllTiers(body);
  }
}
