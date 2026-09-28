import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UuidParam } from '../common/validation/uuid-param.decorator.js';
import { MaintenanceService } from './maintenance.service.js';
import { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto.js';

@ApiTags('maintenance')
@Controller()
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('vehicles/:vehicleId/maintenance-records')
  create(
    @UuidParam('vehicleId') vehicleId: string,
    @Body() dto: CreateMaintenanceRecordDto,
  ) {
    return this.maintenanceService.create(vehicleId, dto);
  }

  @Get('vehicles/:vehicleId/maintenance-records')
  findAll(@UuidParam('vehicleId') vehicleId: string) {
    return this.maintenanceService.findAll(vehicleId);
  }
}
