import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FuelLogsService } from './fuel-logs.service.js';
import { CreateFuelLogDto } from './dto/create-fuel-log.dto.js';

@ApiTags('fuel-logs')
@Controller()
export class FuelLogsController {
  constructor(private readonly fuelLogsService: FuelLogsService) {}

  @Post('vehicles/:vehicleId/fuel-logs')
  create(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: CreateFuelLogDto,
  ) {
    return this.fuelLogsService.create(vehicleId, dto);
  }

  @Get('vehicles/:vehicleId/fuel-logs')
  findAll(@Param('vehicleId') vehicleId: string) {
    return this.fuelLogsService.findAll(vehicleId);
  }

  @Get('vehicles/:vehicleId/fuel-consumption')
  consumption(
    @Param('vehicleId') vehicleId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.fuelLogsService.consumption(
      vehicleId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
