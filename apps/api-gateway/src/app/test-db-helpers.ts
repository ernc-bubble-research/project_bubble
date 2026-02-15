/**
 * Shared test database lifecycle helpers.
 *
 * Used by module-wiring.spec.ts (Tier 1) and integration-wiring.spec.ts (Tier 2).
 * Reuses the same pattern as E2E global-setup.ts but with separate DB names
 * to avoid conflicts when running in parallel.
 *
 * WARNING: If CI runs Tier 1, Tier 2, and E2E tests in parallel, each uses a
 * different DB name. However, pg_terminate_backend calls could race condition
 * if all three test suites start simultaneously. CI jobs should run these
 * sequentially or use unique DB names per job run.
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env.test') });

function createAdminDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env['POSTGRES_HOST'] || 'localhost',
    port: Number(process.env['POSTGRES_PORT'] || 5432),
    username: process.env['POSTGRES_USER'] || 'bubble_user',
    password: process.env['POSTGRES_PASSWORD'] || 'bubble_password',
    database: 'postgres',
  });
}

export async function createTestDatabase(dbName: string): Promise<void> {
  const adminDs = createAdminDataSource();
  await adminDs.initialize();
  await adminDs.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [dbName],
  );
  await adminDs.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  await adminDs.query(`CREATE DATABASE "${dbName}"`);
  await adminDs.destroy();
}

export async function dropTestDatabase(dbName: string): Promise<void> {
  const adminDs = createAdminDataSource();
  await adminDs.initialize();
  await adminDs.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [dbName],
  );
  await adminDs.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  await adminDs.destroy();
}

export function buildTestDbUrl(dbName: string): string {
  const user = process.env['POSTGRES_USER'] || 'bubble_user';
  const password = process.env['POSTGRES_PASSWORD'] || 'bubble_password';
  const host = process.env['POSTGRES_HOST'] || 'localhost';
  const port = process.env['POSTGRES_PORT'] || 5432;
  return `postgresql://${user}:${password}@${host}:${port}/${dbName}`;
}

export function buildAppTestDbUrl(dbName: string): string {
  const user = process.env['DB_APP_USER'] || 'bubble_app';
  const password = process.env['DB_APP_PASSWORD'] || 'bubble_password';
  const host = process.env['POSTGRES_HOST'] || 'localhost';
  const port = process.env['POSTGRES_PORT'] || 5432;
  return `postgresql://${user}:${password}@${host}:${port}/${dbName}`;
}
