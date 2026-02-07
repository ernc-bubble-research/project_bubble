import { test, expect } from '../fixtures';

test.describe('[P0] Authenticated Navigation', () => {
  test('[1E-E2E-003a] sidebar contains all nav links', async ({ page }) => {
    await page.goto('/admin/dashboard');

    const sidebar = page.locator('[data-testid="sidebar-nav"]');
    await expect(sidebar).toBeVisible();

    // Verify all four nav items are present
    await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-tenants"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-workflow-studio"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-settings"]')).toBeVisible();
  });

  test('[1E-E2E-003b] can navigate between pages', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // Navigate to Settings
    await page.locator('[data-testid="nav-settings"]').click();
    await expect(page).toHaveURL(/\/admin\/settings/);

    // Navigate to Tenants
    await page.locator('[data-testid="nav-tenants"]').click();
    await expect(page).toHaveURL(/\/admin\/tenants/);

    // Navigate back to Dashboard
    await page.locator('[data-testid="nav-dashboard"]').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });
});
