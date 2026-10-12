import 'dotenv/config';

/**
 * The database the flow tests run against: TEST_DATABASE_URL if set,
 * otherwise DATABASE_URL with the database name suffixed `_test` (so the
 * docker-compose Postgres gets a `fleetflow_test` next to `fleetflow`).
 */
export function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!explicit && !base) {
    throw new Error('Set TEST_DATABASE_URL or DATABASE_URL to run e2e tests');
  }

  const url = new URL(explicit ?? base!);
  if (!explicit) {
    url.pathname = `${url.pathname}_test`;
  }

  // The flow tests wipe every table, so never point them at a real database.
  const name = url.pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to run e2e tests against "${name}": the database name must end in _test`,
    );
  }
  return url.toString();
}
