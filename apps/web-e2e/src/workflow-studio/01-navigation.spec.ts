import { test, expect } from '../fixtures';

// Workflow Studio uses admin auth (default storageState — no override needed)

test.describe('[P0] Workflow Studio — Navigation', () => {
  test('[3E-E2E-001a] navigate to Workflow Studio shows Templates tab with seeded template', async ({
    page,
  }) => {
    // Given — admin navigates to Workflow Studio
    await page.goto('/admin/workflows');
    await expect(page.getByTestId('workflow-studio-container')).toBeVisible();

    // Then — Templates tab is active and seeded template is visible
    await expect(page.getByTestId('templates-content')).toBeVisible();

    const templateCard = page.locator(
      '[data-testid^="template-card-"]',
    );
    await expect(templateCard.first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('E2E Seed Template')).toBeVisible();
  });

  // TODO: re-enable in Story 4-6 when chain routes and UI are restored
  test.skip('[3E-E2E-001b] switch to Chains tab shows seeded chain', async ({
    page,
  }) => {
    // Given — admin is on Workflow Studio
    await page.goto('/admin/workflows');
    await expect(page.getByTestId('workflow-studio-container')).toBeVisible();

    // When — click Chains tab
    await page.getByTestId('workflow-studio-chains-tab').click();

    // Then — Chains content visible with seeded chain
    await expect(page.getByTestId('chains-content')).toBeVisible();

    const chainCard = page.locator('[data-testid^="chain-card-"]');
    await expect(chainCard.first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('E2E Seed Chain')).toBeVisible();
  });
});
