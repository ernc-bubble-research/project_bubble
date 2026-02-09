import { test, expect } from '../fixtures';

// Override auth state to use Tenant A (customer_admin, NOT bubble_admin)
test.use({ storageState: 'playwright/.auth/tenant-a.json' });

test.describe('[P0] RBAC Enforcement', () => {
  test('[1E-E2E-005a] non-admin user cannot access /admin/ routes', async ({
    page,
  }) => {
    // Navigate to admin dashboard as a tenant user (customer_admin role)
    await page.goto('/admin/dashboard');

    // adminGuard should redirect non-admin users to /app/data-vault
    await expect(page).toHaveURL(/\/app\/data-vault/);
  });

  test('[1E-E2E-005b] suspended tenant user is blocked on /app/ routes', async ({
    page,
    apiURL,
  }) => {
    const TENANT_ALPHA_ID = '11111111-0000-0000-0000-000000000000';

    // Login as admin via API to get an admin token for suspension calls
    const loginResp = await page.request.post(
      `${apiURL}/api/auth/login`,
      {
        data: { email: 'admin@bubble.io', password: 'Admin123!' },
      },
    );
    expect(loginResp.ok()).toBeTruthy();
    const { accessToken: adminToken } = await loginResp.json();

    // Suspend Tenant Alpha via admin API
    const suspendResp = await page.request.patch(
      `${apiURL}/api/admin/tenants/${TENANT_ALPHA_ID}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { status: 'suspended' },
      },
    );
    expect(suspendResp.ok()).toBeTruthy();

    try {
      // Navigate to /app/data-vault as tenant-a user (whose tenant is now suspended)
      // The Angular app loads, but API calls to /api/app/* will be blocked by TenantStatusGuard (403)
      const [response] = await Promise.all([
        page.waitForResponse(
          (resp) =>
            resp.url().includes('/api/app/') && resp.status() === 403,
          { timeout: 15_000 },
        ),
        page.goto('/app/data-vault'),
      ]);

      // waitForResponse already filters for status 403 — reaching here means it was received
    } finally {
      // Cleanup: unsuspend Tenant Alpha to restore seed state for other tests
      await page.request.patch(
        `${apiURL}/api/admin/tenants/${TENANT_ALPHA_ID}`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          data: { status: 'active' },
        },
      );
    }
  });
});
