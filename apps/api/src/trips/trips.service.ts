import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Trip } from '../generated/prisma/client.js';
import { AssignTripDto } from './dto/assign-trip.dto.js';

const HOUR_MS = 3_600_000;

// Fallback limits for companies that haven't configured a SchedulingRule yet.
const DEFAULT_MAX_DAILY_HOURS = 8;
const DEFAULT_MAX_WEEKLY_HOURS = 48;
const DEFAULT_MIN_REST_HOURS = 11;

const ACTIVE_TRIP_STATUSES = ['SCHEDULED', 'IN_PROGRESS'] as const;

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async assign(dto: AssignTripDto): Promise<Trip> {
    const scheduledStart = new Date(dto.scheduledStart);
    const scheduledEnd = new Date(dto.scheduledEnd);

    if (
      Number.isNaN(scheduledStart.getTime()) ||
      Number.isNaN(scheduledEnd.getTime())
    ) {
      throw new BadRequestException(
        'scheduledStart and scheduledEnd must be valid dates',
      );
    }
    if (scheduledEnd <= scheduledStart) {
      throw new BadRequestException(
        'scheduledEnd must be after scheduledStart',
      );
    }

    const [driver, vehicle, rule] = await Promise.all([
      this.prisma.driver.findFirst({
        where: { id: dto.driverId, companyId: dto.companyId },
      }),
      this.prisma.vehicle.findFirst({
        where: { id: dto.vehicleId, companyId: dto.companyId },
      }),
      this.prisma.schedulingRule.findUnique({
        where: { companyId: dto.companyId },
      }),
    ]);

    if (!driver) {
      throw new NotFoundException(
        `Driver ${dto.driverId} not found in this company`,
      );
    }
    if (!vehicle) {
      throw new NotFoundException(
        `Vehicle ${dto.vehicleId} not found in this company`,
      );
    }

    const maxDailyHours = rule?.maxDrivingHoursPerDay ?? DEFAULT_MAX_DAILY_HOURS;
    const maxWeeklyHours =
      rule?.maxDrivingHoursPerWeek ?? DEFAULT_MAX_WEEKLY_HOURS;
    const minRestHours = rule?.minRestHoursBetweenTrips ?? DEFAULT_MIN_REST_HOURS;

    const [driverTrips, vehicleOverlap]: [Trip[], Trip | null] = await Promise.all([
      this.prisma.trip.findMany({
        where: { driverId: dto.driverId, status: { in: [...ACTIVE_TRIP_STATUSES] } },
        orderBy: { scheduledStart: 'asc' },
      }),
      this.prisma.trip.findFirst({
        where: {
          vehicleId: dto.vehicleId,
          status: { in: [...ACTIVE_TRIP_STATUSES] },
          scheduledStart: { lt: scheduledEnd },
          scheduledEnd: { gt: scheduledStart },
        },
      }),
    ]);

    if (vehicleOverlap) {
      throw new ConflictException(
        `Vehicle is already assigned to trip ${vehicleOverlap.id} during that window`,
      );
    }

    const driverOverlap = driverTrips.find(
      (t) => t.scheduledStart < scheduledEnd && t.scheduledEnd > scheduledStart,
    );
    if (driverOverlap) {
      throw new ConflictException(
        `Driver is already assigned to trip ${driverOverlap.id} during that window`,
      );
    }

    const previousTrip = driverTrips
      .filter((t) => t.scheduledEnd <= scheduledStart)
      .at(-1);
    if (previousTrip) {
      const restHours =
        (scheduledStart.getTime() - previousTrip.scheduledEnd.getTime()) /
        HOUR_MS;
      if (restHours < minRestHours) {
        throw new ConflictException(
          `Driver needs ${minRestHours}h rest between trips; only ${restHours.toFixed(1)}h since trip ${previousTrip.id}`,
        );
      }
    }

    const nextTrip = driverTrips.find((t) => t.scheduledStart >= scheduledEnd);
    if (nextTrip) {
      const restHours =
        (nextTrip.scheduledStart.getTime() - scheduledEnd.getTime()) / HOUR_MS;
      if (restHours < minRestHours) {
        throw new ConflictException(
          `Driver needs ${minRestHours}h rest between trips; only ${restHours.toFixed(1)}h before trip ${nextTrip.id}`,
        );
      }
    }

    const durationHours =
      (scheduledEnd.getTime() - scheduledStart.getTime()) / HOUR_MS;

    const dayStart = new Date(scheduledStart);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const dailyHours = driverTrips
      .filter((t) => t.scheduledStart >= dayStart && t.scheduledStart < dayEnd)
      .reduce(
        (sum, t) =>
          sum + (t.scheduledEnd.getTime() - t.scheduledStart.getTime()) / HOUR_MS,
        durationHours,
      );

    if (dailyHours > maxDailyHours) {
      throw new ConflictException(
        `Assigning this trip would put the driver at ${dailyHours.toFixed(1)}h for the day, over the ${maxDailyHours}h limit`,
      );
    }

    // Rolling 7-day window ending at this trip, rather than a calendar week,
    // so the cap reflects actual hours worked in the preceding week.
    const weekStart = new Date(scheduledEnd.getTime() - 7 * 24 * HOUR_MS);
    const weeklyHours = driverTrips
      .filter((t) => t.scheduledStart >= weekStart && t.scheduledStart < scheduledEnd)
      .reduce(
        (sum, t) =>
          sum + (t.scheduledEnd.getTime() - t.scheduledStart.getTime()) / HOUR_MS,
        durationHours,
      );

    if (weeklyHours > maxWeeklyHours) {
      throw new ConflictException(
        `Assigning this trip would put the driver at ${weeklyHours.toFixed(1)}h for the rolling week, over the ${maxWeeklyHours}h limit`,
      );
    }

    return this.prisma.trip.create({
      data: {
        companyId: dto.companyId,
        driverId: dto.driverId,
        vehicleId: dto.vehicleId,
        startLocation: dto.startLocation,
        endLocation: dto.endLocation,
        scheduledStart,
        scheduledEnd,
        status: 'SCHEDULED',
      },
    });
  }

  findAll(filters: {
    companyId?: string;
    driverId?: string;
    vehicleId?: string;
  }): Promise<Trip[]> {
    return this.prisma.trip.findMany({
      where: {
        companyId: filters.companyId,
        driverId: filters.driverId,
        vehicleId: filters.vehicleId,
      },
      orderBy: { scheduledStart: 'asc' },
    });
  }

  async findOne(id: string): Promise<Trip> {
    const trip = await this.prisma.trip.findUnique({ where: { id } });
    if (!trip) {
      throw new NotFoundException(`Trip ${id} not found`);
    }
    return trip;
  }

  async cancel(id: string): Promise<Trip> {
    const trip = await this.findOne(id);
    if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
      throw new ConflictException(
        `Trip ${id} is already ${trip.status.toLowerCase()}`,
      );
    }
    return this.prisma.trip.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async start(id: string): Promise<Trip> {
    const trip = await this.findOne(id);
    if (trip.status !== 'SCHEDULED') {
      throw new ConflictException(
        `Trip ${id} must be SCHEDULED to start (currently ${trip.status})`,
      );
    }
    return this.prisma.trip.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
  }

  async complete(id: string, distanceKm?: number): Promise<Trip> {
    const trip = await this.findOne(id);
    if (trip.status !== 'IN_PROGRESS') {
      throw new ConflictException(
        `Trip ${id} must be IN_PROGRESS to complete (currently ${trip.status})`,
      );
    }
    return this.prisma.trip.update({
      where: { id },
      data: { status: 'COMPLETED', endedAt: new Date(), distanceKm },
    });
  }
}
