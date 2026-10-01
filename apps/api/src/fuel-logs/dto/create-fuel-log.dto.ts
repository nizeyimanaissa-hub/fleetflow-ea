import { z } from 'zod';
import { createZodDto } from '../../common/validation/create-zod-dto.js';
import { isoDate } from '../../common/validation/schemas.js';

export const createFuelLogSchema = z.object({
  liters: z.number().positive(),
  costTotal: z.number().nonnegative(),
  odometerKm: z.number().int().nonnegative(),
  filledAt: isoDate(),
});

export class CreateFuelLogDto extends createZodDto(createFuelLogSchema) {}
