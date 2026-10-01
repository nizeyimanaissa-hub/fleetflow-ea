import { z } from 'zod';
import { createZodDto } from '../../common/validation/create-zod-dto.js';
import { nonEmptyString } from '../../common/validation/schemas.js';

export const createCompanySchema = z.object({
  name: nonEmptyString(),
});

export class CreateCompanyDto extends createZodDto(createCompanySchema) {}
