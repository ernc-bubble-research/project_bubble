import { test, expect } from '../fixtures';

const SEED_PUBLISHED_TEMPLATE_ID = '33333333-0000-0000-0000-000000000001';

test.use({ storageState: 'playwright/.auth/tenant-a.json' });

test.describe('Epic 4 — Workflow Catalog & Run Initiation [P0]', () => {
  test('[4E-E2E-001a] catalog page shows published template', async ({ page }) => {
    await page.goto('/app/workflows');

    // Wait for catalog to load
    await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 15_000 });

    // The seeded published template should be visible
    await expect(page.getByText('E2E Seed Template')).toBeVisible();
  });

  test('[4E-E2E-001b] clicking Run navigates to run form', async ({ page }) => {
    await page.goto('/app/workflows');
    await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 15_000 });

    // Find the run button for the seeded template
    const runButton = page.locator('[data-testid^="run-button-"]').first();
    await expect(runButton).toBeVisible();
    await runButton.click();

    // Should navigate to the run form
    await expect(page).toHaveURL(/\/app\/workflows\/run\//, { timeout: 10_000 });
  });

  test('[4E-E2E-001c] run form renders with subject input field', async ({ page }) => {
    // Navigate directly to the run form for the seeded published template
    await page.goto(`/app/workflows/run/${SEED_PUBLISHED_TEMPLATE_ID}`);

    // Wait for form to load (not loading state)
    await expect(page.getByTestId('run-form-loading')).not.toBeVisible({ timeout: 15_000 });

    // Subject input should be present (the seeded template has a "subject" input)
    const subjectInput = page.locator('[data-testid^="input-group-"]').first();
    await expect(subjectInput).toBeVisible({ timeout: 10_000 });

    // Submit button should exist
    await expect(page.getByTestId('submit-run')).toBeVisible();
  });

  test('[4E-E2E-001d] Tenant B can see published template in catalog', async ({ tenantBPage }) => {
    await tenantBPage.goto('/app/workflows');

    // Wait for catalog to load
    await expect(tenantBPage.getByTestId('catalog-grid')).toBeVisible({ timeout: 15_000 });

    // The public published template should be visible to Tenant B too
    await expect(tenantBPage.getByText('E2E Seed Template')).toBeVisible();
  });
});
