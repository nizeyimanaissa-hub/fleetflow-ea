import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { FuelLog } from '../generated/prisma/client.js';
import type { CreateFuelLogDto } from './dto/create-fuel-log.dto.js';

@Injectable()
export class FuelLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(vehicleId: string, dto: CreateFuelLogDto): Promise<FuelLog> {
    await this.ensureVehicleExists(vehicleId);

    return this.prisma.fuelLog.create({
      data: {
        vehicleId,
        liters: dto.liters,
        costTotal: dto.costTotal,
        odometerKm: dto.odometerKm,
        filledAt: dto.filledAt,
      },
    });
  }

  async findAll(vehicleId: string): Promise<FuelLog[]> {
    await this.ensureVehicleExists(vehicleId);
    return this.prisma.fuelLog.findMany({
      where: { vehicleId },
      orderBy: { filledAt: 'asc' },
    });
  }

  async consumption(vehicleId: string, from?: Date, to?: Date) {
    await this.ensureVehicleExists(vehicleId);

    const logs = await this.prisma.fuelLog.findMany({
      where: { vehicleId, filledAt: { gte: from, lte: to } },
      orderBy: { filledAt: 'asc' },
    });

    const totalLiters = logs.reduce((sum, l) => sum + l.liters, 0);
    const totalCost = logs.reduce((sum, l) => sum + l.costTotal, 0);

    // Standard fill-to-fill method: the liters added at a fill-up is what
    // was consumed covering the distance since the previous fill-up, so the
    // first log in the range has no attributable interval on its own.
    let averageConsumptionL100km: number | null = null;
    if (logs.length >= 2) {
      const distanceKm =
        logs[logs.length - 1].odometerKm - logs[0].odometerKm;
      const litersConsumed = logs
        .slice(1)
        .reduce((sum, l) => sum + l.liters, 0);
      if (distanceKm > 0) {
        averageConsumptionL100km = (litersConsumed / distanceKm) * 100;
      }
    }

    return {
      vehicleId,
      fillUps: logs.length,
      totalLiters,
      totalCost,
      averageConsumptionL100km,
    };
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
