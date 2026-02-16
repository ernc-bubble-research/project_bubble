/**
 * Contract Test Helpers — Tier 3: HTTP API Contract Tests
 *
 * Provides infrastructure for supertest-based API testing against a real
 * NestJS HTTP server with real PostgreSQL (dual DataSource: superuser + bubble_app).
 *
 * Two-phase boot:
 *   Phase 1: Plain TypeORM DataSource syncs schema + creates bubble_app role + grants
 *   Phase 2: NestJS boots with both DSs (synchronize: false) + RlsSetupService sets up RLS
 *
 * Skips BullMQ-dependent modules (WorkflowRunsModule, WorkflowExecutionModule,
 * IngestionModule, KnowledgeModule) to avoid Redis dependency.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as dotenv from 'dotenv';

import { encrypt } from './common/crypto.util';

import {
  DbLayerModule,
  RlsSetupService,
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
  SupportAccessLogEntity,
  SupportMutationLogEntity,
} from '@project-bubble/db-layer';

import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { InvitationsModule } from './invitations/invitations.module';
import { AssetsModule } from './assets/assets.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { SettingsModule } from './settings/settings.module';
import { EmailModule } from './email/email.module';
import { SupportAccessModule } from './support-access/support-access.module';
import { TenantContextInterceptor } from './interceptors/tenant-context.interceptor';
import { SupportMutationInterceptor } from './interceptors/support-mutation.interceptor';
import { TenantStatusGuard } from './guards/tenant-status.guard';

import { buildTestDbUrl, buildAppTestDbUrl } from './test-db-helpers';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env.test') });

const ALL_ENTITIES = [
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
  SupportAccessLogEntity,
  SupportMutationLogEntity,
];

// ── Fixed Test UUIDs ─────────────────────────────────────────────
export const SYSTEM_TENANT_ID = '00000000-0000-4000-a000-000000000001';
export const ADMIN_USER_ID = '00000000-0000-4000-a000-000000000002';

export const TENANT_A_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
export const USER_A_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaab';

export const TENANT_B_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
export const USER_B_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbc';

export const TENANT_C_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
export const USER_C_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccd';

export const TEMPLATE_PUBLIC_PUBLISHED_ID = 'dddddddd-dddd-4ddd-dddd-dddddddddddd';
export const TEMPLATE_DRAFT_ID = 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee';
export const TEMPLATE_PRIVATE_ID = 'ffffffff-ffff-4fff-ffff-ffffffffffff';
export const TEMPLATE_SOFT_DELETED_ID = '11111111-1111-4111-a111-111111111111';
export const VERSION_PUBLISHED_ID = '22222222-2222-4222-a222-222222222222';

// Cross-tenant isolation test fixtures
export const TENANT_A_TEMPLATE_ID = '33333333-3333-4333-a333-333333333333';
export const TENANT_B_TEMPLATE_ID = '44444444-4444-4444-a444-444444444444';
export const TENANT_A_PRIVATE_PUBLISHED_ID = '55555555-5555-4555-a555-555555555555';
export const TENANT_A_PRIVATE_VERSION_ID = '55555555-5555-4555-a555-555555555556';

// Story B fixtures — LLM providers, models, chains
export const PROVIDER_CONFIG_ID = '66666666-6666-4666-a666-666666666666';
export const MODEL_ACTIVE_ID = '77777777-7777-4777-a777-777777777777';
export const MODEL_INACTIVE_ID = '88888888-8888-4888-a888-888888888888';
export const CHAIN_DRAFT_ID = '99999999-9999-4999-a999-999999999999';

// Known password for login testing (USER_A)
export const USER_A_PASSWORD = 'TestPassword123!';
export const USER_A_EMAIL = 'admin-a@tenant-a.io';

export const TEST_DB_NAME = 'project_bubble_contract_test';

/**
 * Phase 1: Sync schema + create bubble_app role using a plain TypeORM DataSource.
 * Must run BEFORE NestJS boots (so bubble_app can connect in Phase 2).
 */
async function setupSchemaAndRole(superuserUrl: string): Promise<void> {
  const setupDs = new DataSource({
    type: 'postgres',
    url: superuserUrl,
    entities: ALL_ENTITIES,
    synchronize: true,
  });
  await setupDs.initialize();

  // Create bubble_app role + grants (replicates RlsSetupService role methods)
  const password = process.env['DB_APP_PASSWORD'] || 'bubble_password';
  const existing = await setupDs.query(
    `SELECT 1 FROM pg_roles WHERE rolname = 'bubble_app'`,
  );
  if (existing.length === 0) {
    await setupDs.query(`CREATE ROLE bubble_app LOGIN PASSWORD $1`, [password]);
  }
  await setupDs.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bubble_app`,
  );
  await setupDs.query(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bubble_app`,
  );
  await setupDs.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bubble_app`,
  );
  await setupDs.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO bubble_app`,
  );

  await setupDs.destroy();
}

/**
 * Creates the full NestJS application with HTTP server for contract testing.
 *
 * Two-phase boot:
 *   Phase 1: setupSchemaAndRole() — plain DataSource syncs schema + creates bubble_app
 *   Phase 2: NestJS boots with migration DS (superuser, sync:false) + default DS (bubble_app, sync:false)
 *            RlsSetupService.onModuleInit() runs — sets up RLS policies + seeds
 */
export async function createContractApp(): Promise<{
  app: INestApplication;
  module: TestingModule;
  jwtService: JwtService;
  seedDs: DataSource;
}> {
  const superuserUrl = buildTestDbUrl(TEST_DB_NAME);
  const appUrl = buildAppTestDbUrl(TEST_DB_NAME);

  // Phase 1: Schema sync + bubble_app role (before NestJS boots)
  await setupSchemaAndRole(superuserUrl);

  // Phase 2: Boot NestJS with both DataSources (no synchronize, no boot order issues)
  const testModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [
          () => ({
            DATABASE_URL: superuserUrl,
            POSTGRES_HOST: process.env['POSTGRES_HOST'] || 'localhost',
            POSTGRES_PORT: process.env['POSTGRES_PORT'] || '5432',
            POSTGRES_USER: process.env['POSTGRES_USER'] || 'bubble_user',
            POSTGRES_PASSWORD:
              process.env['POSTGRES_PASSWORD'] || 'bubble_password',
            POSTGRES_DB: TEST_DB_NAME,
            NODE_ENV: 'test',
            JWT_SECRET: 'contract-test-secret',
            JWT_EXPIRY: '1h',
            ADMIN_API_KEY: 'contract-test-admin-key',
            SEED_ADMIN_EMAIL: 'admin@contract-test.io',
            SEED_ADMIN_PASSWORD: 'ContractTest123!',
            SETTINGS_ENCRYPTION_KEY:
              process.env['SETTINGS_ENCRYPTION_KEY'] ||
              'Y29udHJhY3QtdGVzdC1rZXktMzItYnl0ZXMtbG9uZw==',
            EMBEDDING_PROVIDER: 'mock',
            EMBEDDING_MODEL: 'text-embedding-004',
            SMTP_HOST: 'localhost',
            SMTP_PORT: '2525',
            SMTP_USER: 'test',
            SMTP_PASS: 'test',
            SMTP_FROM: 'noreply@test.io',
            FRONTEND_URL: 'http://localhost:4200',
            INVITATION_EXPIRY_HOURS: '72',
            CHUNK_SIZE: '2000',
            CHUNK_OVERLAP: '400',
            DB_APP_USER: process.env['DB_APP_USER'] || 'bubble_app',
            DB_APP_PASSWORD:
              process.env['DB_APP_PASSWORD'] || 'bubble_password',
          }),
        ],
      }),
      // Migration DS (superuser, synchronize: false — Phase 1 already synced)
      // Needed by: RlsSetupService (@InjectDataSource('migration')), SupportAccessModule
      TypeOrmModule.forRootAsync({
        name: 'migration',
        useFactory: () => ({
          type: 'postgres' as const,
          url: superuserUrl,
          entities: ALL_ENTITIES,
          synchronize: false,
        }),
      }),
      // Default DS (bubble_app, synchronize: false)
      // Used by: TransactionManager + all services — queries through RLS
      TypeOrmModule.forRootAsync({
        useFactory: () => ({
          type: 'postgres' as const,
          url: appUrl,
          entities: ALL_ENTITIES,
          synchronize: false,
        }),
      }),
      ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
      DbLayerModule,
      AuthModule,
      TenantsModule,
      UsersModule,
      InvitationsModule,
      AssetsModule,
      WorkflowsModule,
      SettingsModule,
      EmailModule,
      SupportAccessModule,
    ],
    providers: [
      RlsSetupService,
      TenantStatusGuard,
      { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
      { provide: APP_INTERCEPTOR, useClass: SupportMutationInterceptor },
      { provide: APP_GUARD, useClass: ThrottlerGuard },
    ],
  }).compile();

  const app = testModule.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  await app.init();

  const jwtService = testModule.get(JwtService);

  // Seed DataSource: superuser connection for seeding (bypasses RLS)
  const seedDs = new DataSource({ type: 'postgres', url: superuserUrl });
  await seedDs.initialize();

  return { app, module: testModule, jwtService, seedDs };
}

/**
 * Mint a JWT token via the injected JwtService (stays in sync with production logic).
 */
export function mintToken(
  jwtService: JwtService,
  payload: { sub: string; tenant_id: string; role: string },
): string {
  return jwtService.sign(payload);
}

/**
 * Seed all contract test data via raw SQL through the superuser DataSource.
 * Uses ON CONFLICT DO NOTHING for idempotency (aligns with RlsSetupService auto-seed).
 */
export async function seedContractData(seedDs: DataSource): Promise<void> {
  // ── Tenants ──
  await seedDs.query(`
    INSERT INTO tenants (id, name, status)
    VALUES ($1, 'System', 'active')
    ON CONFLICT (id) DO NOTHING
  `, [SYSTEM_TENANT_ID]);

  await seedDs.query(`
    INSERT INTO tenants (id, name, status)
    VALUES ($1, 'Tenant A', 'active')
    ON CONFLICT (id) DO NOTHING
  `, [TENANT_A_ID]);

  await seedDs.query(`
    INSERT INTO tenants (id, name, status)
    VALUES ($1, 'Tenant B', 'active')
    ON CONFLICT (id) DO NOTHING
  `, [TENANT_B_ID]);

  await seedDs.query(`
    INSERT INTO tenants (id, name, status)
    VALUES ($1, 'Tenant C', 'suspended')
    ON CONFLICT (id) DO NOTHING
  `, [TENANT_C_ID]);

  // ── Users ──
  await seedDs.query(`
    INSERT INTO users (id, email, password_hash, role, tenant_id)
    VALUES ($1, 'admin@contract-test.io', '$2b$10$placeholder', 'bubble_admin', $2)
    ON CONFLICT (id) DO NOTHING
  `, [ADMIN_USER_ID, SYSTEM_TENANT_ID]);

  // USER_A gets real bcrypt hash for login testing (CT-101/CT-102)
  const userAHash = await bcrypt.hash(USER_A_PASSWORD, 10);
  await seedDs.query(`
    INSERT INTO users (id, email, password_hash, role, tenant_id)
    VALUES ($1, $2, $3, 'customer_admin', $4)
    ON CONFLICT (id) DO NOTHING
  `, [USER_A_ID, USER_A_EMAIL, userAHash, TENANT_A_ID]);

  await seedDs.query(`
    INSERT INTO users (id, email, password_hash, role, tenant_id)
    VALUES ($1, 'admin-b@tenant-b.io', '$2b$10$placeholder', 'customer_admin', $2)
    ON CONFLICT (id) DO NOTHING
  `, [USER_B_ID, TENANT_B_ID]);

  await seedDs.query(`
    INSERT INTO users (id, email, password_hash, role, tenant_id)
    VALUES ($1, 'admin-c@tenant-c.io', '$2b$10$placeholder', 'customer_admin', $2)
    ON CONFLICT (id) DO NOTHING
  `, [USER_C_ID, TENANT_C_ID]);

  // ── Templates ──
  // Published PUBLIC template (owned by admin/system tenant)
  await seedDs.query(`
    INSERT INTO workflow_templates (id, tenant_id, name, description, status, visibility, created_by)
    VALUES ($1, $2, 'Published Public Template', 'A published public template', 'published', 'public', $3)
    ON CONFLICT (id) DO NOTHING
  `, [TEMPLATE_PUBLIC_PUBLISHED_ID, SYSTEM_TENANT_ID, ADMIN_USER_ID]);

  // Version for published template (valid definition matching validateWorkflowDefinition shape)
  const validDefinition = JSON.stringify({
    metadata: { name: 'Published Workflow', description: 'Seeded for contract tests' },
    inputs: [{ name: 'document', label: 'Document', role: 'subject', source: ['asset'], required: true }],
    execution: { processing: 'parallel', model: 'mock-model' },
    knowledge: { enabled: false },
    prompt: 'Analyze: {document}',
  });

  await seedDs.query(`
    INSERT INTO workflow_versions (id, template_id, tenant_id, version_number, definition, created_by)
    VALUES ($1, $2, $3, 1, $4, $5)
    ON CONFLICT (id) DO NOTHING
  `, [VERSION_PUBLISHED_ID, TEMPLATE_PUBLIC_PUBLISHED_ID, SYSTEM_TENANT_ID, validDefinition, ADMIN_USER_ID]);

  await seedDs.query(`
    UPDATE workflow_templates SET current_version_id = $1 WHERE id = $2
  `, [VERSION_PUBLISHED_ID, TEMPLATE_PUBLIC_PUBLISHED_ID]);

  // Draft template (owned by admin)
  await seedDs.query(`
    INSERT INTO workflow_templates (id, tenant_id, name, description, status, visibility, created_by)
    VALUES ($1, $2, 'Draft Template', 'A draft template', 'draft', 'public', $3)
    ON CONFLICT (id) DO NOTHING
  `, [TEMPLATE_DRAFT_ID, SYSTEM_TENANT_ID, ADMIN_USER_ID]);

  // Private template with allowedTenants: [tenantA]
  await seedDs.query(`
    INSERT INTO workflow_templates (id, tenant_id, name, description, status, visibility, allowed_tenants, created_by)
    VALUES ($1, $2, 'Private Template', 'Private for tenant A only', 'published', 'private', $3, $4)
    ON CONFLICT (id) DO NOTHING
  `, [TEMPLATE_PRIVATE_ID, SYSTEM_TENANT_ID, `{${TENANT_A_ID}}`, ADMIN_USER_ID]);

  // Soft-deleted template
  await seedDs.query(`
    INSERT INTO workflow_templates (id, tenant_id, name, description, status, visibility, created_by)
    VALUES ($1, $2, 'Soft Deleted Template', 'This is soft-deleted', 'draft', 'public', $3)
    ON CONFLICT (id) DO NOTHING
  `, [TEMPLATE_SOFT_DELETED_ID, SYSTEM_TENANT_ID, ADMIN_USER_ID]);

  await seedDs.query(`
    UPDATE workflow_templates SET deleted_at = NOW() WHERE id = $1
  `, [TEMPLATE_SOFT_DELETED_ID]);

  // ── Cross-tenant isolation fixtures ──
  // Tenant A's own draft template
  await seedDs.query(`
    INSERT INTO workflow_templates (id, tenant_id, name, status, visibility, created_by)
    VALUES ($1, $2, 'Tenant A Only Template', 'draft', 'public', $3)
    ON CONFLICT (id) DO NOTHING
  `, [TENANT_A_TEMPLATE_ID, TENANT_A_ID, USER_A_ID]);

  // Tenant B's own draft template
  await seedDs.query(`
    INSERT INTO workflow_templates (id, tenant_id, name, status, visibility, created_by)
    VALUES ($1, $2, 'Tenant B Only Template', 'draft', 'public', $3)
    ON CONFLICT (id) DO NOTHING
  `, [TENANT_B_TEMPLATE_ID, TENANT_B_ID, USER_B_ID]);

  // Tenant A's private published template (for catalog isolation test)
  await seedDs.query(`
    INSERT INTO workflow_templates (id, tenant_id, name, status, visibility, allowed_tenants, created_by)
    VALUES ($1, $2, 'Tenant A Private Published', 'published', 'private', $3, $4)
    ON CONFLICT (id) DO NOTHING
  `, [TENANT_A_PRIVATE_PUBLISHED_ID, TENANT_A_ID, `{${TENANT_A_ID}}`, USER_A_ID]);

  await seedDs.query(`
    INSERT INTO workflow_versions (id, template_id, tenant_id, version_number, definition, created_by)
    VALUES ($1, $2, $3, 1, $4, $5)
    ON CONFLICT (id) DO NOTHING
  `, [TENANT_A_PRIVATE_VERSION_ID, TENANT_A_PRIVATE_PUBLISHED_ID, TENANT_A_ID, validDefinition, USER_A_ID]);

  await seedDs.query(`
    UPDATE workflow_templates SET current_version_id = $1 WHERE id = $2
  `, [TENANT_A_PRIVATE_VERSION_ID, TENANT_A_PRIVATE_PUBLISHED_ID]);

  // ── LLM Provider Config (Story B — CT-301+) ──
  const encryptionKey = process.env['SETTINGS_ENCRYPTION_KEY'] ||
    'Y29udHJhY3QtdGVzdC1rZXktMzItYnl0ZXMtbG9uZw==';
  const encryptedCreds = encrypt(
    JSON.stringify({ api_key: 'test-mock-api-key-123456' }),
    encryptionKey,
  );
  // RlsSetupService.onModuleInit() already seeds a 'mock' provider (no credentials, random UUID).
  // We update it to our known ID + encrypted credentials for testing.
  await seedDs.query(`
    UPDATE llm_provider_configs
    SET id = $1, encrypted_credentials = $2, rate_limit_rpm = 15
    WHERE provider_key = 'mock'
  `, [PROVIDER_CONFIG_ID, encryptedCreds]);

  // ── LLM Models (Story B — CT-401+) ──
  await seedDs.query(`
    INSERT INTO llm_models (id, provider_key, model_id, display_name, context_window, max_output_tokens, is_active)
    VALUES ($1, 'mock', 'mock-model-active', 'Mock Model Active', 32000, 8192, true)
    ON CONFLICT (id) DO NOTHING
  `, [MODEL_ACTIVE_ID]);

  await seedDs.query(`
    INSERT INTO llm_models (id, provider_key, model_id, display_name, context_window, max_output_tokens, is_active)
    VALUES ($1, 'mock', 'mock-model-inactive', 'Mock Model Inactive', 16000, 4096, false)
    ON CONFLICT (id) DO NOTHING
  `, [MODEL_INACTIVE_ID]);

  // ── Workflow Chain (Story B — CT-501+) ──
  const chainDefinition = JSON.stringify({
    metadata: { name: 'Test Chain', description: 'Seeded for contract tests' },
    steps: [
      { workflow_id: TEMPLATE_PUBLIC_PUBLISHED_ID, alias: 'step-one' },
      {
        workflow_id: TEMPLATE_PUBLIC_PUBLISHED_ID, alias: 'step-two',
        input_mapping: { raw_data: { from_step: 'step-one', from_output: 'outputs' } },
      },
    ],
  });
  await seedDs.query(`
    INSERT INTO workflow_chains (id, tenant_id, name, description, definition, status, visibility, created_by)
    VALUES ($1, $2, 'Test Draft Chain', 'A draft chain for testing', $3, 'draft', 'public', $4)
    ON CONFLICT (id) DO NOTHING
  `, [CHAIN_DRAFT_ID, SYSTEM_TENANT_ID, chainDefinition, ADMIN_USER_ID]);
}

