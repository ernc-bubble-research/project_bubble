import { test, expect } from '../fixtures';

// Chain Builder uses admin auth (default storageState — no override needed)

test.describe('[P0] Workflow Studio — Chain Builder', () => {
  test('[3E-E2E-003a] create chain with 2 steps and input mapping', async ({
    page,
  }) => {
    const uniqueName = `E2E Test Chain ${Date.now()}`;
    const seededTemplateId = '33333333-0000-0000-0000-000000000001';

    // Given — admin navigates to create a new chain
    await page.goto('/admin/workflows/chains/new');
    await expect(page.getByTestId('chain-name-input')).toBeVisible();

    // When — fill chain metadata
    await page.getByTestId('chain-name-input').fill(uniqueName);
    await page
      .getByTestId('chain-description-input')
      .fill('E2E test chain');

    // Add step 1 — select the seeded published template
    const templateSelect = page.getByTestId('chain-template-select');
    await expect(templateSelect.locator('option')).not.toHaveCount(1, {
      timeout: 10_000,
    });
    await templateSelect.selectOption(seededTemplateId);
    await page.getByTestId('chain-add-step-button').click();
    await expect(page.getByTestId('chain-step-0')).toBeVisible();

    // Add step 2 — same template
    await templateSelect.selectOption(seededTemplateId);
    await page.getByTestId('chain-add-step-button').click();
    await expect(page.getByTestId('chain-step-1')).toBeVisible();

    // Verify input mapping section appears for step 2
    await expect(
      page.getByTestId('chain-step-1-mapping'),
    ).toBeVisible({ timeout: 5_000 });

    // Save the chain
    await page.getByTestId('chain-save-button').click();

    // Then — navigates back to Workflow Studio
    await expect(page).toHaveURL(/\/admin\/workflows/, {
      timeout: 15_000,
    });

    // Switch to Chains tab and verify the new chain appears
    await page.getByTestId('workflow-studio-chains-tab').click();
    await expect(page.getByTestId('chains-content')).toBeVisible();
    await expect(page.getByText(uniqueName)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('[3E-E2E-003b] edit seeded chain — modify name and persist', async ({
    page,
  }) => {
    const seededChainId = '33333333-0000-0000-0000-000000000003';
    const editedName = `Edited Chain ${Date.now()}`;

    // Given — admin navigates to edit the seeded chain
    await page.goto(`/admin/workflows/chains/${seededChainId}/edit`);
    await expect(page.getByTestId('chain-name-input')).toBeVisible({
      timeout: 10_000,
    });

    // Then — name is pre-populated with seeded data
    await expect(page.getByTestId('chain-name-input')).toHaveValue(
      'E2E Seed Chain',
    );

    // When — modify the name and save
    await page.getByTestId('chain-name-input').clear();
    await page.getByTestId('chain-name-input').fill(editedName);
    await page.getByTestId('chain-save-button').click();

    // Then — navigates back to Workflow Studio
    await expect(page).toHaveURL(/\/admin\/workflows/, {
      timeout: 15_000,
    });

    // Verify change persists — reload the edit page
    await page.goto(`/admin/workflows/chains/${seededChainId}/edit`);
    await expect(page.getByTestId('chain-name-input')).toHaveValue(
      editedName,
      { timeout: 10_000 },
    );
  });

  test('[3E-E2E-003c] chain with 2+ steps shows data flow diagram', async ({
    page,
  }) => {
    const seededChainId = '33333333-0000-0000-0000-000000000003';

    // Given — admin opens the seeded chain (has 2 steps)
    await page.goto(`/admin/workflows/chains/${seededChainId}/edit`);
    await expect(page.getByTestId('chain-name-input')).toBeVisible({
      timeout: 10_000,
    });

    // Then — data flow diagram is visible
    await expect(
      page.getByTestId('chain-data-flow-diagram'),
    ).toBeVisible({ timeout: 5_000 });
  });
});
