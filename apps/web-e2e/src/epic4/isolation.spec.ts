import { test, expect } from '../fixtures';

const SEED_RUN_COMPLETED_ID = '44444444-0000-0000-0000-000000000001';

test.describe('Epic 4 — Tenant Isolation & Access Log [P0]', () => {
  test('[4E-E2E-004a] Tenant B sees empty execution list', async ({ tenantBPage }) => {
    await tenantBPage.goto('/app/executions');

    // Should show empty state (no runs seeded for Tenant B)
    await expect(tenantBPage.getByTestId('execution-list-empty')).toBeVisible({ timeout: 15_000 });
  });

  test('[4E-E2E-004b] Tenant B cannot view Tenant A run detail', async ({ tenantBPage }) => {
    // Navigate first so localStorage (from storageState) is accessible
    await tenantBPage.goto('/app/executions');
    await tenantBPage.waitForLoadState('domcontentloaded');

    // Extract Tenant B's JWT from localStorage (Angular uses Bearer tokens, not cookies)
    const token = await tenantBPage.evaluate(() => localStorage.getItem('bubble_access_token'));

    // Try to access Tenant A's completed run directly via API
    const response = await tenantBPage.request.get(
      `${process.env['API_URL'] || 'http://localhost:3000'}/api/app/workflow-runs/${SEED_RUN_COMPLETED_ID}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    // Should get 403 or 404 (not 200) — RLS prevents cross-tenant access
    expect([403, 404]).toContain(response.status());
  });

  test('[4EH-E2E-004a] Tenant B navigating to Tenant A execution detail shows not-found', async ({ tenantBPage }) => {
    // Navigate directly to Tenant A's completed run via browser URL
    await tenantBPage.goto(`/app/executions/${SEED_RUN_COMPLETED_ID}`);

    // The component loads the run via API → 404 (RLS blocks cross-tenant access)
    // Should show graceful not-found state, NOT Tenant A's data
    await expect(tenantBPage.getByTestId('detail-not-found')).toBeVisible({ timeout: 15_000 });

    // Verify Tenant A's data is NOT visible
    await expect(tenantBPage.getByTestId('detail-status-badge')).not.toBeVisible();
  });

  test('[4EH-E2E-004b] Tenant B navigating to non-existent execution shows not-found', async ({ tenantBPage }) => {
    // Navigate to a UUID that doesn't exist for any tenant.
    // Intentionally redundant with [4EH-E2E-003a] (Tenant A context) — this verifies the same
    // not-found behavior under Tenant B auth to confirm no cross-tenant information leak.
    await tenantBPage.goto('/app/executions/00000000-0000-0000-0000-999999999999');

    // Should show not-found state (not a cross-tenant leak)
    await expect(tenantBPage.getByTestId('detail-not-found')).toBeVisible({ timeout: 15_000 });
  });

  test.describe('Access Log', () => {
    test.use({ storageState: 'playwright/.auth/tenant-a.json' });

    test('[4E-E2E-004c] access log page loads without errors', async ({ page }) => {
      // Capture console errors BEFORE navigation so load-time errors are caught
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      await page.goto('/app/access-log');

      // Page should render — either table or empty state
      const table = page.getByTestId('access-log-table');
      const empty = page.getByTestId('access-log-empty');

      // One of them should be visible
      await expect(table.or(empty)).toBeVisible({ timeout: 15_000 });

      // No console errors
      expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
    });
  });
});
