import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service.js';
import { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto.js';

@ApiTags('maintenance')
@Controller()
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('vehicles/:vehicleId/maintenance-records')
  create(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: CreateMaintenanceRecordDto,
  ) {
    return this.maintenanceService.create(vehicleId, dto);
  }

  @Get('vehicles/:vehicleId/maintenance-records')
  findAll(@Param('vehicleId') vehicleId: string) {
    return this.maintenanceService.findAll(vehicleId);
  }
}
