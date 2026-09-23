import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MaintenanceRecord } from '../generated/prisma/client.js';
import type { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto.js';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    vehicleId: string,
    dto: CreateMaintenanceRecordDto,
  ): Promise<MaintenanceRecord> {
    await this.ensureVehicleExists(vehicleId);

    if (!dto.description?.trim()) {
      throw new BadRequestException('description is required');
    }
    if (dto.cost < 0) {
      throw new BadRequestException('cost must be >= 0');
    }
    const performedAt = new Date(dto.performedAt);
    if (Number.isNaN(performedAt.getTime())) {
      throw new BadRequestException('performedAt must be a valid date');
    }

    return this.prisma.maintenanceRecord.create({
      data: {
        vehicleId,
        description: dto.description,
        cost: dto.cost,
        odometerKm: dto.odometerKm,
        performedAt,
      },
    });
  }

  async findAll(vehicleId: string): Promise<MaintenanceRecord[]> {
    await this.ensureVehicleExists(vehicleId);
    return this.prisma.maintenanceRecord.findMany({
      where: { vehicleId },
      orderBy: { performedAt: 'asc' },
    });
  }

  private async ensureVehicleExists(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found`);
    }
    return vehicle;
  }
}
