import { test, expect } from '../fixtures';

// Use seed constant values directly (can't import seed-constants from here
// due to Playwright TS transformer limitations with TypeORM decorators)
const SEED_RUN_COMPLETED_ID = '44444444-0000-0000-0000-000000000001';
const SEED_RUN_FAILED_ID = '44444444-0000-0000-0000-000000000003';

test.use({ storageState: 'playwright/.auth/tenant-a.json' });

test.describe('Epic 4 — Execution Detail Page [P0]', () => {
  test('[4E-E2E-003a] completed run shows metadata and per-file results', async ({ page }) => {
    await page.goto(`/app/executions/${SEED_RUN_COMPLETED_ID}`);

    // Wait for detail to load
    await expect(page.getByTestId('detail-status-badge')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('detail-meta')).toBeVisible();

    // Status should show completed
    await expect(page.getByTestId('detail-status-badge')).toContainText(/completed/i);

    // Per-file results table should show 2 files
    await expect(page.getByTestId('per-file-table')).toBeVisible();
    const fileRows = page.getByTestId('file-row');
    await expect(fileRows).toHaveCount(2);
  });

  test('[4E-E2E-003b] failed run shows error message', async ({ page }) => {
    await page.goto(`/app/executions/${SEED_RUN_FAILED_ID}`);

    // Wait for detail to load
    await expect(page.getByTestId('detail-status-badge')).toBeVisible({ timeout: 15_000 });

    // Error banner should be visible
    await expect(page.getByTestId('error-banner')).toBeVisible();
    await expect(page.getByTestId('error-banner')).toContainText(/failed/i);
  });

  test('[4E-E2E-003c] download button present for completed files', async ({ page }) => {
    await page.goto(`/app/executions/${SEED_RUN_COMPLETED_ID}`);

    // Wait for per-file table
    await expect(page.getByTestId('per-file-table')).toBeVisible({ timeout: 15_000 });

    // Download buttons should exist for completed files
    const downloadBtns = page.getByTestId('download-file-btn');
    await expect(downloadBtns.first()).toBeVisible();
  });
});
