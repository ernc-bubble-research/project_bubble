import * as path from 'path';
import { test, expect } from '../fixtures';

test.use({ storageState: 'playwright/.auth/tenant-a.json' });

const TEST_FILE_PATH = path.resolve(
  __dirname,
  '../fixtures/files/test-document.txt',
);

test.describe('Data Vault — File Upload & Operations', () => {
  test('[2E-E2E-002a] upload file via file input', async ({ page }) => {
    await page.goto('/app/data-vault');
    await expect(page.getByTestId('data-vault')).toBeVisible();

    // Upload a file via the hidden file input
    await page.getByTestId('file-input').setInputFiles(TEST_FILE_PATH);

    // File should appear in the file area after upload completes
    await expect(page.locator('[data-testid^="file-item-"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('[2E-E2E-002b] archive file removes it from list', async ({
    page,
  }) => {
    await page.goto('/app/data-vault');
    await expect(page.getByTestId('data-vault')).toBeVisible();

    // First upload a file so we have something to archive
    await page.getByTestId('file-input').setInputFiles(TEST_FILE_PATH);
    await expect(page.locator('[data-testid^="file-item-"]').first()).toBeVisible({
      timeout: 10_000,
    });

    // Click the file card checkbox to select it
    // Find the file item and its checkbox
    const fileItems = page.locator('[data-testid^="file-item-"]');
    const firstFileItem = fileItems.first();
    await expect(firstFileItem).toBeVisible();

    // Get the asset id from the data-testid
    const testId = await firstFileItem.getAttribute('data-testid');
    const assetId = testId?.replace('file-item-', '');

    // Select the file by clicking its checkbox
    const checkbox = page.getByTestId(`file-checkbox-${assetId}`);
    await checkbox.click();

    // Bulk actions should appear
    await expect(page.getByTestId('bulk-actions')).toBeVisible();

    // Set up one-time dialog handler BEFORE triggering archive
    page.once('dialog', (dialog) => dialog.accept());

    // Click archive
    await page.getByTestId('archive-selected-btn').click();

    // File should be removed from list
    await expect(page.locator('[data-testid^="file-item-"]')).toHaveCount(0, {
      timeout: 10_000,
    });
  });
});
