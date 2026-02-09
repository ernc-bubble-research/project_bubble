import { test, expect } from '../fixtures';

// Override storageState — this test must start unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('[P0] Login Flow', () => {
  test('[1E-E2E-002a] user can log in with valid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    // Verify login form is visible
    const form = page.locator('[data-testid="login-form"]');
    await expect(form).toBeVisible();

    // Fill credentials
    await page.locator('[data-testid="login-email"]').fill('admin@bubble.io');
    await page.locator('[data-testid="login-password"]').fill('Admin123!');

    // Submit
    await page.locator('[data-testid="login-submit"]').click();

    // Should redirect to admin dashboard after successful login
    await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('[1E-E2E-002b] login fails with wrong password', async ({ page }) => {
    await page.goto('/auth/login');

    await page.locator('[data-testid="login-email"]').fill('admin@bubble.io');
    await page.locator('[data-testid="login-password"]').fill('WrongPassword!');
    await page.locator('[data-testid="login-submit"]').click();

    // Error message should appear
    const error = page.locator('[data-testid="login-error"]');
    await expect(error).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('[P0] Auth Guard', () => {
  test('[1E-E2E-002c] unauthenticated user is redirected to login', async ({
    page,
  }) => {
    // Navigate to a protected route without authentication
    await page.goto('/admin/dashboard');

    // authGuard should redirect to /auth/login
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
