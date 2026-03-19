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
}
