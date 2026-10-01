import { z } from 'zod';

const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** ISO 8601 date or date-time string, parsed into a Date. */
export const isoDate = () =>
  z
    .string()
    .regex(ISO_DATE, 'must be an ISO 8601 date or date-time')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'must be a valid date')
    .meta({ format: 'date-time' })
    .transform((value) => new Date(value));

export const nonEmptyString = () => z.string().trim().min(1, 'must not be empty');

export const latitude = () => z.number().min(-90).max(90);

export const longitude = () => z.number().min(-180).max(180);
