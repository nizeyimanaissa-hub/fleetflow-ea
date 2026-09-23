import { Module } from '@nestjs/common';
import { RoutingModule } from '../routing/routing.module.js';
import { GpsController } from './gps.controller.js';
import { GpsService } from './gps.service.js';

@Module({
  imports: [RoutingModule],
  controllers: [GpsController],
  providers: [GpsService],
})
export class GpsModule {}
