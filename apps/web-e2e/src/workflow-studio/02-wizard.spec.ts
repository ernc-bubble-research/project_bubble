import { test, expect } from '../fixtures';

// Workflow Wizard uses admin auth (default storageState — no override needed)

test.describe('[P0] Workflow Studio — Wizard', () => {
  test('[3E-E2E-002a] North Star: create workflow through all 5 steps', async ({
    page,
  }) => {
    const uniqueName = `E2E Test Workflow ${Date.now()}`;

    // Given — admin navigates to Workflow Studio and clicks Create
    await page.goto('/admin/workflows');
    await expect(page.getByTestId('workflow-studio-container')).toBeVisible();
    await expect(page.getByTestId('templates-content')).toBeVisible();
    await page.getByTestId('create-workflow-button').click();
    await expect(page.getByTestId('wizard-stepper')).toBeVisible();

    // ── Step 0: Metadata ──────────────────────────────────────────────
    await page.getByTestId('metadata-name-input').fill(uniqueName);
    await page.getByTestId('metadata-description-input').fill(
      'E2E test workflow created by Playwright',
    );
    await page.getByTestId('wizard-next-btn').click();

    // ── Step 1: Inputs ────────────────────────────────────────────────
    await expect(page.getByTestId('add-input-btn')).toBeVisible();
    await page.getByTestId('add-input-btn').click();
    await expect(page.getByTestId('input-card-0')).toBeVisible();

    await page.getByTestId('input-name-0').fill('subject');
    await page.getByTestId('input-label-0').fill('Subject');
    await page.getByTestId('input-role-0').selectOption('subject');
    await page.getByTestId('input-source-text-0').check();
    await page.getByTestId('wizard-next-btn').click();

    // ── Step 2: Execution ─────────────────────────────────────────────
    // Wait for LLM models to load asynchronously
    const modelSelect = page.getByTestId('exec-model-select');
    await expect(modelSelect.locator('option')).not.toHaveCount(1, {
      timeout: 15_000,
    });
    // Auto-selection should pick first model; explicitly select if empty
    const currentValue = await modelSelect.inputValue();
    if (!currentValue) {
      await modelSelect.selectOption({ index: 1 }); // index 0 is "Select a model" placeholder
    }
    await page.getByTestId('wizard-next-btn').click();

    // ── Step 3: Prompt ────────────────────────────────────────────────
    await expect(page.getByTestId('prompt-textarea')).toBeVisible();
    await page.getByTestId('prompt-textarea').fill('Analyze {subject}');
    await page.getByTestId('wizard-next-btn').click();

    // ── Step 4: Output ────────────────────────────────────────────────
    await expect(
      page.getByTestId('output-format-markdown'),
    ).toBeVisible();
    await page.getByTestId('output-format-markdown').click();
    await page.getByTestId('output-filename-input').fill('output-{subject}');
    await page.getByTestId('add-section-btn').click();
    await expect(page.getByTestId('section-name-0')).toBeVisible();
    await page.getByTestId('section-name-0').fill('analysis');
    await page.getByTestId('section-label-0').fill('Analysis');

    // ── Save ──────────────────────────────────────────────────────────
    await page.getByTestId('wizard-save-btn').click();

    // Then — navigates back to template list and new template appears
    await expect(page).toHaveURL(/\/admin\/workflows/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId('templates-content')).toBeVisible();
    await expect(page.getByText(uniqueName)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('[3E-E2E-002b] edit seeded template — modify name and persist', async ({
    page,
  }) => {
    const seededTemplateId = '33333333-0000-0000-0000-000000000001';
    const editedName = `Edited Template ${Date.now()}`;

    // Given — admin navigates to edit the seeded template
    await page.goto(`/admin/workflows/edit/${seededTemplateId}`);
    await expect(page.getByTestId('wizard-stepper')).toBeVisible();

    // Then — metadata step is pre-populated with seeded data
    await expect(page.getByTestId('metadata-name-input')).toHaveValue(
      'E2E Seed Template',
      { timeout: 10_000 },
    );

    // When — modify the name and save
    await page.getByTestId('metadata-name-input').clear();
    await page.getByTestId('metadata-name-input').fill(editedName);

    // Navigate to last step to access save button
    // In edit mode, all steps are visited so we can click step indicators directly
    await page.getByTestId('step-indicator-4').click();
    await expect(page.getByTestId('wizard-save-btn')).toBeVisible();
    await page.getByTestId('wizard-save-btn').click();

    // Then — navigates back to template list
    await expect(page).toHaveURL(/\/admin\/workflows/, {
      timeout: 15_000,
    });

    // Verify change persists — reload the edit page
    await page.goto(`/admin/workflows/edit/${seededTemplateId}`);
    await expect(page.getByTestId('metadata-name-input')).toHaveValue(
      editedName,
      { timeout: 10_000 },
    );
  });

  test('[3E-E2E-002c] back button preserves metadata form state', async ({
    page,
  }) => {
    const testName = 'Back Button Test';
    const testDescription = 'Testing form state preservation';

    // Given — admin starts creating a new workflow
    await page.goto('/admin/workflows/create');
    await expect(page.getByTestId('wizard-stepper')).toBeVisible();

    // When — fill metadata step
    await page.getByTestId('metadata-name-input').fill(testName);
    await page
      .getByTestId('metadata-description-input')
      .fill(testDescription);

    // Advance to step 1 (inputs)
    await page.getByTestId('wizard-next-btn').click();
    await expect(page.getByTestId('add-input-btn')).toBeVisible();

    // Click back to step 0
    await page.getByTestId('wizard-prev-btn').click();

    // Then — metadata form state is preserved
    await expect(page.getByTestId('metadata-name-input')).toHaveValue(
      testName,
    );
    await expect(
      page.getByTestId('metadata-description-input'),
    ).toHaveValue(testDescription);
  });
});
