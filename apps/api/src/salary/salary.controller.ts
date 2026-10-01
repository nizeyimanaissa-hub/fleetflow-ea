import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UuidParam } from '../common/validation/uuid-param.decorator.js';
import { SalaryService } from './salary.service.js';
import { CreateSalaryPaymentDto } from './dto/create-salary-payment.dto.js';

@ApiTags('salary')
@Controller()
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  @Post('drivers/:driverId/salary-payments')
  create(
    @UuidParam('driverId') driverId: string,
    @Body() dto: CreateSalaryPaymentDto,
  ) {
    return this.salaryService.create(driverId, dto);
  }

  @Get('drivers/:driverId/salary-payments')
  findAll(@UuidParam('driverId') driverId: string) {
    return this.salaryService.findAll(driverId);
  }
}
