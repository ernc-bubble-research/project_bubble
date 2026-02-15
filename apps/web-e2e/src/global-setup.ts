import './env';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

const TEST_DB = process.env['POSTGRES_DB'] || 'project_bubble_test';

/**
 * Playwright global setup:
 * 1. Connect to the test DB (pre-created by playwright.config.ts)
 * 2. Synchronize schema via TypeORM entities
 * 3. Truncate all tables for a clean state
 * 4. Seed admin user, tenant users, and test data
 *
 * NOTE: The DB is NOT dropped+recreated here because Playwright starts
 * webServer (API) BEFORE globalSetup. Dropping would kill the API's
 * DB connections. Instead we truncate for a clean slate.
 */
async function globalSetup(): Promise<void> {
  console.log('[E2E] Global setup — preparing test database…');

  try {
    // ── Step 1: Synchronize schema via TypeORM entities ───────────────
    // Import from compiled dist output to avoid decorator compilation issues
    // (Playwright's TypeScript transformer doesn't support experimentalDecorators)
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
    } = await import('../../../dist/libs/db-layer/src/index.js');

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
    console.log('[E2E] Schema synchronized — all tables ready');

    // ── Step 2: Truncate all tables for a clean state ─────────────────
    const tableNames = entities
      .map((e) => testDs.getRepository(e).metadata.tableName)
      .map((t) => `"${t}"`)
      .join(', ');
    await testDs.query(
      `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`,
    );
    console.log('[E2E] All tables truncated — clean state');

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

    const adminUserId = '00000000-0000-0000-0000-000000000001';
    await tenantRepo.save({ id: systemTenantId, name: 'System' });
    await userRepo.save({
      id: adminUserId,
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
    // Unique names retained for clarity in test assertions.
    // RLS is now enforced via bubble_app (non-superuser) — tenant isolation is real.
    await folderRepo.save({
      tenantId: tenantAId,
      name: 'Folder Alpha',
      parentId: null,
    });
    await folderRepo.save({
      tenantId: tenantBId,
      name: 'Folder Beta',
      parentId: null,
    });
    console.log('[E2E] Test folders seeded — one per tenant');

    // ── Step 5: Seed workflow data (Story 3E) ──────────────────────────
    const templateRepo = testDs.getRepository(WorkflowTemplateEntity);
    const versionRepo = testDs.getRepository(WorkflowVersionEntity);
    const chainRepo = testDs.getRepository(WorkflowChainEntity);

    const seedTemplate = await templateRepo.save({
      id: '33333333-0000-0000-0000-000000000001',
      tenantId: systemTenantId,
      name: 'E2E Seed Template',
      description: 'Seeded template for E2E tests',
      visibility: 'public',
      status: 'published',
      createdBy: adminUserId,
    });

    const seedVersion = await versionRepo.save({
      id: '33333333-0000-0000-0000-000000000002',
      tenantId: systemTenantId,
      templateId: seedTemplate.id,
      versionNumber: 1,
      definition: {
        metadata: { name: 'E2E Seed Template', description: 'Seeded', version: 1, tags: [] },
        inputs: [{ name: 'subject', label: 'Subject', role: 'subject', source: ['text'], required: true }],
        execution: { processing: 'parallel', model: 'mock-model', temperature: 0.7, max_output_tokens: 4096 },
        knowledge: { enabled: false },
        prompt: 'Analyze {subject}',
        output: { format: 'markdown', filename_template: 'output-{subject}', sections: [{ name: 'analysis', label: 'Analysis', required: true }] },
      },
      createdBy: adminUserId,
    });

    await templateRepo.update(seedTemplate.id, { currentVersionId: seedVersion.id });

    // Draft template for edit tests (002b) — separate from published template
    const draftTemplate = await templateRepo.save({
      id: '33333333-0000-0000-0000-000000000010',
      tenantId: systemTenantId,
      name: 'E2E Draft Template',
      description: 'Draft template for edit E2E tests',
      visibility: 'public',
      status: 'draft',
      createdBy: adminUserId,
    });

    const draftVersion = await versionRepo.save({
      id: '33333333-0000-0000-0000-000000000011',
      tenantId: systemTenantId,
      templateId: draftTemplate.id,
      versionNumber: 1,
      definition: {
        metadata: { name: 'E2E Draft Template', description: 'Draft for edit tests', version: 1, tags: [] },
        inputs: [{ name: 'subject', label: 'Subject', role: 'subject', source: ['text'], required: true }],
        execution: { processing: 'parallel', model: 'mock-model', temperature: 0.7, max_output_tokens: 4096 },
        knowledge: { enabled: false },
        prompt: 'Analyze {subject}',
        output: { format: 'markdown', filename_template: 'output-{subject}', sections: [{ name: 'analysis', label: 'Analysis', required: true }] },
      },
      createdBy: adminUserId,
    });

    await templateRepo.update(draftTemplate.id, { currentVersionId: draftVersion.id });

    await chainRepo.save({
      id: '33333333-0000-0000-0000-000000000003',
      tenantId: systemTenantId,
      name: 'E2E Seed Chain',
      description: 'Seeded chain for E2E tests',
      visibility: 'public',
      status: 'draft',
      definition: {
        metadata: { name: 'E2E Seed Chain', description: 'Seeded chain for E2E tests' },
        steps: [
          { workflow_id: seedTemplate.id, alias: 'Step 1' },
          { workflow_id: seedTemplate.id, alias: 'Step 2', input_mapping: {} },
        ],
      },
      createdBy: adminUserId,
    });

    console.log('[E2E] Workflow data seeded — 2 templates + 2 versions + 1 chain');

    // ── Step 6: Seed LLM model (Story 3E — wizard execution step) ────
    const llmModelRepo = testDs.getRepository(LlmModelEntity);
    await llmModelRepo.save({
      providerKey: 'mock',
      modelId: 'mock-model',
      displayName: 'Mock LLM (Testing)',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      isActive: true,
    });
    console.log('[E2E] LLM model seeded — mock-model');

    // ── Step 7: Seed LLM provider config (Story 2E — provider list) ────
    const providerConfigRepo = testDs.getRepository(LlmProviderConfigEntity);
    await providerConfigRepo.save({
      providerKey: 'mock',
      displayName: 'Mock Provider (Testing)',
      isActive: true,
    });
    console.log('[E2E] LLM provider config seeded — mock');

    await testDs.destroy();
    console.log('[E2E] Global setup complete');
  } catch (error) {
    console.error('[E2E] Global setup FAILED. Is Docker running? (docker-compose up -d)');
    console.error(error);
    throw error;
  }
}

export default globalSetup;
