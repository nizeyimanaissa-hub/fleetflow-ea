import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGpsPingDto {
  lat!: number;
  lng!: number;

  @ApiPropertyOptional()
  speedKmh?: number;

  @ApiPropertyOptional({
    description: 'Defaults to the current time if omitted',
  })
  recordedAt?: string;
}
