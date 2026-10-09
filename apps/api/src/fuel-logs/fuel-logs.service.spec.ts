import { NotFoundException } from '@nestjs/common';
import {
  asPrisma,
  createPrismaMock,
  type PrismaMock,
} from '../../test/prisma-mock.js';
import { FuelLogsService } from './fuel-logs.service.js';

const at = (iso: string) => new Date(iso);

describe('FuelLogsService', () => {
  let prisma: PrismaMock;
  let service: FuelLogsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.vehicle.findUnique.mockResolvedValue({ id: 'v1' });
    service = new FuelLogsService(asPrisma(prisma));
  });

  describe('vehicle must exist', () => {
    beforeEach(() => {
      prisma.vehicle.findUnique.mockResolvedValue(null);
    });

    it.each([
      ['create', () => service.create('v1', {} as never)],
      ['findAll', () => service.findAll('v1')],
      ['consumption', () => service.consumption('v1')],
    ])('%s throws NotFound', async (_name, call) => {
      await expect(call()).rejects.toThrow(NotFoundException);
      expect(prisma.fuelLog.create).not.toHaveBeenCalled();
      expect(prisma.fuelLog.findMany).not.toHaveBeenCalled();
    });
  });

  it('creates a log for the vehicle', async () => {
    const dto = {
      liters: 40,
      costTotal: 60,
      odometerKm: 12000,
      filledAt: at('2026-10-01'),
    };
    await service.create('v1', dto);
    expect(prisma.fuelLog.create).toHaveBeenCalledWith({
      data: { vehicleId: 'v1', ...dto },
    });
  });

  it('lists logs oldest first', async () => {
    await service.findAll('v1');
    expect(prisma.fuelLog.findMany).toHaveBeenCalledWith({
      where: { vehicleId: 'v1' },
      orderBy: { filledAt: 'asc' },
    });
  });

  describe('consumption', () => {
    it('uses the fill-to-fill method, ignoring the first fill-up', async () => {
      prisma.fuelLog.findMany.mockResolvedValue([
        { liters: 50, costTotal: 75, odometerKm: 10_000 },
        { liters: 30, costTotal: 45, odometerKm: 10_400 },
        { liters: 20, costTotal: 30, odometerKm: 10_600 },
      ]);

      const result = await service.consumption(
        'v1',
        at('2026-09-01'),
        at('2026-09-30'),
      );

      expect(prisma.fuelLog.findMany).toHaveBeenCalledWith({
        where: {
          vehicleId: 'v1',
          filledAt: { gte: at('2026-09-01'), lte: at('2026-09-30') },
        },
        orderBy: { filledAt: 'asc' },
      });
      expect(result).toEqual({
        vehicleId: 'v1',
        fillUps: 3,
        totalLiters: 100,
        totalCost: 150,
        // (30 + 20) L over 600 km
        averageConsumptionL100km: (50 / 600) * 100,
      });
    });

    it('has no average with fewer than two fill-ups', async () => {
      prisma.fuelLog.findMany.mockResolvedValue([
        { liters: 50, costTotal: 75, odometerKm: 10_000 },
      ]);
      const result = await service.consumption('v1');
      expect(result).toMatchObject({
        fillUps: 1,
        totalLiters: 50,
        averageConsumptionL100km: null,
      });
    });

    it('has no average when the odometer did not move', async () => {
      prisma.fuelLog.findMany.mockResolvedValue([
        { liters: 50, costTotal: 75, odometerKm: 10_000 },
        { liters: 10, costTotal: 15, odometerKm: 10_000 },
      ]);
      const result = await service.consumption('v1');
      expect(result.averageConsumptionL100km).toBeNull();
    });

    it('reports zeros for an empty range', async () => {
      prisma.fuelLog.findMany.mockResolvedValue([]);
      await expect(service.consumption('v1')).resolves.toEqual({
        vehicleId: 'v1',
        fillUps: 0,
        totalLiters: 0,
        totalCost: 0,
        averageConsumptionL100km: null,
      });
    });
  });
});
