import { z } from 'zod';
import { createZodDto } from '../../common/validation/create-zod-dto.js';
import {
  isoDate,
  latitude,
  longitude,
  nonEmptyString,
} from '../../common/validation/schemas.js';

export const assignTripSchema = z
  .object({
    companyId: z.uuid(),
    driverId: z.uuid(),
    vehicleId: z.uuid(),
    startLocation: nonEmptyString(),
    endLocation: nonEmptyString().optional(),
    scheduledStart: isoDate(),
    scheduledEnd: isoDate(),
    originLat: latitude(),
    originLng: longitude(),
    destinationLat: latitude(),
    destinationLng: longitude(),
  })
  .refine((trip) => trip.scheduledEnd > trip.scheduledStart, {
    error: 'scheduledEnd must be after scheduledStart',
    path: ['scheduledEnd'],
  });

export class AssignTripDto extends createZodDto(assignTripSchema) {}
