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
 * 4. Seed the admin user
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

    // ── Step 3: Seed admin user ───────────────────────────────────────
    const seedEmail =
      process.env['SEED_ADMIN_EMAIL'] || 'admin@bubble.io';
    const seedPassword = process.env['SEED_ADMIN_PASSWORD'] || 'Admin123!';
    const passwordHash = await bcrypt.hash(seedPassword, 10);

    const tenantRepo = testDs.getRepository(TenantEntity);
    const userRepo = testDs.getRepository(UserEntity);

    // Create the system tenant (nil UUID)
    const systemTenantId = '00000000-0000-0000-0000-000000000000';
    await tenantRepo.save({
      id: systemTenantId,
      name: 'System',
    });

    await userRepo.save({
      email: seedEmail,
      passwordHash,
      role: 'bubble_admin',
      tenantId: systemTenantId,
      status: 'active',
    });

    console.log(`[E2E] Admin user seeded — ${seedEmail}`);

    await testDs.destroy();
    console.log('[E2E] Global setup complete');
  } catch (error) {
    console.error('[E2E] Global setup FAILED. Is Docker running? (docker-compose up -d)');
    console.error(error);
    throw error;
  }
}

export default globalSetup;
