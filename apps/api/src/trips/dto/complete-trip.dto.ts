import { z } from 'zod';
import { createZodDto } from '../../common/validation/create-zod-dto.js';

export const completeTripSchema = z.object({
  distanceKm: z
    .number()
    .positive()
    .optional()
    .meta({
      description:
        'Actual distance driven; defaults to the planned route distance',
    }),
});

export class CompleteTripDto extends createZodDto(completeTripSchema) {}
