import { z } from 'zod';
import { createZodDto } from '../../common/validation/create-zod-dto.js';
import { isoDate } from '../../common/validation/schemas.js';

export const createSalaryPaymentSchema = z
  .object({
    amount: z.number().nonnegative(),
    periodStart: isoDate(),
    periodEnd: isoDate(),
    paidAt: isoDate(),
  })
  .refine((payment) => payment.periodEnd > payment.periodStart, {
    error: 'periodEnd must be after periodStart',
    path: ['periodEnd'],
  });

export class CreateSalaryPaymentDto extends createZodDto(
  createSalaryPaymentSchema,
) {}
