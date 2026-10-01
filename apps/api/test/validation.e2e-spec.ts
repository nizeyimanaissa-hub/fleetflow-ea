import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { type Mock } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { CompaniesService } from './../src/companies/companies.service.js';
import { DriversService } from './../src/drivers/drivers.service.js';
import { VehiclesService } from './../src/vehicles/vehicles.service.js';
import { TripsService } from './../src/trips/trips.service.js';
import { GpsService } from './../src/gps/gps.service.js';
import { FuelLogsService } from './../src/fuel-logs/fuel-logs.service.js';
import { MaintenanceService } from './../src/maintenance/maintenance.service.js';
import { SalaryService } from './../src/salary/salary.service.js';
import { ReportsService } from './../src/reports/reports.service.js';

// Every service is stubbed, so these tests exercise only routing and request
// validation and need no database: a request that passes validation reaches
// a stub that returns {}.
const services = {
  companies: [
    CompaniesService,
    ['create', 'findAll', 'findOne', 'update', 'remove'],
  ],
  drivers: [
    DriversService,
    ['create', 'findAll', 'findOne', 'update', 'remove'],
  ],
  vehicles: [
    VehiclesService,
    ['create', 'findAll', 'findOne', 'update', 'remove'],
  ],
  trips: [
    TripsService,
    ['assign', 'findAll', 'findOne', 'cancel', 'start', 'complete'],
  ],
  gps: [GpsService, ['ingest', 'history', 'latest']],
  fuelLogs: [FuelLogsService, ['create', 'findAll', 'consumption']],
  maintenance: [MaintenanceService, ['create', 'findAll']],
  salary: [SalaryService, ['create', 'findAll']],
  reports: [
    ReportsService,
    [
      'costReport',
      'companyPerformance',
      'driverPerformance',
      'vehiclePerformance',
    ],
  ],
} as const;

type Stubs = {
  [K in keyof typeof services]: Record<(typeof services)[K][1][number], Mock>;
};

const ID = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';

const validDriver = {
  companyId: ID,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '+250700000000',
  licenseNumber: 'LIC-1',
  licenseExpiry: '2030-01-01',
};

const validVehicle = {
  companyId: ID,
  plateNumber: 'RAB 123 A',
  make: 'Toyota',
  model: 'Hilux',
  year: 2020,
};

const validTrip = {
  companyId: ID,
  driverId: ID,
  vehicleId: ID,
  startLocation: 'Kigali',
  scheduledStart: '2026-10-01T08:00:00Z',
  scheduledEnd: '2026-10-01T12:00:00Z',
  originLat: -1.95,
  originLng: 30.06,
  destinationLat: -2.6,
  destinationLng: 29.74,
};

const validGpsPing = { lat: -1.95, lng: 30.06 };

const validFuelLog = {
  liters: 40,
  costTotal: 60,
  odometerKm: 12000,
  filledAt: '2026-10-01',
};

const validMaintenance = {
  description: 'Oil change',
  cost: 80,
  performedAt: '2026-10-01',
};

const validSalary = {
  amount: 500,
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  paidAt: '2026-10-01',
};

describe('Request validation (e2e)', () => {
  let app: INestApplication<App>;
  let stubs: Stubs;
  let http: () => ReturnType<typeof request>;

  beforeAll(async () => {
    stubs = {} as Stubs;
    let builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({});
    for (const [name, [token, methods]] of Object.entries(services)) {
      const stub = Object.fromEntries(
        methods.map((method) => [method, vi.fn().mockResolvedValue({})]),
      );
      (stubs as Record<string, unknown>)[name] = stub;
      builder = builder.overrideProvider(token).useValue(stub);
    }

    app = (await builder.compile()).createNestApplication();
    await app.init();
    http = () => request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const issuePaths = (res: request.Response) =>
    (res.body.issues as { path: string }[]).map((issue) => issue.path);

  /** Asserts a 400 whose issues include each of `paths`, and no service ran. */
  function expectRejected(res: request.Response, ...paths: string[]) {
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
    });
    expect(issuePaths(res)).toEqual(expect.arrayContaining(paths));
    for (const stub of Object.values(stubs)) {
      for (const method of Object.values(stub)) {
        expect(method).not.toHaveBeenCalled();
      }
    }
  }

  describe('UUID route params', () => {
    it.each([
      ['get', '/companies/nope', 'id'],
      ['patch', '/companies/nope', 'id'],
      ['delete', '/companies/nope', 'id'],
      ['get', '/drivers/nope', 'id'],
      ['patch', '/drivers/nope', 'id'],
      ['delete', '/drivers/nope', 'id'],
      ['get', '/vehicles/nope', 'id'],
      ['patch', '/vehicles/nope', 'id'],
      ['delete', '/vehicles/nope', 'id'],
      ['get', '/trips/nope', 'id'],
      ['patch', '/trips/nope/cancel', 'id'],
      ['patch', '/trips/nope/start', 'id'],
      ['patch', '/trips/nope/complete', 'id'],
      ['post', '/trips/nope/gps', 'tripId', validGpsPing],
      ['get', '/trips/nope/gps', 'tripId'],
      ['get', '/trips/nope/location', 'tripId'],
      ['post', '/vehicles/nope/fuel-logs', 'vehicleId', validFuelLog],
      ['get', '/vehicles/nope/fuel-logs', 'vehicleId'],
      ['get', '/vehicles/nope/fuel-consumption', 'vehicleId'],
      [
        'post',
        '/vehicles/nope/maintenance-records',
        'vehicleId',
        validMaintenance,
      ],
      ['get', '/vehicles/nope/maintenance-records', 'vehicleId'],
      ['post', '/drivers/nope/salary-payments', 'driverId', validSalary],
      ['get', '/drivers/nope/salary-payments', 'driverId'],
      ['get', '/companies/nope/cost-report', 'companyId'],
      ['get', '/companies/nope/performance', 'companyId'],
      ['get', '/drivers/nope/performance', 'driverId'],
      ['get', '/vehicles/nope/performance', 'vehicleId'],
    ] as const)(
      '%s %s rejects a non-UUID %s',
      async (method, url, param, body?: object) => {
        // POST routes get a valid body, so the param is the only thing wrong.
        expectRejected(await http()[method](url).send(body), param);
      },
    );
  });

  describe('missing bodies', () => {
    it.each([
      ['/companies', ['name']],
      ['/drivers', ['companyId', 'firstName', 'email', 'licenseExpiry']],
      ['/vehicles', ['companyId', 'plateNumber', 'year']],
      ['/trips/assign', ['companyId', 'scheduledStart', 'originLat']],
      [`/trips/${ID}/gps`, ['lat', 'lng']],
      [`/vehicles/${ID}/fuel-logs`, ['liters', 'filledAt']],
      [`/vehicles/${ID}/maintenance-records`, ['description', 'cost']],
      [`/drivers/${ID}/salary-payments`, ['amount', 'paidAt']],
    ])('POST %s reports every required field', async (url, paths) => {
      expectRejected(await http().post(url), ...paths);
    });
  });

  describe('field rules', () => {
    it('companies: rejects a blank name', async () => {
      expectRejected(
        await http().post('/companies').send({ name: '   ' }),
        'name',
      );
    });

    it('drivers: rejects a bad email, date, and status', async () => {
      const res = await http()
        .post('/drivers')
        .send({
          ...validDriver,
          email: 'not-an-email',
          licenseExpiry: '01/01/2030',
          status: 'ON_HOLIDAY',
        });
      expectRejected(res, 'email', 'licenseExpiry', 'status');
    });

    it('drivers: rejects a non-UUID companyId', async () => {
      const res = await http()
        .post('/drivers')
        .send({ ...validDriver, companyId: '123' });
      expectRejected(res, 'companyId');
    });

    it('vehicles: rejects an out-of-range year and fractional odometer', async () => {
      const res = await http()
        .post('/vehicles')
        .send({ ...validVehicle, year: 1850, odometerKm: 12.5 });
      expectRejected(res, 'year', 'odometerKm');
    });

    it('vehicles: rejects a numeric string where a number is expected', async () => {
      const res = await http()
        .post('/vehicles')
        .send({ ...validVehicle, year: '2020' });
      expectRejected(res, 'year');
    });

    it('trips: rejects coordinates out of range', async () => {
      const res = await http()
        .post('/trips/assign')
        .send({ ...validTrip, originLat: 91, destinationLng: -181 });
      expectRejected(res, 'originLat', 'destinationLng');
    });

    it('trips: rejects scheduledEnd before scheduledStart', async () => {
      const res = await http()
        .post('/trips/assign')
        .send({ ...validTrip, scheduledEnd: '2026-10-01T07:00:00Z' });
      expectRejected(res, 'scheduledEnd');
    });

    it('trips: rejects a non-positive distance on completion', async () => {
      const res = await http()
        .patch(`/trips/${ID}/complete`)
        .send({ distanceKm: 0 });
      expectRejected(res, 'distanceKm');
    });

    it('gps: rejects a negative speed', async () => {
      const res = await http()
        .post(`/trips/${ID}/gps`)
        .send({ ...validGpsPing, speedKmh: -5 });
      expectRejected(res, 'speedKmh');
    });

    it('fuel logs: rejects zero liters and negative cost', async () => {
      const res = await http()
        .post(`/vehicles/${ID}/fuel-logs`)
        .send({ ...validFuelLog, liters: 0, costTotal: -1 });
      expectRejected(res, 'liters', 'costTotal');
    });

    it('maintenance: rejects a negative cost', async () => {
      const res = await http()
        .post(`/vehicles/${ID}/maintenance-records`)
        .send({ ...validMaintenance, cost: -10 });
      expectRejected(res, 'cost');
    });

    it('salary: rejects periodEnd not after periodStart', async () => {
      const res = await http()
        .post(`/drivers/${ID}/salary-payments`)
        .send({ ...validSalary, periodEnd: '2026-08-31' });
      expectRejected(res, 'periodEnd');
    });
  });

  describe('query strings', () => {
    it.each(['/drivers', '/vehicles'])(
      'GET %s rejects a non-UUID companyId',
      async (url) => {
        expectRejected(
          await http().get(url).query({ companyId: 'x' }),
          'companyId',
        );
      },
    );

    it('GET /trips rejects non-UUID filters', async () => {
      const res = await http()
        .get('/trips')
        .query({ driverId: 'x', vehicleId: 'y' });
      expectRejected(res, 'driverId', 'vehicleId');
    });

    it('rejects an invalid date in a range', async () => {
      const res = await http()
        .get(`/companies/${ID}/cost-report`)
        .query({ from: 'last-week' });
      expectRejected(res, 'from');
    });

    it('rejects from after to', async () => {
      const res = await http()
        .get(`/drivers/${ID}/performance`)
        .query({ from: '2026-10-01', to: '2026-09-01' });
      expectRejected(res, 'to');
    });
  });

  describe('valid requests', () => {
    it('passes parsed bodies to the service: trimmed, dated, stripped', async () => {
      const res = await http()
        .post('/drivers')
        .send({ ...validDriver, firstName: '  Ada  ', isAdmin: true });

      expect(res.status).toBe(201);
      expect(stubs.drivers.create).toHaveBeenCalledWith({
        ...validDriver,
        firstName: 'Ada',
        licenseExpiry: new Date('2030-01-01'),
      });
    });

    it('drops companyId from a driver update', async () => {
      const res = await http()
        .patch(`/drivers/${ID}`)
        .send({ companyId: ID, phone: '+250711111111' });

      expect(res.status).toBe(200);
      expect(stubs.drivers.update).toHaveBeenCalledWith(ID, {
        phone: '+250711111111',
      });
    });

    it('accepts an empty update', async () => {
      const res = await http().patch(`/vehicles/${ID}`).send({});
      expect(res.status).toBe(200);
      expect(stubs.vehicles.update).toHaveBeenCalledWith(ID, {});
    });

    it('assigns a trip with parsed dates', async () => {
      const res = await http().post('/trips/assign').send(validTrip);
      expect(res.status).toBe(201);
      expect(stubs.trips.assign).toHaveBeenCalledWith({
        ...validTrip,
        scheduledStart: new Date(validTrip.scheduledStart),
        scheduledEnd: new Date(validTrip.scheduledEnd),
      });
    });

    it('completes a trip with no body', async () => {
      const res = await http().patch(`/trips/${ID}/complete`);
      expect(res.status).toBe(200);
      expect(stubs.trips.complete).toHaveBeenCalledWith(ID, undefined);
    });

    it('passes report date ranges as Dates', async () => {
      const res = await http()
        .get(`/vehicles/${ID}/performance`)
        .query({ from: '2026-09-01', to: '2026-09-30' });

      expect(res.status).toBe(200);
      expect(stubs.reports.vehiclePerformance).toHaveBeenCalledWith(
        ID,
        new Date('2026-09-01'),
        new Date('2026-09-30'),
      );
    });

    it('passes an open-ended range as undefined bounds', async () => {
      const res = await http().get(`/companies/${ID}/cost-report`);
      expect(res.status).toBe(200);
      expect(stubs.reports.costReport).toHaveBeenCalledWith(
        ID,
        undefined,
        undefined,
      );
    });

    it('passes query filters through', async () => {
      const res = await http().get('/trips').query({ driverId: ID });
      expect(res.status).toBe(200);
      expect(stubs.trips.findAll).toHaveBeenCalledWith({ driverId: ID });
    });
  });
});
