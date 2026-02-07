import { test, expect } from '../fixtures';

test.describe('[P0] Health Check', () => {
  test('[1E-E2E-001a] API returns 200 on /api', async ({ apiURL, request }) => {
    const response = await request.get(`${apiURL}/api`);
    expect(response.status()).toBe(200);
  });

  test('[1E-E2E-001b] Frontend serves the Angular app', async ({ page }) => {
    await page.goto('/');
    // Angular app should load — check for any rendered content
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
