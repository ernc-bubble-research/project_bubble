/**
 * Tier 2 Wiring Integration Test — RETURNING Query Shape (Rule 31)
 *
 * Discovers and verifies the actual return shape of PostgreSQL RETURNING queries
 * when executed via TypeORM's EntityManager.query() vs DataSource.query().
 *
 * KEY DISCOVERY (verified empirically against PostgreSQL + TypeORM):
 *
 *   EntityManager.query('UPDATE ... RETURNING ...')  →  [[rows], affectedCount]
 *   EntityManager.query('INSERT ... RETURNING ...')  →  [row, row, ...]  (flat)
 *   DataSource.query('UPDATE ... RETURNING ...')     →  [[rows], affectedCount]
 *   DataSource.query('INSERT ... RETURNING ...')     →  [row, row, ...]  (flat)
 *
 * UPDATE RETURNING wraps rows in a nested array with an affectedCount.
 * INSERT RETURNING returns a flat array of row objects.
 * This asymmetry is a TypeORM/pg driver quirk — NOT a PostgreSQL behavior.
 *
 * Story: 4-FIX-A1 (AC1)
 * Rule: 31 (Raw SQL RETURNING needs Tier 2 wiring test)
 */
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createTestDatabase, dropTestDatabase, buildTestDbUrl } from '../test-db-helpers';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env.test') });

const TEST_DB_NAME = 'project_bubble_wiring_integ_test';

describe('RETURNING Query Shape — Tier 2 Wiring [Rule 31]', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    await createTestDatabase(TEST_DB_NAME);

    dataSource = new DataSource({
      type: 'postgres',
      url: buildTestDbUrl(TEST_DB_NAME),
      synchronize: false,
    });
    await dataSource.initialize();

    // Create a minimal workflow_runs-like table for testing RETURNING behavior
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS returning_test (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        completed_jobs INT,
        failed_jobs INT,
        total_jobs INT,
        status TEXT NOT NULL DEFAULT 'running',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await dropTestDatabase(TEST_DB_NAME);
  }, 15_000);

  afterEach(async () => {
    await dataSource.query(`DELETE FROM returning_test`);
  });

  // ── UPDATE RETURNING via EntityManager.query() ─────────────────

  it('[4-FIX-A1-WIRE-001] EntityManager.query UPDATE RETURNING returns [[rows], affectedCount]', async () => {
    const id = uuidv4();
    const tenantId = uuidv4();

    await dataSource.query(
      `INSERT INTO returning_test (id, tenant_id, completed_jobs, failed_jobs, total_jobs)
       VALUES ($1, $2, 0, 0, 3)`,
      [id, tenantId],
    );

    // Execute UPDATE RETURNING via EntityManager (same as processor does)
    const result = await dataSource.manager.query(
      `UPDATE returning_test
       SET completed_jobs = COALESCE(completed_jobs, 0) + 1
       WHERE id = $1
       RETURNING completed_jobs, failed_jobs, total_jobs`,
      [id],
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);

    // result[0] is the array of row objects, result[1] is the affected count
    const [rows, affectedCount] = result;

    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(1);
    expect(typeof affectedCount).toBe('number');
    expect(affectedCount).toBe(1);

    // Verify the row data has the expected fields as numbers
    const row = rows[0];
    expect(typeof row.completed_jobs).toBe('number');
    expect(row.completed_jobs).toBe(1);
    expect(typeof row.failed_jobs).toBe('number');
    expect(row.failed_jobs).toBe(0);
    expect(typeof row.total_jobs).toBe('number');
    expect(row.total_jobs).toBe(3);
  });

  it('[4-FIX-A1-WIRE-002] EntityManager.query UPDATE RETURNING with multiple rows', async () => {
    const tenantId = uuidv4();
    const id1 = uuidv4();
    const id2 = uuidv4();

    await dataSource.query(
      `INSERT INTO returning_test (id, tenant_id, completed_jobs, failed_jobs, total_jobs)
       VALUES ($1, $3, 0, 0, 5), ($2, $3, 2, 1, 5)`,
      [id1, id2, tenantId],
    );

    const result = await dataSource.manager.query(
      `UPDATE returning_test
       SET completed_jobs = COALESCE(completed_jobs, 0) + 1
       WHERE tenant_id = $1
       RETURNING completed_jobs, failed_jobs, total_jobs`,
      [tenantId],
    );

    const [rows, affectedCount] = result;

    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(2);
    expect(affectedCount).toBe(2);

    const sorted = rows.sort(
      (a: { completed_jobs: number }, b: { completed_jobs: number }) =>
        a.completed_jobs - b.completed_jobs,
    );
    expect(sorted[0].completed_jobs).toBe(1);
    expect(sorted[1].completed_jobs).toBe(3);
  });

  // ── INSERT RETURNING via EntityManager.query() ─────────────────

  it('[4-FIX-A1-WIRE-003] EntityManager.query INSERT RETURNING returns flat [row] (different from UPDATE)', async () => {
    const id = uuidv4();
    const tenantId = uuidv4();

    // Execute INSERT RETURNING via EntityManager (same pattern as validated-insight.service.ts)
    const result = await dataSource.manager.query(
      `INSERT INTO returning_test (id, tenant_id, completed_jobs, failed_jobs, total_jobs, status)
       VALUES ($1, $2, 0, 0, 3, 'running')
       RETURNING id, completed_jobs, failed_jobs, total_jobs, status`,
      [id, tenantId],
    );

    // CRITICAL DISCOVERY: INSERT RETURNING returns flat [row], NOT [[rows], affectedCount]
    // This is DIFFERENT from UPDATE RETURNING — an asymmetry in TypeORM/pg driver.
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);

    // result[0] is the row object directly — NOT nested
    const row = result[0];
    expect(Array.isArray(row)).toBe(false);
    expect(typeof row).toBe('object');
    expect(row.id).toBe(id);
    expect(typeof row.completed_jobs).toBe('number');
    expect(row.completed_jobs).toBe(0);
    expect(row.status).toBe('running');
  });

  // ── DataSource.query() for comparison ──────────────────────────

  it('[4-FIX-A1-WIRE-004] DataSource.query UPDATE RETURNING also returns [[rows], affectedCount]', async () => {
    const id = uuidv4();
    const tenantId = uuidv4();

    await dataSource.query(
      `INSERT INTO returning_test (id, tenant_id, completed_jobs, failed_jobs, total_jobs)
       VALUES ($1, $2, 0, 0, 3)`,
      [id, tenantId],
    );

    const result = await dataSource.query(
      `UPDATE returning_test
       SET completed_jobs = COALESCE(completed_jobs, 0) + 1
       WHERE id = $1
       RETURNING completed_jobs, failed_jobs, total_jobs`,
      [id],
    );

    // DataSource.query UPDATE RETURNING has same shape as EntityManager: [[rows], affectedCount]
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);

    const [rows, affectedCount] = result;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(1);
    expect(typeof affectedCount).toBe('number');
    expect(affectedCount).toBe(1);
    expect(typeof rows[0].completed_jobs).toBe('number');
    expect(rows[0].completed_jobs).toBe(1);
  });

  it('[4-FIX-A1-WIRE-005] DataSource.query INSERT RETURNING returns flat [row]', async () => {
    const id = uuidv4();
    const tenantId = uuidv4();

    const result = await dataSource.query(
      `INSERT INTO returning_test (id, tenant_id, completed_jobs, failed_jobs, total_jobs, status)
       VALUES ($1, $2, 0, 0, 3, 'running')
       RETURNING id, completed_jobs, failed_jobs, total_jobs`,
      [id, tenantId],
    );

    // INSERT RETURNING via DataSource.query also returns flat [row] — consistent with EntityManager
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(id);
    expect(typeof result[0].completed_jobs).toBe('number');
  });

  // ── Destructuring pattern verification ─────────────────────────

  it('[4-FIX-A1-WIRE-006] The buggy pattern result[0] on UPDATE RETURNING gives array not object', async () => {
    const id = uuidv4();
    const tenantId = uuidv4();

    await dataSource.query(
      `INSERT INTO returning_test (id, tenant_id, completed_jobs, failed_jobs, total_jobs)
       VALUES ($1, $2, 0, 0, 3)`,
      [id, tenantId],
    );

    const result = await dataSource.manager.query(
      `UPDATE returning_test
       SET completed_jobs = COALESCE(completed_jobs, 0) + 1
       WHERE id = $1
       RETURNING completed_jobs, failed_jobs, total_jobs`,
      [id],
    );

    // THE BUG: result[0] for UPDATE RETURNING is the rows ARRAY, not a row object
    const buggyResult = result[0];
    expect(Array.isArray(buggyResult)).toBe(true);
    // buggyResult.completed_jobs is undefined because arrays don't have named properties
    expect(buggyResult.completed_jobs).toBeUndefined();

    // The CORRECT destructuring for UPDATE RETURNING:
    const [[correctRow]] = result;
    expect(typeof correctRow.completed_jobs).toBe('number');
    expect(correctRow.completed_jobs).toBe(1);
    expect(typeof correctRow.failed_jobs).toBe('number');
    expect(typeof correctRow.total_jobs).toBe('number');
  });

  // ── E2E pattern verification ───────────────────────────────────

  it('[4-FIX-A1-WIRE-007] E2E pattern ds.query INSERT RETURNING with result[0].id works correctly', async () => {
    const id = uuidv4();
    const tenantId = uuidv4();

    // Replicates the pattern from invitations.spec.ts:87 — result[0].id
    const result = await dataSource.query(
      `INSERT INTO returning_test (id, tenant_id, completed_jobs, failed_jobs, total_jobs)
       VALUES ($1, $2, 0, 0, 1)
       RETURNING id`,
      [id, tenantId],
    );

    // INSERT RETURNING returns flat [row] so result[0].id works
    expect(result[0].id).toBe(id);
  });

  // ── validated-insight.service.ts pattern ────────────────────────

  it('[4-FIX-A1-WIRE-008] validated-insight INSERT RETURNING via txManager pattern returns flat [row]', async () => {
    const id = uuidv4();
    const tenantId = uuidv4();

    // Simulate the pattern from validated-insight.service.ts:64-78
    // which uses txManager.run() → manager.query('INSERT ... RETURNING ...')
    // and then accesses rows[0] (flat array access)
    const result = await dataSource.manager.query(
      `INSERT INTO returning_test (id, tenant_id, completed_jobs, failed_jobs, total_jobs, status)
       VALUES ($1, $2, 0, 0, 1, 'running')
       RETURNING id, completed_jobs, status`,
      [id, tenantId],
    );

    // INSERT RETURNING is flat — so rows[0] is correct in validated-insight.service.ts
    expect(result[0].id).toBe(id);
    expect(typeof result[0].completed_jobs).toBe('number');
    expect(result[0].status).toBe('running');
  });

  it('[4-FIX-A1-WIRE-009] validated-insight UPDATE RETURNING via txManager needs [[row]] destructuring', async () => {
    const id = uuidv4();
    const tenantId = uuidv4();

    await dataSource.query(
      `INSERT INTO returning_test (id, tenant_id, completed_jobs, failed_jobs, total_jobs)
       VALUES ($1, $2, 0, 0, 1)`,
      [id, tenantId],
    );

    // Simulate the pattern from validated-insight.service.ts:176-182
    // which uses manager.query('UPDATE ... RETURNING id')
    const result = await dataSource.manager.query(
      `UPDATE returning_test
       SET status = 'completed'
       WHERE id = $1 AND tenant_id = $2
       RETURNING id`,
      [id, tenantId],
    );

    // UPDATE RETURNING is nested — rows[0] gives the array, NOT the row
    expect(Array.isArray(result[0])).toBe(true);

    // The correct access pattern:
    const [[row]] = result;
    expect(row.id).toBe(id);
  });

  it('[4-FIX-A1-WIRE-010] UPDATE RETURNING with zero matches returns [[], 0]', async () => {
    const nonExistentId = uuidv4();

    const result = await dataSource.manager.query(
      `UPDATE returning_test
       SET status = 'completed'
       WHERE id = $1
       RETURNING id`,
      [nonExistentId],
    );

    // Zero-match UPDATE RETURNING still returns [[rows], affectedCount] shape
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);

    const [rows, affectedCount] = result;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(0);
    expect(affectedCount).toBe(0);
  });
});
