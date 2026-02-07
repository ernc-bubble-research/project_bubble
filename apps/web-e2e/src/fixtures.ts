import { test as base } from '@playwright/test';

/**
 * Extended test fixtures for E2E tests.
 * Currently re-exports base test — extend here as needs grow.
 */
export const test = base.extend<{
  apiURL: string;
}>({
  apiURL: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use(process.env['API_URL'] || 'http://localhost:3000');
    },
    { scope: 'test' },
  ],
});

export { expect } from '@playwright/test';
