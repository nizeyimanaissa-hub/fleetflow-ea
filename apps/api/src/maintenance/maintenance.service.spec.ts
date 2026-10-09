import { NotFoundException } from '@nestjs/common';
import {
  asPrisma,
  createPrismaMock,
  type PrismaMock,
} from '../../test/prisma-mock.js';
import { MaintenanceService } from './maintenance.service.js';

const dto = {
  description: 'Oil change',
  cost: 80,
  performedAt: new Date('2026-10-01'),
  odometerKm: 12000,
};

describe('MaintenanceService', () => {
  let prisma: PrismaMock;
  let service: MaintenanceService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.vehicle.findUnique.mockResolvedValue({ id: 'v1' });
    service = new MaintenanceService(asPrisma(prisma));
  });

  it('creates a record for the vehicle', async () => {
    await service.create('v1', dto);
    expect(prisma.maintenanceRecord.create).toHaveBeenCalledWith({
      data: { vehicleId: 'v1', ...dto },
    });
  });

  it('lists records oldest first', async () => {
    await service.findAll('v1');
    expect(prisma.maintenanceRecord.findMany).toHaveBeenCalledWith({
      where: { vehicleId: 'v1' },
      orderBy: { performedAt: 'asc' },
    });
  });

  it.each([
    ['create', (s: MaintenanceService) => s.create('v1', dto)],
    ['findAll', (s: MaintenanceService) => s.findAll('v1')],
  ])('%s throws NotFound for an unknown vehicle', async (_name, call) => {
    prisma.vehicle.findUnique.mockResolvedValue(null);
    await expect(call(service)).rejects.toThrow(NotFoundException);
    expect(prisma.maintenanceRecord.create).not.toHaveBeenCalled();
    expect(prisma.maintenanceRecord.findMany).not.toHaveBeenCalled();
  });
});
