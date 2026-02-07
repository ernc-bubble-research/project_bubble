import './env';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

const ADMIN_DB = 'postgres'; // connect here first to CREATE/DROP test DB
const TEST_DB = process.env['POSTGRES_DB'] || 'project_bubble_test';

/**
 * Playwright global setup:
 * 1. Connect to the default 'postgres' DB
 * 2. Create the test database (DROP if leftover from a crashed run)
 * 3. Connect to the test DB with TypeORM synchronize to create all tables
 * 4. Seed admin user, tenant users, and test folders
 */
async function globalSetup(): Promise<void> {
  console.log('[E2E] Global setup — creating test database…');

  try {
    // ── Step 1: Create the test database ──────────────────────────────
    const adminDs = new DataSource({
      type: 'postgres',
      host: process.env['POSTGRES_HOST'] || 'localhost',
      port: Number(process.env['POSTGRES_PORT'] || 5432),
      username: process.env['POSTGRES_USER'] || 'bubble_user',
      password: process.env['POSTGRES_PASSWORD'] || 'bubble_password',
      database: ADMIN_DB,
    });

    await adminDs.initialize();

    // Terminate any lingering connections, then drop + recreate
    await adminDs.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [TEST_DB],
    );
    await adminDs.query(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await adminDs.query(`CREATE DATABASE "${TEST_DB}"`);
    await adminDs.destroy();
    console.log(`[E2E] Database "${TEST_DB}" created`);

    // ── Step 2: Synchronize schema via TypeORM entities ───────────────
    const {
      TenantEntity,
      UserEntity,
      InvitationEntity,
      AssetEntity,
      FolderEntity,
      KnowledgeChunkEntity,
      WorkflowTemplateEntity,
      WorkflowVersionEntity,
      WorkflowChainEntity,
      WorkflowRunEntity,
      LlmModelEntity,
      LlmProviderConfigEntity,
    } = await import('@project-bubble/db-layer');

    const entities = [
      TenantEntity,
      UserEntity,
      InvitationEntity,
      AssetEntity,
      FolderEntity,
      KnowledgeChunkEntity,
      WorkflowTemplateEntity,
      WorkflowVersionEntity,
      WorkflowChainEntity,
      WorkflowRunEntity,
      LlmModelEntity,
      LlmProviderConfigEntity,
    ];

    const testDs = new DataSource({
      type: 'postgres',
      host: process.env['POSTGRES_HOST'] || 'localhost',
      port: Number(process.env['POSTGRES_PORT'] || 5432),
      username: process.env['POSTGRES_USER'] || 'bubble_user',
      password: process.env['POSTGRES_PASSWORD'] || 'bubble_password',
      database: TEST_DB,
      synchronize: true,
      entities,
    });

    await testDs.initialize();
    console.log('[E2E] Schema synchronized — all tables created');

    // ── Step 3: Seed tenants and users ─────────────────────────────────
    const tenantRepo = testDs.getRepository(TenantEntity);
    const userRepo = testDs.getRepository(UserEntity);
    const folderRepo = testDs.getRepository(FolderEntity);

    // System tenant (nil UUID) + bubble_admin
    const systemTenantId = '00000000-0000-0000-0000-000000000000';
    const seedEmail =
      process.env['SEED_ADMIN_EMAIL'] || 'admin@bubble.io';
    const seedPassword = process.env['SEED_ADMIN_PASSWORD'] || 'Admin123!';
    const adminHash = await bcrypt.hash(seedPassword, 10);

    await tenantRepo.save({ id: systemTenantId, name: 'System' });
    await userRepo.save({
      email: seedEmail,
      passwordHash: adminHash,
      role: 'bubble_admin',
      tenantId: systemTenantId,
      status: 'active',
    });
    console.log(`[E2E] Admin user seeded — ${seedEmail}`);

    // Tenant A + customer_admin
    const tenantAId = '11111111-0000-0000-0000-000000000000';
    const tenantAEmail =
      process.env['SEED_TENANT_A_EMAIL'] || 'tenant-a@test.io';
    const tenantAPassword =
      process.env['SEED_TENANT_A_PASSWORD'] || 'TenantA123!';
    const tenantAHash = await bcrypt.hash(tenantAPassword, 10);

    await tenantRepo.save({ id: tenantAId, name: 'Tenant Alpha' });
    await userRepo.save({
      email: tenantAEmail,
      passwordHash: tenantAHash,
      role: 'customer_admin',
      tenantId: tenantAId,
      status: 'active',
    });
    console.log(`[E2E] Tenant A user seeded — ${tenantAEmail}`);

    // Tenant B + customer_admin
    const tenantBId = '22222222-0000-0000-0000-000000000000';
    const tenantBEmail =
      process.env['SEED_TENANT_B_EMAIL'] || 'tenant-b@test.io';
    const tenantBPassword =
      process.env['SEED_TENANT_B_PASSWORD'] || 'TenantB123!';
    const tenantBHash = await bcrypt.hash(tenantBPassword, 10);

    await tenantRepo.save({ id: tenantBId, name: 'Tenant Beta' });
    await userRepo.save({
      email: tenantBEmail,
      passwordHash: tenantBHash,
      role: 'customer_admin',
      tenantId: tenantBId,
      status: 'active',
    });
    console.log(`[E2E] Tenant B user seeded — ${tenantBEmail}`);

    // ── Step 4: Seed one root folder per tenant ─────────────────────
    await folderRepo.save({
      tenantId: tenantAId,
      name: 'Test Folder',
      parentId: null,
    });
    await folderRepo.save({
      tenantId: tenantBId,
      name: 'Test Folder',
      parentId: null,
    });
    console.log('[E2E] Test folders seeded — one per tenant');

    await testDs.destroy();
    console.log('[E2E] Global setup complete');
  } catch (error) {
    console.error('[E2E] Global setup FAILED. Is Docker running? (docker-compose up -d)');
    console.error(error);
    throw error;
  }
}

export default globalSetup;
