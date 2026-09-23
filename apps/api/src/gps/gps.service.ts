import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoutingService } from '../routing/routing.service.js';
import { haversineKm } from '../common/geo.js';
import type { GpsPing } from '../generated/prisma/client.js';
import type { CreateGpsPingDto } from './dto/create-gps-ping.dto.js';

const OFF_ROUTE_THRESHOLD_KM = 0.5;

@Injectable()
export class GpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: RoutingService,
  ) {}

  async ingest(tripId: string, dto: CreateGpsPingDto): Promise<GpsPing> {
    if (
      typeof dto.lat !== 'number' ||
      typeof dto.lng !== 'number' ||
      Math.abs(dto.lat) > 90 ||
      Math.abs(dto.lng) > 180
    ) {
      throw new BadRequestException('lat/lng must be valid coordinates');
    }

    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }
    if (trip.status !== 'IN_PROGRESS') {
      throw new ConflictException(
        `Trip ${tripId} must be IN_PROGRESS to record GPS pings (currently ${trip.status})`,
      );
    }

    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();
    if (Number.isNaN(recordedAt.getTime())) {
      throw new BadRequestException('recordedAt must be a valid date');
    }

    const geometry = trip.routeGeometry as [number, number][] | null;
    const offRoute = this.isOffRoute(dto.lat, dto.lng, geometry);

    // Recompute ETA from the driver's current position to the destination.
    const route = await this.routing.route(
      dto.lat,
      dto.lng,
      trip.destinationLat,
      trip.destinationLng,
    );

    const [ping] = await this.prisma.$transaction([
      this.prisma.gpsPing.create({
        data: {
          tripId,
          lat: dto.lat,
          lng: dto.lng,
          speedKmh: dto.speedKmh,
          offRoute,
          recordedAt,
        },
      }),
      this.prisma.trip.update({
        where: { id: tripId },
        data: {
          estimatedArrival: new Date(
            recordedAt.getTime() + route.durationMin * 60_000,
          ),
        },
      }),
    ]);

    return ping;
  }

  async history(tripId: string): Promise<GpsPing[]> {
    await this.ensureTripExists(tripId);
    return this.prisma.gpsPing.findMany({
      where: { tripId },
      orderBy: { recordedAt: 'asc' },
    });
  }

  async latest(tripId: string) {
    const trip = await this.ensureTripExists(tripId);
    const lastPing = await this.prisma.gpsPing.findFirst({
      where: { tripId },
      orderBy: { recordedAt: 'desc' },
    });

    return {
      tripId: trip.id,
      status: trip.status,
      estimatedArrival: trip.estimatedArrival,
      lastPing,
    };
  }

  private async ensureTripExists(tripId: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }
    return trip;
  }

  private isOffRoute(
    lat: number,
    lng: number,
    geometry: [number, number][] | null,
  ): boolean {
    if (!geometry?.length) {
      return false;
    }
    const nearestKm = Math.min(
      ...geometry.map(([gLng, gLat]) => haversineKm(lat, lng, gLat, gLng)),
    );
    return nearestKm > OFF_ROUTE_THRESHOLD_KM;
  }
}
