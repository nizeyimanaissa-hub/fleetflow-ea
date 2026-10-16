import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Trip } from '../generated/prisma/client.js';
import type { RoutingService } from '../routing/routing.service.js';
import {
  asPrisma,
  createPrismaMock,
  type PrismaMock,
} from '../../test/prisma-mock.js';
import type { AssignTripDto } from './dto/assign-trip.dto.js';
import { TripsService } from './trips.service.js';

const COMPANY = 'company-1';
const DRIVER = 'driver-1';
const VEHICLE = 'vehicle-1';

const at = (iso: string) => new Date(iso);

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-x',
    companyId: COMPANY,
    driverId: DRIVER,
    vehicleId: VEHICLE,
    status: 'SCHEDULED',
    scheduledStart: at('2026-10-01T08:00:00Z'),
    scheduledEnd: at('2026-10-01T12:00:00Z'),
    startedAt: null,
    endedAt: null,
    distanceKm: null,
    routeDistanceKm: null,
    ...overrides,
  } as Trip;
}

/** A 4h trip on 2026-10-10, 08:00–12:00 UTC. */
function assignDto(overrides: Partial<AssignTripDto> = {}): AssignTripDto {
  return {
    companyId: COMPANY,
    driverId: DRIVER,
    vehicleId: VEHICLE,
    startLocation: 'Kigali',
    scheduledStart: at('2026-10-10T08:00:00Z'),
    scheduledEnd: at('2026-10-10T12:00:00Z'),
    originLat: -1.95,
    originLng: 30.06,
    destinationLat: -2.6,
    destinationLng: 29.74,
    ...overrides,
  };
}

describe('TripsService', () => {
  let prisma: PrismaMock;
  let routing: { route: ReturnType<typeof vi.fn> };
  let service: TripsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    routing = {
      route: vi.fn().mockResolvedValue({
        distanceKm: 160,
        durationMin: 150,
        geometry: [
          [30.06, -1.95],
          [29.74, -2.6],
        ],
      }),
    };
    service = new TripsService(
      asPrisma(prisma),
      routing as unknown as RoutingService,
    );
  });

  describe('assign', () => {
    /** Sets up a valid driver/vehicle, an optional rule, and existing trips. */
    function given({
      driverTrips = [] as Trip[],
      vehicleOverlap = null as Trip | null,
      rule = null as object | null,
    } = {}) {
      prisma.driver.findFirst.mockResolvedValue({ id: DRIVER });
      prisma.vehicle.findFirst.mockResolvedValue({ id: VEHICLE });
      prisma.schedulingRule.findUnique.mockResolvedValue(rule);
      prisma.trip.findMany.mockResolvedValue(driverTrips);
      prisma.trip.findFirst.mockResolvedValue(vehicleOverlap);
      prisma.trip.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'new-trip', ...data }),
      );
    }

    async function expectConflict(dto: AssignTripDto, message: RegExp) {
      const result = service.assign(dto);
      await expect(result).rejects.toThrow(ConflictException);
      await expect(result).rejects.toThrow(message);
      expect(routing.route).not.toHaveBeenCalled();
      expect(prisma.trip.create).not.toHaveBeenCalled();
    }

    it('creates a scheduled trip with the route attached', async () => {
      given();

      const created = await service.assign(assignDto());

      expect(routing.route).toHaveBeenCalledWith(-1.95, 30.06, -2.6, 29.74);
      expect(prisma.trip.create).toHaveBeenCalledWith({
        data: {
          companyId: COMPANY,
          driverId: DRIVER,
          vehicleId: VEHICLE,
          startLocation: 'Kigali',
          endLocation: undefined,
          scheduledStart: at('2026-10-10T08:00:00Z'),
          scheduledEnd: at('2026-10-10T12:00:00Z'),
          status: 'SCHEDULED',
          originLat: -1.95,
          originLng: 30.06,
          destinationLat: -2.6,
          destinationLng: 29.74,
          routeDistanceKm: 160,
          routeDurationMin: 150,
          routeGeometry: [
            [30.06, -1.95],
            [29.74, -2.6],
          ],
          // scheduledStart + 150 min
          estimatedArrival: at('2026-10-10T10:30:00Z'),
        },
      });
      expect(created.id).toBe('new-trip');
    });

    it('looks the driver and vehicle up within the company', async () => {
      given();
      await service.assign(assignDto());

      expect(prisma.driver.findFirst).toHaveBeenCalledWith({
        where: { id: DRIVER, companyId: COMPANY },
      });
      expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({
        where: { id: VEHICLE, companyId: COMPANY },
      });
    });

    it('queries vehicle overlaps against active trips in the window', async () => {
      given();
      await service.assign(assignDto());

      expect(prisma.trip.findFirst).toHaveBeenCalledWith({
        where: {
          vehicleId: VEHICLE,
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          scheduledStart: { lt: at('2026-10-10T12:00:00Z') },
          scheduledEnd: { gt: at('2026-10-10T08:00:00Z') },
        },
      });
    });

    it('rejects a driver outside the company', async () => {
      given();
      prisma.driver.findFirst.mockResolvedValue(null);
      await expect(service.assign(assignDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a vehicle outside the company', async () => {
      given();
      prisma.vehicle.findFirst.mockResolvedValue(null);
      await expect(service.assign(assignDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a vehicle that is already booked', async () => {
      given({ vehicleOverlap: trip({ id: 'busy-vehicle' }) });
      await expectConflict(assignDto(), /Vehicle .* trip busy-vehicle/);
    });

    it('rejects a driver who is already booked', async () => {
      given({
        driverTrips: [
          trip({
            id: 'busy-driver',
            scheduledStart: at('2026-10-10T11:00:00Z'),
            scheduledEnd: at('2026-10-10T14:00:00Z'),
          }),
        ],
      });
      await expectConflict(assignDto(), /Driver .* trip busy-driver/);
    });

    it('allows back-to-back trips that only touch at the edges', async () => {
      // Rest rule set to 0 so only the overlap check is in play.
      given({
        rule: { minRestHoursBetweenTrips: 0 },
        driverTrips: [
          trip({
            scheduledStart: at('2026-10-10T04:00:00Z'),
            scheduledEnd: at('2026-10-10T08:00:00Z'),
          }),
        ],
      });
      await expect(
        service.assign(assignDto({ scheduledEnd: at('2026-10-10T10:00:00Z') })),
      ).resolves.toBeDefined();
    });

    it('rejects too little rest after the previous trip (default 11h)', async () => {
      given({
        driverTrips: [
          trip({
            id: 'earlier',
            scheduledStart: at('2026-10-09T19:00:00Z'),
            scheduledEnd: at('2026-10-09T23:00:00Z'),
          }),
        ],
      });
      await expectConflict(
        assignDto(),
        /needs 11h rest .* only 9\.0h since trip earlier/,
      );
    });

    it('rejects too little rest before the next trip', async () => {
      given({
        driverTrips: [
          trip({
            id: 'later',
            scheduledStart: at('2026-10-10T20:00:00Z'),
            scheduledEnd: at('2026-10-10T22:00:00Z'),
          }),
        ],
      });
      await expectConflict(
        assignDto(),
        /needs 11h rest .* only 8\.0h before trip later/,
      );
    });

    it('accepts exactly the minimum rest', async () => {
      given({
        driverTrips: [
          trip({
            scheduledStart: at('2026-10-09T17:00:00Z'),
            scheduledEnd: at('2026-10-09T21:00:00Z'),
          }),
        ],
      });
      await expect(service.assign(assignDto())).resolves.toBeDefined();
    });

    it("uses the company's scheduling rule over the defaults", async () => {
      // 9h rest would fail the 11h default but passes a 6h rule.
      given({
        rule: { minRestHoursBetweenTrips: 6 },
        driverTrips: [
          trip({
            scheduledStart: at('2026-10-09T19:00:00Z'),
            scheduledEnd: at('2026-10-09T23:00:00Z'),
          }),
        ],
      });
      await expect(service.assign(assignDto())).resolves.toBeDefined();
    });

    it('rejects going over the daily limit (default 8h)', async () => {
      // 5h earlier the same UTC day + this 4h trip = 9h.
      given({
        rule: { minRestHoursBetweenTrips: 0 },
        driverTrips: [
          trip({
            scheduledStart: at('2026-10-10T00:00:00Z'),
            scheduledEnd: at('2026-10-10T05:00:00Z'),
          }),
        ],
      });
      await expectConflict(assignDto(), /9\.0h for the day, over the 8h/);
    });

    it('allows exactly the daily limit', async () => {
      given({
        rule: { minRestHoursBetweenTrips: 0 },
        driverTrips: [
          trip({
            scheduledStart: at('2026-10-10T00:00:00Z'),
            scheduledEnd: at('2026-10-10T04:00:00Z'),
          }),
        ],
      });
      await expect(service.assign(assignDto())).resolves.toBeDefined();
    });

    it('does not count trips from other days toward the daily limit', async () => {
      given({
        rule: { minRestHoursBetweenTrips: 0 },
        driverTrips: [
          trip({
            scheduledStart: at('2026-10-09T08:00:00Z'),
            scheduledEnd: at('2026-10-09T16:00:00Z'),
          }),
        ],
      });
      await expect(service.assign(assignDto())).resolves.toBeDefined();
    });

    it('rejects going over the rolling weekly limit (default 48h)', async () => {
      // 8h on each of the six previous days + this 4h trip = 52h.
      const previousSixDays = [4, 5, 6, 7, 8, 9].map((day) =>
        trip({
          scheduledStart: at(`2026-10-0${day}T08:00:00Z`),
          scheduledEnd: at(`2026-10-0${day}T16:00:00Z`),
        }),
      );
      given({ driverTrips: previousSixDays });
      await expectConflict(
        assignDto(),
        /52\.0h for the rolling week, over the 48h/,
      );
    });

    it('ignores trips that start before the seven-day window', async () => {
      // The window runs back 7 days from this trip's end, to 10-03 12:00.
      // The 10-03 trip starts before that, so only 40h + 4h = 44h counts.
      const history = [3, 4, 5, 6, 7, 8].map((day) =>
        trip({
          scheduledStart: at(`2026-10-0${day}T08:00:00Z`),
          scheduledEnd: at(`2026-10-0${day}T16:00:00Z`),
        }),
      );
      given({ driverTrips: history });
      await expect(service.assign(assignDto())).resolves.toBeDefined();
    });
  });

  describe('findAll', () => {
    it('filters by the given ids, ordered by start', async () => {
      prisma.trip.findMany.mockResolvedValue([]);
      await service.findAll({ driverId: DRIVER });
      expect(prisma.trip.findMany).toHaveBeenCalledWith({
        where: { companyId: undefined, driverId: DRIVER, vehicleId: undefined },
        orderBy: { scheduledStart: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('returns the trip', async () => {
      const found = trip({ id: 't1' });
      prisma.trip.findUnique.mockResolvedValue(found);
      await expect(service.findOne('t1')).resolves.toBe(found);
    });

    it('throws when the trip does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);
      await expect(service.findOne('t1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it.each(['SCHEDULED', 'IN_PROGRESS'] as const)(
      'cancels a %s trip',
      async (status) => {
        prisma.trip.findUnique.mockResolvedValue(trip({ id: 't1', status }));
        await service.cancel('t1');
        expect(prisma.trip.update).toHaveBeenCalledWith({
          where: { id: 't1' },
          data: { status: 'CANCELLED' },
        });
      },
    );

    it.each(['COMPLETED', 'CANCELLED'] as const)(
      'refuses to cancel a %s trip',
      async (status) => {
        prisma.trip.findUnique.mockResolvedValue(trip({ id: 't1', status }));
        await expect(service.cancel('t1')).rejects.toThrow(ConflictException);
        expect(prisma.trip.update).not.toHaveBeenCalled();
      },
    );
  });

  describe('start', () => {
    it('moves a scheduled trip to in progress', async () => {
      prisma.trip.findUnique.mockResolvedValue(trip({ id: 't1' }));
      await service.start('t1');
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { status: 'IN_PROGRESS', startedAt: expect.any(Date) },
      });
    });

    it.each(['IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const)(
      'refuses to start a %s trip',
      async (status) => {
        prisma.trip.findUnique.mockResolvedValue(trip({ id: 't1', status }));
        await expect(service.start('t1')).rejects.toThrow(ConflictException);
        expect(prisma.trip.update).not.toHaveBeenCalled();
      },
    );
  });

  describe('complete', () => {
    beforeEach(() => {
      prisma.trip.update.mockResolvedValue(trip({ status: 'COMPLETED' }));
      prisma.vehicle.update.mockResolvedValue({});
    });

    it.each(['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const)(
      'refuses to complete a %s trip',
      async (status) => {
        prisma.trip.findUnique.mockResolvedValue(trip({ id: 't1', status }));
        await expect(service.complete('t1')).rejects.toThrow(ConflictException);
        expect(prisma.trip.update).not.toHaveBeenCalled();
      },
    );

    it('records the reported distance and advances the odometer', async () => {
      prisma.trip.findUnique.mockResolvedValue(
        trip({ id: 't1', status: 'IN_PROGRESS', routeDistanceKm: 160 }),
      );

      await service.complete('t1', 172.6);

      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: {
          status: 'COMPLETED',
          endedAt: expect.any(Date),
          distanceKm: 172.6,
        },
      });
      expect(prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: VEHICLE },
        data: { odometerKm: { increment: 173 } },
      });
    });

    it('falls back to the planned route distance', async () => {
      prisma.trip.findUnique.mockResolvedValue(
        trip({ id: 't1', status: 'IN_PROGRESS', routeDistanceKm: 160 }),
      );

      await service.complete('t1');

      expect(prisma.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ distanceKm: 160 }),
        }),
      );
      expect(prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: VEHICLE },
        data: { odometerKm: { increment: 160 } },
      });
    });

    it('completes without touching the odometer when no distance is known', async () => {
      prisma.trip.findUnique.mockResolvedValue(
        trip({ id: 't1', status: 'IN_PROGRESS', routeDistanceKm: null }),
      );

      await service.complete('t1');

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.vehicle.update).not.toHaveBeenCalled();
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { status: 'COMPLETED', endedAt: expect.any(Date) },
      });
    });
  });
});
