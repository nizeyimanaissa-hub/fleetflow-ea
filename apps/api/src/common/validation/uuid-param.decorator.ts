import { Param } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const uuidPipe = new ZodValidationPipe(z.uuid());

/** Route param that must be a UUID (every model id is `@default(uuid())`). */
export const UuidParam = (name: string) => Param(name, uuidPipe);
