import './env';
import { test as setup, expect, type APIRequestContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const AUTH_DIR = path.resolve(__dirname, '../../../playwright/.auth');

const apiURL = process.env['API_URL'] || 'http://localhost:3000';
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';
const origin = new URL(baseURL).origin;

/**
 * Create a storageState JSON file for the given credentials.
 * Logs in via POST /api/auth/login and writes the JWT to localStorage format.
 */
async function createStorageState(
  request: APIRequestContext,
  email: string,
  password: string,
  filePath: string,
): Promise<void> {
  const response = await request.post(`${apiURL}/api/auth/login`, {
    data: { email, password },
  });

  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body.accessToken).toBeTruthy();

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

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(storageState, null, 2));
}

setup('authenticate as admin', async ({ request }) => {
  const email = process.env['SEED_ADMIN_EMAIL'] || 'admin@bubble.io';
  const password = process.env['SEED_ADMIN_PASSWORD'] || 'Admin123!';
  await createStorageState(
    request,
    email,
    password,
    path.join(AUTH_DIR, 'admin.json'),
  );
});

setup('authenticate as tenant-a', async ({ request }) => {
  const email = process.env['SEED_TENANT_A_EMAIL'] || 'tenant-a@test.io';
  const password = process.env['SEED_TENANT_A_PASSWORD'] || 'TenantA123!';
  await createStorageState(
    request,
    email,
    password,
    path.join(AUTH_DIR, 'tenant-a.json'),
  );
});

setup('authenticate as tenant-b', async ({ request }) => {
  const email = process.env['SEED_TENANT_B_EMAIL'] || 'tenant-b@test.io';
  const password = process.env['SEED_TENANT_B_PASSWORD'] || 'TenantB123!';
  await createStorageState(
    request,
    email,
    password,
    path.join(AUTH_DIR, 'tenant-b.json'),
  );
});
