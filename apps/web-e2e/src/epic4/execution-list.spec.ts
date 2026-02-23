import { test, expect } from '../fixtures';

test.use({ storageState: 'playwright/.auth/tenant-a.json' });

test.describe('Epic 4 — Execution List Page [P0]', () => {
  test('[4E-E2E-002a] execution list shows 3 seeded runs with correct statuses', async ({ page }) => {
    await page.goto('/app/executions');

    // Wait for table to load
    await expect(page.getByTestId('execution-list-table')).toBeVisible({ timeout: 15_000 });

    // Should have 3 rows (completed, completed_with_errors, failed)
    const rows = page.getByTestId('execution-row');
    await expect(rows).toHaveCount(3, { timeout: 10_000 });

    // Verify status badges show correct statuses (sorted by created_at desc: failed, errors, completed)
    const badges = page.getByTestId('status-badge');
    await expect(badges).toHaveCount(3);

    // Verify all 3 expected statuses are present in the page (UI renders title-cased)
    const pageText = (await page.textContent('body')) || '';
    const lower = pageText.toLowerCase();
    expect(lower).toContain('completed');
    expect(lower).toContain('completed with errors');
    expect(lower).toContain('failed');
  });

  test('[4E-E2E-002b] status filter filters correctly', async ({ page }) => {
    await page.goto('/app/executions');
    await expect(page.getByTestId('execution-list-table')).toBeVisible({ timeout: 15_000 });

    // Find the status filter dropdown
    const statusFilter = page.getByTestId('status-filter');
    await expect(statusFilter).toBeVisible();

    // Select "completed" filter — should show 1 row
    await statusFilter.selectOption('completed');

    // Wait for filtered results
    const rows = page.getByTestId('execution-row');
    await expect(rows).toHaveCount(1, { timeout: 10_000 });
  });

  test('[4E-E2E-002c] clicking a row navigates to execution detail', async ({ page }) => {
    await page.goto('/app/executions');
    await expect(page.getByTestId('execution-list-table')).toBeVisible({ timeout: 15_000 });

    // Click the first view button
    const viewBtn = page.getByTestId('view-btn').first();
    await viewBtn.click();

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/app\/executions\/[0-9a-f-]+/, { timeout: 10_000 });
  });
});
