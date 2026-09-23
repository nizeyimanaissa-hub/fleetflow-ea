import { ApiPropertyOptional } from '@nestjs/swagger';
import type { DriverStatus } from '../../generated/prisma/client.js';
import { DriverStatus as DriverStatusEnum } from '../../generated/prisma/client.js';

export class UpdateDriverDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  licenseNumber?: string;
  licenseExpiry?: string;

  @ApiPropertyOptional({ enum: DriverStatusEnum })
  status?: DriverStatus;
}
