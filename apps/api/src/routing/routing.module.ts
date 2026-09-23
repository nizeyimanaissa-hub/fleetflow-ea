import { Module } from '@nestjs/common';
import { RoutingService } from './routing.service.js';

@Module({
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
