import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ClaimService } from './claims.service';

@Controller('api/claims')
export class ClaimController {
  constructor(private readonly claimService: ClaimService) {}

  @Get('worker/:workerId')
  async getWorkerClaims(@Param('workerId') workerId: string) {
    return this.claimService.getWorkerClaims(workerId);
  }

  @Get(':id')
  async getClaimById(@Param('id') id: string) {
    return this.claimService.getClaimById(id);
  }

  @Post('simulate')
  async simulate(
    @Body() body: { workerId: string; triggerType: string; hoursLost?: number; triggerValue?: number },
  ) {
    return this.claimService.simulateTrigger(body);
  }
}
