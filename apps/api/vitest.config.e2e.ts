import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { testDatabaseUrl } from './test/setup/test-database.js';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    // PrismaService reads DATABASE_URL, so point the app at the test database.
    env: { DATABASE_URL: testDatabaseUrl() },
    // Flow tests reset the shared test database, so files must not overlap.
    fileParallelism: false,
  },
});
