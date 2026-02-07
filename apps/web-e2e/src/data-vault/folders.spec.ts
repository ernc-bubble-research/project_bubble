import { test, expect } from '../fixtures';

test.use({ storageState: 'playwright/.auth/tenant-a.json' });

test.describe('Data Vault — Folder Operations', () => {
  test('[2E-E2E-001a] navigate to Data Vault shows folder tree with All Files active', async ({
    page,
  }) => {
    await page.goto('/app/data-vault');
    await expect(page.getByTestId('data-vault')).toBeVisible();
    await expect(page.getByTestId('folder-tree')).toBeVisible();
    await expect(page.getByTestId('folder-all-files')).toBeVisible();

    // "All Files" button should have active class
    const allFilesBtn = page.getByTestId('folder-all-files');
    await expect(allFilesBtn).toHaveClass(/active/);

    // Seeded "Test Folder" should be visible in tree
    await expect(page.getByText('Test Folder')).toBeVisible();
  });

  test('[2E-E2E-001b] create folder via dialog', async ({ page }) => {
    await page.goto('/app/data-vault');
    await expect(page.getByTestId('data-vault')).toBeVisible();

    // Click new folder button
    await page.getByTestId('new-folder-btn').click();

    // Dialog should appear
    await expect(page.getByTestId('create-folder-dialog')).toBeVisible();
    await expect(page.getByTestId('folder-name-input')).toBeVisible();

    // Enter folder name and submit
    const folderName = `E2E Folder ${Date.now()}`;
    await page.getByTestId('folder-name-input').fill(folderName);
    await page.getByTestId('folder-create-btn').click();

    // Dialog should close and new folder should appear in tree
    await expect(page.getByTestId('create-folder-dialog')).toBeHidden();
    await expect(page.getByText(folderName)).toBeVisible();
  });

  test('[2E-E2E-001c] navigate into folder updates active state', async ({
    page,
  }) => {
    await page.goto('/app/data-vault');
    await expect(page.getByTestId('data-vault')).toBeVisible();

    // Click on the seeded "Test Folder"
    const testFolder = page.getByText('Test Folder');
    await expect(testFolder).toBeVisible();
    await testFolder.click();

    // "All Files" should no longer be active
    await expect(page.getByTestId('folder-all-files')).not.toHaveClass(
      /active/,
    );

    // The file area should be visible (may show empty state since no files in folder)
    await expect(page.getByTestId('file-area')).toBeVisible();
  });
});
