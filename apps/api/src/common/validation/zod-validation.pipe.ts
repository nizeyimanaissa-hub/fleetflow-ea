import {
  BadRequestException,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import type { z } from 'zod';
import { isZodDto } from './create-zod-dto.js';

/**
 * Validates with an explicit schema when given one (e.g. for a single
 * @Param), otherwise with the schema of the parameter's DTO class if it was
 * built by createZodDto. Anything else passes through untouched.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: z.ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema =
      this.schema ??
      (isZodDto(metadata.metatype) ? metadata.metatype.schema : undefined);
    if (!schema) {
      return value;
    }

    // Express leaves req.body undefined when no JSON body is sent; validate
    // it as an empty object so each missing field is reported individually.
    const input = metadata.type === 'body' && value === undefined ? {} : value;

    const result = schema.safeParse(input);
    if (result.success) {
      return result.data;
    }

    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      issues: result.error.issues.map((issue) => ({
        path: [metadata.data, ...issue.path]
          .filter((segment) => segment !== undefined)
          .map(String)
          .join('.'),
        message: issue.message,
      })),
    });
  }
}
