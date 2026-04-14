import { Controller, Post, Get, Patch, Param, Body } from '@nestjs/common';
import { PolicyService } from './policy.service';

@Controller('api/policies')
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  @Post()
  async create(@Body() body: { workerId: string; coveragePct: number }) {
    return this.policyService.createPolicy(body);
  }

  @Get(':workerId/active')
  async getActive(@Param('workerId') workerId: string) {
    return this.policyService.getActivePolicy(workerId);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.policyService.getPolicyById(id);
  }

  /**
   * Called by frontend after returning from Stripe Checkout (?payment=success)
   * Activates the policy if payment was completed
   */
  @Patch(':id/activate')
  async activate(@Param('id') policyId: string) {
    return this.policyService.activatePolicy(policyId, 'manual-confirm');
  }
}
