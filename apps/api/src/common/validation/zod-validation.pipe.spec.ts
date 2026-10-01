import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { z } from 'zod';
import { createZodDto } from './create-zod-dto.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

class PlainDto {}

class PersonDto extends createZodDto(
  z.object({
    name: z.string(),
    address: z.object({ city: z.string() }),
  }),
) {}

const body = (metatype?: ArgumentMetadata['metatype']): ArgumentMetadata => ({
  type: 'body',
  metatype,
});

function issuesOf(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).getResponse();
  }
  throw new Error('expected a BadRequestException');
}

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe();

  it('passes values through when the metatype is not a Zod DTO', () => {
    const value = { anything: true };
    expect(pipe.transform(value, body(PlainDto))).toBe(value);
    expect(pipe.transform('raw', body(String))).toBe('raw');
    expect(pipe.transform(value, body())).toBe(value);
  });

  it('returns the parsed data and strips unknown keys', () => {
    expect(
      pipe.transform(
        { name: 'Ada', address: { city: 'Kigali' }, extra: 1 },
        body(PersonDto),
      ),
    ).toEqual({ name: 'Ada', address: { city: 'Kigali' } });
  });

  it('reports each invalid field with a dotted path', () => {
    expect(
      issuesOf(() =>
        pipe.transform({ name: 42, address: {} }, body(PersonDto)),
      ),
    ).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      issues: [
        { path: 'name', message: expect.any(String) },
        { path: 'address.city', message: expect.any(String) },
      ],
    });
  });

  it('treats a missing body as an empty object', () => {
    const response = issuesOf(() =>
      pipe.transform(undefined, body(PersonDto)),
    ) as { issues: { path: string }[] };
    expect(response.issues.map((issue) => issue.path)).toEqual([
      'name',
      'address',
    ]);
  });

  it('prefixes the param name when validating a single param', () => {
    const uuidPipe = new ZodValidationPipe(z.uuid());
    const metadata: ArgumentMetadata = { type: 'param', data: 'id' };

    const id = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';
    expect(uuidPipe.transform(id, metadata)).toBe(id);
    expect(
      issuesOf(() => uuidPipe.transform('not-a-uuid', metadata)),
    ).toMatchObject({ issues: [{ path: 'id' }] });
  });
});
