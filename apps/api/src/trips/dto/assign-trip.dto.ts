import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssignTripDto {
  companyId!: string;
  driverId!: string;
  vehicleId!: string;
  startLocation!: string;

  @ApiPropertyOptional()
  endLocation?: string;

  scheduledStart!: string;
  scheduledEnd!: string;

  originLat!: number;
  originLng!: number;
  destinationLat!: number;
  destinationLng!: number;
}
