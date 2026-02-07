import { test, expect } from '../fixtures';

// Settings uses admin auth (default storageState — no override needed)

test.describe('Settings — LLM Admin', () => {
  test('[2E-E2E-004a] LLM Models tab shows seeded models', async ({
    page,
  }) => {
    await page.goto('/admin/settings');
    await expect(page.getByTestId('settings-page')).toBeVisible();

    // LLM Models tab should be active by default
    await expect(page.getByTestId('tab-llm-models')).toBeVisible();
    await page.getByTestId('tab-llm-models').click();

    // Models list should be visible with seeded data
    await expect(page.getByTestId('llm-models-list')).toBeVisible();

    // Verify at least one provider group is visible (seeded models exist)
    const providerGroups = page.locator(
      '[data-testid^="provider-group-"]',
    );
    await expect(providerGroups.first()).toBeVisible({ timeout: 10_000 });

    // Verify at least one model row is visible
    const modelRows = page.locator('[data-testid^="model-row-"]');
    await expect(modelRows.first()).toBeVisible();
  });

  test('[2E-E2E-004b] edit model display name persists on reload', async ({
    page,
  }) => {
    await page.goto('/admin/settings');
    await expect(page.getByTestId('settings-page')).toBeVisible();
    await page.getByTestId('tab-llm-models').click();
    await expect(page.getByTestId('llm-models-list')).toBeVisible();

    // Wait for models to load
    const modelRows = page.locator('[data-testid^="model-row-"]');
    await expect(modelRows.first()).toBeVisible({ timeout: 10_000 });

    // Click edit on the first model (scoped within models list)
    const modelsList = page.getByTestId('llm-models-list');
    const editButtons = modelsList.locator('[data-testid^="edit-"]');
    await editButtons.first().click();

    // Form dialog should open
    await expect(page.getByTestId('form-dialog')).toBeVisible();

    // Update display name
    const displayNameInput = page.getByTestId('input-displayName');
    await displayNameInput.clear();
    const newName = `E2E Model ${Date.now()}`;
    await displayNameInput.fill(newName);

    // Submit form
    await page.getByTestId('submit-btn').click();

    // Dialog should close
    await expect(page.getByTestId('form-dialog')).toBeHidden();

    // Reload and verify the change persisted
    await page.reload();
    await expect(page.getByTestId('llm-models-list')).toBeVisible();
    await expect(modelRows.first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(newName)).toBeVisible();
  });

  test('[2E-E2E-004c] Providers tab shows seeded provider configs', async ({
    page,
  }) => {
    await page.goto('/admin/settings');
    await expect(page.getByTestId('settings-page')).toBeVisible();

    // Switch to Providers tab
    await page.getByTestId('tab-providers').click();

    // Provider config list should load
    await expect(page.getByTestId('provider-config-list')).toBeVisible();

    // Verify at least one provider row (seeded configs exist)
    const providerRows = page.locator(
      '[data-testid^="provider-row-"]',
    );
    await expect(providerRows.first()).toBeVisible({ timeout: 10_000 });
  });

  test('[2E-E2E-004d] toggle model active/inactive', async ({ page }) => {
    await page.goto('/admin/settings');
    await expect(page.getByTestId('settings-page')).toBeVisible();
    await page.getByTestId('tab-llm-models').click();
    await expect(page.getByTestId('llm-models-list')).toBeVisible();

    // Wait for models to load
    const modelRows = page.locator('[data-testid^="model-row-"]');
    await expect(modelRows.first()).toBeVisible({ timeout: 10_000 });

    // Find a toggle button (custom <button> with aria-pressed, not a native checkbox)
    const modelsList = page.getByTestId('llm-models-list');
    const toggleButtons = modelsList.locator('[data-testid^="toggle-"]');
    const firstToggle = toggleButtons.first();
    await expect(firstToggle).toBeVisible();

    // Get current toggle state via aria-pressed attribute
    const wasActive = (await firstToggle.getAttribute('aria-pressed')) === 'true';

    // Click toggle to change state
    await firstToggle.click();

    // Verify toggle state changed
    if (wasActive) {
      await expect(firstToggle).toHaveAttribute('aria-pressed', 'false');
    } else {
      await expect(firstToggle).toHaveAttribute('aria-pressed', 'true');
    }

    // Toggle back to restore original state
    await firstToggle.click();
    if (wasActive) {
      await expect(firstToggle).toHaveAttribute('aria-pressed', 'true');
    } else {
      await expect(firstToggle).toHaveAttribute('aria-pressed', 'false');
    }
  });
});
