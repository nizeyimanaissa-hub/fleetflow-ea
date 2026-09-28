import { z } from 'zod';
import { DriverStatus } from '../../generated/prisma/client.js';
import { createZodDto } from '../../common/validation/create-zod-dto.js';
import { isoDate, nonEmptyString } from '../../common/validation/schemas.js';

export const createDriverSchema = z.object({
  companyId: z.uuid(),
  firstName: nonEmptyString(),
  lastName: nonEmptyString(),
  email: z.email(),
  phone: nonEmptyString(),
  licenseNumber: nonEmptyString(),
  licenseExpiry: isoDate(),
  status: z.enum(DriverStatus).optional(),
});

export class CreateDriverDto extends createZodDto(createDriverSchema) {}
