import { test, expect } from '../fixtures';

// Workflow Wizard uses admin auth (default storageState — no override needed)

test.describe('[P0] Workflow Studio — Wizard', () => {
  test('[3E-E2E-002a] North Star: create workflow through all 4 steps', async ({
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

    // ── Step 3: Prompt (last step — save button appears here) ─────────
    await expect(page.getByTestId('prompt-textarea')).toBeVisible();
    await page.getByTestId('prompt-textarea').fill('Analyze {subject}');

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

    // Navigate to last step (Prompt — 4-step wizard, Output step removed)
    // In edit mode, all steps are visited so we can click step indicators directly
    await page.getByTestId('step-indicator-3').click();
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

  test('[3E-E2E-002d] file type preset chips toggle and custom extension input', async ({
    page,
  }) => {
    // Given — admin starts creating a new workflow and reaches inputs step
    await page.goto('/admin/workflows/create');
    await expect(page.getByTestId('wizard-stepper')).toBeVisible();

    await page.getByTestId('metadata-name-input').fill(`Preset Test ${Date.now()}`);
    await page.getByTestId('wizard-next-btn').click();

    // ── Step 1: Inputs ────────────────────────────────────────────────
    await expect(page.getByTestId('add-input-btn')).toBeVisible();
    await page.getByTestId('add-input-btn').click();
    await expect(page.getByTestId('input-card-0')).toBeVisible();

    // Fill required fields
    await page.getByTestId('input-name-0').fill('document');
    await page.getByTestId('input-label-0').fill('Document');
    await page.getByTestId('input-role-0').selectOption('subject');

    // When — select "Upload" source (file-based → preset chips appear)
    await page.getByTestId('input-source-upload-0').check();

    // Then — preset chips container is visible
    await expect(page.getByTestId('preset-chips-0')).toBeVisible();

    // When — click "Documents" preset chip
    await page.getByTestId('preset-chip-documents-0').click();

    // Then — chip shows active state
    await expect(
      page.getByTestId('preset-chip-documents-0'),
    ).toHaveClass(/active/);

    // When — add a custom extension via input
    await page.getByTestId('custom-ext-input-0').fill('.custom');
    await page.getByTestId('custom-ext-input-0').press('Enter');

    // Then — custom extension tag appears
    await expect(page.getByTestId('custom-ext-tags-0')).toBeVisible();
    await expect(
      page.getByTestId('custom-ext-tag-.custom-0'),
    ).toBeVisible();

    // Verify Documents chip is still active (custom ext doesn't deactivate presets)
    await expect(
      page.getByTestId('preset-chip-documents-0'),
    ).toHaveClass(/active/);
  });

  test('[3E-E2E-006a] validation blocks Next when metadata required fields empty', async ({
    page,
  }) => {
    // Given — admin starts creating a new workflow
    await page.goto('/admin/workflows/create');
    await expect(page.getByTestId('wizard-stepper')).toBeVisible();

    // When — leave name and description empty and click Next
    await page.getByTestId('wizard-next-btn').click();

    // Then — step does NOT advance (still on step 0)
    // Validation error message should appear
    await expect(page.getByTestId('step-validation-error')).toBeVisible();
    // Inputs step add-input-btn should NOT be visible (we didn't advance)
    await expect(page.getByTestId('add-input-btn')).not.toBeVisible();
    // Metadata fields should still be visible (still on step 0)
    await expect(page.getByTestId('metadata-name-input')).toBeVisible();
  });

  test('[3E-E2E-006b] prompt step shows variable chips matching defined inputs', async ({
    page,
  }) => {
    // Given — admin creates a workflow and adds a "subject" input
    await page.goto('/admin/workflows/create');
    await expect(page.getByTestId('wizard-stepper')).toBeVisible();

    // Step 0: Metadata
    await page.getByTestId('metadata-name-input').fill(`Variable Chip Test ${Date.now()}`);
    await page.getByTestId('metadata-description-input').fill('Testing variable chips');
    await page.getByTestId('wizard-next-btn').click();

    // Step 1: Inputs — add "subject" input
    await expect(page.getByTestId('add-input-btn')).toBeVisible();
    await page.getByTestId('add-input-btn').click();
    await page.getByTestId('input-name-0').fill('subject');
    await page.getByTestId('input-label-0').fill('Subject');
    await page.getByTestId('input-role-0').selectOption('subject');
    await page.getByTestId('input-source-text-0').check();
    await page.getByTestId('wizard-next-btn').click();

    // Step 2: Execution — wait for models, advance
    const modelSelect = page.getByTestId('exec-model-select');
    await expect(modelSelect.locator('option')).not.toHaveCount(1, {
      timeout: 15_000,
    });
    const currentValue = await modelSelect.inputValue();
    if (!currentValue) {
      await modelSelect.selectOption({ index: 1 });
    }
    await page.getByTestId('wizard-next-btn').click();

    // Step 3: Prompt — verify variable chip for "subject" appears
    await expect(page.getByTestId('prompt-textarea')).toBeVisible();
    await expect(page.getByTestId('variable-chips')).toBeVisible();
    await expect(page.getByTestId('variable-chip-subject')).toBeVisible();
  });
});
