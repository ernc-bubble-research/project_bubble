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
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15_000 });
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

test.describe('[P0] Auth Error Paths', () => {
  test('[4EH-E2E-001a] invalid email format shows client-side validation error', async ({
    page,
  }) => {
    await page.goto('/auth/login');
    await expect(page.getByTestId('login-form')).toBeVisible();

    // Fill invalid email and trigger validation by submitting
    await page.locator('[data-testid="login-email"]').fill('not-an-email');
    await page.locator('[data-testid="login-password"]').fill('SomePassword1!');
    await page.locator('[data-testid="login-submit"]').click();

    // Client-side validation error should appear (Angular marks all as touched on invalid submit)
    await expect(page.getByTestId('login-email-error')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('login-email-error')).toContainText('valid email');

    // Should NOT navigate away — still on login page
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('[4EH-E2E-001b] garbage token redirects to login', async ({ page }) => {
    // Start on login page to get a page context for localStorage manipulation
    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    // Inject a garbage JWT into localStorage
    await page.evaluate(() =>
      localStorage.setItem('bubble_access_token', 'garbage.jwt.token'),
    );

    // Navigate to a protected app route
    await page.goto('/app/data-vault');

    // Should be redirected to login — garbage token rejected by auth guard or API
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 });
  });
});
