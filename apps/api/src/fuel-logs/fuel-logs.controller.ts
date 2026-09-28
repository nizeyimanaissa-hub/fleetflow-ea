import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DateRangeQueryDto } from '../common/validation/query.dto.js';
import { UuidParam } from '../common/validation/uuid-param.decorator.js';
import { FuelLogsService } from './fuel-logs.service.js';
import { CreateFuelLogDto } from './dto/create-fuel-log.dto.js';

@ApiTags('fuel-logs')
@Controller()
export class FuelLogsController {
  constructor(private readonly fuelLogsService: FuelLogsService) {}

  @Post('vehicles/:vehicleId/fuel-logs')
  create(
    @UuidParam('vehicleId') vehicleId: string,
    @Body() dto: CreateFuelLogDto,
  ) {
    return this.fuelLogsService.create(vehicleId, dto);
  }

  @Get('vehicles/:vehicleId/fuel-logs')
  findAll(@UuidParam('vehicleId') vehicleId: string) {
    return this.fuelLogsService.findAll(vehicleId);
  }

  @Get('vehicles/:vehicleId/fuel-consumption')
  consumption(
    @UuidParam('vehicleId') vehicleId: string,
    @Query() range: DateRangeQueryDto,
  ) {
    return this.fuelLogsService.consumption(vehicleId, range.from, range.to);
  }
}
