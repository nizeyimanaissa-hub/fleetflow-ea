import { z } from 'zod';
import { createZodDto } from '../../common/validation/create-zod-dto.js';

export const listTripsQuerySchema = z.object({
  companyId: z.uuid().optional(),
  driverId: z.uuid().optional(),
  vehicleId: z.uuid().optional(),
});

export class ListTripsQueryDto extends createZodDto(listTripsQuerySchema) {}
