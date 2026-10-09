import { NotFoundException } from '@nestjs/common';
import {
  asPrisma,
  createPrismaMock,
  type PrismaMock,
} from '../../test/prisma-mock.js';
import { SalaryService } from './salary.service.js';

const dto = {
  amount: 500,
  periodStart: new Date('2026-09-01'),
  periodEnd: new Date('2026-09-30'),
  paidAt: new Date('2026-10-01'),
};

describe('SalaryService', () => {
  let prisma: PrismaMock;
  let service: SalaryService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.driver.findUnique.mockResolvedValue({ id: 'd1' });
    service = new SalaryService(asPrisma(prisma));
  });

  it('creates a payment for the driver', async () => {
    await service.create('d1', dto);
    expect(prisma.salaryPayment.create).toHaveBeenCalledWith({
      data: { driverId: 'd1', ...dto },
    });
  });

  it('lists payments oldest first', async () => {
    await service.findAll('d1');
    expect(prisma.salaryPayment.findMany).toHaveBeenCalledWith({
      where: { driverId: 'd1' },
      orderBy: { paidAt: 'asc' },
    });
  });

  it.each([
    ['create', (s: SalaryService) => s.create('d1', dto)],
    ['findAll', (s: SalaryService) => s.findAll('d1')],
  ])('%s throws NotFound for an unknown driver', async (_name, call) => {
    prisma.driver.findUnique.mockResolvedValue(null);
    await expect(call(service)).rejects.toThrow(NotFoundException);
    expect(prisma.salaryPayment.create).not.toHaveBeenCalled();
    expect(prisma.salaryPayment.findMany).not.toHaveBeenCalled();
  });
});
