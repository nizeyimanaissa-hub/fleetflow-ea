import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Driver } from '../generated/prisma/client.js';
import { CreateDriverDto } from './dto/create-driver.dto.js';
import { UpdateDriverDto } from './dto/update-driver.dto.js';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDriverDto): Promise<Driver> {
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company ${dto.companyId} not found`);
    }

    try {
      return await this.prisma.driver.create({
        data: {
          companyId: dto.companyId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          licenseNumber: dto.licenseNumber,
          licenseExpiry: dto.licenseExpiry,
          status: dto.status,
        },
      });
    } catch (error) {
      throw this.mapUniqueConstraintError(error);
    }
  }

  findAll(companyId?: string): Promise<Driver[]> {
    return this.prisma.driver.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({ where: { id } });
    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found`);
    }
    return driver;
  }

  async update(id: string, dto: UpdateDriverDto): Promise<Driver> {
    await this.findOne(id);

    const data: Prisma.DriverUpdateInput = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      licenseNumber: dto.licenseNumber,
      licenseExpiry: dto.licenseExpiry,
      status: dto.status,
    };

    try {
      return await this.prisma.driver.update({ where: { id }, data });
    } catch (error) {
      throw this.mapUniqueConstraintError(error);
    }
  }

  async remove(id: string): Promise<Driver> {
    await this.findOne(id);
    return this.prisma.driver.delete({ where: { id } });
  }

  private mapUniqueConstraintError(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'A driver with this email or license number already exists for this company',
      );
    }
    return error;
  }
}
