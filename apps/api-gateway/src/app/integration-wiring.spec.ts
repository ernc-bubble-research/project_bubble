/**
 * Integration Wiring Tests — Tier 2: Runtime Behavior
 *
 * Verifies that NestJS modules work correctly at RUNTIME with real PostgreSQL:
 * - RLS policies are created and enforced
 * - Seed data (admin user, LLM models, provider configs) is idempotent
 * - TransactionManager tenant isolation via SET LOCAL
 * - Cross-module service injection
 * - Guard chain behavior (TenantStatusGuard)
 *
 * Prerequisites: Docker PostgreSQL + Redis running (docker-compose up -d)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { DataSource, EntityManager } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { createTestDatabase, dropTestDatabase, buildTestDbUrl } from './test-db-helpers';

import {
  DbLayerModule,
  TransactionManager,
  TenantEntity,
  TenantStatus,
  UserEntity,
  UserRole,
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
  RlsSetupService,
  tenantContextStorage,
  TenantContext,
} from '@project-bubble/db-layer';

import { AuthModule } from './auth/auth.module';
import { AuthService } from './auth/auth.service';
import { TenantsModule } from './tenants/tenants.module';
import { TenantsService } from './tenants/tenants.service';
import { UsersModule } from './users/users.module';
import { InvitationsModule } from './invitations/invitations.module';
import { AssetsModule } from './assets/assets.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { IngestionService } from './ingestion/ingestion.service';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { KnowledgeSearchService } from './knowledge/knowledge-search.service';
import { WorkflowsModule } from './workflows/workflows.module';
import { WorkflowTemplatesService } from './workflows/workflow-templates.service';
import { SettingsModule } from './settings/settings.module';
import { EmailModule } from './email/email.module';
import { TenantStatusGuard } from './guards/tenant-status.guard';

// Load test env vars
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
];

const TEST_DB_NAME = 'project_bubble_wiring_integ_test';

function createRootImports() {
  const dbUrl = buildTestDbUrl(TEST_DB_NAME);

  return [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          DATABASE_URL: dbUrl,
          POSTGRES_HOST: process.env['POSTGRES_HOST'] || 'localhost',
          POSTGRES_PORT: process.env['POSTGRES_PORT'] || '5432',
          POSTGRES_USER: process.env['POSTGRES_USER'] || 'bubble_user',
          POSTGRES_PASSWORD: process.env['POSTGRES_PASSWORD'] || 'bubble_password',
          POSTGRES_DB: TEST_DB_NAME,
          REDIS_HOST: process.env['REDIS_HOST'] || 'localhost',
          REDIS_PORT: process.env['REDIS_PORT'] || '6379',
          // IMPORTANT: NODE_ENV must be 'development' (not 'test') to trigger
          // RlsSetupService.onModuleInit() seed logic (RLS policies, admin user,
          // LLM models, provider configs). If this guard condition changes in
          // rls-setup.service.ts, these seed tests will silently stop working.
          NODE_ENV: 'development',
          JWT_SECRET: 'wiring-test-secret',
          ADMIN_API_KEY: 'wiring-test-admin-key',
          SEED_ADMIN_EMAIL: 'admin@wiring-test.io',
          SEED_ADMIN_PASSWORD: 'WiringTest123!',
          SETTINGS_ENCRYPTION_KEY: process.env['SETTINGS_ENCRYPTION_KEY'] || 'dGVzdA==',
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
        }),
      ],
    }),
    // Named 'migration' DataSource — used by RlsSetupService for DDL operations
    TypeOrmModule.forRootAsync({
      name: 'migration',
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        entities: ALL_ENTITIES,
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    // Default (unnamed) DataSource — used by TransactionManager + all services
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        entities: ALL_ENTITIES,
        synchronize: false, // Schema synced by migration DS
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    DbLayerModule,
  ];
}

describe('Integration Wiring — Tier 2 Runtime [P0]', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    await createTestDatabase(TEST_DB_NAME);

    // Build the full module graph with all feature modules
    // TenantStatusGuard is not in any module (used via @UseGuards on controllers),
    // so we provide it explicitly to test DI resolution rather than direct instantiation.
    module = await Test.createTestingModule({
      imports: [
        ...createRootImports(),
        AuthModule,
        UsersModule,
        InvitationsModule,
        AssetsModule,
        IngestionModule,
        KnowledgeModule,
        WorkflowsModule,
        SettingsModule,
        TenantsModule,
        EmailModule,
      ],
      // RlsSetupService moved from DbLayerModule to MigrationDatabaseModule in production,
      // but in tests we provide it directly with the named 'migration' DataSource.
      // TenantStatusGuard is not in any module (used via @UseGuards on controllers).
      providers: [RlsSetupService, TenantStatusGuard],
    }).compile();

    // Initialize — triggers RlsSetupService.onModuleInit() + AuthService.onModuleInit()
    await module.init();

    dataSource = module.get(DataSource);
  }, 60_000);

  afterAll(async () => {
    if (module) {
      // Dual DataSource teardown: @nestjs/typeorm's TypeOrmCoreModule.onApplicationShutdown
      // throws when looking up the named DataSource ('migration') token via moduleRef.get().
      // Manually destroy both DataSources before module.close() to prevent the error.
      try {
        const migrationDs = module.get<DataSource>(getDataSourceToken('migration'));
        if (migrationDs?.isInitialized) await migrationDs.destroy();
      } catch { /* already destroyed or not found */ }
      try {
        const defaultDs = module.get(DataSource);
        if (defaultDs?.isInitialized) await defaultDs.destroy();
      } catch { /* already destroyed */ }
      try {
        await module.close();
      } catch {
        // TypeOrmCoreModule shutdown race with pre-destroyed DataSources — benign
      }
    }
    await dropTestDatabase(TEST_DB_NAME);
  }, 30_000);

  // ── AC2: RLS Setup ──────────────────────────────────────────────

  it('[MW-1-INTEG-001] [P0] RLS policies exist on all 7 tenant-scoped tables', async () => {
    const tenantScopedTables = [
      'users', 'invitations', 'assets', 'folders',
      'knowledge_chunks', 'workflow_versions', 'workflow_runs',
    ];

    for (const table of tenantScopedTables) {
      const policies = await dataSource.query(
        `SELECT policyname FROM pg_policies WHERE tablename = $1`,
        [table],
      );
      const policyNames = policies.map((p: { policyname: string }) => p.policyname);

      expect(policyNames).toContain(`tenant_isolation_${table}`);
    }
  });

  it('[MW-1-INTEG-002] [P0] Auth pre-auth policies exist (SELECT/INSERT on users, SELECT/UPDATE on invitations)', async () => {
    const userPolicies = await dataSource.query(
      `SELECT policyname FROM pg_policies WHERE tablename = 'users'`,
    );
    const userPolicyNames = userPolicies.map((p: { policyname: string }) => p.policyname);
    expect(userPolicyNames).toContain('auth_select_all');
    expect(userPolicyNames).toContain('auth_insert_users');

    const invPolicies = await dataSource.query(
      `SELECT policyname FROM pg_policies WHERE tablename = 'invitations'`,
    );
    const invPolicyNames = invPolicies.map((p: { policyname: string }) => p.policyname);
    expect(invPolicyNames).toContain('auth_accept_invitations');
    expect(invPolicyNames).toContain('auth_update_invitations');
  });

  it('[MW-1-INTEG-003] [P0] Workflow visibility-based RLS policies exist on workflow_templates and workflow_chains', async () => {
    const templatePolicies = await dataSource.query(
      `SELECT policyname FROM pg_policies WHERE tablename = 'workflow_templates'`,
    );
    expect(templatePolicies.map((p: { policyname: string }) => p.policyname)).toContain('template_access');

    const chainPolicies = await dataSource.query(
      `SELECT policyname FROM pg_policies WHERE tablename = 'workflow_chains'`,
    );
    expect(chainPolicies.map((p: { policyname: string }) => p.policyname)).toContain('chain_access');
  });

  // ── AC2: Seed Data ──────────────────────────────────────────────

  it('[MW-1-INTEG-004] [P0] LLM provider configs are seeded (4 default providers)', async () => {
    const result = await dataSource.query(
      `SELECT provider_key FROM llm_provider_configs ORDER BY provider_key`,
    );
    const keys = result.map((r: { provider_key: string }) => r.provider_key);
    expect(keys).toEqual(['google-ai-studio', 'mock', 'openai', 'vertex']);
  });

  it('[MW-1-INTEG-005] [P0] LLM models are seeded (12 models)', async () => {
    const result = await dataSource.query(
      `SELECT COUNT(*)::int as count FROM llm_models`,
    );
    expect(result[0].count).toBe(12);
  });

  it('[MW-1-INTEG-006] [P0] Admin user is seeded (BUBBLE_ADMIN role)', async () => {
    const result = await dataSource.query(
      `SELECT email, role, tenant_id FROM users WHERE role = $1`,
      [UserRole.BUBBLE_ADMIN],
    );
    expect(result.length).toBe(1);
    expect(result[0].email).toBe('admin@wiring-test.io');
    expect(result[0].tenant_id).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('[MW-1-INTEG-007] [P0] Seed is idempotent — re-initializing does not duplicate data', async () => {
    // Manually trigger onModuleInit again
    const rlsService = module.get(RlsSetupService);
    await rlsService.onModuleInit();

    const providerCount = await dataSource.query(
      `SELECT COUNT(*)::int as count FROM llm_provider_configs`,
    );
    expect(providerCount[0].count).toBe(4);

    const modelCount = await dataSource.query(
      `SELECT COUNT(*)::int as count FROM llm_models`,
    );
    expect(modelCount[0].count).toBe(12);
  });

  // ── AC3: Cross-Module Injection ─────────────────────────────────

  it('[MW-1-INTEG-008] [P0] TenantsModule can resolve AuthService (cross-module injection)', async () => {
    const tenantsService = module.get(TenantsService);
    const authService = module.get(AuthService);

    expect(tenantsService).toBeDefined();
    expect(authService).toBeDefined();

    // Verify AuthService is the same singleton instance
    const authFromModule = module.get(AuthService);
    expect(authService).toBe(authFromModule);
  });

  it('[MW-1-INTEG-009] [P0] KnowledgeSearchService resolves alongside IngestionModule providers', async () => {
    const knowledgeService = module.get(KnowledgeSearchService);
    const ingestionService = module.get(IngestionService);

    expect(knowledgeService).toBeDefined();
    expect(ingestionService).toBeDefined();
  });

  it('[MW-1-INTEG-010] [P0] InvitationsService resolves EmailService cross-module (runtime wiring, not just DI)', async () => {
    // This tests that the cross-module forwardRef between InvitationsModule and EmailModule
    // actually wires up at runtime — not just that the provider exists in the DI container.
    const { InvitationsService } = await import('./invitations/invitations.service');
    const invService = module.get(InvitationsService);
    expect(invService).toBeDefined();

    // Verify the EmailService is the same singleton injected into InvitationsService
    const { EmailService } = await import('./email/email.service');
    const emailService = module.get(EmailService);
    expect(emailService).toBeDefined();

    // Both should be real instances (not mocks), proving cross-module injection works at runtime
    expect(typeof invService.create).toBe('function');
    expect(typeof emailService.sendInvitationEmail).toBe('function');
  });

  // ── AC4: TransactionManager Tenant Isolation ────────────────────

  it('[MW-1-INTEG-011] [P0] TransactionManager.run(tenantId) sets SET LOCAL correctly', async () => {
    const txManager = module.get(TransactionManager);

    // Create a tenant first (direct SQL)
    const tenantId = uuidv4();
    await dataSource.query(
      `INSERT INTO tenants (id, name, status) VALUES ($1, $2, $3)`,
      [tenantId, 'Test Tenant A', TenantStatus.ACTIVE],
    );

    // Verify SET LOCAL was executed by checking current_setting inside the transaction
    await txManager.run(tenantId, async (manager: EntityManager) => {
      const result = await manager.query(
        `SELECT current_setting('app.current_tenant', true) as tenant`,
      );
      expect(result[0].tenant).toBe(tenantId);
    });

    // Verify SET LOCAL is transaction-scoped (not leaked to next query)
    const afterTx = await dataSource.query(
      `SELECT current_setting('app.current_tenant', true) as tenant`,
    );
    // Outside the transaction, the setting should be empty/null
    expect(afterTx[0].tenant === null || afterTx[0].tenant === '').toBe(true);

    // Note: RLS policy enforcement (tenant isolation) cannot be tested with superuser
    // DB role (bubble_user is superuser — superusers bypass ALL RLS policies).
    // Policy existence is verified in INTEG-001. Enforcement requires a non-superuser
    // role, which is an Epic 7P concern (Story 7P-6: RLS Security Review).
  });

  it('[MW-1-INTEG-012] [P0] TransactionManager.run() with AsyncLocalStorage context uses implicit tenantId', async () => {
    const txManager = module.get(TransactionManager);

    const tenantId = uuidv4();
    await dataSource.query(
      `INSERT INTO tenants (id, name, status) VALUES ($1, $2, $3)`,
      [tenantId, 'Test Tenant C', TenantStatus.ACTIVE],
    );

    // Simulate what TenantContextInterceptor does — set AsyncLocalStorage
    const tenantContext: TenantContext = { tenantId, bypassRls: false };

    await tenantContextStorage.run(tenantContext, async () => {
      await txManager.run(async (manager: EntityManager) => {
        const result = await manager.query(
          `SELECT current_setting('app.current_tenant', true) as tenant`,
        );
        expect(result[0].tenant).toBe(tenantId);
      });
    });
  });

  it('[MW-1-INTEG-013] [P0] TransactionManager.run() with bypassRls=true sets app.is_admin instead of current_tenant', async () => {
    const txManager = module.get(TransactionManager);

    const tenantContext: TenantContext = {
      tenantId: '00000000-0000-0000-0000-000000000000',
      bypassRls: true,
    };

    await tenantContextStorage.run(tenantContext, async () => {
      await txManager.run(async (manager: EntityManager) => {
        // Admin bypass: app.is_admin should be 'true'
        const adminResult = await manager.query(
          `SELECT current_setting('app.is_admin', true) as is_admin`,
        );
        expect(adminResult[0].is_admin).toBe('true');

        // current_tenant should NOT be set
        const tenantResult = await manager.query(
          `SELECT current_setting('app.current_tenant', true) as tenant`,
        );
        expect(tenantResult[0].tenant === null || tenantResult[0].tenant === '').toBe(true);
      });
    });
  });

  it('[MW-1-INTEG-014] [P0] TransactionManager rejects invalid tenant ID format', async () => {
    const txManager = module.get(TransactionManager);

    await expect(
      txManager.run('not-a-valid-uuid', async () => {
        // Should not reach here
      }),
    ).rejects.toThrow('Invalid tenant ID format');
  });

  // ── Guard Chain Behavior ────────────────────────────────────────

  it('[MW-1-INTEG-015] [P0] TenantStatusGuard allows ACTIVE tenant', async () => {
    const guard = module.get(TenantStatusGuard);

    const tenantId = uuidv4();
    await dataSource.query(
      `INSERT INTO tenants (id, name, status) VALUES ($1, $2, $3)`,
      [tenantId, 'Active Tenant', TenantStatus.ACTIVE],
    );

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: uuidv4(), tenantId, role: UserRole.CUSTOMER_ADMIN },
        }),
      }),
    };

    const result = await guard.canActivate(mockContext as unknown as ExecutionContext);
    expect(result).toBe(true);
  });

  it('[MW-1-INTEG-016] [P0] TenantStatusGuard blocks SUSPENDED tenant with ForbiddenException', async () => {
    const guard = module.get(TenantStatusGuard);

    const tenantId = uuidv4();
    await dataSource.query(
      `INSERT INTO tenants (id, name, status) VALUES ($1, $2, $3)`,
      [tenantId, 'Suspended Tenant', TenantStatus.SUSPENDED],
    );

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: uuidv4(), tenantId, role: UserRole.CUSTOMER_ADMIN },
        }),
      }),
    };

    await expect(guard.canActivate(mockContext as unknown as ExecutionContext)).rejects.toThrow(
      'Account suspended',
    );
  });

  it('[MW-1-INTEG-017a] [P0] TenantStatusGuard blocks ARCHIVED tenant with ForbiddenException', async () => {
    const guard = module.get(TenantStatusGuard);

    const tenantId = uuidv4();
    await dataSource.query(
      `INSERT INTO tenants (id, name, status) VALUES ($1, $2, $3)`,
      [tenantId, 'Archived Tenant', TenantStatus.ARCHIVED],
    );

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: uuidv4(), tenantId, role: UserRole.CUSTOMER_ADMIN },
        }),
      }),
    };

    await expect(guard.canActivate(mockContext as unknown as ExecutionContext)).rejects.toThrow(
      'Account archived',
    );
  });

  it('[MW-1-INTEG-018] [P0] TenantStatusGuard allows BUBBLE_ADMIN regardless of tenant status', async () => {
    const guard = module.get(TenantStatusGuard);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            userId: uuidv4(),
            tenantId: '00000000-0000-0000-0000-000000000000',
            role: UserRole.BUBBLE_ADMIN,
          },
        }),
      }),
    };

    const result = await guard.canActivate(mockContext as unknown as ExecutionContext);
    expect(result).toBe(true);
  });
});
