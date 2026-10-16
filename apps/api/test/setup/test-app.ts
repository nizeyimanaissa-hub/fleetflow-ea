import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { haversineKm } from '../../src/common/geo.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import {
  RoutingService,
  type RouteResult,
} from '../../src/routing/routing.service.js';

/** Average speed the fake router uses to turn distance into duration. */
export const FAKE_ROUTE_SPEED_KMH = 60;

/**
 * Stands in for OSRM (an external service, loaded with one region only):
 * routes are a straight line, so distances and ETAs are predictable.
 */
export class FakeRoutingService {
  route(
    originLat: number,
    originLng: number,
    destinationLat: number,
    destinationLng: number,
  ): Promise<RouteResult> {
    const distanceKm = haversineKm(
      originLat,
      originLng,
      destinationLat,
      destinationLng,
    );
    return Promise.resolve({
      distanceKm,
      durationMin: (distanceKm / FAKE_ROUTE_SPEED_KMH) * 60,
      geometry: [
        [originLng, originLat],
        [destinationLng, destinationLat],
      ],
    });
  }
}

export interface TestApp {
  app: INestApplication<App>;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
  /** Empties every table, for a clean slate between tests. */
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

/** The full app on the test database, with only routing faked. */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RoutingService)
    .useClass(FakeRoutingService)
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  await app.init();
  const prisma = app.get(PrismaService);

  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const truncate = `TRUNCATE ${tables
    .map(({ tablename }) => `"${tablename}"`)
    .join(', ')} CASCADE`;

  return {
    app,
    prisma,
    http: () => request(app.getHttpServer()),
    reset: async () => {
      await prisma.$executeRawUnsafe(truncate);
    },
    close: () => app.close(),
  };
}
