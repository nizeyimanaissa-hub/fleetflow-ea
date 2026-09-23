import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMaintenanceRecordDto {
  description!: string;
  cost!: number;
  performedAt!: string;

  @ApiPropertyOptional()
  odometerKm?: number;
}
