import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TripsService } from './trips.service.js';
import { AssignTripDto } from './dto/assign-trip.dto.js';

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('assign')
  assign(@Body() dto: AssignTripDto) {
    return this.tripsService.assign(dto);
  }

  @Get()
  findAll(
    @Query('companyId') companyId?: string,
    @Query('driverId') driverId?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.tripsService.findAll({ companyId, driverId, vehicleId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tripsService.findOne(id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.tripsService.cancel(id);
  }

  @Patch(':id/start')
  start(@Param('id') id: string) {
    return this.tripsService.start(id);
  }

  @Patch(':id/complete')
  complete(@Param('id') id: string, @Body('distanceKm') distanceKm?: number) {
    return this.tripsService.complete(id, distanceKm);
  }
}
