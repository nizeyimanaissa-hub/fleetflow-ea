import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UuidParam } from '../common/validation/uuid-param.decorator.js';
import { TripsService } from './trips.service.js';
import { AssignTripDto } from './dto/assign-trip.dto.js';
import { CompleteTripDto } from './dto/complete-trip.dto.js';
import { ListTripsQueryDto } from './dto/list-trips-query.dto.js';

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('assign')
  assign(@Body() dto: AssignTripDto) {
    return this.tripsService.assign(dto);
  }

  @Get()
  findAll(@Query() query: ListTripsQueryDto) {
    return this.tripsService.findAll(query);
  }

  @Get(':id')
  findOne(@UuidParam('id') id: string) {
    return this.tripsService.findOne(id);
  }

  @Patch(':id/cancel')
  cancel(@UuidParam('id') id: string) {
    return this.tripsService.cancel(id);
  }

  @Patch(':id/start')
  start(@UuidParam('id') id: string) {
    return this.tripsService.start(id);
  }

  @Patch(':id/complete')
  complete(@UuidParam('id') id: string, @Body() dto: CompleteTripDto) {
    return this.tripsService.complete(id, dto.distanceKm);
  }
}
