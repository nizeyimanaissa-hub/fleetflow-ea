import { z } from 'zod';
import { createZodDto } from '../../common/validation/create-zod-dto.js';
import {
  isoDate,
  latitude,
  longitude,
} from '../../common/validation/schemas.js';

export const createGpsPingSchema = z.object({
  lat: latitude(),
  lng: longitude(),
  speedKmh: z.number().nonnegative().optional(),
  recordedAt: isoDate()
    .optional()
    .meta({ description: 'Defaults to the current time if omitted' }),
});

export class CreateGpsPingDto extends createZodDto(createGpsPingSchema) {}
