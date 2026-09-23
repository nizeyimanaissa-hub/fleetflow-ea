import { ApiPropertyOptional } from '@nestjs/swagger';
import type { VehicleStatus } from '../../generated/prisma/client.js';
import { VehicleStatus as VehicleStatusEnum } from '../../generated/prisma/client.js';

export class UpdateVehicleDto {
  plateNumber?: string;
  make?: string;
  model?: string;
  year?: number;

  @ApiPropertyOptional({ enum: VehicleStatusEnum })
  status?: VehicleStatus;

  @ApiPropertyOptional()
  odometerKm?: number;
}
