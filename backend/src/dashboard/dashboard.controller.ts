import { Controller, Get, Param } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('worker/:id')
  async getWorkerDashboard(@Param('id') id: string) {
    return this.dashboardService.getWorkerDashboard(id);
  }

  @Get('admin')
  async getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }

  @Get('company/:id')
  async getCompanyDashboard(@Param('id') id: string) {
    return this.dashboardService.getCompanyDashboard(id);
  }

  @Get('admin/predictions/:city')
  async getAdminPredictions(@Param('city') city: string) {
    try {
      const axios = require('axios');
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const resp = await axios.get(`${aiUrl}/weather/forecast/${city}`, { timeout: 8000 });
      return resp.data;
    } catch {
      return { source: 'unavailable', daily_forecasts: [] };
    }
  }

  @Get('admin/fraud-stats')
  async getFraudStats() {
    return this.dashboardService.getFraudStats();
  }

  @Get('admin/trends')
  async getTrends() {
    return this.dashboardService.getTrendData();
  }

  @Get('admin/ml-info')
  async getMLModelInfo() {
    try {
      const axios = require('axios');
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const resp = await axios.get(`${aiUrl}/ml/model-info`, { timeout: 5000 });
      return resp.data;
    } catch {
      return { is_trained: false, error: 'ML service unavailable' };
    }
  }
}
