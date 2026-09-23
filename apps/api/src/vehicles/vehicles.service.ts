import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Vehicle } from '../generated/prisma/client.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';

const REQUIRED_FIELDS: (keyof CreateVehicleDto)[] = [
  'companyId',
  'plateNumber',
  'make',
  'model',
  'year',
];

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVehicleDto): Promise<Vehicle> {
    for (const field of REQUIRED_FIELDS) {
      if (!dto[field]) {
        throw new BadRequestException(`${field} is required`);
      }
    }

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company ${dto.companyId} not found`);
    }

    try {
      return await this.prisma.vehicle.create({
        data: {
          companyId: dto.companyId,
          plateNumber: dto.plateNumber,
          make: dto.make,
          model: dto.model,
          year: dto.year,
          status: dto.status,
          odometerKm: dto.odometerKm,
        },
      });
    } catch (error) {
      throw this.mapUniqueConstraintError(error);
    }
  }

  findAll(companyId?: string): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string): Promise<Vehicle> {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }
    return vehicle;
  }

  async update(id: string, dto: UpdateVehicleDto): Promise<Vehicle> {
    await this.findOne(id);

    try {
      return await this.prisma.vehicle.update({ where: { id }, data: dto });
    } catch (error) {
      throw this.mapUniqueConstraintError(error);
    }
  }

  async remove(id: string): Promise<Vehicle> {
    await this.findOne(id);
    return this.prisma.vehicle.delete({ where: { id } });
  }

  private mapUniqueConstraintError(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'A vehicle with this plate number already exists for this company',
      );
    }
    return error;
  }
}
