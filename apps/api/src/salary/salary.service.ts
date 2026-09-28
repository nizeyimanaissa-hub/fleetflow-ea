import { Injectable, NotFoundException } from '@nestjs/common';
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

    return this.prisma.salaryPayment.create({
      data: {
        driverId,
        amount: dto.amount,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        paidAt: dto.paidAt,
      },
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
