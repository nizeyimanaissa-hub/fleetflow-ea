import { ApiProperty, type ApiPropertyOptions } from '@nestjs/swagger';
import { z } from 'zod';

type ObjectSchema = z.ZodType<object>;

export interface ZodDto<T extends ObjectSchema> {
  new (): z.output<T>;
  readonly schema: T;
}

/**
 * Builds a DTO class from a Zod object schema, so the schema is the single
 * definition of the DTO: ZodValidationPipe parses request data with
 * `schema`, and each property is registered with Swagger from the schema's
 * JSON Schema (the input side, i.e. what clients send).
 */
export function createZodDto<T extends ObjectSchema>(schema: T): ZodDto<T> {
  class ZodDtoClass {
    static readonly schema = schema;
  }

  const jsonSchema = z.toJSONSchema(schema, {
    io: 'input',
    target: 'openapi-3.0',
    unrepresentable: 'any',
  });
  const required = new Set(jsonSchema.required ?? []);
  for (const [key, property] of Object.entries(jsonSchema.properties ?? {})) {
    ApiProperty({
      ...(property as object),
      required: required.has(key),
    } as ApiPropertyOptions)(ZodDtoClass.prototype, key);
  }

  return ZodDtoClass as unknown as ZodDto<T>;
}

export function isZodDto(metatype: unknown): metatype is ZodDto<ObjectSchema> {
  return (
    typeof metatype === 'function' &&
    'schema' in metatype &&
    metatype.schema instanceof z.ZodType
  );
}
