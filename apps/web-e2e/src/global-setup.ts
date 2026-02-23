import './env';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  SEED_SYSTEM_TENANT_ID,
  SEED_ADMIN_USER_ID,
  SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD,
  SEED_TENANT_A_ID,
  SEED_TENANT_A_USER_ID,
  SEED_TENANT_A_EMAIL,
  SEED_TENANT_A_PASSWORD,
  SEED_TENANT_B_ID,
  SEED_TENANT_B_USER_ID,
  SEED_TENANT_B_EMAIL,
  SEED_TENANT_B_PASSWORD,
  SEED_PUBLISHED_TEMPLATE_ID,
  SEED_PUBLISHED_VERSION_ID,
  SEED_DRAFT_TEMPLATE_ID,
  SEED_DRAFT_VERSION_ID,
  SEED_CHAIN_ID,
  SEED_RUN_COMPLETED_ID,
  SEED_RUN_COMPLETED_WITH_ERRORS_ID,
  SEED_RUN_FAILED_ID,
  SEED_OUTPUT_ASSET_1_ID,
  SEED_OUTPUT_ASSET_2_ID,
  SEED_LLM_MODEL_UUID,
} from '../../../libs/db-layer/src/lib/test-factories/seed-constants';

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
 *
 * NOTE: Factory build*() functions are NOT used here because they import
 * from entity files containing TypeORM decorators, which Playwright's TS
 * transformer cannot compile. Seed constants (pure string exports) are safe.
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
    const seedEmail = process.env['SEED_ADMIN_EMAIL'] || SEED_ADMIN_EMAIL;
    const seedPassword = process.env['SEED_ADMIN_PASSWORD'] || SEED_ADMIN_PASSWORD;
    const adminHash = await bcrypt.hash(seedPassword, 10);

    await tenantRepo.save({ id: SEED_SYSTEM_TENANT_ID, name: 'System' });
    await userRepo.save({
      id: SEED_ADMIN_USER_ID,
      email: seedEmail,
      passwordHash: adminHash,
      role: 'bubble_admin',
      tenantId: SEED_SYSTEM_TENANT_ID,
      status: 'active',
    });
    console.log(`[E2E] Admin user seeded — ${seedEmail}`);

    // Tenant A + customer_admin
    const tenantAEmail = process.env['SEED_TENANT_A_EMAIL'] || SEED_TENANT_A_EMAIL;
    const tenantAPassword = process.env['SEED_TENANT_A_PASSWORD'] || SEED_TENANT_A_PASSWORD;
    const tenantAHash = await bcrypt.hash(tenantAPassword, 10);

    await tenantRepo.save({ id: SEED_TENANT_A_ID, name: 'Tenant Alpha', purchasedCredits: 100 });
    await userRepo.save({
      id: SEED_TENANT_A_USER_ID,
      email: tenantAEmail,
      passwordHash: tenantAHash,
      role: 'customer_admin',
      tenantId: SEED_TENANT_A_ID,
      status: 'active',
    });
    console.log(`[E2E] Tenant A user seeded — ${tenantAEmail}`);

    // Tenant B + customer_admin
    const tenantBEmail = process.env['SEED_TENANT_B_EMAIL'] || SEED_TENANT_B_EMAIL;
    const tenantBPassword = process.env['SEED_TENANT_B_PASSWORD'] || SEED_TENANT_B_PASSWORD;
    const tenantBHash = await bcrypt.hash(tenantBPassword, 10);

    await tenantRepo.save({ id: SEED_TENANT_B_ID, name: 'Tenant Beta' });
    await userRepo.save({
      id: SEED_TENANT_B_USER_ID,
      email: tenantBEmail,
      passwordHash: tenantBHash,
      role: 'customer_admin',
      tenantId: SEED_TENANT_B_ID,
      status: 'active',
    });
    console.log(`[E2E] Tenant B user seeded — ${tenantBEmail}`);

    // ── Step 4: Seed one root folder per tenant ─────────────────────
    // Unique names retained for clarity in test assertions.
    // RLS is now enforced via bubble_app (non-superuser) — tenant isolation is real.
    await folderRepo.save({
      tenantId: SEED_TENANT_A_ID,
      name: 'Folder Alpha',
      parentId: null,
    });
    await folderRepo.save({
      tenantId: SEED_TENANT_B_ID,
      name: 'Folder Beta',
      parentId: null,
    });
    console.log('[E2E] Test folders seeded — one per tenant');

    // ── Step 5: Seed workflow data (Story 3E) ──────────────────────────
    const templateRepo = testDs.getRepository(WorkflowTemplateEntity);
    const versionRepo = testDs.getRepository(WorkflowVersionEntity);
    const chainRepo = testDs.getRepository(WorkflowChainEntity);

    const seedTemplate = await templateRepo.save({
      id: SEED_PUBLISHED_TEMPLATE_ID,
      tenantId: SEED_SYSTEM_TENANT_ID,
      name: 'E2E Seed Template',
      description: 'Seeded template for E2E tests',
      visibility: 'public',
      status: 'published',
      createdBy: SEED_ADMIN_USER_ID,
    });

    const seedVersion = await versionRepo.save({
      id: SEED_PUBLISHED_VERSION_ID,
      tenantId: SEED_SYSTEM_TENANT_ID,
      templateId: seedTemplate.id,
      versionNumber: 1,
      definition: {
        metadata: { name: 'E2E Seed Template', description: 'Seeded', version: 1, tags: [] },
        inputs: [{ name: 'subject', label: 'Subject', role: 'subject', source: ['text'], required: true }],
        execution: { processing: 'parallel', model: SEED_LLM_MODEL_UUID, temperature: 0.7, max_output_tokens: 4096 },
        knowledge: { enabled: false },
        prompt: 'Analyze {subject}',
        output: { format: 'markdown', filename_template: 'output-{subject}', sections: [{ name: 'analysis', label: 'Analysis', required: true }] },
      },
      createdBy: SEED_ADMIN_USER_ID,
    });

    await templateRepo.update(seedTemplate.id, { currentVersionId: seedVersion.id });

    // Draft template for edit tests (002b) — separate from published template
    const draftTemplate = await templateRepo.save({
      id: SEED_DRAFT_TEMPLATE_ID,
      tenantId: SEED_SYSTEM_TENANT_ID,
      name: 'E2E Draft Template',
      description: 'Draft template for edit E2E tests',
      visibility: 'public',
      status: 'draft',
      createdBy: SEED_ADMIN_USER_ID,
    });

    const draftVersion = await versionRepo.save({
      id: SEED_DRAFT_VERSION_ID,
      tenantId: SEED_SYSTEM_TENANT_ID,
      templateId: draftTemplate.id,
      versionNumber: 1,
      definition: {
        metadata: { name: 'E2E Draft Template', description: 'Draft for edit tests', version: 1, tags: [] },
        inputs: [{ name: 'subject', label: 'Subject', role: 'subject', source: ['text'], required: true }],
        execution: { processing: 'parallel', model: SEED_LLM_MODEL_UUID, temperature: 0.7, max_output_tokens: 4096 },
        knowledge: { enabled: false },
        prompt: 'Analyze {subject}',
        output: { format: 'markdown', filename_template: 'output-{subject}', sections: [{ name: 'analysis', label: 'Analysis', required: true }] },
      },
      createdBy: SEED_ADMIN_USER_ID,
    });

    await templateRepo.update(draftTemplate.id, { currentVersionId: draftVersion.id });

    await chainRepo.save({
      id: SEED_CHAIN_ID,
      tenantId: SEED_SYSTEM_TENANT_ID,
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
      createdBy: SEED_ADMIN_USER_ID,
    });

    console.log('[E2E] Workflow data seeded — 2 templates + 2 versions + 1 chain');

    // ── Step 6: Seed LLM model (Story 3E — wizard execution step) ────
    const llmModelRepo = testDs.getRepository(LlmModelEntity);
    await llmModelRepo.save({
      id: SEED_LLM_MODEL_UUID,
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

    // ── Step 8: Seed workflow runs for Epic 4 E2E (Story 4E) ────────
    const runRepo = testDs.getRepository(WorkflowRunEntity);

    // Run 1: COMPLETED — 2 files, both succeeded
    await runRepo.save({
      id: SEED_RUN_COMPLETED_ID,
      tenantId: SEED_TENANT_A_ID,
      versionId: SEED_PUBLISHED_VERSION_ID,
      status: 'completed',
      startedBy: SEED_TENANT_A_USER_ID,
      inputSnapshot: { templateName: 'E2E Seed Template' },
      outputAssetIds: [SEED_OUTPUT_ASSET_1_ID, SEED_OUTPUT_ASSET_2_ID],
      creditsConsumed: 2,
      creditsFromPurchased: 2,
      creditsFromMonthly: 0,
      totalJobs: 2,
      completedJobs: 2,
      failedJobs: 0,
      startedAt: new Date('2026-02-20T10:00:00Z'),
      completedAt: new Date('2026-02-20T10:01:00Z'),
      durationMs: 60000,
      perFileResults: [
        { index: 0, fileName: 'doc1.txt', status: 'completed', outputAssetId: SEED_OUTPUT_ASSET_1_ID, tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 } },
        { index: 1, fileName: 'doc2.txt', status: 'completed', outputAssetId: SEED_OUTPUT_ASSET_2_ID, tokenUsage: { inputTokens: 150, outputTokens: 250, totalTokens: 400 } },
      ],
    });

    // Run 2: COMPLETED_WITH_ERRORS — 2 files, 1 succeeded + 1 failed
    await runRepo.save({
      id: SEED_RUN_COMPLETED_WITH_ERRORS_ID,
      tenantId: SEED_TENANT_A_ID,
      versionId: SEED_PUBLISHED_VERSION_ID,
      status: 'completed_with_errors',
      startedBy: SEED_TENANT_A_USER_ID,
      inputSnapshot: { templateName: 'E2E Seed Template' },
      creditsConsumed: 1,
      creditsFromPurchased: 1,
      creditsFromMonthly: 0,
      totalJobs: 2,
      completedJobs: 1,
      failedJobs: 1,
      startedAt: new Date('2026-02-20T11:00:00Z'),
      completedAt: new Date('2026-02-20T11:01:00Z'),
      durationMs: 60000,
      perFileResults: [
        { index: 0, fileName: 'report1.pdf', status: 'completed', tokenUsage: { inputTokens: 200, outputTokens: 300, totalTokens: 500 } },
        { index: 1, fileName: 'report2.pdf', status: 'failed', errorMessage: 'Mock LLM error: timeout' },
      ],
    });

    // Run 3: FAILED — all files failed
    await runRepo.save({
      id: SEED_RUN_FAILED_ID,
      tenantId: SEED_TENANT_A_ID,
      versionId: SEED_PUBLISHED_VERSION_ID,
      status: 'failed',
      startedBy: SEED_TENANT_A_USER_ID,
      inputSnapshot: { templateName: 'E2E Seed Template' },
      errorMessage: 'All files failed processing',
      creditsConsumed: 0,
      creditsFromPurchased: 0,
      creditsFromMonthly: 0,
      totalJobs: 1,
      completedJobs: 0,
      failedJobs: 1,
      startedAt: new Date('2026-02-20T12:00:00Z'),
      completedAt: new Date('2026-02-20T12:00:30Z'),
      durationMs: 30000,
      perFileResults: [
        { index: 0, fileName: 'broken.txt', status: 'failed', errorMessage: 'Mock LLM error: invalid input' },
      ],
    });

    console.log('[E2E] Workflow runs seeded — 3 runs (completed/errors/failed) for Tenant A');

    // ── Step 9: Seed output assets linked to completed run (Story 4E) ──
    const assetRepo = testDs.getRepository(AssetEntity);

    await assetRepo.save({
      id: SEED_OUTPUT_ASSET_1_ID,
      tenantId: SEED_TENANT_A_ID,
      originalName: 'output-doc1.md',
      storagePath: `uploads/${SEED_TENANT_A_ID}/output-doc1.md`,
      mimeType: 'text/markdown',
      fileSize: 1024,
      sha256Hash: 'e2e_seed_output_hash_1'.padEnd(64, '0'),
      sourceType: 'workflow_output',
      workflowRunId: SEED_RUN_COMPLETED_ID,
      uploadedBy: SEED_TENANT_A_USER_ID,
    });

    await assetRepo.save({
      id: SEED_OUTPUT_ASSET_2_ID,
      tenantId: SEED_TENANT_A_ID,
      originalName: 'output-doc2.md',
      storagePath: `uploads/${SEED_TENANT_A_ID}/output-doc2.md`,
      mimeType: 'text/markdown',
      fileSize: 2048,
      sha256Hash: 'e2e_seed_output_hash_2'.padEnd(64, '0'),
      sourceType: 'workflow_output',
      workflowRunId: SEED_RUN_COMPLETED_ID,
      uploadedBy: SEED_TENANT_A_USER_ID,
    });

    console.log('[E2E] Output assets seeded — 2 assets linked to completed run');

    await testDs.destroy();
    console.log('[E2E] Global setup complete');
  } catch (error) {
    console.error('[E2E] Global setup FAILED. Is Docker running? (docker-compose up -d)');
    console.error(error);
    throw error;
  }
}

export default globalSetup;
