import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DateRangeQueryDto } from '../common/validation/query.dto.js';
import { UuidParam } from '../common/validation/uuid-param.decorator.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('companies/:companyId/cost-report')
  costReport(
    @UuidParam('companyId') companyId: string,
    @Query() range: DateRangeQueryDto,
  ) {
    return this.reportsService.costReport(companyId, range.from, range.to);
  }

  @Get('companies/:companyId/performance')
  companyPerformance(
    @UuidParam('companyId') companyId: string,
    @Query() range: DateRangeQueryDto,
  ) {
    return this.reportsService.companyPerformance(
      companyId,
      range.from,
      range.to,
    );
  }

  @Get('drivers/:driverId/performance')
  driverPerformance(
    @UuidParam('driverId') driverId: string,
    @Query() range: DateRangeQueryDto,
  ) {
    return this.reportsService.driverPerformance(
      driverId,
      range.from,
      range.to,
    );
  }

  @Get('vehicles/:vehicleId/performance')
  vehiclePerformance(
    @UuidParam('vehicleId') vehicleId: string,
    @Query() range: DateRangeQueryDto,
  ) {
    return this.reportsService.vehiclePerformance(
      vehicleId,
      range.from,
      range.to,
    );
  }
}
