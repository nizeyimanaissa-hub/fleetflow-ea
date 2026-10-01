import { Injectable, NotFoundException } from '@nestjs/common';
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

    return this.prisma.maintenanceRecord.create({
      data: {
        vehicleId,
        description: dto.description,
        cost: dto.cost,
        odometerKm: dto.odometerKm,
        performedAt: dto.performedAt,
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
