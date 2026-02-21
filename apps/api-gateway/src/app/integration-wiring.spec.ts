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
  WorkflowTemplateStatus,
  WorkflowVisibility,
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

  it('[MW-1-INTEG-013] [P0] TransactionManager.run() with bypassRls=true sets BOTH app.is_admin AND app.current_tenant', async () => {
    const txManager = module.get(TransactionManager);
    const adminTenantId = '00000000-0000-0000-0000-000000000000';

    const tenantContext: TenantContext = {
      tenantId: adminTenantId,
      bypassRls: true,
    };

    await tenantContextStorage.run(tenantContext, async () => {
      await txManager.run(async (manager: EntityManager) => {
        // Admin bypass: app.is_admin should be 'true'
        const adminResult = await manager.query(
          `SELECT current_setting('app.is_admin', true) as is_admin`,
        );
        expect(adminResult[0].is_admin).toBe('true');

        // current_tenant should ALSO be set (fix for if/else if bug)
        const tenantResult = await manager.query(
          `SELECT current_setting('app.current_tenant', true) as tenant`,
        );
        expect(tenantResult[0].tenant).toBe(adminTenantId);
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

  it('[4-5b-INTEG-001] [P0] retryFailed full flow: charges credits for FAILED files only, re-opens counter, updates perFileResults', async () => {
    const WorkflowRunsService = (await import('./workflow-runs/workflow-runs.service')).WorkflowRunsService;
    const workflowRunsService = module.get(WorkflowRunsService);
    const workflowTemplatesService = module.get(WorkflowTemplatesService);
    const txManager = module.get(TransactionManager);

    // Setup: Create tenant with 100 monthly credits, 50 purchased credits
    const tenantId = uuidv4();
    const userId = uuidv4();
    await dataSource.query(
      `INSERT INTO tenants (id, name, status, monthly_credit_limit, monthly_credits_remaining, purchased_credits)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, 'Retry Test Tenant', TenantStatus.ACTIVE, 100, 100, 50],
    );

    await dataSource.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, tenantId, 'user@retry.io', 'hash', UserRole.CUSTOMER_ADMIN],
    );

    // Create published template with credits_per_run = 10
    const templateId = uuidv4();
    const versionId = uuidv4();
    await dataSource.query(
      `INSERT INTO workflow_templates (id, tenant_id, name, description, visibility, status, created_by, credits_per_run)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [templateId, tenantId, 'Test Template', 'For retry', 'private', 'published', userId, 10],
    );
    await dataSource.query(
      `INSERT INTO workflow_versions (id, tenant_id, template_id, version_number, definition, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [versionId, tenantId, templateId, 1, JSON.stringify({ inputs: [], prompt: 'test', execution: {} }), userId],
    );

    // Create a run with 2 FAILED + 1 PENDING file (totalJobs=3, creditsConsumed=30 from initial run)
    const runId = uuidv4();
    const perFileResults = [
      { index: 0, fileName: 'file-0.pdf', status: 'failed', retryAttempt: 0 },
      { index: 1, fileName: 'file-1.pdf', status: 'pending', retryAttempt: 0 },
      { index: 2, fileName: 'file-2.pdf', status: 'failed', retryAttempt: 0 },
    ];

    await dataSource.query(
      `INSERT INTO workflow_runs (
        id, tenant_id, version_id, status, started_by, input_snapshot,
        total_jobs, completed_jobs, failed_jobs, per_file_results,
        credits_consumed, credits_from_monthly, credits_from_purchased, max_retry_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        runId, tenantId, versionId, 'completed_with_errors', userId, JSON.stringify({}),
        3, 1, 2, JSON.stringify(perFileResults),
        30, 30, 0, 3,
      ],
    );

    // Verify initial tenant credits (100 monthly - 30 from initial run = 70 remaining)
    const beforeRetry = await dataSource.query(
      `SELECT monthly_credits_remaining, purchased_credits FROM tenants WHERE id = $1`,
      [tenantId],
    );
    expect(beforeRetry[0].monthly_credits_remaining).toBe(70);
    expect(beforeRetry[0].purchased_credits).toBe(50);

    // When: Call retryFailed (2 FAILED files = 20 credits, 1 PENDING file = free)
    const result = await workflowRunsService.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN);

    // Then: Verify response
    expect(result.status).toBe('running');
    expect(result.creditsConsumed).toBe(50); // 30 from initial + 20 from retry
    expect(result.creditsFromMonthly).toBe(50); // all from monthly (70 remaining)
    expect(result.creditsFromPurchased).toBe(0);

    // Verify tenant credits were deducted (70 - 20 = 50 monthly remaining)
    const afterRetry = await dataSource.query(
      `SELECT monthly_credits_remaining, purchased_credits FROM tenants WHERE id = $1`,
      [tenantId],
    );
    expect(afterRetry[0].monthly_credits_remaining).toBe(50);
    expect(afterRetry[0].purchased_credits).toBe(50); // unchanged (PENDING file free)

    // Verify run was updated in database
    const [[runRow]] = await dataSource.query(
      `SELECT status, total_jobs, completed_jobs, failed_jobs, credits_consumed,
              credits_from_monthly, credits_from_purchased, per_file_results
       FROM workflow_runs WHERE id = $1`,
      [runId],
    );

    expect(runRow.status).toBe('running');
    expect(runRow.total_jobs).toBe(3); // unchanged
    expect(runRow.completed_jobs).toBe(0); // re-opened
    expect(runRow.failed_jobs).toBe(0); // re-opened
    expect(runRow.credits_consumed).toBe(50);
    expect(runRow.credits_from_monthly).toBe(50);
    expect(runRow.credits_from_purchased).toBe(0);

    // Verify perFileResults were updated (status → 'pending', retryAttempt incremented)
    const updatedResults = runRow.per_file_results;
    expect(updatedResults).toHaveLength(3);
    expect(updatedResults[0]).toMatchObject({ index: 0, status: 'pending', retryAttempt: 1 });
    expect(updatedResults[1]).toMatchObject({ index: 1, status: 'pending', retryAttempt: 1 });
    expect(updatedResults[2]).toMatchObject({ index: 2, status: 'pending', retryAttempt: 1 });
  }, 15_000);

  // M3-001: Concurrent retry integration test deferred to Story 4-test-gaps-error-path-coverage
  // Reason: Complex schema setup required (assets table, tenant columns, etc.)
  // Unit test 4-5b-UNIT-013 already verifies FOR UPDATE locks are acquired
  it.skip('[4-5b-INTEG-002] [P0] concurrent retry attempts are serialized via FOR UPDATE lock', async () => {
    const WorkflowRunsService = (await import('./workflow-runs/workflow-runs.service')).WorkflowRunsService;
    const workflowRunsService = module.get(WorkflowRunsService);

    // Setup: Create tenant with 100 monthly credits (max_monthly_runs), 0 purchased
    const tenantId = uuidv4();
    const userId = uuidv4();
    await dataSource.query(
      `INSERT INTO tenants (id, name, status, max_monthly_runs, purchased_credits, max_credits_per_run)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, 'Concurrent Retry Test', TenantStatus.ACTIVE, 100, 0, 100],
    );

    await dataSource.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, tenantId, 'user@concurrent.io', 'hash', UserRole.CUSTOMER_ADMIN],
    );

    // Create published template with credits_per_run = 10
    const templateId = uuidv4();
    const versionId = uuidv4();
    await dataSource.query(
      `INSERT INTO workflow_templates (id, tenant_id, name, description, visibility, status, created_by, credits_per_run)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [templateId, tenantId, 'Concurrent Template', 'test', 'private', 'published', userId, 10],
    );
    await dataSource.query(
      `INSERT INTO workflow_versions (id, tenant_id, template_id, version_number, definition, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [versionId, tenantId, templateId, 1, JSON.stringify({ inputs: [], prompt: 'test', execution: {} }), userId],
    );

    // Create assets for subject files
    const assetId1 = uuidv4();
    const assetId2 = uuidv4();
    await dataSource.query(
      `INSERT INTO assets (id, tenant_id, original_name, storage_path, mime_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [assetId1, tenantId, 'test-1.pdf', '/path/test-1.pdf', 'application/pdf', 1000, userId],
    );
    await dataSource.query(
      `INSERT INTO assets (id, tenant_id, original_name, storage_path, mime_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [assetId2, tenantId, 'test-2.pdf', '/path/test-2.pdf', 'application/pdf', 1000, userId],
    );

    // Create a run with 2 FAILED files
    const runId = uuidv4();
    const perFileResults = [
      { index: 0, fileName: 'test-1.pdf', status: 'failed', retryAttempt: 0 },
      { index: 1, fileName: 'test-2.pdf', status: 'failed', retryAttempt: 0 },
    ];

    const inputSnapshot = {
      templateId,
      definition: { inputs: [{ name: 'subject_files', role: 'subject', sources: ['asset'] }], prompt: 'test', execution: {} },
      userInputs: {
        subject_files: { type: 'asset', assetIds: [assetId1, assetId2] },
      },
    };

    await dataSource.query(
      `INSERT INTO workflow_runs (
        id, tenant_id, version_id, status, started_by, input_snapshot,
        total_jobs, completed_jobs, failed_jobs, per_file_results,
        credits_consumed, credits_from_monthly, credits_from_purchased, max_retry_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        runId, tenantId, versionId, 'completed_with_errors', userId, JSON.stringify(inputSnapshot),
        2, 0, 2, JSON.stringify(perFileResults),
        20, 20, 0, 3,
      ],
    );

    // When: Fire 2 concurrent retryFailed() calls
    const results = await Promise.allSettled([
      workflowRunsService.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      workflowRunsService.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN),
    ]);

    // Then: One should succeed, one should fail with ConflictException or BadRequestException
    const successResults = results.filter((r) => r.status === 'fulfilled');
    const failedResults = results.filter((r) => r.status === 'rejected');

    expect(successResults).toHaveLength(1);
    expect(failedResults).toHaveLength(1);

    // The failed call should throw "already in progress" or similar
    const error = (failedResults[0] as PromiseRejectedResult).reason;
    expect(error.message).toMatch(/already in progress|cannot retry.*running/i);

    // Verify credits deducted only ONCE
    // Monthly credits remaining = max_monthly_runs - SUM(credits_from_monthly)
    // Expected: 100 (max) - 20 (from retry) = 80 remaining
    const [[monthlySum]] = await dataSource.query(
      `SELECT COALESCE(SUM(credits_from_monthly), 0)::int AS total
       FROM workflow_runs
       WHERE tenant_id = $1
         AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_TIMESTAMP)`,
      [tenantId],
    );
    expect(monthlySum.total).toBe(20); // Only one retry deduction (2 files * 10 credits)

    // Verify run status is RUNNING (from the successful call)
    const [[runRow]] = await dataSource.query(
      `SELECT status, credits_consumed FROM workflow_runs WHERE id = $1`,
      [runId],
    );
    expect(runRow.status).toBe('running');
    expect(runRow.credits_consumed).toBe(40); // 20 from initial + 20 from retry
  }, 20_000);
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

  // ── Story 4-LT4-3: Cross-Tenant Template Read for Run Initiation ──

  describe('Cross-Tenant Template + Version Read (Story 4-LT4-3)', () => {
    let publicTemplateId: string;
    let publicVersionId: string;
    let privateAllowedTemplateId: string;
    let privateAllowedVersionId: string;
    let privateBlockedTemplateId: string;
    let softDeletedTemplateId: string;

    beforeAll(async () => {
      const adminUserId = uuidv4();
      // Seed admin user for created_by FK
      await seedDs.query(
        `INSERT INTO users (id, email, password_hash, role, tenant_id, status)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING`,
        [adminUserId, `lt4-admin-${Date.now()}@test.io`, 'hash', 'bubble_admin', systemTenantId, 'active'],
      );

      // 1. Public published template + version (cross-tenant readable)
      publicTemplateId = uuidv4();
      publicVersionId = uuidv4();
      await seedDs.query(
        `INSERT INTO workflow_templates (id, tenant_id, name, description, visibility, status, created_by, current_version_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [publicTemplateId, systemTenantId, 'LT4-3 Public Template', 'test', 'public', 'published', adminUserId, publicVersionId],
      );
      await seedDs.query(
        `INSERT INTO workflow_versions (id, tenant_id, template_id, version_number, definition, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [publicVersionId, systemTenantId, publicTemplateId, 1, JSON.stringify({ inputs: [], prompt: 'test', execution: {} }), adminUserId],
      );

      // 2. Private published template with allowedTenants containing tenantA
      privateAllowedTemplateId = uuidv4();
      privateAllowedVersionId = uuidv4();
      await seedDs.query(
        `INSERT INTO workflow_templates (id, tenant_id, name, description, visibility, status, created_by, current_version_id, allowed_tenants)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [privateAllowedTemplateId, systemTenantId, 'LT4-3 Private Allowed', 'test', 'private', 'published', adminUserId, privateAllowedVersionId, `{${tenantAId}}`],
      );
      await seedDs.query(
        `INSERT INTO workflow_versions (id, tenant_id, template_id, version_number, definition, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [privateAllowedVersionId, systemTenantId, privateAllowedTemplateId, 1, JSON.stringify({ inputs: [], prompt: 'test', execution: {} }), adminUserId],
      );

      // 3. Private published template WITHOUT tenantA in allowedTenants
      privateBlockedTemplateId = uuidv4();
      const privateBlockedVersionId = uuidv4();
      await seedDs.query(
        `INSERT INTO workflow_templates (id, tenant_id, name, description, visibility, status, created_by, current_version_id, allowed_tenants)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [privateBlockedTemplateId, systemTenantId, 'LT4-3 Private Blocked', 'test', 'private', 'published', adminUserId, privateBlockedVersionId, `{${tenantBId}}`],
      );
      await seedDs.query(
        `INSERT INTO workflow_versions (id, tenant_id, template_id, version_number, definition, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [privateBlockedVersionId, systemTenantId, privateBlockedTemplateId, 1, JSON.stringify({ inputs: [], prompt: 'test', execution: {} }), adminUserId],
      );

      // 4. Soft-deleted public published template
      softDeletedTemplateId = uuidv4();
      const softDeletedVersionId = uuidv4();
      await seedDs.query(
        `INSERT INTO workflow_templates (id, tenant_id, name, description, visibility, status, created_by, current_version_id, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [softDeletedTemplateId, systemTenantId, 'LT4-3 Soft Deleted', 'test', 'public', 'published', adminUserId, softDeletedVersionId],
      );
      await seedDs.query(
        `INSERT INTO workflow_versions (id, tenant_id, template_id, version_number, definition, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [softDeletedVersionId, systemTenantId, softDeletedTemplateId, 1, JSON.stringify({ inputs: [], prompt: 'test', execution: {} }), adminUserId],
      );
    });

    it('[4-LT4-3-INTEG-001] [P0] non-admin tenant reads public published template + version via RLS', async () => {
      await appDs.transaction(async (manager) => {
        await manager.query(`SET LOCAL app.current_tenant = '${tenantAId}'`);

        // Template readable via template_access (visibility = 'public')
        const templates = await manager.query(
          `SELECT id, name, current_version_id FROM workflow_templates WHERE id = $1`,
          [publicTemplateId],
        );
        expect(templates).toHaveLength(1);
        expect(templates[0].name).toBe('LT4-3 Public Template');
        expect(templates[0].current_version_id).toBe(publicVersionId);

        // Version readable via catalog_read_published_versions policy:
        // SELECT USING (EXISTS (SELECT 1 FROM workflow_templates wt WHERE wt.id = template_id
        //   AND wt.status = 'published' AND wt.deleted_at IS NULL
        //   AND (wt.visibility = 'public' OR current_tenant = ANY(wt.allowed_tenants))))
        // This policy ORs with tenant_isolation, so cross-tenant version reads work
        // when the parent template is published + visible.
        const versions = await manager.query(
          `SELECT id, template_id FROM workflow_versions WHERE id = $1`,
          [publicVersionId],
        );
        expect(versions).toHaveLength(1);
        expect(versions[0].template_id).toBe(publicTemplateId);
      });
    });

    it('[4-LT4-3-INTEG-002] [P0] private template with allowedTenants containing requesting tenant is visible — template + version', async () => {
      await appDs.transaction(async (manager) => {
        await manager.query(`SET LOCAL app.current_tenant = '${tenantAId}'`);

        // Template readable via catalog_read_published (current_tenant = ANY(allowed_tenants))
        const rows = await manager.query(
          `SELECT id, name FROM workflow_templates WHERE id = $1`,
          [privateAllowedTemplateId],
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].name).toBe('LT4-3 Private Allowed');

        // Version readable via catalog_read_published_versions (same allowed_tenants check):
        // SELECT USING (EXISTS (... wt.visibility = 'public'
        //   OR current_tenant = ANY(wt.allowed_tenants)))
        // tenantA is in allowedTenants → version accessible in same transaction context.
        const versions = await manager.query(
          `SELECT id, template_id FROM workflow_versions WHERE id = $1`,
          [privateAllowedVersionId],
        );
        expect(versions).toHaveLength(1);
        expect(versions[0].template_id).toBe(privateAllowedTemplateId);
      });
    });

    it('[4-LT4-3-INTEG-003] [P0] private template WITHOUT requesting tenant in allowedTenants is blocked', async () => {
      await appDs.transaction(async (manager) => {
        await manager.query(`SET LOCAL app.current_tenant = '${tenantAId}'`);

        // privateBlockedTemplateId has allowedTenants = [tenantBId] — tenantA is NOT in it
        const rows = await manager.query(
          `SELECT id FROM workflow_templates WHERE id = $1`,
          [privateBlockedTemplateId],
        );
        expect(rows).toHaveLength(0);
      });
    });

    it('[4-LT4-3-INTEG-004] [P0] soft-deleted public template is still visible via RLS (template_access allows visibility=public)', async () => {
      // NOTE: template_access and catalog_read_published are both SELECT policies that OR together.
      // template_access grants access for visibility='public' regardless of deleted_at.
      // Therefore soft-deleted public templates ARE visible via RLS.
      // The application code's `withDeleted: false` (in findPublishedOneEntity) is the
      // enforcement layer for soft-deletion filtering — NOT RLS.
      await appDs.transaction(async (manager) => {
        await manager.query(`SET LOCAL app.current_tenant = '${tenantAId}'`);

        const rows = await manager.query(
          `SELECT id FROM workflow_templates WHERE id = $1`,
          [softDeletedTemplateId],
        );
        // Visible because template_access allows visibility='public'
        expect(rows).toHaveLength(1);
      });

      // Verify that adding deleted_at IS NULL filter (what withDeleted:false does) blocks it
      await appDs.transaction(async (manager) => {
        await manager.query(`SET LOCAL app.current_tenant = '${tenantAId}'`);

        const rows = await manager.query(
          `SELECT id FROM workflow_templates WHERE id = $1 AND deleted_at IS NULL`,
          [softDeletedTemplateId],
        );
        expect(rows).toHaveLength(0);
      });
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

  // ── Test Run Execution (Story 4-7a) ──────────────────────────────

  it('[4-7a-INTEG-001] [P0] WorkflowTestService.executeTest enqueues BullMQ job with isTestRun flag and sessionId', async () => {
    const workflowService = module.get(WorkflowTemplatesService);
    const txManager = module.get(TransactionManager);
    const { Queue } = await import('bullmq');

    // Create test tenant + user
    const testTenantId = uuidv4();
    const testUserId = uuidv4();
    await seedDs.query(
      `INSERT INTO tenants (id, name, status) VALUES ($1, $2, $3)`,
      [testTenantId, 'Test Tenant', TenantStatus.ACTIVE],
    );
    await seedDs.query(
      `INSERT INTO users (id, email, password_hash, role, tenant_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testUserId, `test-${Date.now()}@test.io`, 'hash', UserRole.CUSTOMER_ADMIN, testTenantId, 'active'],
    );

    // Create template with current version (Rule 2c compliant)
    const templateId = uuidv4();
    const versionId = uuidv4();
    await txManager.run(testTenantId, async (manager) => {
      await manager.save(WorkflowTemplateEntity, {
        id: templateId,
        tenantId: testTenantId,
        name: 'Test Template',
        description: 'Test',
        visibility: WorkflowVisibility.PUBLIC,
        allowedTenants: null,
        status: WorkflowTemplateStatus.DRAFT,
        currentVersionId: versionId,
        creditsPerRun: 1,
        createdBy: testUserId,
      });

      await manager.save(WorkflowVersionEntity, {
        id: versionId,
        tenantId: testTenantId,
        templateId,
        versionNumber: 1,
        definition: {
          metadata: { name: 'Test', description: 'Test', version: 1 },
          inputs: [{ name: 'subject', type: 'asset' }],
          execution: { model: 'gemini-1.5-flash-002', maxConcurrentFiles: 5 },
        },
        createdBy: testUserId,
      });
    });

    // Import WorkflowTestService and inject dependencies
    const { WorkflowTestService } = await import('./workflows/workflow-test.service');
    const { TestRunCacheService } = await import('./services/test-run-cache.service');
    const executionQueue = new Queue('workflow-execution', {
      connection: {
        host: process.env['REDIS_HOST'] || 'localhost',
        port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
      },
    });

    const testService = new WorkflowTestService(
      txManager,
      executionQueue as any,
      module.get(TestRunCacheService),
      workflowService,
    );

    // Execute test run with empty inputs
    const result = await testService.executeTest(
      templateId,
      {},
      testUserId,
      testTenantId,
    );

    // Verify sessionId returned
    expect(result.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    // Verify BullMQ job was enqueued
    const job = await executionQueue.getJob(result.sessionId);
    expect(job).toBeDefined();
    expect(job?.data.isTestRun).toBe(true);
    expect(job?.data.sessionId).toBe(result.sessionId);
    expect(job?.data.tenantId).toBe(testTenantId);
    expect(job?.data.versionId).toBe(versionId);
    expect(job?.opts?.attempts).toBe(1); // Test runs don't retry

    // Clean up (close queue without removing job to avoid lock conflicts)
    await executionQueue.close();
  });

  it('[4-7b-INTEG-001] [P0] TestRunGateway WebSocket event emission and room isolation', async () => {
    // This test verifies WebSocket infrastructure without starting full HTTP server:
    // - TestRunGateway can emit events
    // - Events are scoped to session rooms
    // - Multiple sessions are isolated

    const { TestRunGateway } = await import('./gateways/test-run.gateway');

    // Create mock socket server with room tracking
    const rooms = new Map<string, Set<any>>();
    const mockServer = {
      to: jest.fn((room: string) => {
        return {
          emit: jest.fn((event: string, data: any) => {
            // Track emitted events per room
            if (!rooms.has(room)) {
              rooms.set(room, new Set());
            }
            rooms.get(room)!.add({ event, data });
          }),
        };
      }),
    };

    // Instantiate gateway with mocked server
    const gateway = new TestRunGateway();
    gateway['server'] = mockServer as any;

    // Simulate test run events for session 1
    const session1 = 'session-1-uuid';
    gateway.emitFileStart({ sessionId: session1, fileIndex: 0, fileName: 'file1.pdf' });
    gateway.emitFileComplete({
      sessionId: session1,
      fileIndex: 0,
      fileName: 'file1.pdf',
      assembledPrompt: 'Prompt content',
      llmResponse: 'LLM response',
      status: 'success',
    });
    gateway.emitComplete({ sessionId: session1, totalFiles: 1, successCount: 1, failedCount: 0 });

    // Simulate test run events for session 2
    const session2 = 'session-2-uuid';
    gateway.emitFileStart({ sessionId: session2, fileIndex: 0, fileName: 'file2.pdf' });
    gateway.emitError({ sessionId: session2, errorMessage: 'Test error' });

    // Verify session 1 room received 3 events
    const session1RoomName = `test-run-${session1}`;
    expect(rooms.get(session1RoomName)?.size).toBe(3);
    const session1Events = Array.from(rooms.get(session1RoomName)!);
    expect(session1Events[0]).toMatchObject({
      event: 'test-run-file-start',
      data: { sessionId: session1, fileIndex: 0, fileName: 'file1.pdf' },
    });
    expect(session1Events[1]).toMatchObject({
      event: 'test-run-file-complete',
      data: {
        sessionId: session1,
        fileIndex: 0,
        fileName: 'file1.pdf',
        assembledPrompt: 'Prompt content',
        llmResponse: 'LLM response',
        status: 'success',
      },
    });
    expect(session1Events[2]).toMatchObject({
      event: 'test-run-complete',
      data: { sessionId: session1, totalFiles: 1, successCount: 1, failedCount: 0 },
    });

    // Verify session 2 room received 2 events
    const session2RoomName = `test-run-${session2}`;
    expect(rooms.get(session2RoomName)?.size).toBe(2);
    const session2Events = Array.from(rooms.get(session2RoomName)!);
    expect(session2Events[0]).toMatchObject({
      event: 'test-run-file-start',
      data: { sessionId: session2, fileIndex: 0, fileName: 'file2.pdf' },
    });
    expect(session2Events[1]).toMatchObject({
      event: 'test-run-error',
      data: { sessionId: session2, errorMessage: 'Test error' },
    });

    // Verify room isolation - each session only sees its own events
    expect(mockServer.to).toHaveBeenCalledWith(session1RoomName);
    expect(mockServer.to).toHaveBeenCalledWith(session2RoomName);
    expect(mockServer.to).not.toHaveBeenCalledWith('global'); // No cross-session broadcast
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

    // ── sal_tenant_read policy (Story 4-SA-B) ────────────────────

    it('[4-SAB-INTEG-001] [P0] tenant A can read own access log entries via app.current_tenant', async () => {
      const sessionId = uuidv4();
      // Seed a row for tenant A via superuser
      await seedDs.query(
        `INSERT INTO support_access_log (id, admin_user_id, tenant_id, jwt_token_hash)
         VALUES ($1, $2, $3, $4)`,
        [sessionId, adminUserId, tenantAId, 'e'.repeat(64)],
      );

      // bubble_app with tenant A context should see the row
      await appDs.transaction(async (manager) => {
        await manager.query(`SET LOCAL app.current_tenant = '${tenantAId}'`);
        const rows = await manager.query(
          `SELECT id FROM support_access_log WHERE tenant_id = $1`,
          [tenantAId],
        );
        // May see rows from other tests too — just verify our row is present
        const found = rows.some((r: { id: string }) => r.id === sessionId);
        expect(found).toBe(true);
      });
    });

    it('[4-SAB-INTEG-002] [P0] tenant B cannot read tenant A access log entries', async () => {
      const sessionId = uuidv4();
      // Seed a row for tenant A via superuser
      await seedDs.query(
        `INSERT INTO support_access_log (id, admin_user_id, tenant_id, jwt_token_hash)
         VALUES ($1, $2, $3, $4)`,
        [sessionId, adminUserId, tenantAId, 'f'.repeat(64)],
      );

      // bubble_app with tenant B context should NOT see tenant A's rows
      await appDs.transaction(async (manager) => {
        await manager.query(`SET LOCAL app.current_tenant = '${tenantBId}'`);
        const rows = await manager.query(
          `SELECT id FROM support_access_log WHERE tenant_id = $1`,
          [tenantAId],
        );
        expect(rows).toHaveLength(0);
      });
    });
  });
});
