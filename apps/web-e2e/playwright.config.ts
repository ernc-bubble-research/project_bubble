import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load .env.test so all env vars are available to webServer child processes
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

// Pre-create test database so the API webServer can connect during startup.
// Playwright starts webServer BEFORE globalSetup, but the API needs the DB to exist.
// globalSetup will drop + recreate for a clean state — this just ensures first boot works.
const testDb = process.env['POSTGRES_DB'] || 'project_bubble_test';
try {
  execSync(
    `docker exec project_bubble-postgres psql -U bubble_user -d postgres -c "CREATE DATABASE ${testDb}"`,
    { stdio: 'pipe' },
  );
} catch {
  // DB already exists — expected on subsequent runs
}

const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';
const apiURL = process.env['API_URL'] || 'http://localhost:3000';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),

  globalSetup: require.resolve('./src/global-setup.ts'),
  globalTeardown: require.resolve('./src/global-teardown.ts'),

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: [
    {
      command: 'npx nx serve api-gateway',
      url: `${apiURL}/api`,
      reuseExistingServer: !process.env['CI'],
      cwd: workspaceRoot,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    },
    {
      command: 'npx nx serve web',
      url: baseURL,
      reuseExistingServer: !process.env['CI'],
      cwd: workspaceRoot,
      timeout: 120_000,
    },
  ],

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],
});
