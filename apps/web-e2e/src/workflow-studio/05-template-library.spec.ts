import { test, expect } from '../fixtures';

// Template Library uses admin auth (default storageState — no override needed)

const SEEDED_TEMPLATE_ID = '33333333-0000-0000-0000-000000000001';

test.describe('[P1] Workflow Studio — Template Library', () => {
  test('[3E-E2E-005a] search filters templates by text match', async ({
    page,
  }) => {
    // Given — admin navigates to Workflow Studio
    await page.goto('/admin/workflows');
    await expect(page.getByTestId('templates-content')).toBeVisible();

    // Wait for template cards to load
    const templateCards = page.locator('[data-testid^="template-card-"]');
    await expect(templateCards.first()).toBeVisible({ timeout: 10_000 });

    // When — search for "E2E" (should match seeded + test-created templates)
    await page.getByTestId('workflow-search-input').fill('E2E');

    // Then — at least one template card is still visible
    await expect(templateCards.first()).toBeVisible({ timeout: 5_000 });

    // When — search for a string that matches nothing
    await page.getByTestId('workflow-search-input').clear();
    await page.getByTestId('workflow-search-input').fill('zzz_nonexistent_xyz');

    // Then — empty state is shown (no matching templates)
    await expect(page.getByTestId('template-list-empty')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('[3E-E2E-005b] status filter shows only matching status', async ({
    page,
  }) => {
    // Given — admin navigates to Workflow Studio with templates loaded
    await page.goto('/admin/workflows');
    await expect(page.getByTestId('templates-content')).toBeVisible();
    const templateCards = page.locator('[data-testid^="template-card-"]');
    await expect(templateCards.first()).toBeVisible({ timeout: 10_000 });

    // When — click "Archived" status filter
    await page.getByTestId('filter-status-archived').click();

    // Then — no archived templates exist, so seeded template should be hidden
    await expect(
      page.getByTestId(`template-card-${SEEDED_TEMPLATE_ID}`),
    ).not.toBeVisible({ timeout: 5_000 });

    // When — click "All" to restore full list
    await page.getByTestId('filter-status-all').click();

    // Then — seeded template is visible again
    await expect(
      page.getByTestId(`template-card-${SEEDED_TEMPLATE_ID}`),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('[3E-E2E-005c] duplicate template creates a copy', async ({
    page,
  }) => {
    // Given — admin navigates to Workflow Studio with seeded template visible
    await page.goto('/admin/workflows');
    await expect(page.getByTestId('templates-content')).toBeVisible();
    await expect(
      page.getByTestId(`template-card-${SEEDED_TEMPLATE_ID}`),
    ).toBeVisible({ timeout: 10_000 });

    // When — open template card menu and click Duplicate
    await page
      .getByTestId(`template-card-${SEEDED_TEMPLATE_ID}-menu`)
      .click();
    await page
      .getByTestId(`template-card-${SEEDED_TEMPLATE_ID}-duplicate`)
      .click();

    // Duplicate navigates to the edit page for the new copy
    await expect(page).toHaveURL(/\/admin\/workflows\/edit\//, {
      timeout: 15_000,
    });

    // Navigate back to template list to verify the copy was created
    await page.goto('/admin/workflows');
    await expect(page.getByTestId('templates-content')).toBeVisible();

    // Then — a new template card appears with "(Copy)" in its name
    await expect(page.getByText('(Copy)')).toBeVisible({ timeout: 10_000 });
  });
});
