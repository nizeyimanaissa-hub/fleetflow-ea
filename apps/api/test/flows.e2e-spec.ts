import { haversineKm } from '../src/common/geo.js';
import { createTestApp, type TestApp } from './setup/test-app.js';

// Real HTTP requests against the full app and a real (test) Postgres; only
// OSRM is faked, with straight-line routes (see FakeRoutingService).

const KIGALI = { lat: -1.9441, lng: 30.0619 };
const HUYE = { lat: -2.5967, lng: 29.7394 };
const KIGALI_TO_HUYE_KM = haversineKm(
  KIGALI.lat,
  KIGALI.lng,
  HUYE.lat,
  HUYE.lng,
);

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('API flows (e2e, test database)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t?.close();
  });

  beforeEach(async () => {
    await t.reset();
  });

  // --- helpers: each creates via the API and returns the response body ---

  async function createCompany(name = 'Acme Logistics') {
    const res = await t.http().post('/companies').send({ name }).expect(201);
    return res.body as { id: string };
  }

  async function createDriver(companyId: string, overrides: object = {}) {
    const res = await t
      .http()
      .post('/drivers')
      .send({
        companyId,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '+250700000000',
        licenseNumber: 'LIC-1',
        licenseExpiry: '2030-01-01',
        ...overrides,
      })
      .expect(201);
    return res.body as { id: string };
  }

  async function createVehicle(companyId: string, overrides: object = {}) {
    const res = await t
      .http()
      .post('/vehicles')
      .send({
        companyId,
        plateNumber: 'RAB 123 A',
        make: 'Toyota',
        model: 'Hilux',
        year: 2020,
        odometerKm: 10_000,
        ...overrides,
      })
      .expect(201);
    return res.body as { id: string };
  }

  /** A company with one driver and one vehicle. */
  async function createFleet() {
    const company = await createCompany();
    const driver = await createDriver(company.id);
    const vehicle = await createVehicle(company.id);
    return {
      companyId: company.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
    };
  }

  type Fleet = Awaited<ReturnType<typeof createFleet>>;

  /** Kigali → Huye; 4h on 2026-11-02 unless overridden. */
  function tripRequest(fleet: Fleet, overrides: object = {}) {
    return t
      .http()
      .post('/trips/assign')
      .send({
        ...fleet,
        startLocation: 'Kigali',
        endLocation: 'Huye',
        scheduledStart: '2026-11-02T08:00:00Z',
        scheduledEnd: '2026-11-02T12:00:00Z',
        originLat: KIGALI.lat,
        originLng: KIGALI.lng,
        destinationLat: HUYE.lat,
        destinationLng: HUYE.lng,
        ...overrides,
      });
  }

  async function assignTrip(fleet: Fleet, overrides: object = {}) {
    const res = await tripRequest(fleet, overrides).expect(201);
    return res.body as { id: string };
  }

  describe('fleet setup', () => {
    it('creates a company, driver and vehicle and lists them', async () => {
      const { companyId, driverId, vehicleId } = await createFleet();

      const company = await t.http().get(`/companies/${companyId}`).expect(200);
      expect(company.body).toMatchObject({ name: 'Acme Logistics' });

      const driver = await t.http().get(`/drivers/${driverId}`).expect(200);
      expect(driver.body).toMatchObject({
        companyId,
        status: 'ACTIVE',
        licenseExpiry: '2030-01-01T00:00:00.000Z',
      });

      const vehicle = await t.http().get(`/vehicles/${vehicleId}`).expect(200);
      expect(vehicle.body).toMatchObject({
        status: 'ACTIVE',
        odometerKm: 10_000,
      });
    });

    it('filters drivers and vehicles by company', async () => {
      const a = await createFleet();
      const b = await createCompany('Other Co');
      await createDriver(b.id);
      await createVehicle(b.id);

      const drivers = await t
        .http()
        .get('/drivers')
        .query({ companyId: a.companyId })
        .expect(200);
      expect(drivers.body.map((d: { id: string }) => d.id)).toEqual([
        a.driverId,
      ]);

      const vehicles = await t
        .http()
        .get('/vehicles')
        .query({ companyId: a.companyId })
        .expect(200);
      expect(vehicles.body.map((v: { id: string }) => v.id)).toEqual([
        a.vehicleId,
      ]);

      const all = await t.http().get('/drivers').expect(200);
      expect(all.body).toHaveLength(2);
    });

    it('rejects a duplicate driver email or licence within a company', async () => {
      const { companyId } = await createFleet();

      await t
        .http()
        .post('/drivers')
        .send({
          companyId,
          firstName: 'Grace',
          lastName: 'Hopper',
          email: 'ada@example.com',
          phone: '+250700000001',
          licenseNumber: 'LIC-2',
          licenseExpiry: '2030-01-01',
        })
        .expect(409);

      const grace = await createDriver(companyId, {
        email: 'grace@example.com',
        licenseNumber: 'LIC-2',
      });
      await t
        .http()
        .patch(`/drivers/${grace.id}`)
        .send({ licenseNumber: 'LIC-1' })
        .expect(409);
    });

    it('allows the same driver email and plate in different companies', async () => {
      await createFleet();
      const other = await createCompany('Other Co');
      await createDriver(other.id);
      await createVehicle(other.id);
    });

    it('rejects a duplicate plate within a company', async () => {
      const { companyId } = await createFleet();
      await t
        .http()
        .post('/vehicles')
        .send({
          companyId,
          plateNumber: 'RAB 123 A',
          make: 'Isuzu',
          model: 'D-Max',
          year: 2022,
        })
        .expect(409);
    });

    it('rejects a driver or vehicle for a company that does not exist', async () => {
      await t
        .http()
        .post('/drivers')
        .send({
          companyId: MISSING_ID,
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
          phone: '+250700000000',
          licenseNumber: 'LIC-1',
          licenseExpiry: '2030-01-01',
        })
        .expect(404);
    });

    it('updates a driver but keeps their company', async () => {
      const { companyId, driverId } = await createFleet();
      const other = await createCompany('Other Co');

      const res = await t
        .http()
        .patch(`/drivers/${driverId}`)
        .send({ phone: '+250711111111', companyId: other.id })
        .expect(200);

      expect(res.body).toMatchObject({ phone: '+250711111111', companyId });
    });

    it.each(['companies', 'drivers', 'vehicles', 'trips'])(
      'returns 404 for an unknown %s id',
      async (resource) => {
        await t.http().get(`/${resource}/${MISSING_ID}`).expect(404);
      },
    );

    it('deletes a company with nothing attached', async () => {
      const { id } = await createCompany();
      await t.http().delete(`/companies/${id}`).expect(200);
      await t.http().get(`/companies/${id}`).expect(404);
    });

    // KNOWN BUG: nothing in the schema cascades and the services don't
    // check, so deleting a record that others reference fails the foreign
    // key (P2003) and returns a 500. Whether this should be a 409, a
    // cascade, or a soft delete is still to be decided; these expect a 409.
    // Remove `.fails` once deletes are handled.
    describe('deleting records that others reference', () => {
      it.fails('company with drivers', async () => {
        const { companyId } = await createFleet();
        await t.http().delete(`/companies/${companyId}`).expect(409);
      });

      it.fails('vehicle with fuel logs', async () => {
        const { vehicleId } = await createFleet();
        await t
          .http()
          .post(`/vehicles/${vehicleId}/fuel-logs`)
          .send({
            liters: 40,
            costTotal: 60,
            odometerKm: 10_000,
            filledAt: '2026-10-01',
          })
          .expect(201);
        await t.http().delete(`/vehicles/${vehicleId}`).expect(409);
      });

      it.fails('driver with a trip', async () => {
        const fleet = await createFleet();
        await assignTrip(fleet);
        await t.http().delete(`/drivers/${fleet.driverId}`).expect(409);
      });
    });
  });

  describe('trip lifecycle', () => {
    it('assigns, starts, tracks and completes a trip', async () => {
      const fleet = await createFleet();

      // Assign: route and ETA come from the (fake) router.
      const assigned = await tripRequest(fleet).expect(201);
      const tripId = assigned.body.id as string;
      expect(assigned.body).toMatchObject({
        status: 'SCHEDULED',
        startedAt: null,
      });
      expect(assigned.body.routeDistanceKm).toBeCloseTo(KIGALI_TO_HUYE_KM, 6);
      // 60 km/h, so one minute per km after the scheduled start.
      expect(new Date(assigned.body.estimatedArrival).getTime()).toBeCloseTo(
        new Date('2026-11-02T08:00:00Z').getTime() + KIGALI_TO_HUYE_KM * 60_000,
        -2,
      );

      // GPS is refused until the trip starts.
      await t
        .http()
        .post(`/trips/${tripId}/gps`)
        .send({ lat: KIGALI.lat, lng: KIGALI.lng })
        .expect(409);

      // Start.
      const started = await t
        .http()
        .patch(`/trips/${tripId}/start`)
        .expect(200);
      expect(started.body.status).toBe('IN_PROGRESS');
      expect(started.body.startedAt).not.toBeNull();

      // A ping halfway along the route is on route, and moves the ETA.
      const midway = {
        lat: (KIGALI.lat + HUYE.lat) / 2,
        lng: (KIGALI.lng + HUYE.lng) / 2,
      };
      const onRoute = await t
        .http()
        .post(`/trips/${tripId}/gps`)
        .send({ ...midway, speedKmh: 70, recordedAt: '2026-11-02T09:00:00Z' })
        .expect(201);
      expect(onRoute.body.offRoute).toBe(false);

      // A ping ~5 km west of the route is off route.
      const offRoute = await t
        .http()
        .post(`/trips/${tripId}/gps`)
        .send({
          lat: midway.lat,
          lng: midway.lng - 0.05,
          recordedAt: '2026-11-02T09:10:00Z',
        })
        .expect(201);
      expect(offRoute.body.offRoute).toBe(true);

      const history = await t.http().get(`/trips/${tripId}/gps`).expect(200);
      expect(
        history.body.map((p: { offRoute: boolean }) => p.offRoute),
      ).toEqual([false, true]);

      const location = await t
        .http()
        .get(`/trips/${tripId}/location`)
        .expect(200);
      expect(location.body).toMatchObject({
        tripId,
        status: 'IN_PROGRESS',
        lastPing: { id: offRoute.body.id },
      });
      // ETA recomputed from the last ping: its time plus 1 min/km to Huye.
      const kmLeft = haversineKm(
        midway.lat,
        midway.lng - 0.05,
        HUYE.lat,
        HUYE.lng,
      );
      expect(new Date(location.body.estimatedArrival).getTime()).toBeCloseTo(
        new Date('2026-11-02T09:10:00Z').getTime() + kmLeft * 60_000,
        -2,
      );

      // Complete with the actual distance; the odometer moves by it.
      const completed = await t
        .http()
        .patch(`/trips/${tripId}/complete`)
        .send({ distanceKm: 85.4 })
        .expect(200);
      expect(completed.body).toMatchObject({
        status: 'COMPLETED',
        distanceKm: 85.4,
      });
      expect(completed.body.endedAt).not.toBeNull();

      const vehicle = await t
        .http()
        .get(`/vehicles/${fleet.vehicleId}`)
        .expect(200);
      expect(vehicle.body.odometerKm).toBe(10_085);

      // A finished trip can't be restarted, cancelled, or tracked.
      await t.http().patch(`/trips/${tripId}/start`).expect(409);
      await t.http().patch(`/trips/${tripId}/cancel`).expect(409);
      await t
        .http()
        .post(`/trips/${tripId}/gps`)
        .send({ lat: HUYE.lat, lng: HUYE.lng })
        .expect(409);
    });

    it('falls back to the route distance for the odometer', async () => {
      const fleet = await createFleet();
      const { id } = await assignTrip(fleet);
      await t.http().patch(`/trips/${id}/start`).expect(200);
      await t.http().patch(`/trips/${id}/complete`).expect(200);

      const vehicle = await t
        .http()
        .get(`/vehicles/${fleet.vehicleId}`)
        .expect(200);
      expect(vehicle.body.odometerKm).toBe(
        10_000 + Math.round(KIGALI_TO_HUYE_KM),
      );
    });

    it('cannot complete a trip that has not started', async () => {
      const fleet = await createFleet();
      const { id } = await assignTrip(fleet);
      await t.http().patch(`/trips/${id}/complete`).expect(409);
    });

    it('lists trips filtered by driver', async () => {
      const fleet = await createFleet();
      const other = await createDriver(fleet.companyId, {
        email: 'grace@example.com',
        licenseNumber: 'LIC-2',
      });
      const otherVehicle = await createVehicle(fleet.companyId, {
        plateNumber: 'RAB 456 B',
      });
      const mine = await assignTrip(fleet);
      await assignTrip({
        ...fleet,
        driverId: other.id,
        vehicleId: otherVehicle.id,
      });

      const res = await t
        .http()
        .get('/trips')
        .query({ driverId: fleet.driverId })
        .expect(200);
      expect(res.body.map((trip: { id: string }) => trip.id)).toEqual([
        mine.id,
      ]);
    });
  });

  describe('scheduling rules', () => {
    it('rejects double-booking the driver', async () => {
      const fleet = await createFleet();
      await assignTrip(fleet);
      const otherVehicle = await createVehicle(fleet.companyId, {
        plateNumber: 'RAB 456 B',
      });

      const res = await tripRequest(
        { ...fleet, vehicleId: otherVehicle.id },
        {
          scheduledStart: '2026-11-02T10:00:00Z',
          scheduledEnd: '2026-11-02T11:00:00Z',
        },
      ).expect(409);
      expect(res.body.message).toMatch(/Driver is already assigned/);
    });

    it('rejects double-booking the vehicle', async () => {
      const fleet = await createFleet();
      await assignTrip(fleet);
      const otherDriver = await createDriver(fleet.companyId, {
        email: 'grace@example.com',
        licenseNumber: 'LIC-2',
      });

      const res = await tripRequest(
        { ...fleet, driverId: otherDriver.id },
        {
          scheduledStart: '2026-11-02T11:00:00Z',
          scheduledEnd: '2026-11-02T13:00:00Z',
        },
      ).expect(409);
      expect(res.body.message).toMatch(/Vehicle is already assigned/);
    });

    it('frees the slot when a trip is cancelled', async () => {
      const fleet = await createFleet();
      const first = await assignTrip(fleet);
      await t.http().patch(`/trips/${first.id}/cancel`).expect(200);

      await assignTrip(fleet);
    });

    it('enforces 11h rest by default, and a company rule when set', async () => {
      const fleet = await createFleet();
      await assignTrip(fleet); // ends 12:00

      // Next morning at 06:00 is 18h later: fine. 20:00 the same day is 8h.
      const tooSoon = {
        scheduledStart: '2026-11-02T20:00:00Z',
        scheduledEnd: '2026-11-02T22:00:00Z',
      };
      const res = await tripRequest(fleet, tooSoon).expect(409);
      expect(res.body.message).toMatch(/needs 11h rest/);

      // There's no endpoint for rules yet, so set one directly.
      await t.prisma.schedulingRule.create({
        data: { companyId: fleet.companyId, minRestHoursBetweenTrips: 6 },
      });
      await tripRequest(fleet, tooSoon).expect(201);
    });

    it('rejects a driver and vehicle from another company', async () => {
      const fleet = await createFleet();
      const other = await createCompany('Other Co');

      const res = await tripRequest({ ...fleet, companyId: other.id }).expect(
        404,
      );
      expect(res.body.message).toMatch(/Driver .* not found in this company/);
    });
  });

  describe('costs and reports', () => {
    it('reports costs, consumption and performance over a date range', async () => {
      const fleet = await createFleet();
      const { vehicleId, driverId, companyId } = fleet;

      // Three fill-ups in October (fill-to-fill: 50 L over 600 km), one in
      // November outside the range.
      for (const log of [
        {
          liters: 40,
          costTotal: 60,
          odometerKm: 10_000,
          filledAt: '2026-10-01',
        },
        {
          liters: 30,
          costTotal: 45,
          odometerKm: 10_400,
          filledAt: '2026-10-10',
        },
        {
          liters: 20,
          costTotal: 30,
          odometerKm: 10_600,
          filledAt: '2026-10-20',
        },
        {
          liters: 99,
          costTotal: 999,
          odometerKm: 11_000,
          filledAt: '2026-11-15',
        },
      ]) {
        await t
          .http()
          .post(`/vehicles/${vehicleId}/fuel-logs`)
          .send(log)
          .expect(201);
      }
      await t
        .http()
        .post(`/vehicles/${vehicleId}/maintenance-records`)
        .send({ description: 'Brakes', cost: 120, performedAt: '2026-10-05' })
        .expect(201);
      await t
        .http()
        .post(`/drivers/${driverId}/salary-payments`)
        .send({
          amount: 800,
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
          paidAt: '2026-10-31',
        })
        .expect(201);

      // One completed trip in October.
      const { id: tripId } = await assignTrip(fleet, {
        scheduledStart: '2026-10-15T08:00:00Z',
        scheduledEnd: '2026-10-15T12:00:00Z',
      });
      await t.http().patch(`/trips/${tripId}/start`).expect(200);
      await t
        .http()
        .patch(`/trips/${tripId}/complete`)
        .send({ distanceKm: 100 })
        .expect(200);

      const october = { from: '2026-10-01', to: '2026-10-31T23:59:59Z' };

      const consumption = await t
        .http()
        .get(`/vehicles/${vehicleId}/fuel-consumption`)
        .query(october)
        .expect(200);
      expect(consumption.body).toMatchObject({
        fillUps: 3,
        totalLiters: 90,
        totalCost: 135,
      });
      expect(consumption.body.averageConsumptionL100km).toBeCloseTo(
        (50 / 600) * 100,
        6,
      );

      const costs = await t
        .http()
        .get(`/companies/${companyId}/cost-report`)
        .query(october)
        .expect(200);
      expect(costs.body).toMatchObject({
        totalFuelCost: 135,
        totalMaintenanceCost: 120,
        totalSalaryCost: 800,
        grandTotal: 1055,
        byVehicle: [
          { vehicleId, fuelCost: 135, maintenanceCost: 120, total: 255 },
        ],
        byDriver: [{ driverId, salaryCost: 800 }],
      });

      // The trip ended "now" (it was completed during the test run), which
      // is outside October, so performance reports use an open range.
      const driver = await t
        .http()
        .get(`/drivers/${driverId}/performance`)
        .expect(200);
      expect(driver.body).toMatchObject({
        tripsCompleted: 1,
        totalDistanceKm: 100,
      });

      const vehicle = await t
        .http()
        .get(`/vehicles/${vehicleId}/performance`)
        .expect(200);
      expect(vehicle.body).toMatchObject({
        tripsCompleted: 1,
        totalDistanceKm: 100,
        // all fuel (incl. November) + maintenance, over 100 km
        fuelCost: 1134,
        maintenanceCost: 120,
        costPerKm: 12.54,
      });

      const company = await t
        .http()
        .get(`/companies/${companyId}/performance`)
        .expect(200);
      expect(company.body).toMatchObject({
        vehicleCount: 1,
        driverCount: 1,
        tripsCompleted: 1,
        totalDistanceKm: 100,
        costs: { grandTotal: 1134 + 120 + 800 },
      });
    });

    it('returns 404 for reports on unknown ids', async () => {
      await t.http().get(`/companies/${MISSING_ID}/cost-report`).expect(404);
      await t.http().get(`/drivers/${MISSING_ID}/performance`).expect(404);
      await t.http().get(`/vehicles/${MISSING_ID}/performance`).expect(404);
      await t.http().get(`/vehicles/${MISSING_ID}/fuel-logs`).expect(404);
      await t.http().get(`/drivers/${MISSING_ID}/salary-payments`).expect(404);
    });
  });
});
