import './env';
import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const ADMIN_STORAGE_STATE = path.resolve(
  __dirname,
  '../../../playwright/.auth/admin.json',
);

const apiURL = process.env['API_URL'] || 'http://localhost:3000';
const seedEmail = process.env['SEED_ADMIN_EMAIL'] || 'admin@bubble.io';
const seedPassword = process.env['SEED_ADMIN_PASSWORD'] || 'Admin123!';

setup('authenticate as admin', async ({ request }) => {
  // Login via API — avoids UI interaction and throttle limits
  const response = await request.post(`${apiURL}/api/auth/login`, {
    data: { email: seedEmail, password: seedPassword },
  });

  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body.accessToken).toBeTruthy();

  // Build storageState manually — the Angular app stores JWT in localStorage
  const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';
  const origin = new URL(baseURL).origin;

  const storageState = {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          { name: 'bubble_access_token', value: body.accessToken },
        ],
      },
    ],
  };

  // Write storageState to disk so the 'chromium' project picks it up
  fs.mkdirSync(path.dirname(ADMIN_STORAGE_STATE), { recursive: true });
  fs.writeFileSync(
    ADMIN_STORAGE_STATE,
    JSON.stringify(storageState, null, 2),
  );
});
