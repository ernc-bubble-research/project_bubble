import './env';

/**
 * Playwright global teardown.
 *
 * The test database is NOT dropped here — it persists between runs.
 * globalSetup truncates all tables at the start of each run for a clean state.
 * This avoids the chicken-and-egg problem where the API webServer
 * (started by Playwright before globalSetup) needs the DB to exist.
 */
async function globalTeardown(): Promise<void> {
  console.log('[E2E] Global teardown complete');
}

export default globalTeardown;
