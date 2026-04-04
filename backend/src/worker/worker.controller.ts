import { Controller, Post, Get, Patch, Param, Body } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { CreateWorkerDto, UpdateWorkerDto } from './dto/worker.dto';

@Controller('api/workers')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Post('register')
  async register(@Body() dto: CreateWorkerDto) {
    return this.workerService.create(dto);
  }

  @Get('phone/:phone')
  async findByPhone(@Param('phone') phone: string) {
    return this.workerService.findByPhone(phone);
  }

  @Get('all')
  async findAll() {
    return this.workerService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.workerService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateWorkerDto) {
    return this.workerService.update(id, dto);
  }
}
