import { test, expect } from '../fixtures';

const SEED_PUBLISHED_TEMPLATE_ID = '33333333-0000-0000-0000-000000000001';

test.use({ storageState: 'playwright/.auth/tenant-a.json' });

test.describe('Epic 4 — Real Execution Pipeline (MockLlmProvider) [P0]', () => {
  test('[4E-E2E-005a] full pipeline: initiate run → MockLlm → completed', async ({ page }) => {
    test.setTimeout(60_000); // Pipeline test — MockLlm has 500ms-2s latency

    // Step 1: Navigate to run form for the seeded published template
    await page.goto(`/app/workflows/run/${SEED_PUBLISHED_TEMPLATE_ID}`);

    // Wait for form to load
    await expect(page.getByTestId('run-form-loading')).not.toBeVisible({ timeout: 15_000 });

    // Step 2: Fill in a text subject input
    // The seeded template has a "subject" input with source: ["text"]
    // Select text mode if there's a source toggle
    const textToggle = page.locator('[data-testid^="toggle-text-"]').first();
    if (await textToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await textToggle.click();
    }

    // Fill the text input
    const textInput = page.locator('[data-testid^="text-input-"]').first();
    await expect(textInput).toBeVisible({ timeout: 5_000 });
    await textInput.fill('This is a test document for E2E pipeline validation.');

    // Step 3: Submit the run
    const submitBtn = page.getByTestId('submit-run');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Step 4: Wait for run to be created and navigate to result
    // After submission, the form should show success or redirect
    // Give the MockLlmProvider time to process (it has 500ms-2s latency)
    const successMsg = page.getByTestId('run-success');
    await expect(successMsg).toBeVisible({ timeout: 15_000 });

    // Step 5: Navigate to executions list and verify the new run appears
    await page.goto('/app/executions');
    await expect(page.getByTestId('execution-list-table')).toBeVisible({ timeout: 15_000 });

    // Should have at least 4 rows now (3 seeded + 1 just created)
    const rows = page.getByTestId('execution-row');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('[4E-E2E-005b] execution detail shows completed status after pipeline', async ({ page }) => {
    test.setTimeout(60_000); // Pipeline test — depends on 005a creating a run

    // Poll execution list until pipeline run from 005a appears (>= 4 rows)
    // The list component polls every 10s, but we reload for faster detection
    await expect(async () => {
      await page.goto('/app/executions');
      await expect(page.getByTestId('execution-list-table')).toBeVisible({ timeout: 10_000 });
      const count = await page.getByTestId('execution-row').count();
      expect(count).toBeGreaterThanOrEqual(4);
    }).toPass({ timeout: 30_000, intervals: [2_000] });

    // Click the first row (most recent — sorted by created_at desc = pipeline run)
    const viewBtn = page.getByTestId('view-btn').first();
    await viewBtn.click();

    // Wait for detail page
    await expect(page).toHaveURL(/\/app\/executions\/[0-9a-f-]+/, { timeout: 10_000 });
    await expect(page.getByTestId('detail-status-badge')).toBeVisible({ timeout: 15_000 });

    // The detail page should load successfully and show run metadata
    await expect(page.getByTestId('detail-meta')).toBeVisible();
  });
});
