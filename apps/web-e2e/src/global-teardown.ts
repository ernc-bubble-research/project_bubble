import './env';
import { DataSource } from 'typeorm';

const ADMIN_DB = 'postgres';
const TEST_DB = process.env['POSTGRES_DB'] || 'project_bubble_test';

/**
 * Playwright global teardown:
 * 1. Terminate all connections to the test database
 * 2. Drop the test database
 */
async function globalTeardown(): Promise<void> {
  console.log('[E2E] Global teardown — dropping test database…');

  try {
    const adminDs = new DataSource({
      type: 'postgres',
      host: process.env['POSTGRES_HOST'] || 'localhost',
      port: Number(process.env['POSTGRES_PORT'] || 5432),
      username: process.env['POSTGRES_USER'] || 'bubble_user',
      password: process.env['POSTGRES_PASSWORD'] || 'bubble_password',
      database: ADMIN_DB,
    });

    await adminDs.initialize();

    // Terminate lingering connections before dropping
    await adminDs.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [TEST_DB],
    );
    await adminDs.query(`DROP DATABASE IF EXISTS "${TEST_DB}"`);

    await adminDs.destroy();
    console.log(`[E2E] Database "${TEST_DB}" dropped — teardown complete`);
  } catch (error) {
    console.error('[E2E] Global teardown FAILED — test database may still exist.');
    console.error(error);
    // Don't re-throw — teardown failures should not mask test results
  }
}

export default globalTeardown;
