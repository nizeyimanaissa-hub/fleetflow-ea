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
import type { CreateDriverDto } from './dto/create-driver.dto.js';
import { DriversService } from './drivers.service.js';

const dto: CreateDriverDto = {
  companyId: 'c1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '+250700000000',
  licenseNumber: 'LIC-1',
  licenseExpiry: new Date('2030-01-01'),
  status: 'ACTIVE',
};

describe('DriversService', () => {
  let prisma: PrismaMock;
  let service: DriversService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.driver.findUnique.mockResolvedValue({ id: 'd1' });
    service = new DriversService(asPrisma(prisma));
  });

  describe('create', () => {
    it('creates a driver in the company', async () => {
      await service.create(dto);
      expect(prisma.driver.create).toHaveBeenCalledWith({ data: dto });
    });

    it('rejects an unknown company', async () => {
      prisma.company.findUnique.mockResolvedValue(null);
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(prisma.driver.create).not.toHaveBeenCalled();
    });

    it('turns a duplicate email or licence into a 409', async () => {
      prisma.driver.create.mockRejectedValue(uniqueConstraintError());
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('rethrows other database errors unchanged', async () => {
      const error = foreignKeyError();
      prisma.driver.create.mockRejectedValue(error);
      await expect(service.create(dto)).rejects.toBe(error);
    });
  });

  describe('findAll', () => {
    it('filters by company when given one', async () => {
      await service.findAll('c1');
      expect(prisma.driver.findMany).toHaveBeenCalledWith({
        where: { companyId: 'c1' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('lists every driver otherwise', async () => {
      await service.findAll();
      expect(prisma.driver.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('update', () => {
    it('updates only the given fields', async () => {
      await service.update('d1', { phone: '+250711111111' });
      expect(prisma.driver.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: expect.objectContaining({
          phone: '+250711111111',
          firstName: undefined,
          email: undefined,
        }),
      });
    });

    it('never changes the company', async () => {
      await service.update('d1', { companyId: 'c2' } as never);
      const { data } = prisma.driver.update.mock.calls[0][0];
      expect(data).not.toHaveProperty('companyId');
    });

    it('turns a duplicate email or licence into a 409', async () => {
      prisma.driver.update.mockRejectedValue(uniqueConstraintError());
      await expect(
        service.update('d1', { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  it('deletes a driver', async () => {
    await service.remove('d1');
    expect(prisma.driver.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
  });

  describe('when the driver does not exist', () => {
    beforeEach(() => {
      prisma.driver.findUnique.mockResolvedValue(null);
    });

    it.each([
      ['findOne', () => service.findOne('d1')],
      ['update', () => service.update('d1', {})],
      ['remove', () => service.remove('d1')],
    ])('%s throws NotFound and writes nothing', async (_name, call) => {
      await expect(call()).rejects.toThrow(NotFoundException);
      expect(prisma.driver.update).not.toHaveBeenCalled();
      expect(prisma.driver.delete).not.toHaveBeenCalled();
    });
  });
});
