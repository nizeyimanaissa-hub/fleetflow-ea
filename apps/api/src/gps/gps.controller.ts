import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GpsService } from './gps.service.js';
import { CreateGpsPingDto } from './dto/create-gps-ping.dto.js';

@ApiTags('gps')
@Controller()
export class GpsController {
  constructor(private readonly gpsService: GpsService) {}

  @Post('trips/:tripId/gps')
  ingest(@Param('tripId') tripId: string, @Body() dto: CreateGpsPingDto) {
    return this.gpsService.ingest(tripId, dto);
  }

  @Get('trips/:tripId/gps')
  history(@Param('tripId') tripId: string) {
    return this.gpsService.history(tripId);
  }

  @Get('trips/:tripId/location')
  location(@Param('tripId') tripId: string) {
    return this.gpsService.latest(tripId);
  }
}
