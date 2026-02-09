import { Page, expect } from '@playwright/test';
import { test } from '../fixtures';

/**
 * Creates a tenant via the Dashboard modal and verifies it appears in the table.
 * Shared across all tenant-management tests to eliminate duplication.
 */
async function createTenant(page: Page, tenantName: string): Promise<void> {
  await page.goto('/admin/dashboard');
  await page.getByTestId('create-tenant-btn').click();
  await expect(page.getByTestId('create-tenant-modal')).toBeVisible();
  await page.getByTestId('create-tenant-name-input').fill(tenantName);
  await page.getByTestId('create-tenant-submit-btn').click();
  await expect(page.getByTestId('create-tenant-modal')).not.toBeVisible();
  await expect(page.getByText(tenantName)).toBeVisible();
}

// Default storageState = admin (bubble_admin) — no override needed

test.describe('[P0] Tenant Management', () => {
  test('[1E-E2E-004a] admin can create a tenant via dashboard modal', async ({
    page,
  }) => {
    const tenantName = `E2E Create ${Date.now()}`;
    await createTenant(page, tenantName);
  });

  test('[1E-E2E-004b] admin can edit a tenant name and it persists', async ({
    page,
  }) => {
    const originalName = `E2E Edit ${Date.now()}`;
    const updatedName = `${originalName} Updated`;

    // Create a tenant first
    await createTenant(page, originalName);

    // Navigate to the tenant detail page via the "Manage" button
    const row = page.locator('tr', { hasText: originalName });
    await row.getByText('Manage').click();
    await expect(page).toHaveURL(/\/admin\/tenants\//);

    // Edit the tenant name
    const nameInput = page.getByTestId('tenant-name-input');
    await nameInput.clear();
    await nameInput.fill(updatedName);

    // Save changes
    await page.getByTestId('tenant-save-btn').click();

    // Wait for save to complete (button text returns to "Save Changes")
    await expect(page.getByTestId('tenant-save-btn')).toContainText(
      'Save Changes',
    );

    // Reload the page and verify the name persisted
    await page.reload();
    await expect(nameInput).toHaveValue(updatedName);
  });

  test('[1E-E2E-004c] admin can perform full tenant lifecycle: suspend, unsuspend, archive, unarchive', async ({
    page,
  }) => {
    const tenantName = `E2E Lifecycle ${Date.now()}`;

    // Create a tenant and navigate to detail
    await createTenant(page, tenantName);
    const row = page.locator('tr', { hasText: tenantName });
    await row.getByText('Manage').click();
    await expect(page).toHaveURL(/\/admin\/tenants\//);

    // Verify initial status is "active"
    await expect(page.getByTestId('tenant-status-badge')).toContainText(
      'active',
    );

    // Step 1: Suspend — verify button label says "Suspend"
    const suspendToggleBtn = page.getByTestId('suspend-toggle-btn');
    await expect(suspendToggleBtn).toContainText('Suspend');
    await suspendToggleBtn.click();
    await expect(
      page.getByTestId('suspend-confirm-dialog'),
    ).toBeVisible();
    await page.getByTestId('suspend-confirm-btn').click();
    await expect(page.getByTestId('tenant-status-badge')).toContainText(
      'suspended',
    );

    // Step 2: Activate (unsuspend) — verify button label says "Activate"
    await expect(suspendToggleBtn).toContainText('Activate');
    await suspendToggleBtn.click();
    await expect(
      page.getByTestId('suspend-confirm-dialog'),
    ).toBeVisible();
    await page.getByTestId('suspend-confirm-btn').click();
    await expect(page.getByTestId('tenant-status-badge')).toContainText(
      'active',
    );

    // Step 3: Archive
    await page.getByTestId('archive-btn').click();
    await expect(
      page.getByTestId('archive-confirm-dialog'),
    ).toBeVisible();
    await page.getByTestId('archive-confirm-btn').click();
    await expect(page.getByTestId('tenant-status-badge')).toContainText(
      'archived',
    );

    // Step 4: Unarchive
    await page.getByTestId('unarchive-btn').click();
    await expect(page.getByTestId('tenant-status-badge')).toContainText(
      'active',
    );
  });

  test('[1E-E2E-004d] admin can hard-delete an archived tenant', async ({
    page,
  }) => {
    const tenantName = `E2E Delete ${Date.now()}`;

    // Create a tenant and navigate to detail
    await createTenant(page, tenantName);
    const row = page.locator('tr', { hasText: tenantName });
    await row.getByText('Manage').click();
    await expect(page).toHaveURL(/\/admin\/tenants\//);

    // Archive the tenant first (required before delete)
    await page.getByTestId('archive-btn').click();
    await expect(
      page.getByTestId('archive-confirm-dialog'),
    ).toBeVisible();
    await page.getByTestId('archive-confirm-btn').click();
    await expect(page.getByTestId('tenant-status-badge')).toContainText(
      'archived',
    );

    // Click delete button (only visible when archived)
    await page.getByTestId('delete-btn').click();

    // Type the tenant name in confirmation dialog
    await expect(
      page.getByTestId('delete-confirm-dialog'),
    ).toBeVisible();
    await page.getByTestId('delete-confirm-input').fill(tenantName);

    // Confirm deletion
    await page.getByTestId('delete-confirm-btn').click();

    // Should redirect to tenant list after deletion
    await expect(page).toHaveURL(/\/admin\/tenants$/);

    // Wait for the tenant table to render before asserting absence
    await expect(page.locator('.table-container')).toBeVisible();

    // Verify the tenant no longer appears in the list
    await expect(page.getByText(tenantName)).not.toBeVisible();
  });
});
