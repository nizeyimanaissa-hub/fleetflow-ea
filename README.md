# FleetFlow-EA

A fleet management API: companies, drivers, vehicles, and trips, with
configurable scheduling rules and conflict-safe trip assignment.

## Prerequisites

- Docker (for PostgreSQL)
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
Vehicle  — plate, make/model/year, status (ACTIVE | MAINTENANCE | RETIRED), odometer
Trip     — driver + vehicle + scheduled window, status
           (SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED)
```

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

- `POST /trips/assign` — the only way to create a trip
- `GET /trips` (filter with `?companyId=`, `?driverId=`, `?vehicleId=`)
- `GET /trips/:id`
- `PATCH /trips/:id/cancel`
- `PATCH /trips/:id/start`
- `PATCH /trips/:id/complete`

### Safe trip assignment

`POST /trips/assign` rejects a trip (`409 Conflict`) instead of creating it if
any of the following fail, using each company's `SchedulingRule` (or defaults
of 8h/day, 48h/week, 11h rest if none is configured):

1. **Vehicle overlap** — vehicle isn't already booked for that time window
2. **Driver overlap** — driver isn't already booked for that time window
3. **Rest rule** — enough gap before/after the driver's adjacent trips
4. **Hour caps** — daily and rolling-7-day driving hours stay under the limit

## Verify

```bash
# From the repository root
docker compose ps          # db should show "healthy"

# From apps/api
npx prisma migrate status  # should report "Database schema is up to date!"
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
