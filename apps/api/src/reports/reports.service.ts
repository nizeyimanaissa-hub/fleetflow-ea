import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CompaniesService } from '../companies/companies.service.js';
import { DriversService } from '../drivers/drivers.service.js';
import { VehiclesService } from '../vehicles/vehicles.service.js';
import { FuelLogsService } from '../fuel-logs/fuel-logs.service.js';

const HOUR_MS = 3_600_000;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly driversService: DriversService,
    private readonly vehiclesService: VehiclesService,
    private readonly fuelLogsService: FuelLogsService,
  ) {}

  async costReport(companyId: string, from?: Date, to?: Date) {
    await this.companiesService.findOne(companyId);

    const [fuelByVehicle, maintenanceByVehicle, salaryByDriver] =
      await Promise.all([
        this.prisma.fuelLog.groupBy({
          by: ['vehicleId'],
          where: { vehicle: { companyId }, filledAt: { gte: from, lte: to } },
          _sum: { costTotal: true },
        }),
        this.prisma.maintenanceRecord.groupBy({
          by: ['vehicleId'],
          where: {
            vehicle: { companyId },
            performedAt: { gte: from, lte: to },
          },
          _sum: { cost: true },
        }),
        this.prisma.salaryPayment.groupBy({
          by: ['driverId'],
          where: { driver: { companyId }, paidAt: { gte: from, lte: to } },
          _sum: { amount: true },
        }),
      ]);

    const byVehicle = new Map<
      string,
      { fuelCost: number; maintenanceCost: number }
    >();
    for (const row of fuelByVehicle) {
      byVehicle.set(row.vehicleId, {
        fuelCost: row._sum.costTotal ?? 0,
        maintenanceCost: 0,
      });
    }
    for (const row of maintenanceByVehicle) {
      const existing = byVehicle.get(row.vehicleId) ?? {
        fuelCost: 0,
        maintenanceCost: 0,
      };
      existing.maintenanceCost = row._sum.cost ?? 0;
      byVehicle.set(row.vehicleId, existing);
    }

    const totalFuelCost = fuelByVehicle.reduce(
      (sum, r) => sum + (r._sum.costTotal ?? 0),
      0,
    );
    const totalMaintenanceCost = maintenanceByVehicle.reduce(
      (sum, r) => sum + (r._sum.cost ?? 0),
      0,
    );
    const totalSalaryCost = salaryByDriver.reduce(
      (sum, r) => sum + (r._sum.amount ?? 0),
      0,
    );

    return {
      companyId,
      from: from ?? null,
      to: to ?? null,
      totalFuelCost,
      totalMaintenanceCost,
      totalSalaryCost,
      grandTotal: totalFuelCost + totalMaintenanceCost + totalSalaryCost,
      byVehicle: [...byVehicle.entries()].map(([vehicleId, c]) => ({
        vehicleId,
        fuelCost: c.fuelCost,
        maintenanceCost: c.maintenanceCost,
        total: c.fuelCost + c.maintenanceCost,
      })),
      byDriver: salaryByDriver.map((r) => ({
        driverId: r.driverId,
        salaryCost: r._sum.amount ?? 0,
      })),
    };
  }

  async driverPerformance(driverId: string, from?: Date, to?: Date) {
    await this.driversService.findOne(driverId);

    const trips = await this.prisma.trip.findMany({
      where: { driverId, status: 'COMPLETED', endedAt: { gte: from, lte: to } },
    });

    const tripsCompleted = trips.length;
    const totalDistanceKm = trips.reduce(
      (sum, t) => sum + (t.distanceKm ?? 0),
      0,
    );
    const totalDrivingHours = trips.reduce(
      (sum, t) => sum + drivingHours(t.startedAt, t.endedAt),
      0,
    );
    const onTimeTrips = trips.filter(
      (t) => t.endedAt && t.endedAt <= t.scheduledEnd,
    ).length;

    return {
      driverId,
      tripsCompleted,
      totalDistanceKm,
      totalDrivingHours,
      onTimeRate: tripsCompleted > 0 ? onTimeTrips / tripsCompleted : null,
    };
  }

  async vehiclePerformance(vehicleId: string, from?: Date, to?: Date) {
    await this.vehiclesService.findOne(vehicleId);

    const [trips, consumption, fuelCostAgg, maintenanceCostAgg] =
      await Promise.all([
        this.prisma.trip.findMany({
          where: {
            vehicleId,
            status: 'COMPLETED',
            endedAt: { gte: from, lte: to },
          },
        }),
        this.fuelLogsService.consumption(vehicleId, from, to),
        this.prisma.fuelLog.aggregate({
          where: { vehicleId, filledAt: { gte: from, lte: to } },
          _sum: { costTotal: true },
        }),
        this.prisma.maintenanceRecord.aggregate({
          where: { vehicleId, performedAt: { gte: from, lte: to } },
          _sum: { cost: true },
        }),
      ]);

    const tripsCompleted = trips.length;
    const totalDistanceKm = trips.reduce(
      (sum, t) => sum + (t.distanceKm ?? 0),
      0,
    );
    const totalDrivingHours = trips.reduce(
      (sum, t) => sum + drivingHours(t.startedAt, t.endedAt),
      0,
    );

    const fuelCost = fuelCostAgg._sum.costTotal ?? 0;
    const maintenanceCost = maintenanceCostAgg._sum.cost ?? 0;
    const totalCost = fuelCost + maintenanceCost;

    return {
      vehicleId,
      tripsCompleted,
      totalDistanceKm,
      totalDrivingHours,
      averageConsumptionL100km: consumption.averageConsumptionL100km,
      fuelCost,
      maintenanceCost,
      costPerKm: totalDistanceKm > 0 ? totalCost / totalDistanceKm : null,
    };
  }

  async companyPerformance(companyId: string, from?: Date, to?: Date) {
    await this.companiesService.findOne(companyId);

    const [vehicles, drivers, trips, costs] = await Promise.all([
      this.prisma.vehicle.findMany({ where: { companyId } }),
      this.prisma.driver.findMany({ where: { companyId } }),
      this.prisma.trip.findMany({
        where: { companyId, status: 'COMPLETED', endedAt: { gte: from, lte: to } },
      }),
      this.costReport(companyId, from, to),
    ]);

    const tripsCompleted = trips.length;
    const totalDistanceKm = trips.reduce(
      (sum, t) => sum + (t.distanceKm ?? 0),
      0,
    );
    const totalDrivingHours = trips.reduce(
      (sum, t) => sum + drivingHours(t.startedAt, t.endedAt),
      0,
    );

    return {
      companyId,
      vehicleCount: vehicles.length,
      driverCount: drivers.length,
      tripsCompleted,
      totalDistanceKm,
      totalDrivingHours,
      costPerKm:
        totalDistanceKm > 0 ? costs.grandTotal / totalDistanceKm : null,
      costs,
    };
  }
}

function drivingHours(startedAt: Date | null, endedAt: Date | null): number {
  if (!startedAt || !endedAt) {
    return 0;
  }
  return (endedAt.getTime() - startedAt.getTime()) / HOUR_MS;
}
