import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  asPrisma,
  createPrismaMock,
  type PrismaMock,
} from '../../test/prisma-mock.js';
import {
  foreignKeyError,
  uniqueConstraintError,
} from '../../test/prisma-errors.js';
import type { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { VehiclesService } from './vehicles.service.js';

const dto: CreateVehicleDto = {
  companyId: 'c1',
  plateNumber: 'RAB 123 A',
  make: 'Toyota',
  model: 'Hilux',
  year: 2020,
  status: 'ACTIVE',
  odometerKm: 1000,
};

describe('VehiclesService', () => {
  let prisma: PrismaMock;
  let service: VehiclesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.vehicle.findUnique.mockResolvedValue({ id: 'v1' });
    service = new VehiclesService(asPrisma(prisma));
  });

  describe('create', () => {
    it('creates a vehicle in the company', async () => {
      await service.create(dto);
      expect(prisma.vehicle.create).toHaveBeenCalledWith({ data: dto });
    });

    it('rejects an unknown company', async () => {
      prisma.company.findUnique.mockResolvedValue(null);
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(prisma.vehicle.create).not.toHaveBeenCalled();
    });

    it('turns a duplicate plate number into a 409', async () => {
      prisma.vehicle.create.mockRejectedValue(uniqueConstraintError());
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('rethrows other database errors unchanged', async () => {
      const error = foreignKeyError();
      prisma.vehicle.create.mockRejectedValue(error);
      await expect(service.create(dto)).rejects.toBe(error);
    });
  });

  describe('findAll', () => {
    it('filters by company when given one', async () => {
      await service.findAll('c1');
      expect(prisma.vehicle.findMany).toHaveBeenCalledWith({
        where: { companyId: 'c1' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('lists every vehicle otherwise', async () => {
      await service.findAll();
      expect(prisma.vehicle.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('update', () => {
    it('updates the given fields', async () => {
      await service.update('v1', { odometerKm: 2000 });
      expect(prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { odometerKm: 2000 },
      });
    });

    it('turns a duplicate plate number into a 409', async () => {
      prisma.vehicle.update.mockRejectedValue(uniqueConstraintError());
      await expect(
        service.update('v1', { plateNumber: 'TAKEN' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  it('deletes a vehicle', async () => {
    await service.remove('v1');
    expect(prisma.vehicle.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
  });

  describe('when the vehicle does not exist', () => {
    beforeEach(() => {
      prisma.vehicle.findUnique.mockResolvedValue(null);
    });

    it.each([
      ['findOne', () => service.findOne('v1')],
      ['update', () => service.update('v1', {})],
      ['remove', () => service.remove('v1')],
    ])('%s throws NotFound and writes nothing', async (_name, call) => {
      await expect(call()).rejects.toThrow(NotFoundException);
      expect(prisma.vehicle.update).not.toHaveBeenCalled();
      expect(prisma.vehicle.delete).not.toHaveBeenCalled();
    });
  });
});
