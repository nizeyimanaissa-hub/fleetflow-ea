import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { ZodValidationPipe } from './common/validation/zod-validation.pipe.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TripsModule } from './trips/trips.module.js';
import { CompaniesModule } from './companies/companies.module.js';
import { DriversModule } from './drivers/drivers.module.js';
import { VehiclesModule } from './vehicles/vehicles.module.js';
import { GpsModule } from './gps/gps.module.js';
import { FuelLogsModule } from './fuel-logs/fuel-logs.module.js';
import { MaintenanceModule } from './maintenance/maintenance.module.js';
import { SalaryModule } from './salary/salary.module.js';
import { ReportsModule } from './reports/reports.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'api',
    }),
    PrismaModule,
    CompaniesModule,
    DriversModule,
    VehiclesModule,
    TripsModule,
    GpsModule,
    FuelLogsModule,
    MaintenanceModule,
    SalaryModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Validates every @Body()/@Query() typed with a createZodDto class.
    { provide: APP_PIPE, useValue: new ZodValidationPipe() },
  ],
})
export class AppModule {}
