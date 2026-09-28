import { createZodDto } from '../../common/validation/create-zod-dto.js';
import { createCompanySchema } from './create-company.dto.js';

export const updateCompanySchema = createCompanySchema.partial();

export class UpdateCompanyDto extends createZodDto(updateCompanySchema) {}
