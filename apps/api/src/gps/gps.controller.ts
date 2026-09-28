import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UuidParam } from '../common/validation/uuid-param.decorator.js';
import { GpsService } from './gps.service.js';
import { CreateGpsPingDto } from './dto/create-gps-ping.dto.js';

@ApiTags('gps')
@Controller()
export class GpsController {
  constructor(private readonly gpsService: GpsService) {}

  @Post('trips/:tripId/gps')
  ingest(@UuidParam('tripId') tripId: string, @Body() dto: CreateGpsPingDto) {
    return this.gpsService.ingest(tripId, dto);
  }

  @Get('trips/:tripId/gps')
  history(@UuidParam('tripId') tripId: string) {
    return this.gpsService.history(tripId);
  }

  @Get('trips/:tripId/location')
  location(@UuidParam('tripId') tripId: string) {
    return this.gpsService.latest(tripId);
  }
}
