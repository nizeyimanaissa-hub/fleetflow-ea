import { z } from 'zod';
import { createZodDto } from '../../common/validation/create-zod-dto.js';
import { isoDate, nonEmptyString } from '../../common/validation/schemas.js';

export const createMaintenanceRecordSchema = z.object({
  description: nonEmptyString(),
  cost: z.number().nonnegative(),
  performedAt: isoDate(),
  odometerKm: z.number().int().nonnegative().optional(),
});

export class CreateMaintenanceRecordDto extends createZodDto(
  createMaintenanceRecordSchema,
) {}
