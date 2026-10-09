import { ConflictException, NotFoundException } from '@nestjs/common';
import type { RoutingService } from '../routing/routing.service.js';
import {
  asPrisma,
  createPrismaMock,
  type PrismaMock,
} from '../../test/prisma-mock.js';
import { GpsService } from './gps.service.js';

const at = (iso: string) => new Date(iso);

// Straight north–south route along longitude 30, as OSRM [lng, lat] pairs.
const ROUTE: [number, number][] = [
  [30, -2],
  [30, -1.99],
  [30, -1.98],
];

function inProgressTrip(overrides: object = {}) {
  return {
    id: 't1',
    status: 'IN_PROGRESS',
    destinationLat: -1.98,
    destinationLng: 30,
    routeGeometry: ROUTE,
    estimatedArrival: at('2026-10-01T12:00:00Z'),
    ...overrides,
  };
}

describe('GpsService', () => {
  let prisma: PrismaMock;
  let routing: { route: ReturnType<typeof vi.fn> };
  let service: GpsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.trip.findUnique.mockResolvedValue(inProgressTrip());
    prisma.gpsPing.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'p1', ...data }),
    );
    prisma.trip.update.mockResolvedValue({});
    routing = {
      route: vi
        .fn()
        .mockResolvedValue({ distanceKm: 2, durationMin: 20, geometry: [] }),
    };
    service = new GpsService(
      asPrisma(prisma),
      routing as unknown as RoutingService,
    );
  });

  describe('ingest', () => {
    it('stores the ping and recomputes the ETA from it', async () => {
      const ping = await service.ingest('t1', {
        lat: -1.99,
        lng: 30,
        speedKmh: 40,
        recordedAt: at('2026-10-01T10:00:00Z'),
      });

      expect(routing.route).toHaveBeenCalledWith(-1.99, 30, -1.98, 30);
      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(prisma.gpsPing.create).toHaveBeenCalledWith({
        data: {
          tripId: 't1',
          lat: -1.99,
          lng: 30,
          speedKmh: 40,
          offRoute: false,
          recordedAt: at('2026-10-01T10:00:00Z'),
        },
      });
      expect(prisma.trip.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        // recordedAt + 20 min
        data: { estimatedArrival: at('2026-10-01T10:20:00Z') },
      });
      expect(ping).toMatchObject({ id: 'p1' });
    });

    it('defaults recordedAt to now', async () => {
      vi.useFakeTimers({ now: at('2026-10-01T09:00:00Z') });
      try {
        await service.ingest('t1', { lat: -2, lng: 30 });
      } finally {
        vi.useRealTimers();
      }

      expect(prisma.gpsPing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recordedAt: at('2026-10-01T09:00:00Z'),
        }),
      });
    });

    it.each([
      // 0.004° of longitude at -2° latitude is ~0.44 km
      ['~0.44 km from the route is on route', 30.004, false],
      // 0.005° is ~0.56 km, past the 0.5 km threshold
      ['~0.56 km from the route is off route', 30.005, true],
      ['far away is off route', 31, true],
    ])('%s', async (_name, lng, offRoute) => {
      await service.ingest('t1', { lat: -1.99, lng });
      expect(prisma.gpsPing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ offRoute }),
      });
    });

    // KNOWN BUG: isOffRoute measures distance to the nearest route *vertex*,
    // not the nearest segment. This ping sits on the route line, midway
    // between two vertices ~1.1 km apart, so it is wrongly flagged. OSRM
    // geometry has sparse vertices on long straight roads, so this happens
    // in practice. Remove `.fails` once isOffRoute measures to segments.
    it.fails(
      'treats a point between two route vertices as on route',
      async () => {
        await service.ingest('t1', { lat: -1.995, lng: 30 });
        expect(prisma.gpsPing.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ offRoute: false }),
        });
      },
    );

    it.each([null, []])(
      'never flags off route without route geometry (%j)',
      async (routeGeometry) => {
        prisma.trip.findUnique.mockResolvedValue(
          inProgressTrip({ routeGeometry }),
        );
        await service.ingest('t1', { lat: 10, lng: 10 });
        expect(prisma.gpsPing.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ offRoute: false }),
        });
      },
    );

    it('rejects an unknown trip', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);
      await expect(service.ingest('t1', { lat: 0, lng: 0 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it.each(['SCHEDULED', 'COMPLETED', 'CANCELLED'])(
      'rejects pings for a %s trip',
      async (status) => {
        prisma.trip.findUnique.mockResolvedValue(inProgressTrip({ status }));
        await expect(service.ingest('t1', { lat: 0, lng: 0 })).rejects.toThrow(
          ConflictException,
        );
        expect(routing.route).not.toHaveBeenCalled();
        expect(prisma.gpsPing.create).not.toHaveBeenCalled();
      },
    );

    it('stores nothing if routing fails', async () => {
      routing.route.mockRejectedValue(new Error('OSRM down'));
      await expect(service.ingest('t1', { lat: -2, lng: 30 })).rejects.toThrow(
        'OSRM down',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('history', () => {
    it('lists pings oldest first', async () => {
      await service.history('t1');
      expect(prisma.gpsPing.findMany).toHaveBeenCalledWith({
        where: { tripId: 't1' },
        orderBy: { recordedAt: 'asc' },
      });
    });

    it('rejects an unknown trip', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);
      await expect(service.history('t1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('latest', () => {
    it('returns the trip status, ETA and most recent ping', async () => {
      const lastPing = { id: 'p9' };
      prisma.gpsPing.findFirst.mockResolvedValue(lastPing);

      await expect(service.latest('t1')).resolves.toEqual({
        tripId: 't1',
        status: 'IN_PROGRESS',
        estimatedArrival: at('2026-10-01T12:00:00Z'),
        lastPing,
      });
      expect(prisma.gpsPing.findFirst).toHaveBeenCalledWith({
        where: { tripId: 't1' },
        orderBy: { recordedAt: 'desc' },
      });
    });

    it('returns a null ping before any have been recorded', async () => {
      prisma.gpsPing.findFirst.mockResolvedValue(null);
      await expect(service.latest('t1')).resolves.toMatchObject({
        lastPing: null,
      });
    });

    it('rejects an unknown trip', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);
      await expect(service.latest('t1')).rejects.toThrow(NotFoundException);
    });
  });
});
