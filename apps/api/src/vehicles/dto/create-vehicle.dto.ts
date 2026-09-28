import { z } from 'zod';
import { VehicleStatus } from '../../generated/prisma/client.js';
import { createZodDto } from '../../common/validation/create-zod-dto.js';
import { nonEmptyString } from '../../common/validation/schemas.js';

export const createVehicleSchema = z.object({
  companyId: z.uuid(),
  plateNumber: nonEmptyString(),
  make: nonEmptyString(),
  model: nonEmptyString(),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  status: z.enum(VehicleStatus).optional(),
  odometerKm: z.number().int().nonnegative().optional(),
});

export class CreateVehicleDto extends createZodDto(createVehicleSchema) {}
