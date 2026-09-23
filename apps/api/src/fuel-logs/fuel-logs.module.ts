import { Module } from '@nestjs/common';
import { FuelLogsController } from './fuel-logs.controller.js';
import { FuelLogsService } from './fuel-logs.service.js';

@Module({
  controllers: [FuelLogsController],
  providers: [FuelLogsService],
  exports: [FuelLogsService],
})
export class FuelLogsModule {}
