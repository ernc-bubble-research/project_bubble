import * as path from 'path';
import { test, expect } from '../fixtures';

test.use({ storageState: 'playwright/.auth/tenant-a.json' });

const TEST_FILE_PATH = path.resolve(
  __dirname,
  '../fixtures/files/test-document.txt',
);

test.describe('Multi-Tenant Isolation (P0)', () => {
  test('[2E-E2E-003a] file uploaded by Tenant A is not visible to Tenant B', async ({
    page,
    tenantBPage,
  }) => {
    // Tenant A: upload a file
    await page.goto('/app/data-vault');
    await expect(page.getByTestId('data-vault')).toBeVisible();
    await page.getByTestId('file-input').setInputFiles(TEST_FILE_PATH);

    // Wait for file to appear in Tenant A's vault
    await expect(page.getByText('test-document.txt')).toBeVisible({
      timeout: 10_000,
    });

    // Tenant B: navigate to Data Vault — file should NOT be visible
    await tenantBPage.goto('/app/data-vault');
    await expect(tenantBPage.getByTestId('data-vault')).toBeVisible();

    // Wait for file area to fully load before asserting absence
    await expect(tenantBPage.getByTestId('file-area')).toBeVisible();
    await expect(
      tenantBPage.getByText('test-document.txt'),
    ).toBeHidden();
  });

  test('[2E-E2E-003b] folder created by Tenant A is not visible to Tenant B', async ({
    page,
    tenantBPage,
  }) => {
    // Tenant A: create a uniquely named folder
    const folderName = `Isolated Folder ${Date.now()}`;
    await page.goto('/app/data-vault');
    await expect(page.getByTestId('data-vault')).toBeVisible();
    await page.getByTestId('new-folder-btn').click();
    await expect(page.getByTestId('create-folder-dialog')).toBeVisible();
    await page.getByTestId('folder-name-input').fill(folderName);
    await page.getByTestId('folder-create-btn').click();

    // Verify folder appears in Tenant A's tree
    await expect(page.getByText(folderName)).toBeVisible();

    // Tenant B: navigate to Data Vault — folder should NOT be visible
    await tenantBPage.goto('/app/data-vault');
    await expect(tenantBPage.getByTestId('data-vault')).toBeVisible();

    // Wait for folder tree to fully load before asserting absence
    await expect(tenantBPage.getByTestId('folder-tree')).toBeVisible();
    await expect(tenantBPage.getByText(folderName)).toBeHidden();
  });
});
