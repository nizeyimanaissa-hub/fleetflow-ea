# FleetFlow-EA

A fleet management API: companies, drivers, vehicles, and trips, with
configurable scheduling rules, conflict-safe trip assignment, GPS tracking,
real road-based routing/ETA, and fuel/maintenance/salary cost reporting.

## Prerequisites

- Docker (for PostgreSQL and OSRM routing)
- Node.js + npm

## Setup

```bash
# 1. Start the database (from the repository root)
docker compose up -d db

# 2. Configure environment
cp .env.example apps/api/.env
# apps/api/.env must point DATABASE_URL at the db container, e.g.
# postgresql://fleetflow:fleetflow_local@localhost:5434/fleetflow?schema=public

# 3. Install and set up the API
cd apps/api
npm install
npx prisma validate
npx prisma migrate dev

# 4. Set up routing (one-time; downloads + preprocesses map data)
cd ..
./scripts/setup-osrm.sh
docker compose up -d osrm
```

## Running the API

```bash
cd apps/api
npm run start:dev
```

The API listens on `http://localhost:3000`.

### Interactive API docs

Once running, open **http://localhost:3000/api** for a Swagger UI page listing
every endpoint, grouped by resource, with a "Try it out" button to fire real
requests. Raw OpenAPI JSON is at `/api-json`.

## Data model

```
Company
 ├─ drivers   Driver[]
 ├─ vehicles  Vehicle[]
 ├─ trips     Trip[]
 └─ schedulingRule SchedulingRule?   (configurable hour/rest limits, one per company)

Driver   — name, contact, license, status (ACTIVE | INACTIVE | SUSPENDED)
 └─ salaryPayments SalaryPayment[]   — actual payments made (amount, period, paidAt)

Vehicle  — plate, make/model/year, status (ACTIVE | MAINTENANCE | RETIRED), odometer
 ├─ fuelLogs           FuelLog[]           — fill-ups (liters, cost, odometer, filledAt)
 └─ maintenanceRecords MaintenanceRecord[] — service events (description, cost, performedAt)

Trip     — driver + vehicle + scheduled window, origin/destination coordinates,
           computed route (distance/duration/geometry), live ETA, status
           (SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED)
 └─ gpsPings GpsPing[]   — position history while a trip is IN_PROGRESS
```

Fuel/maintenance/salary are append-only cost logs (actual money spent, not
projected rates) — this is what the cost/performance reports below aggregate.
Completing a trip (`PATCH /trips/:id/complete`) also increments the vehicle's
`odometerKm` by the distance driven, so odometer-based fuel consumption stays
meaningful over time.

All of Driver, Vehicle, and Trip belong to a Company (multi-tenant from the
start). Schema lives in `apps/api/prisma/schema.prisma`; history in
`apps/api/prisma/migrations/`.

## API endpoints

Standard CRUD (`POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`) for:

- `/companies`
- `/drivers` (filter list with `?companyId=`)
- `/vehicles` (filter list with `?companyId=`)

Trips are managed separately — there is deliberately no plain `POST /trips` or
generic `PATCH /trips/:id`, so every trip goes through the safety checks below:

- `POST /trips/assign` — the only way to create a trip; also takes
  `originLat/Lng` and `destinationLat/Lng` and computes the route via OSRM
- `GET /trips` (filter with `?companyId=`, `?driverId=`, `?vehicleId=`)
- `GET /trips/:id`
- `PATCH /trips/:id/cancel`
- `PATCH /trips/:id/start`
- `PATCH /trips/:id/complete`

GPS tracking (only while a trip is `IN_PROGRESS`):

- `POST /trips/:id/gps` — ingest a `{ lat, lng, speedKmh? }` position; recomputes
  the trip's ETA from the new position to the destination and flags the ping
  `offRoute: true` if it's more than 500m from the planned route
- `GET /trips/:id/gps` — position history
- `GET /trips/:id/location` — latest position + current `estimatedArrival`

Cost logs:

- `POST/GET /vehicles/:id/fuel-logs` — record/list fuel fill-ups
- `GET /vehicles/:id/fuel-consumption` — avg L/100km (fill-to-fill method),
  total liters, total cost (optional `?from=&to=` date range)
- `POST/GET /vehicles/:id/maintenance-records` — record/list service events
- `POST/GET /drivers/:id/salary-payments` — record/list salary payments

Cost and performance reports (all take optional `?from=&to=`):

- `GET /companies/:id/cost-report` — total fuel/maintenance/salary cost,
  broken down by vehicle and driver, plus a grand total
- `GET /vehicles/:id/performance` — trips completed, distance/hours driven,
  fuel efficiency, and cost per km (fuel + maintenance ÷ distance)
- `GET /drivers/:id/performance` — trips completed, distance/hours driven,
  on-time completion rate
- `GET /companies/:id/performance` — fleet-wide rollup (vehicle/driver counts,
  trips, distance, hours, cost per km) plus the full cost report

### Validation

Request bodies, query strings, and id params are validated with
[Zod](https://zod.dev). Each DTO is a Zod schema wrapped by `createZodDto`
(`apps/api/src/common/validation/`), which a global `ZodValidationPipe` uses to
parse the request and Swagger uses to document it. Ids must be UUIDs, dates ISO
8601 strings (parsed to `Date` before reaching services). Invalid input returns
`400` with every problem listed:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "issues": [{ "path": "originLat", "message": "Too big: expected number to be <=90" }]
}
```

### Safe trip assignment

`POST /trips/assign` rejects a trip (`409 Conflict`) instead of creating it if
any of the following fail, using each company's `SchedulingRule` (or defaults
of 8h/day, 48h/week, 11h rest if none is configured):

1. **Vehicle overlap** — vehicle isn't already booked for that time window
2. **Driver overlap** — driver isn't already booked for that time window
3. **Rest rule** — enough gap before/after the driver's adjacent trips
4. **Hour caps** — daily and rolling-7-day driving hours stay under the limit

### Routing (OSRM)

Real road distance/duration/ETA come from a self-hosted [OSRM](https://project-osrm.org/)
instance (`docker-compose.yml`'s `osrm` service) — no external API key or cost.
OSRM needs a preprocessed map extract before it can serve routes; that's what
`scripts/setup-osrm.sh` does (download a Geofabrik `.osm.pbf` extract, then run
`osrm-extract` / `osrm-partition` / `osrm-customize`).

Currently configured for **Berlin** (a small Germany sub-region), not all of
Germany — a full-country extract needs more RAM than a default Docker Desktop
setup has allocated (it OOM-killed partway through when I first tried it here
with ~7.75GB available). To switch to full Germany:

```bash
# 1. Docker Desktop -> Settings -> Resources -> raise the memory limit
#    (12GB+ recommended for the full Germany extract)
# 2. Re-run preprocessing for Germany (the .osm.pbf may already be downloaded
#    in osrm-data/ from the first attempt)
REGION=germany ./scripts/setup-osrm.sh
# 3. Edit the `osrm` service's `command` in docker-compose.yml to point at
#    /data/germany-latest.osrm instead of berlin-latest.osrm
docker compose up -d osrm
```

To use a different country/region instead, override `REGION`/`URL` with any
[Geofabrik extract](https://download.geofabrik.de/) — country files cover
cross-border trips within that country; Geofabrik's continent-level regional
extracts (e.g. "east-africa") bundle multiple countries into one file if your
fleet spans several.

## Verify

```bash
# From the repository root
docker compose ps          # db should show "healthy"; osrm should be "Up"

# From apps/api
npx prisma migrate status  # should report "Database schema is up to date!"

# Routing service responds (coordinates must fall within the loaded region)
curl "http://localhost:5001/route/v1/driving/13.3777,52.5163;13.4094,52.5208?overview=false"
```

## Stop

```bash
# From the repository root
docker compose down
```

## Notes

- The Postgres container publishes on host port `5434` (not the default `5432`)
  to avoid clashing with a locally installed Postgres instance. Adjust
  `DATABASE_URL` if you remap the port.
- `apps/api/.env` holds real credentials and is gitignored; only
  `.env.example` (root) is committed.
- `osrm-data/` (gitignored) holds downloaded map extracts and preprocessed
  routing files — multi-GB for a full country, regenerated by
  `scripts/setup-osrm.sh`, not meant to be committed.
- The `osrm/osrm-backend` image is amd64-only; on Apple Silicon it runs under
  emulation, which is noticeably slower for preprocessing (not for serving
  routes at runtime).
