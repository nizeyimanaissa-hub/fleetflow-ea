# FleetFlow-EA — Phase One: Database Foundation

Phase One is database setup only. It brings up a PostgreSQL container, wires the
NestJS API (`apps/api`) to it through Prisma, and applies the first migration
(a single `Company` model).

## Prerequisites

- Docker (for PostgreSQL)
- Node.js + npm

## Setup

```bash
# 1. Start the database (from the repository root)
docker compose up -d db

# 2. Configure environment
cp .env.example apps/api/.env
# postgresql://fleetflow:fleetflow_local@localhost:5434/fleetflow?schema=public

# 3. Install and set up the API
cd apps/api
npm install
npx prisma validate
npx prisma migrate dev
```

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
