import { test, expect } from '../fixtures';

// Seeded template ID from global-setup.ts (Step 5)
const SEEDED_TEMPLATE_ID = '33333333-0000-0000-0000-000000000001';

// Tenant IDs from global-setup.ts (Step 3)
const TENANT_ALPHA_ID = '11111111-0000-0000-0000-000000000000';

test.describe('[P0] Workflow Studio — Settings Modal', () => {
  test('[3E-E2E-004a] open settings modal from template card and verify structure', async ({
    page,
  }) => {
    // Given — admin navigates to Workflow Studio
    await page.goto('/admin/workflows');
    await expect(page.getByTestId('templates-content')).toBeVisible();
    await expect(
      page.getByTestId(`template-card-${SEEDED_TEMPLATE_ID}`),
    ).toBeVisible({ timeout: 10_000 });

    // When — click the 3-dot menu → Settings
    await page
      .getByTestId(`template-card-${SEEDED_TEMPLATE_ID}-menu`)
      .click();
    await page
      .getByTestId(`template-card-${SEEDED_TEMPLATE_ID}-settings`)
      .click();

    // Then — settings modal is visible with expected structure
    await expect(page.getByTestId('settings-modal')).toBeVisible();
    await expect(page.getByTestId('settings-workflow-name')).toBeVisible();
    await expect(page.getByTestId('settings-status-badge')).toBeVisible();
    await expect(page.getByTestId('settings-visibility')).toBeVisible();
    await expect(page.getByTestId('visibility-public')).toBeVisible();
    await expect(page.getByTestId('visibility-private')).toBeVisible();
    await expect(page.getByTestId('settings-save-btn')).toBeVisible();
    await expect(page.getByTestId('settings-cancel-btn')).toBeVisible();

    // Close modal via close button
    await page.getByTestId('settings-close-btn').click();
    await expect(page.getByTestId('settings-modal')).not.toBeVisible();
  });

  test('[3E-E2E-004b] change visibility to private, select tenant, save and verify persistence', async ({
    page,
  }) => {
    // Given — open settings for seeded template
    await page.goto('/admin/workflows');
    await expect(page.getByTestId('templates-content')).toBeVisible();
    await expect(
      page.getByTestId(`template-card-${SEEDED_TEMPLATE_ID}`),
    ).toBeVisible({ timeout: 10_000 });
    await page
      .getByTestId(`template-card-${SEEDED_TEMPLATE_ID}-menu`)
      .click();
    await page
      .getByTestId(`template-card-${SEEDED_TEMPLATE_ID}-settings`)
      .click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();

    // When — switch to private visibility
    await page.getByTestId('visibility-private').check();

    // Then — tenant section appears with Tenant Alpha visible (System tenant filtered out)
    await expect(page.getByTestId('settings-tenant-section')).toBeVisible();
    await expect(
      page.getByTestId(`tenant-option-${TENANT_ALPHA_ID}`),
    ).toBeVisible();

    // Select Tenant Alpha
    await page.getByTestId(`tenant-option-${TENANT_ALPHA_ID}`).click();

    // Save
    await page.getByTestId('settings-save-btn').click();
    await expect(page.getByTestId('settings-modal')).not.toBeVisible({
      timeout: 10_000,
    });

    // Verify persistence — re-open modal
    await page
      .getByTestId(`template-card-${SEEDED_TEMPLATE_ID}-menu`)
      .click();
    await page
      .getByTestId(`template-card-${SEEDED_TEMPLATE_ID}-settings`)
      .click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();

    // Verify private is selected
    await expect(page.getByTestId('visibility-private')).toBeChecked();
    await expect(page.getByTestId('settings-tenant-section')).toBeVisible();

    // Verify Tenant Alpha checkbox is checked
    const tenantCheckbox = page
      .getByTestId(`tenant-option-${TENANT_ALPHA_ID}`)
      .locator('input[type="checkbox"]');
    await expect(tenantCheckbox).toBeChecked();

    // Cleanup — restore to public for subsequent tests
    await page.getByTestId('visibility-public').check();
    await page.getByTestId('settings-save-btn').click();
    await expect(page.getByTestId('settings-modal')).not.toBeVisible({
      timeout: 10_000,
    });
  });

  test('[3E-E2E-004c] archive template via settings modal, confirm, then unarchive', async ({
    page,
  }) => {
    // Given — open settings for seeded template
    await page.goto('/admin/workflows');
    await expect(page.getByTestId('templates-content')).toBeVisible();
    await expect(
      page.getByTestId(`template-card-${SEEDED_TEMPLATE_ID}`),
    ).toBeVisible({ timeout: 10_000 });
    await page
      .getByTestId(`template-card-${SEEDED_TEMPLATE_ID}-menu`)
      .click();
    await page
      .getByTestId(`template-card-${SEEDED_TEMPLATE_ID}-settings`)
      .click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();

    // When — click archive
    await page.getByTestId('settings-archive-btn').click();

    // Then — confirmation dialog appears
    await expect(
      page.getByTestId('settings-archive-confirm'),
    ).toBeVisible();

    // Confirm archive
    await page.getByTestId('settings-archive-confirm-btn').click();

    // Modal should close after successful archive
    await expect(page.getByTestId('settings-modal')).not.toBeVisible({
      timeout: 10_000,
    });

    // Re-open settings — template should still be in list (filter defaults to 'all')
    await page
      .getByTestId(`template-card-${SEEDED_TEMPLATE_ID}-menu`)
      .click();
    await page
      .getByTestId(`template-card-${SEEDED_TEMPLATE_ID}-settings`)
      .click();
    await expect(page.getByTestId('settings-modal')).toBeVisible();

    // Verify — archive button gone, unarchive button visible
    await expect(
      page.getByTestId('settings-archive-btn'),
    ).not.toBeVisible();
    await expect(page.getByTestId('settings-unarchive-btn')).toBeVisible();

    // Unarchive — restore to draft
    await page.getByTestId('settings-unarchive-btn').click();
    await expect(page.getByTestId('settings-modal')).not.toBeVisible({
      timeout: 10_000,
    });
  });
});
