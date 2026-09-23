import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SalaryPayment } from '../generated/prisma/client.js';
import type { CreateSalaryPaymentDto } from './dto/create-salary-payment.dto.js';

@Injectable()
export class SalaryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    driverId: string,
    dto: CreateSalaryPaymentDto,
  ): Promise<SalaryPayment> {
    await this.ensureDriverExists(driverId);

    if (dto.amount < 0) {
      throw new BadRequestException('amount must be >= 0');
    }
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    const paidAt = new Date(dto.paidAt);
    if (
      Number.isNaN(periodStart.getTime()) ||
      Number.isNaN(periodEnd.getTime()) ||
      Number.isNaN(paidAt.getTime())
    ) {
      throw new BadRequestException(
        'periodStart, periodEnd, and paidAt must be valid dates',
      );
    }
    if (periodEnd <= periodStart) {
      throw new BadRequestException('periodEnd must be after periodStart');
    }

    return this.prisma.salaryPayment.create({
      data: { driverId, amount: dto.amount, periodStart, periodEnd, paidAt },
    });
  }

  async findAll(driverId: string): Promise<SalaryPayment[]> {
    await this.ensureDriverExists(driverId);
    return this.prisma.salaryPayment.findMany({
      where: { driverId },
      orderBy: { paidAt: 'asc' },
    });
  }

  private async ensureDriverExists(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });
    if (!driver) {
      throw new NotFoundException(`Driver ${driverId} not found`);
    }
    return driver;
  }
}
