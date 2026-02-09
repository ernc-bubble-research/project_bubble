import { DataSource } from 'typeorm';
import { test, expect } from '../fixtures';

// Default storageState = admin (bubble_admin) — no override needed

const TENANT_ALPHA_ID = '11111111-0000-0000-0000-000000000000';
const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Connect to the test database for seeding/cleanup.
 * Uses the same connection defaults as global-setup.ts.
 */
function createTestDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env['POSTGRES_HOST'] || 'localhost',
    port: Number(process.env['POSTGRES_PORT'] || 5432),
    username: process.env['POSTGRES_USER'] || 'bubble_user',
    password: process.env['POSTGRES_PASSWORD'] || 'bubble_password',
    database: process.env['POSTGRES_DB'] || 'project_bubble_test',
  });
}

test.describe('[P1] Invitation Management', () => {
  test('[2E-E2E-005a] admin can open invite dialog and submit (handles email failure)', async ({
    page,
  }) => {
    // Navigate to Tenant Alpha detail page
    await page.goto(`/admin/tenants/${TENANT_ALPHA_ID}`);

    // Click Users tab
    await page.getByTestId('tab-users').click();

    // Click "Invite User" button
    await page.getByTestId('invite-user-btn').click();

    // Verify dialog opens with form fields
    await expect(page.getByTestId('invite-dialog')).toBeVisible();
    await expect(page.getByTestId('invite-email-input')).toBeVisible();
    await expect(page.getByTestId('invite-submit-btn')).toBeVisible();
    await expect(page.getByTestId('invite-cancel-btn')).toBeVisible();

    // Fill the form with a valid email and submit
    await page.getByTestId('invite-email-input').fill('e2e-invite@example.com');
    await page.getByTestId('invite-submit-btn').click();

    // Expect error (no SMTP in test env — email send fails, invitation rolled back)
    await expect(page.getByTestId('invite-error')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('invite-error')).toContainText(
      'Failed to send invitation',
    );

    // Verify cancel closes the dialog
    await page.getByTestId('invite-cancel-btn').click();
    await expect(page.getByTestId('invite-dialog')).not.toBeVisible();
  });

  test('[2E-E2E-005b] admin can view and revoke a pending invitation', async ({
    page,
  }) => {
    // Seed a pending invitation directly in the DB (bypasses email)
    const ds = createTestDataSource();
    await ds.initialize();

    const expiresAt = new Date(
      Date.now() + 72 * 60 * 60 * 1000,
    ).toISOString();
    const result = await ds.query(
      `INSERT INTO invitations
         (email, token_hash, token_prefix, tenant_id, role, invited_by, inviter_name, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        `e2e-seeded-${Date.now()}@example.com`,
        '$2b$10$dummy_token_hash_for_e2e_testing_only', // dummy hash — not a real token
        'e2edummy',
        TENANT_ALPHA_ID,
        'creator',
        ADMIN_USER_ID,
        'Admin',
        'pending',
        expiresAt,
      ],
    );
    const invitationId = result[0].id;
    await ds.destroy();

    try {
      // Navigate to Tenant Alpha detail → Users tab
      await page.goto(`/admin/tenants/${TENANT_ALPHA_ID}`);
      await page.getByTestId('tab-users').click();

      // Verify invitation row appears in the table
      const invitationRow = page.getByTestId(`invitation-row-${invitationId}`);
      await expect(invitationRow).toBeVisible({ timeout: 10_000 });

      // Verify status shows "pending"
      await expect(page.getByTestId(`invitation-status-${invitationId}`)).toContainText(
        'pending',
      );

      // Click revoke button
      const revokeBtn = page.getByTestId(
        `invitation-revoke-${invitationId}`,
      );
      await expect(revokeBtn).toBeVisible();
      await revokeBtn.click();

      // After revoke, the list reloads — status should change to "revoked"
      // The revoke button should disappear (only shown for pending)
      await expect(
        page.getByTestId(`invitation-status-${invitationId}`),
      ).toContainText('revoked', { timeout: 10_000 });
      await expect(revokeBtn).not.toBeVisible();
    } finally {
      // Cleanup: remove the seeded invitation
      const cleanupDs = createTestDataSource();
      await cleanupDs.initialize();
      await cleanupDs.query(`DELETE FROM invitations WHERE id = $1`, [
        invitationId,
      ]);
      await cleanupDs.destroy();
    }
  });
});
