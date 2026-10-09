import { NotFoundException } from '@nestjs/common';
import {
  asPrisma,
  createPrismaMock,
  type PrismaMock,
} from '../../test/prisma-mock.js';
import { CompaniesService } from './companies.service.js';

describe('CompaniesService', () => {
  let prisma: PrismaMock;
  let service: CompaniesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
    service = new CompaniesService(asPrisma(prisma));
  });

  it('creates a company', async () => {
    await service.create({ name: 'Acme' });
    expect(prisma.company.create).toHaveBeenCalledWith({
      data: { name: 'Acme' },
    });
  });

  it('lists companies oldest first', async () => {
    await service.findAll();
    expect(prisma.company.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'asc' },
    });
  });

  it('finds a company', async () => {
    await expect(service.findOne('c1')).resolves.toEqual({ id: 'c1' });
  });

  it('updates a company', async () => {
    await service.update('c1', { name: 'Acme 2' });
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { name: 'Acme 2' },
    });
  });

  it('deletes a company', async () => {
    await service.remove('c1');
    expect(prisma.company.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  describe('when the company does not exist', () => {
    beforeEach(() => {
      prisma.company.findUnique.mockResolvedValue(null);
    });

    it.each([
      ['findOne', () => service.findOne('c1')],
      ['update', () => service.update('c1', { name: 'x' })],
      ['remove', () => service.remove('c1')],
    ])('%s throws NotFound and writes nothing', async (_name, call) => {
      await expect(call()).rejects.toThrow(NotFoundException);
      expect(prisma.company.update).not.toHaveBeenCalled();
      expect(prisma.company.delete).not.toHaveBeenCalled();
    });
  });
});
