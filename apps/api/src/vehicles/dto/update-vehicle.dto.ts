import { createZodDto } from '../../common/validation/create-zod-dto.js';
import { createVehicleSchema } from './create-vehicle.dto.js';

// A vehicle can't be moved to another company, so companyId isn't updatable.
export const updateVehicleSchema = createVehicleSchema
  .omit({ companyId: true })
  .partial();

export class UpdateVehicleDto extends createZodDto(updateVehicleSchema) {}
