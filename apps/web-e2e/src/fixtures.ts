import { test as base, type Page } from '@playwright/test';

/**
 * Extended test fixtures for E2E tests.
 *
 * - apiURL: Base URL for API requests
 * - tenantBPage: A separate browser context authenticated as Tenant B,
 *   used in isolation tests that need both Tenant A and Tenant B pages.
 */
export const test = base.extend<{
  apiURL: string;
  tenantBPage: Page;
}>({
  apiURL: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use(process.env['API_URL'] || 'http://localhost:3000');
    },
    { scope: 'test' },
  ],

  tenantBPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: 'playwright/.auth/tenant-b.json',
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect } from '@playwright/test';
