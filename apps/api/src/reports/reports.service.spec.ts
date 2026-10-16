import { NotFoundException } from '@nestjs/common';
import type { Trip } from '../generated/prisma/client.js';
import type { CompaniesService } from '../companies/companies.service.js';
import type { DriversService } from '../drivers/drivers.service.js';
import type { VehiclesService } from '../vehicles/vehicles.service.js';
import type { FuelLogsService } from '../fuel-logs/fuel-logs.service.js';
import {
  asPrisma,
  createPrismaMock,
  type PrismaMock,
} from '../../test/prisma-mock.js';
import { ReportsService } from './reports.service.js';

const at = (iso: string) => new Date(iso);
const FROM = at('2026-09-01');
const TO = at('2026-09-30');

/** A completed trip; hours are from startedAt to endedAt. */
function completedTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    status: 'COMPLETED',
    scheduledEnd: at('2026-09-10T12:00:00Z'),
    startedAt: at('2026-09-10T08:00:00Z'),
    endedAt: at('2026-09-10T12:00:00Z'),
    distanceKm: 100,
    ...overrides,
  } as Trip;
}

describe('ReportsService', () => {
  let prisma: PrismaMock;
  let companies: { findOne: ReturnType<typeof vi.fn> };
  let drivers: { findOne: ReturnType<typeof vi.fn> };
  let vehicles: { findOne: ReturnType<typeof vi.fn> };
  let fuelLogs: { consumption: ReturnType<typeof vi.fn> };
  let service: ReportsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    companies = { findOne: vi.fn().mockResolvedValue({}) };
    drivers = { findOne: vi.fn().mockResolvedValue({}) };
    vehicles = { findOne: vi.fn().mockResolvedValue({}) };
    fuelLogs = {
      consumption: vi.fn().mockResolvedValue({ averageConsumptionL100km: 9.5 }),
    };
    service = new ReportsService(
      asPrisma(prisma),
      companies as unknown as CompaniesService,
      drivers as unknown as DriversService,
      vehicles as unknown as VehiclesService,
      fuelLogs as unknown as FuelLogsService,
    );
  });

  /** Fuel for v1 and v2, maintenance for v1 and v3, salary for d1 and d2. */
  function givenCosts() {
    prisma.fuelLog.groupBy.mockResolvedValue([
      { vehicleId: 'v1', _sum: { costTotal: 100 } },
      { vehicleId: 'v2', _sum: { costTotal: 50 } },
    ]);
    prisma.maintenanceRecord.groupBy.mockResolvedValue([
      { vehicleId: 'v1', _sum: { cost: 30 } },
      { vehicleId: 'v3', _sum: { cost: 20 } },
    ]);
    prisma.salaryPayment.groupBy.mockResolvedValue([
      { driverId: 'd1', _sum: { amount: 500 } },
      { driverId: 'd2', _sum: { amount: null } },
    ]);
  }

  describe('costReport', () => {
    it('totals fuel, maintenance and salary, and breaks them down', async () => {
      givenCosts();

      const report = await service.costReport('c1', FROM, TO);

      expect(report).toEqual({
        companyId: 'c1',
        from: FROM,
        to: TO,
        totalFuelCost: 150,
        totalMaintenanceCost: 50,
        totalSalaryCost: 500,
        grandTotal: 700,
        byVehicle: [
          { vehicleId: 'v1', fuelCost: 100, maintenanceCost: 30, total: 130 },
          { vehicleId: 'v2', fuelCost: 50, maintenanceCost: 0, total: 50 },
          { vehicleId: 'v3', fuelCost: 0, maintenanceCost: 20, total: 20 },
        ],
        byDriver: [
          { driverId: 'd1', salaryCost: 500 },
          { driverId: 'd2', salaryCost: 0 },
        ],
      });
    });

    it('scopes every query to the company and date range', async () => {
      givenCosts();
      await service.costReport('c1', FROM, TO);

      expect(prisma.fuelLog.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            vehicle: { companyId: 'c1' },
            filledAt: { gte: FROM, lte: TO },
          },
        }),
      );
      expect(prisma.maintenanceRecord.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            vehicle: { companyId: 'c1' },
            performedAt: { gte: FROM, lte: TO },
          },
        }),
      );
      expect(prisma.salaryPayment.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            driver: { companyId: 'c1' },
            paidAt: { gte: FROM, lte: TO },
          },
        }),
      );
    });

    it('returns zeros and null bounds when there is nothing to report', async () => {
      prisma.fuelLog.groupBy.mockResolvedValue([]);
      prisma.maintenanceRecord.groupBy.mockResolvedValue([]);
      prisma.salaryPayment.groupBy.mockResolvedValue([]);

      const report = await service.costReport('c1');

      expect(report).toMatchObject({
        from: null,
        to: null,
        grandTotal: 0,
        byVehicle: [],
        byDriver: [],
      });
    });

    it('fails when the company does not exist', async () => {
      companies.findOne.mockRejectedValue(new NotFoundException());
      await expect(service.costReport('c1')).rejects.toThrow(NotFoundException);
      expect(prisma.fuelLog.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('driverPerformance', () => {
    it('summarises completed trips in the range', async () => {
      prisma.trip.findMany.mockResolvedValue([
        // 4h, on time
        completedTrip(),
        // 2h, 30 min late, no distance recorded
        completedTrip({
          startedAt: at('2026-09-11T08:00:00Z'),
          endedAt: at('2026-09-11T10:30:00Z'),
          scheduledEnd: at('2026-09-11T10:00:00Z'),
          distanceKm: null,
        }),
        // never marked as started: counts as 0h
        completedTrip({ startedAt: null, distanceKm: 50 }),
      ]);

      const report = await service.driverPerformance('d1', FROM, TO);

      expect(prisma.trip.findMany).toHaveBeenCalledWith({
        where: {
          driverId: 'd1',
          status: 'COMPLETED',
          endedAt: { gte: FROM, lte: TO },
        },
      });
      expect(report).toEqual({
        driverId: 'd1',
        tripsCompleted: 3,
        totalDistanceKm: 150,
        totalDrivingHours: 6.5,
        onTimeRate: 2 / 3,
      });
    });

    it('reports a null on-time rate when there are no trips', async () => {
      prisma.trip.findMany.mockResolvedValue([]);
      const report = await service.driverPerformance('d1');
      expect(report).toMatchObject({ tripsCompleted: 0, onTimeRate: null });
    });

    it('fails when the driver does not exist', async () => {
      drivers.findOne.mockRejectedValue(new NotFoundException());
      await expect(service.driverPerformance('d1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('vehiclePerformance', () => {
    it('combines trips, consumption and costs', async () => {
      prisma.trip.findMany.mockResolvedValue([
        completedTrip({ distanceKm: 120 }),
        completedTrip({ distanceKm: 80 }),
      ]);
      prisma.fuelLog.aggregate.mockResolvedValue({ _sum: { costTotal: 90 } });
      prisma.maintenanceRecord.aggregate.mockResolvedValue({
        _sum: { cost: 30 },
      });

      const report = await service.vehiclePerformance('v1', FROM, TO);

      expect(fuelLogs.consumption).toHaveBeenCalledWith('v1', FROM, TO);
      expect(report).toEqual({
        vehicleId: 'v1',
        tripsCompleted: 2,
        totalDistanceKm: 200,
        totalDrivingHours: 8,
        averageConsumptionL100km: 9.5,
        fuelCost: 90,
        maintenanceCost: 30,
        costPerKm: 0.6,
      });
    });

    it('reports null cost per km when no distance was driven', async () => {
      prisma.trip.findMany.mockResolvedValue([]);
      prisma.fuelLog.aggregate.mockResolvedValue({ _sum: { costTotal: null } });
      prisma.maintenanceRecord.aggregate.mockResolvedValue({
        _sum: { cost: null },
      });

      const report = await service.vehiclePerformance('v1');

      expect(report).toMatchObject({
        fuelCost: 0,
        maintenanceCost: 0,
        costPerKm: null,
      });
    });

    it('fails when the vehicle does not exist', async () => {
      vehicles.findOne.mockRejectedValue(new NotFoundException());
      await expect(service.vehiclePerformance('v1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('companyPerformance', () => {
    it('counts the fleet and divides total cost by distance', async () => {
      givenCosts();
      prisma.vehicle.findMany.mockResolvedValue([{}, {}, {}]);
      prisma.driver.findMany.mockResolvedValue([{}, {}]);
      prisma.trip.findMany.mockResolvedValue([
        completedTrip({ distanceKm: 300 }),
        completedTrip({ distanceKm: 400 }),
      ]);

      const report = await service.companyPerformance('c1', FROM, TO);

      expect(prisma.trip.findMany).toHaveBeenCalledWith({
        where: {
          companyId: 'c1',
          status: 'COMPLETED',
          endedAt: { gte: FROM, lte: TO },
        },
      });
      expect(report).toMatchObject({
        companyId: 'c1',
        vehicleCount: 3,
        driverCount: 2,
        tripsCompleted: 2,
        totalDistanceKm: 700,
        totalDrivingHours: 8,
        // grandTotal 700 / 700 km
        costPerKm: 1,
        costs: { grandTotal: 700 },
      });
    });

    it('reports null cost per km when no distance was driven', async () => {
      givenCosts();
      prisma.vehicle.findMany.mockResolvedValue([]);
      prisma.driver.findMany.mockResolvedValue([]);
      prisma.trip.findMany.mockResolvedValue([]);

      const report = await service.companyPerformance('c1');
      expect(report.costPerKm).toBeNull();
    });
  });
});
