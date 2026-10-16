import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { testDatabaseUrl } from './test-database.js';

/**
 * Runs once before the e2e suite: creates the test database if it doesn't
 * exist and brings it up to date with the migrations.
 */
export default async function setup() {
  const url = testDatabaseUrl();
  const name = new URL(url).pathname.slice(1);

  // Connect to the server's default database to create the test one.
  const admin = new URL(url);
  admin.pathname = '/postgres';
  admin.search = '';
  const client = new pg.Client({ connectionString: admin.toString() });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Can't reach Postgres for the e2e tests. Is it running (docker compose up -d db)?\n${String(error)}`,
    );
  }
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }

  execFileSync(
    'npx',
    ['prisma', 'migrate', 'deploy', '--config', 'prisma7.config.ts'],
    { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' },
  );
}
