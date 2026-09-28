import { createZodDto } from '../../common/validation/create-zod-dto.js';
import { createDriverSchema } from './create-driver.dto.js';

// A driver can't be moved to another company, so companyId isn't updatable.
export const updateDriverSchema = createDriverSchema
  .omit({ companyId: true })
  .partial();

export class UpdateDriverDto extends createZodDto(updateDriverSchema) {}
