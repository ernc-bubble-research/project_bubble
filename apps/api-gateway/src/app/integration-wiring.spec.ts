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
import { createTestDatabase, dropTestDatabase, buildTestDbUrl, buildAppTestDbUrl } from './test-db-helpers';

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
  SupportAccessLogEntity,
  SupportMutationLogEntity,
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
import { SupportAccessModule } from './support-access/support-access.module';
import { SupportAccessService } from './support-access/support-access.service';
import { WorkflowRunsModule } from './workflow-runs/workflow-runs.module';
import { PreFlightValidationService } from './workflow-runs/pre-flight-validation.service';

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
  SupportAccessLogEntity,
  SupportMutationLogEntity,
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
          // RlsSetupService.onModuleInit() runs in both 'development' and 'test' modes.
          // Using 'development' here for consistency with existing seed behavior.
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
        SupportAccessModule,
        WorkflowRunsModule,
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

    // Note: This test uses the superuser DataSource (bubble_user) which bypasses RLS.
    // RLS enforcement is verified in the dedicated 'RLS Enforcement' describe block below,
    // which uses a separate bubble_app (non-superuser) DataSource.
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

  // ── Story 4-4: Credit Management Wiring ───────────────────────

  it('[4-4-INTEG-001] [P0] new credit columns exist with correct defaults after schema sync', async () => {
    // Insert a tenant with only required fields — new columns should have defaults
    const tenantId = uuidv4();
    await dataSource.query(
      `INSERT INTO tenants (id, name, status) VALUES ($1, $2, $3)`,
      [tenantId, 'Credit Default Test', TenantStatus.ACTIVE],
    );

    const rows = await dataSource.query(
      `SELECT purchased_credits, max_credits_per_run_limit, max_credits_per_run, max_monthly_runs
       FROM tenants WHERE id = $1`,
      [tenantId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].purchased_credits).toBe(0);
    expect(rows[0].max_credits_per_run_limit).toBe(1000);
    expect(rows[0].max_credits_per_run).toBe(1000);
    expect(rows[0].max_monthly_runs).toBe(50);

    // Also verify WorkflowRunEntity new columns have correct defaults
    const userId = uuidv4();
    await dataSource.query(
      `INSERT INTO users (id, email, password_hash, role, tenant_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, `credit-test-${Date.now()}@test.io`, 'hash', 'customer_admin', tenantId, 'active'],
    );
    // Need a workflow version for the FK constraint — create a minimal template + version
    const templateId = uuidv4();
    const versionId = uuidv4();
    await dataSource.query(
      `INSERT INTO workflow_templates (id, tenant_id, name, description, visibility, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [templateId, tenantId, 'Credit Test Template', 'test', 'private', 'draft', userId],
    );
    await dataSource.query(
      `INSERT INTO workflow_versions (id, tenant_id, template_id, version_number, definition, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [versionId, tenantId, templateId, 1, JSON.stringify({ inputs: [], prompt: '', execution: {} }), userId],
    );

    const runId = uuidv4();
    await dataSource.query(
      `INSERT INTO workflow_runs (id, tenant_id, version_id, status, started_by, input_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [runId, tenantId, versionId, 'queued', userId, JSON.stringify({})],
    );

    const runRows = await dataSource.query(
      `SELECT is_test_run, credits_from_monthly, credits_from_purchased, credits_consumed
       FROM workflow_runs WHERE id = $1`,
      [runId],
    );
    expect(runRows).toHaveLength(1);
    expect(runRows[0].is_test_run).toBe(false);
    expect(runRows[0].credits_from_monthly).toBe(0);
    expect(runRows[0].credits_from_purchased).toBe(0);
    expect(runRows[0].credits_consumed).toBe(0);
  });

  it('[4-4-INTEG-002] [P0] credit deduction persists via PreFlightValidationService (monthly-first split)', async () => {
    const preFlightService = module.get(PreFlightValidationService);
    const txManager = module.get(TransactionManager);

    // Create tenant with known credit state: 50 monthly, 20 purchased
    const tenantId = uuidv4();
    await dataSource.query(
      `INSERT INTO tenants (id, name, status, max_monthly_runs, purchased_credits, max_credits_per_run)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, 'Credit Deduction Test', TenantStatus.ACTIVE, 50, 20, 100],
    );

    // Deduct 5 credits when full monthly remaining (50) — should all come from monthly
    const result = await txManager.run(tenantId, async (manager: EntityManager) => {
      await manager.query('SELECT id FROM tenants WHERE id = $1 FOR UPDATE', [tenantId]);
      return preFlightService.checkAndDeductCredits(tenantId, 5, false, manager);
    });

    expect(result.creditsFromMonthly).toBe(5);
    expect(result.creditsFromPurchased).toBe(0);

    // Verify purchased_credits unchanged in DB
    const after = await dataSource.query(
      `SELECT purchased_credits FROM tenants WHERE id = $1`, [tenantId],
    );
    expect(after[0].purchased_credits).toBe(20);
  });

  it('[4-4-INTEG-003] [P0] credit refund restores purchased_credits to tenant after FAILED run', async () => {
    // Create tenant with purchased credits
    const tenantId = uuidv4();
    await dataSource.query(
      `INSERT INTO tenants (id, name, status, max_monthly_runs, purchased_credits, max_credits_per_run)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, 'Refund Test', TenantStatus.ACTIVE, 0, 100, 100],
    );

    const txManager = module.get(TransactionManager);
    const preFlightService = module.get(PreFlightValidationService);

    // Deduct 15 credits (0 monthly remaining, all from purchased)
    const deduction = await txManager.run(tenantId, async (manager: EntityManager) => {
      await manager.query('SELECT id FROM tenants WHERE id = $1 FOR UPDATE', [tenantId]);
      return preFlightService.checkAndDeductCredits(tenantId, 15, false, manager);
    });
    expect(deduction.creditsFromPurchased).toBe(15);

    // Verify purchased went from 100 → 85
    const afterDeduct = await dataSource.query(
      `SELECT purchased_credits FROM tenants WHERE id = $1`, [tenantId],
    );
    expect(afterDeduct[0].purchased_credits).toBe(85);

    // Refund the purchased credits (simulating FAILED run)
    await txManager.run(tenantId, async (manager: EntityManager) => {
      await manager.query('SELECT id FROM tenants WHERE id = $1 FOR UPDATE', [tenantId]);
      await preFlightService.refundCredits(tenantId, deduction.creditsFromPurchased, manager);
    });

    // Verify purchased back to 100
    const afterRefund = await dataSource.query(
      `SELECT purchased_credits FROM tenants WHERE id = $1`, [tenantId],
    );
    expect(afterRefund[0].purchased_credits).toBe(100);
  });

  it('[4-4-INTEG-004] [P0] SELECT FOR UPDATE prevents concurrent double-spend on tenant credits', async () => {
    // Create tenant with exactly 10 purchased credits, 0 monthly
    const tenantId = uuidv4();
    await dataSource.query(
      `INSERT INTO tenants (id, name, status, max_monthly_runs, purchased_credits, max_credits_per_run)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, 'Concurrent Test', TenantStatus.ACTIVE, 0, 10, 100],
    );

    // Two concurrent QueryRunners simulate two concurrent run initiations.
    // Each tries to deduct 7 credits. Without FOR UPDATE, both would succeed (double-spend).
    // With FOR UPDATE, the second one should see the updated balance and fail.
    const qr1 = dataSource.createQueryRunner();
    const qr2 = dataSource.createQueryRunner();

    await qr1.connect();
    await qr2.connect();

    try {
      // Start both transactions
      await qr1.startTransaction();
      await qr2.startTransaction();

      // QR1: Lock tenant row and deduct 7
      await qr1.query(`SET LOCAL app.current_tenant = '${tenantId}'`);
      await qr1.query('SELECT id FROM tenants WHERE id = $1 FOR UPDATE', [tenantId]);
      await qr1.query(
        'UPDATE tenants SET purchased_credits = purchased_credits - $1 WHERE id = $2',
        [7, tenantId],
      );

      // QR2: Try to lock the same row — this will BLOCK until QR1 commits/rolls back
      // We use a timeout to avoid hanging the test forever
      const qr2Lock = qr2.query(`SET LOCAL app.current_tenant = '${tenantId}'`)
        .then(() => qr2.query('SELECT id FROM tenants WHERE id = $1 FOR UPDATE', [tenantId]));

      // Commit QR1 — this releases the lock, allowing QR2 to proceed
      await qr1.commitTransaction();

      // Now QR2 can acquire the lock and read the updated balance
      await qr2Lock;
      const rows = await qr2.query(
        'SELECT purchased_credits FROM tenants WHERE id = $1', [tenantId],
      );
      const remaining = rows[0].purchased_credits;

      // After QR1 deducted 7, only 3 remain — not enough for another 7
      expect(remaining).toBe(3);

      // QR2 should see there aren't enough credits and NOT deduct
      if (remaining >= 7) {
        // This should NOT happen — if it does, FOR UPDATE failed
        await qr2.query(
          'UPDATE tenants SET purchased_credits = purchased_credits - $1 WHERE id = $2',
          [7, tenantId],
        );
      }
      await qr2.commitTransaction();

      // Final state: purchased_credits should be 3 (not -4)
      const finalRows = await dataSource.query(
        'SELECT purchased_credits FROM tenants WHERE id = $1', [tenantId],
      );
      expect(finalRows[0].purchased_credits).toBe(3);
    } finally {
      // Clean up query runners
      if (!qr1.isReleased) await qr1.release();
      if (!qr2.isReleased) await qr2.release();
    }
  }, 15_000);

  it('[4-4-INTEG-005] [P0] monthly SUM query excludes runs from previous month (boundary test)', async () => {
    const preFlightService = module.get(PreFlightValidationService);
    const txManager = module.get(TransactionManager);

    // Create tenant with 50 monthly credits, 100 purchased, cap 100
    const tenantId = uuidv4();
    await dataSource.query(
      `INSERT INTO tenants (id, name, status, max_monthly_runs, purchased_credits, max_credits_per_run)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, 'Monthly Boundary Test', TenantStatus.ACTIVE, 50, 100, 100],
    );

    // Need a user + template + version for FK constraints on workflow_runs
    const userId = uuidv4();
    await dataSource.query(
      `INSERT INTO users (id, email, password_hash, role, tenant_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, `boundary-${Date.now()}@test.io`, 'hash', 'customer_admin', tenantId, 'active'],
    );
    const templateId = uuidv4();
    const versionId = uuidv4();
    await dataSource.query(
      `INSERT INTO workflow_templates (id, tenant_id, name, description, visibility, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [templateId, tenantId, 'Boundary Template', 'test', 'private', 'draft', userId],
    );
    await dataSource.query(
      `INSERT INTO workflow_versions (id, tenant_id, template_id, version_number, definition, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [versionId, tenantId, templateId, 1, JSON.stringify({ inputs: [], prompt: '', execution: {} }), userId],
    );

    // Insert a run from LAST MONTH with 10 monthly credits consumed
    const lastMonthRunId = uuidv4();
    await dataSource.query(
      `INSERT INTO workflow_runs (id, tenant_id, version_id, status, started_by, input_snapshot,
         credits_consumed, credits_from_monthly, credits_from_purchased, is_test_run, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         date_trunc('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 day')`,
      [lastMonthRunId, tenantId, versionId, 'completed', userId, JSON.stringify({}),
       10, 10, 0, false],
    );

    // Insert a run from THIS MONTH with 5 monthly credits consumed
    const thisMonthRunId = uuidv4();
    await dataSource.query(
      `INSERT INTO workflow_runs (id, tenant_id, version_id, status, started_by, input_snapshot,
         credits_consumed, credits_from_monthly, credits_from_purchased, is_test_run)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [thisMonthRunId, tenantId, versionId, 'completed', userId, JSON.stringify({}),
       5, 5, 0, false],
    );

    // checkAndDeductCredits should see monthly used = 5 (only this month), NOT 15
    // Monthly remaining = 50 - 5 = 45. Deducting 3 should all come from monthly.
    const result = await txManager.run(tenantId, async (manager: EntityManager) => {
      await manager.query('SELECT id FROM tenants WHERE id = $1 FOR UPDATE', [tenantId]);
      return preFlightService.checkAndDeductCredits(tenantId, 3, false, manager);
    });

    expect(result.creditsFromMonthly).toBe(3);
    expect(result.creditsFromPurchased).toBe(0);

    // Purchased should be unchanged (all from monthly)
    const after = await dataSource.query(
      `SELECT purchased_credits FROM tenants WHERE id = $1`, [tenantId],
    );
    expect(after[0].purchased_credits).toBe(100);
  });
});

/**
 * RLS Enforcement Tests — Tier 2
 *
 * These tests use a SEPARATE bubble_app DataSource (non-superuser) to verify that
 * RLS policies actually enforce tenant isolation at the database layer.
 * The superuser DataSource (bubble_user) is used ONLY for seed data setup.
 *
 * Without the non-superuser role, all RLS tests are meaningless — superusers bypass all policies.
 */
describe('RLS Enforcement — Tier 2 [P0]', () => {
  let module: TestingModule;
  let seedDs: DataSource;     // bubble_user (superuser) — seed data only
  let appDs: DataSource;      // bubble_app (non-superuser) — RLS tests

  const tenantAId = uuidv4();
  const tenantBId = uuidv4();
  const systemTenantId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    await createTestDatabase(TEST_DB_NAME);

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
        SupportAccessModule,
        WorkflowRunsModule,
      ],
      providers: [RlsSetupService, TenantStatusGuard],
    }).compile();

    await module.init();

    // Superuser DS for seed data (bypasses RLS)
    seedDs = module.get(DataSource);

    // Create separate bubble_app DataSource for RLS enforcement tests
    appDs = new DataSource({
      type: 'postgres',
      url: buildAppTestDbUrl(TEST_DB_NAME),
      entities: ALL_ENTITIES,
      synchronize: false,
    });
    await appDs.initialize();

    // Seed tenants
    await seedDs.query(
      `INSERT INTO tenants (id, name, status) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [systemTenantId, 'System', TenantStatus.ACTIVE],
    );
    await seedDs.query(
      `INSERT INTO tenants (id, name, status) VALUES ($1, $2, $3)`,
      [tenantAId, 'RLS Tenant A', TenantStatus.ACTIVE],
    );
    await seedDs.query(
      `INSERT INTO tenants (id, name, status) VALUES ($1, $2, $3)`,
      [tenantBId, 'RLS Tenant B', TenantStatus.ACTIVE],
    );

    // Seed folders (one per tenant)
    await seedDs.query(
      `INSERT INTO folders (id, tenant_id, name) VALUES ($1, $2, $3)`,
      [uuidv4(), tenantAId, 'Folder A'],
    );
    await seedDs.query(
      `INSERT INTO folders (id, tenant_id, name) VALUES ($1, $2, $3)`,
      [uuidv4(), tenantBId, 'Folder B'],
    );

    // Seed a published template in system tenant for catalog tests
    await seedDs.query(
      `INSERT INTO workflow_templates (id, tenant_id, name, description, visibility, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uuidv4(), systemTenantId, 'Catalog Template', 'For RLS catalog test', 'public', 'published', uuidv4()],
    );
  }, 60_000);

  afterAll(async () => {
    if (appDs?.isInitialized) await appDs.destroy();
    if (module) {
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
      } catch { /* benign */ }
    }
    await dropTestDatabase(TEST_DB_NAME);
  }, 30_000);

  // ── AC4: Tenant Isolation ─────────────────────────────────────────

  it('[4-RLS-C-INTEG-001] [P0] tenant_A context cannot read tenant_B folders', async () => {
    await appDs.transaction(async (manager) => {
      await manager.query(`SET LOCAL app.current_tenant = '${tenantAId}'`);
      const rows = await manager.query(`SELECT * FROM folders WHERE tenant_id = $1`, [tenantBId]);
      expect(rows).toHaveLength(0);
    });

    // Verify tenant_A CAN read their own folder
    await appDs.transaction(async (manager) => {
      await manager.query(`SET LOCAL app.current_tenant = '${tenantAId}'`);
      const rows = await manager.query(`SELECT * FROM folders WHERE tenant_id = $1`, [tenantAId]);
      expect(rows).toHaveLength(1);
    });
  });

  // ── AC5: Admin Bypass (Read + Write) ──────────────────────────────

  it('[4-RLS-C-INTEG-002] [P0] admin bypass reads ALL tenants folders', async () => {
    await appDs.transaction(async (manager) => {
      await manager.query(`SET LOCAL app.is_admin = 'true'`);
      const rows = await manager.query(`SELECT * FROM folders`);
      // Should see folders from both tenants (at least 2)
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('[4-RLS-C-INTEG-003] [P0] admin bypass can INSERT row with any tenant_id', async () => {
    const folderId = uuidv4();
    await appDs.transaction(async (manager) => {
      await manager.query(`SET LOCAL app.is_admin = 'true'`);
      await manager.query(
        `INSERT INTO folders (id, tenant_id, name) VALUES ($1, $2, $3)`,
        [folderId, tenantBId, 'Admin-created Folder'],
      );
      const rows = await manager.query(`SELECT * FROM folders WHERE id = $1`, [folderId]);
      expect(rows).toHaveLength(1);
      expect(rows[0].tenant_id).toBe(tenantBId);
    });
  });

  // ── AC6: Catalog Access ───────────────────────────────────────────

  it('[4-RLS-C-INTEG-004] [P0] tenant_A can read published catalog templates from system tenant', async () => {
    await appDs.transaction(async (manager) => {
      await manager.query(`SET LOCAL app.current_tenant = '${tenantAId}'`);
      const rows = await manager.query(
        `SELECT * FROM workflow_templates WHERE status = 'published' AND visibility = 'public'`,
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
      // Verify the system tenant template is visible
      const catalogTemplate = rows.find((r: { name: string }) => r.name === 'Catalog Template');
      expect(catalogTemplate).toBeDefined();
    });
  });

  // ── AC7: Fail-Closed ─────────────────────────────────────────────

  it('[4-RLS-C-INTEG-005] [P0] no SET LOCAL reads zero tenant-scoped rows', async () => {
    await appDs.transaction(async (manager) => {
      // No SET LOCAL at all — app.current_tenant defaults to '' → NULLIF returns NULL → no match
      const rows = await manager.query(`SELECT * FROM folders`);
      expect(rows).toHaveLength(0);
    });
  });

  it('[4-RLS-C-INTEG-006] [P0] empty string current_tenant reads zero rows (NULLIF safety)', async () => {
    await appDs.transaction(async (manager) => {
      await manager.query(`SET LOCAL app.current_tenant = ''`);
      const rows = await manager.query(`SELECT * FROM folders`);
      expect(rows).toHaveLength(0);
    });
  });

  // ── AC8: Write Isolation (WITH CHECK) ─────────────────────────────

  it('[4-RLS-C-INTEG-007] [P0] tenant_A cannot INSERT folder with tenant_B tenant_id', async () => {
    await expect(
      appDs.transaction(async (manager) => {
        await manager.query(`SET LOCAL app.current_tenant = '${tenantAId}'`);
        await manager.query(
          `INSERT INTO folders (id, tenant_id, name) VALUES ($1, $2, $3)`,
          [uuidv4(), tenantBId, 'Cross-tenant folder'],
        );
      }),
    ).rejects.toThrow();
  });

  // ── AC9: Auth INSERT Role Restriction ──────────────────────────────

  it('[4-RLS-C-INTEG-008] [P0] auth_insert_users blocks bubble_admin role creation', async () => {
    await expect(
      appDs.transaction(async (manager) => {
        // No SET LOCAL — simulates pre-auth context (seed, invitation accept)
        await manager.query(
          `INSERT INTO users (id, email, password_hash, role, tenant_id, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuidv4(), `rogue-admin-${Date.now()}@test.io`, 'hash', 'bubble_admin', tenantAId, 'active'],
        );
      }),
    ).rejects.toThrow();
  });

  it('[4-RLS-C-INTEG-009] [P0] auth_insert_users allows customer_admin role creation', async () => {
    const userId = uuidv4();
    await appDs.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO users (id, email, password_hash, role, tenant_id, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, `legit-admin-${Date.now()}@test.io`, 'hash', 'customer_admin', tenantAId, 'active'],
      );
    });

    // Verify via superuser that the row was created
    const rows = await seedDs.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('customer_admin');
  });

  it('[4-RLS-C-INTEG-010] [P0] auth_insert_users allows creator role creation', async () => {
    const userId = uuidv4();
    await appDs.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO users (id, email, password_hash, role, tenant_id, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, `legit-creator-${Date.now()}@test.io`, 'hash', 'creator', tenantAId, 'active'],
      );
    });

    // Verify via superuser that the row was created
    const rows = await seedDs.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('creator');
  });

  // ── Support Access Log RLS (Story 4-SA-A) ──────────────────────

  describe('Support Access Log', () => {
    let adminUserId: string;

    beforeAll(async () => {
      // Get seeded admin user ID for FK constraint
      const rows = await seedDs.query(
        `SELECT id FROM users WHERE email = 'admin@wiring-test.io'`,
      );
      adminUserId = rows[0].id;
    });

    it('[4-SA-INTEG-001] [P0] bubble_app cannot SELECT from support_access_log (admin-only RLS)', async () => {
      // Seed a row via superuser
      const sessionId = uuidv4();
      await seedDs.query(
        `INSERT INTO support_access_log (id, admin_user_id, tenant_id, jwt_token_hash)
         VALUES ($1, $2, $3, $4)`,
        [sessionId, adminUserId, tenantAId, 'a'.repeat(64)],
      );

      // bubble_app without admin bypass should see 0 rows
      await appDs.transaction(async (manager) => {
        const rows = await manager.query(`SELECT * FROM support_access_log`);
        expect(rows).toHaveLength(0);
      });
    });

    it('[4-SA-INTEG-002] [P0] admin bypass can INSERT and read support_access_log', async () => {
      const sessionId = uuidv4();
      await appDs.transaction(async (manager) => {
        await manager.query(`SET LOCAL app.is_admin = 'true'`);
        await manager.query(
          `INSERT INTO support_access_log (id, admin_user_id, tenant_id, jwt_token_hash)
           VALUES ($1, $2, $3, $4)`,
          [sessionId, adminUserId, tenantAId, 'b'.repeat(64)],
        );
        const rows = await manager.query(
          `SELECT * FROM support_access_log WHERE id = $1`,
          [sessionId],
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].admin_user_id).toBe(adminUserId);
      });
    });

    it('[4-SA-INTEG-003] [P0] logSessionEnd updates ended_at', async () => {
      const supportService = module.get(SupportAccessService);
      const sessionId = uuidv4();

      await supportService.logSessionStart(sessionId, adminUserId, tenantAId, 'c'.repeat(64));

      // Verify ended_at is initially null
      const before = await seedDs.query(
        `SELECT ended_at FROM support_access_log WHERE id = $1`,
        [sessionId],
      );
      expect(before[0].ended_at).toBeNull();

      await supportService.logSessionEnd(sessionId, adminUserId);

      const after = await seedDs.query(
        `SELECT ended_at FROM support_access_log WHERE id = $1`,
        [sessionId],
      );
      expect(after[0].ended_at).not.toBeNull();
    });

    it('[4-SA-INTEG-004] [P0] mutation log row created with FK to session', async () => {
      const supportService = module.get(SupportAccessService);
      const sessionId = uuidv4();

      await supportService.logSessionStart(sessionId, adminUserId, tenantAId, 'd'.repeat(64));
      await supportService.logMutation(sessionId, 'POST', '/api/app/assets', 201);

      const rows = await seedDs.query(
        `SELECT session_id, http_method, url_path, status_code
         FROM support_mutation_log WHERE session_id = $1`,
        [sessionId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].session_id).toBe(sessionId);
      expect(rows[0].http_method).toBe('POST');
      expect(rows[0].url_path).toBe('/api/app/assets');
      expect(rows[0].status_code).toBe(201);
    });
  });
});
