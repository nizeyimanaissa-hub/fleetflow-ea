import { z } from 'zod';
import { createZodDto } from './create-zod-dto.js';
import { isoDate } from './schemas.js';

export const dateRangeQuerySchema = z
  .object({
    from: isoDate().optional(),
    to: isoDate().optional(),
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    error: 'from must be on or before to',
    path: ['to'],
  });

export class DateRangeQueryDto extends createZodDto(dateRangeQuerySchema) {}

export const companyFilterQuerySchema = z.object({
  companyId: z.uuid().optional(),
});

export class CompanyFilterQueryDto extends createZodDto(
  companyFilterQuerySchema,
) {}
