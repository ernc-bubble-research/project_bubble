# Story MW-1: Module Wiring Tests for Epics 1, 2, 3

Status: review

## Story

As a development team,
I want module wiring and integration tests that verify NestJS modules compile with real providers and Angular composite components render with real children,
so that startup crashes, unregistered entities, circular dependencies, and silently broken UI components are caught before they reach E2E or production.

## Context

This story was created from the Epic 3 retrospective (2026-02-08) as a new standard test category (Rule 24). The problem: 555+ unit tests passed while the app crashed on startup because every test mocked providers, repositories, and child components. TypeORM entities not registered, circular dependencies, 20 Lucide icons silently failing — none caught by mocked unit tests.

**Two-tier approach** (party mode decision 2026-02-08):
- **Tier 1 — Module Compilation** (~11 tests): `Test.createTestingModule({...}).compile()` with real module imports (no mocks). No database needed. Verifies DI graph resolves, no circular deps, all providers available.
- **Tier 2 — Integration Wiring** (~12 tests): Real PostgreSQL (reuse E2E test DB pattern). Verifies RLS setup, seed logic, `TransactionManager` tenant isolation, guard chains, cross-module service calls.
- **Angular Composite Renders** (~12 tests): Render composite components with real child components (not stubs). Verifies imports array complete, Lucide icons registered, template bindings resolve.
- **TenantId CI Check** (1 script): Automated grep for raw SQL without tenant_id in WHERE clauses.

## Acceptance Criteria

1. **AC1**: All 11 NestJS feature modules compile successfully via `Test.createTestingModule().compile()` without mocking any providers (Tier 1).
2. **AC2**: AppModule compiles and initializes with real PostgreSQL (test DB), RLS setup runs without errors, seed data is created (Tier 2).
3. **AC3**: Cross-module service injection works — `TenantsModule` can use `AuthService` and `WorkflowTemplatesService` from their respective modules (Tier 2).
4. **AC4**: `TransactionManager.run(tenantId, callback)` correctly sets `SET LOCAL app.current_tenant` and queries respect RLS (Tier 2).
5. **AC5**: 9-12 Angular composite components render with real child components and all Lucide icons resolve (no empty renders).
6. **AC6**: `WorkflowWizardComponent` renders all 4 step components and stepper navigation works.
7. **AC7**: `ChainBuilderComponent` renders all 7 child sections and form interactions work.
8. **AC8**: A `tools/check-tenant-id.sh` script exists that greps for raw SQL queries missing tenant_id and returns non-zero on findings.
9. **AC9**: All existing tests (944+) continue to pass. Zero regressions.
10. **AC10**: Zero lint errors across all projects.

## Tasks / Subtasks

- [x] Task 1: Create Tier 1 NestJS module compilation tests (AC: 1)
  - [x] 1.1 Create `apps/api-gateway/src/app/module-wiring.spec.ts`
  - [x] 1.2 Test each module compiles independently: AuthModule, TenantsModule, UsersModule, InvitationsModule, AssetsModule, IngestionModule, KnowledgeModule, WorkflowsModule, SettingsModule, EmailModule
  - [x] 1.3 Test AppModule compiles with all imports (uses real PostgreSQL — SQLite unavailable, catches more real-world issues)
- [x] Task 2: Create Tier 2 NestJS integration wiring tests (AC: 2, 3, 4)
  - [x] 2.1 Create `apps/api-gateway/src/app/integration-wiring.spec.ts`
  - [x] 2.2 Create test DB setup/teardown helpers reusing E2E pattern (connect to `postgres` admin DB, drop/create test DB, TypeORM synchronize)
  - [x] 2.3 Test AppModule full initialization with real PostgreSQL (RLS setup, seed logic)
  - [x] 2.4 Test cross-module injection: TenantsService → AuthService, KnowledgeModule → IngestionModule
  - [x] 2.5 Test TransactionManager tenant isolation (SET LOCAL + transaction scoping)
  - [x] 2.6 Test TenantStatusGuard behavior (active/suspended/admin bypass)
- [x] Task 3: Create Angular composite component wiring tests (AC: 5, 6, 7)
  - [x] 3.1 Create `apps/web/src/app/component-wiring.spec.ts`
  - [x] 3.2 Test layout components: AdminLayoutComponent, AppLayoutComponent (with real AvatarDropdownComponent)
  - [x] 3.3 Test page components: DashboardComponent, SettingsComponent, TenantDetailComponent, DataVaultComponent
  - [x] 3.4 Test WorkflowWizardComponent with all 4 real step children
  - [x] 3.5 Test ChainBuilderComponent with all 7 real child sections
  - [x] 3.6 Test WorkflowStudioComponent with real TemplateListComponent + ChainListComponent
  - [x] 3.7 Lucide icon SVG verification tests (caught 3 missing icons: Database, List, LayoutGrid)
- [x] Task 4: Create tenantId CI check script (AC: 8)
  - [x] 4.1 Create `tools/check-tenant-id.sh`
  - [x] 4.2 Script greps for `.query(` patterns on tenant-scoped tables without TransactionManager/SET LOCAL
  - [x] 4.3 Whitelist known exemptions (rls-setup, transaction-manager, auth.service, all spec files)
  - [x] 4.4 Script returns exit code 0 (clean) — no violations found
- [x] Task 5: Run all tests, verify zero regressions (AC: 9, 10)
  - [x] 5.1 Run `npx nx run-many --target=test --all` — 1027 tests, all passing
  - [x] 5.2 Run `npx nx run-many --target=lint --all` — 0 errors (only pre-existing warnings)
  - [x] 5.3 Verify total test count: 944 (baseline) + 83 (net new) = 1027 total

## Dev Notes

### Tier 1: Module Compilation Tests (No DB)

**Pattern**: Create `TestingModule` with the REAL module import, but override `TypeOrmModule.forRoot()` and `BullModule.forRoot()` with empty stubs since we only need DI resolution, not DB connections.

```typescript
// Tier 1 pattern — compilation only, no DB
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

describe('Module Wiring — Tier 1 Compilation', () => {
  // Shared root config that stubs out DB/Redis but provides ConfigService
  const rootImports = [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.test' }),
  ];

  it('[MW-1-UNIT-001] AuthModule compiles with real providers', async () => {
    const module = await Test.createTestingModule({
      imports: [...rootImports, AuthModule],
    })
    .overrideProvider(DataSource).useValue({}) // stub DataSource
    .compile();
    expect(module).toBeDefined();
    expect(module.get(AuthService)).toBeDefined();
  });
});
```

**Important**: For modules that use `TypeOrmModule.forFeature([...])`, the `forFeature` call requires a root `TypeOrmModule.forRoot()` to be registered. You'll need to provide a minimal root TypeORM config. Use `TypeOrmModule.forRoot({ type: 'sqlite', database: ':memory:', entities: [...all entities...], synchronize: true })` for Tier 1 ONLY (compilation check). This is acceptable because Tier 1 only verifies the DI graph resolves — Tier 2 uses real PostgreSQL for actual behavior.

**All 12 entities** to register in Tier 1 root TypeORM:
```typescript
import {
  TenantEntity, UserEntity, InvitationEntity, AssetEntity,
  FolderEntity, KnowledgeChunkEntity, WorkflowTemplateEntity,
  WorkflowVersionEntity, WorkflowChainEntity, WorkflowRunEntity,
  LlmModelEntity, LlmProviderConfigEntity,
} from '@project-bubble/db-layer';
```

**SQLite limitation for Tier 1**: SQLite does NOT support `pgvector`, `SET LOCAL`, `jsonb`, or PostgreSQL-specific column types. This is fine for Tier 1 (compilation-only). Entity column decorators that use `type: 'jsonb'` will work in SQLite as basic JSON. The `vector(768)` column in `KnowledgeChunkEntity` must be overridden or skipped — use `@Column({ type: 'simple-json', nullable: true })` equivalent. If SQLite causes entity issues, fall back to mocking DataSource for that specific module.

**Modules to test individually (11 tests)**:
1. AuthModule (has forwardRef to InvitationsModule — test both directions)
2. TenantsModule (imports AuthModule + WorkflowsModule — heaviest cross-deps)
3. UsersModule (standalone, no TypeORM forFeature)
4. InvitationsModule (imports EmailModule, forwardRef to AuthModule)
5. AssetsModule (standalone, TypeORM forFeature)
6. IngestionModule (BullMQ registerQueue — override BullModule)
7. KnowledgeModule (imports IngestionModule)
8. WorkflowsModule (standalone, 5 entities + LlmModel)
9. SettingsModule (standalone, TypeORM forFeature)
10. EmailModule (standalone utility, no deps)
11. AppModule (full graph — all modules together)

### Tier 2: Integration Wiring Tests (Real PostgreSQL)

**DB lifecycle** — reuse the E2E pattern from `apps/web-e2e/src/global-setup.ts`:

```typescript
// test-db-setup.ts helper
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env.test') });

const TEST_DB = 'project_bubble_wiring_test'; // separate from E2E DB

export async function createTestDatabase(): Promise<void> {
  const adminDs = new DataSource({
    type: 'postgres',
    host: process.env['POSTGRES_HOST'] || 'localhost',
    port: Number(process.env['POSTGRES_PORT'] || 5432),
    username: process.env['POSTGRES_USER'] || 'bubble_user',
    password: process.env['POSTGRES_PASSWORD'] || 'bubble_password',
    database: 'postgres',
  });
  await adminDs.initialize();
  await adminDs.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [TEST_DB]);
  await adminDs.query(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
  await adminDs.query(`CREATE DATABASE "${TEST_DB}"`);
  await adminDs.destroy();
}

export async function dropTestDatabase(): Promise<void> {
  // Same pattern as E2E global-teardown.ts
}
```

**Tier 2 tests (~12)**:
1. AppModule initializes with real PostgreSQL (tables created, no errors)
2. RlsSetupService.onModuleInit completes (RLS policies created)
3. LLM model seed runs idempotently (12 models seeded)
4. Provider config seed runs idempotently (4 configs seeded)
5. TransactionManager.run(tenantId) sets SET LOCAL correctly
6. TransactionManager.run(tenantId) — query only returns rows for that tenant
7. TransactionManager.run() without context — query returns no rows (fail-closed)
8. Cross-module: TenantsService calls AuthService (password hashing in create flow)
9. Cross-module: KnowledgeSearchService uses IngestionModule's EMBEDDING_PROVIDER
10. Guard chain: JwtAuthGuard extracts user, TenantStatusGuard checks tenant, RolesGuard checks role
11. AuthModule ↔ InvitationsModule forwardRef resolves correctly
12. IngestionModule BullMQ queue registration (verify queue is accessible)

**Environment**: Tests require Docker PostgreSQL + Redis running (`docker-compose up -d`).

### Angular Composite Component Tests

**Pattern**: Use `TestBed.configureTestingModule` with REAL child component imports (not stubs). Mock only HTTP services.

```typescript
// Component wiring test pattern
describe('Component Wiring — Composite Renders', () => {
  it('[MW-1-UNIT-024] WorkflowWizardComponent renders all 4 step children', async () => {
    await TestBed.configureTestingModule({
      imports: [
        WorkflowWizardComponent,  // standalone — brings its own imports
        provideHttpClientTesting(),
      ],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } }, queryParamMap: of(new Map()) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkflowWizardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    // Verify the wizard renders (step 0 = metadata)
    const metadataStep = fixture.nativeElement.querySelector('app-wizard-metadata-step');
    expect(metadataStep).toBeTruthy();
  });
});
```

**Lucide icon verification**: Check that `<lucide-icon>` elements render SVG content (not empty). If an icon name is unregistered, the element renders but contains no SVG — test for `querySelector('lucide-icon svg')`.

**Components to test (9-12 tests)**:
1. AdminLayoutComponent (with real AvatarDropdownComponent)
2. AppLayoutComponent (with real AvatarDropdownComponent)
3. DashboardComponent (StatCardComponent, StatusBadgeComponent, CreateTenantModalComponent)
4. SettingsComponent (LlmModelsListComponent, ProviderConfigListComponent, form dialogs)
5. TenantDetailComponent (StatusBadgeComponent, ImpersonateConfirmDialogComponent, dialogs)
6. WorkflowStudioComponent (TemplateListComponent, ChainListComponent)
7. WorkflowWizardComponent (4 step children)
8. ChainBuilderComponent (7 child sections)
9. DataVaultComponent (UploadZoneComponent, FolderTreeComponent, FileCardComponent)
10. TemplateListComponent (TemplateCardComponent, WorkflowSearchComponent, WorkflowFilterBarComponent)
11. ChainListComponent (ChainCardComponent, WorkflowSearchComponent, WorkflowFilterBarComponent)
12. TenantListComponent (StatusBadgeComponent) [optional — simpler composite]

### TenantId CI Check Script

```bash
#!/usr/bin/env bash
# tools/check-tenant-id.sh — find raw SQL without tenant_id on tenant-scoped tables
# Exemptions: auth.service, invitations.service, tenants.service, rls-setup.service, llm-model.service

EXEMPTIONS="auth\.service|invitations\.service|tenants\.service|rls-setup\.service|llm-model\.service"
VIOLATIONS=0

# Check for .query( calls in service files that operate on tenant-scoped tables
# but don't include tenant_id
# ... (implementation details in task)
```

### Project Structure Notes

- **Tier 1 tests**: `apps/api-gateway/src/app/module-wiring.spec.ts`
- **Tier 2 tests**: `apps/api-gateway/src/app/integration-wiring.spec.ts`
- **Tier 2 helpers**: `apps/api-gateway/src/app/test-db-setup.ts`
- **Angular tests**: `apps/web/src/app/component-wiring.spec.ts`
- **CI check**: `tools/check-tenant-id.sh`
- **All entities exported from**: `@project-bubble/db-layer` (see `libs/db-layer/src/index.ts`)

### Key Risks

1. **SQLite column type conflicts in Tier 1**: The `KnowledgeChunkEntity` has a `vector(768)` column type that SQLite doesn't support. If TypeORM `synchronize: true` with SQLite fails on this entity, override the column metadata or skip that specific module's SQLite test and rely on Tier 2 for it.
2. **BullMQ registration in Tier 1**: `IngestionModule` uses `BullModule.registerQueue()` which requires Redis. For Tier 1, override the BullModule with a mock provider.
3. **Angular test isolation**: Component wiring tests import REAL children which may have HTTP dependencies. Use `provideHttpClientTesting()` to prevent real HTTP calls while keeping component tree intact.
4. **Test DB port conflicts**: Tier 2 uses a SEPARATE test database name (`project_bubble_wiring_test`) from E2E (`project_bubble_test`) to avoid conflicts if both test suites run in parallel.

### References

- [Rule 24 — Module Wiring Tests](../../project-context.md) (line 429)
- [E2E global-setup.ts](../../../apps/web-e2e/src/global-setup.ts) — test DB lifecycle pattern
- [E2E global-teardown.ts](../../../apps/web-e2e/src/global-teardown.ts) — cleanup pattern
- [Epic 3 retrospective](../retrospectives/epic-3-retrospective.md) — Action Items 4+5
- [RlsSetupService](../../../libs/db-layer/src/lib/rls-setup.service.ts) — RLS policy creation + seeding
- [TransactionManager](../../../libs/db-layer/src/lib/transaction-manager.ts) — tenant-aware transactions
- [AppModule](../../../apps/api-gateway/src/app/app.module.ts) — root module with all imports
- [TenantStatusGuard architecture](../../../apps/api-gateway/src/app/tenants/tenant-status.guard.ts) — controller-level, not APP_GUARD

### NestJS Module Inventory (12 modules)

| Module | TypeORM Entities | BullMQ | Cross-Module Deps |
|--------|-----------------|--------|-------------------|
| AppModule | forRootAsync (autoLoad) | forRootAsync | All feature modules |
| AuthModule | UserEntity | - | InvitationsModule (forwardRef) |
| TenantsModule | 10 entities | - | AuthModule, WorkflowsModule |
| UsersModule | - | - | - |
| InvitationsModule | InvitationEntity, UserEntity, TenantEntity | - | EmailModule |
| AssetsModule | AssetEntity, FolderEntity | - | - |
| IngestionModule | KnowledgeChunkEntity | ingestion queue | - |
| KnowledgeModule | - | - | IngestionModule |
| WorkflowsModule | 5 entities + LlmModelEntity | - | - |
| SettingsModule | LlmProviderConfigEntity | - | - |
| EmailModule | - | - | - |
| DbLayerModule | - (global) | - | - |

### Angular Composite Component Inventory (19 components)

| Component | Real Children | Lucide Icons |
|-----------|--------------|-------------|
| AdminLayoutComponent | AvatarDropdownComponent | Yes |
| AppLayoutComponent | AvatarDropdownComponent | Yes |
| DashboardComponent | StatCardComponent, StatusBadgeComponent, CreateTenantModalComponent | No |
| SettingsComponent | LlmModelsListComponent, ProviderConfigListComponent, form dialogs | Yes |
| TenantDetailComponent | StatusBadgeComponent, ImpersonateConfirmDialogComponent, dialogs | Yes |
| TenantListComponent | StatusBadgeComponent | No |
| WorkflowStudioComponent | TemplateListComponent, ChainListComponent | Yes |
| WorkflowWizardComponent | 4 wizard step components | Yes |
| ChainBuilderComponent | 7 child section components | Yes |
| DataVaultComponent | UploadZoneComponent, FolderTreeComponent, FileCardComponent, CreateFolderDialogComponent | Yes |
| TemplateListComponent | TemplateCardComponent, WorkflowSearchComponent, WorkflowFilterBarComponent, WorkflowSettingsModalComponent | Yes |
| ChainListComponent | ChainCardComponent, WorkflowSearchComponent, WorkflowFilterBarComponent, WorkflowSettingsModalComponent | Yes |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Tier 2 integration tests: `bubble_user` is a PostgreSQL superuser, bypassing ALL RLS policies. RLS enforcement cannot be tested with current DB role — deferred to Epic 7P-6 (RLS Security Review).
- Tier 1 used real PostgreSQL (not SQLite) because `better-sqlite3`/`sqlite3` not installed. Catches more real issues.
- `current_setting('app.current_tenant', true)` returns empty string `''` (not `null`) in PostgreSQL when not set within a transaction context.

### Completion Notes List

1. **Tier 1 (11 tests)**: All 11 NestJS modules compile with real providers. Full AppModule DI graph resolves. Uses dedicated `project_bubble_wiring_test` database.
2. **Tier 2 (18 tests)**: RLS policies verified on all 7 tenant-scoped tables. Seed data (admin, tenants, LLM models, provider configs) verified idempotent. TransactionManager SET LOCAL + transaction scoping verified. TenantStatusGuard active/suspended/archived/admin-bypass verified (ARCHIVED added in code review). Cross-module injection with real method-existence verification (InvitationsService↔EmailService). Uses dedicated `project_bubble_wiring_integ_test` database.
3. **Angular (11 tests)**: 9 composite components render with real children. Lucide icons render SVG elements. **3 missing Lucide icons found and fixed**: Database, List, LayoutGrid (added to `app.config.ts`).
4. **TenantId CI check**: `tools/check-tenant-id.sh` greps for raw SQL on tenant-scoped tables without TransactionManager. Clean exit (no violations found).
5. **Regression**: 1028 total tests (83 shared + 25 db-layer + 458 api-gateway + 462 web), 0 lint errors. Net new: +84 tests from 944 baseline.

### Code Review Fixes (Party Mode 2026-02-08)

7 findings from Murat (TEA), Amelia (Dev), Winston (Architect), Bob (SM):
1. **INTEG-017a added**: ARCHIVED tenant guard test — was missing from the guard chain coverage (Murat).
2. **INTEG-010 replaced**: Thin `module.get().toBeDefined()` test replaced with real cross-module method-existence verification (InvitationsService→EmailService.sendInvitationEmail) (Murat).
3. **Shared DB helpers**: Extracted `test-db-helpers.ts` — eliminates DRY violation across module-wiring.spec.ts and integration-wiring.spec.ts (Amelia).
4. **NODE_ENV coupling comment**: Documented hidden coupling between `NODE_ENV: 'development'` and RlsSetupService.onModuleInit() seed guard condition (Amelia).
5. **ALL_ICONS source-of-truth comment**: Added cross-reference to `app.config.ts` as the canonical icon list (Amelia). Icons already in sync (64 icons).
6. **DI-resolved guards**: Changed guard tests from `new TenantStatusGuard(dataSource)` to `module.get(TenantStatusGuard)` with explicit provider registration (Amelia).
7. **Test count clarified**: 944 (3.10 baseline) + 44 (Story 1-13) + 40 (MW-1) = 1028 (Bob).

### Real Bugs Found

- **3 missing Lucide icons** (Database, List, LayoutGrid) — registered in `app.config.ts` but were missing from the provider. Silently broke template rendering in production. Fixed in this story.

### File List

**New Files:**
- `apps/api-gateway/src/app/module-wiring.spec.ts` — Tier 1: 11 NestJS module compilation tests
- `apps/api-gateway/src/app/integration-wiring.spec.ts` — Tier 2: 18 NestJS integration wiring tests
- `apps/api-gateway/src/app/test-db-helpers.ts` — Shared test DB lifecycle helpers (create/drop/buildUrl)
- `apps/web/src/app/component-wiring.spec.ts` — 11 Angular composite component wiring tests
- `tools/check-tenant-id.sh` — TenantId CI check script

**Modified Files:**
- `apps/web/src/app/app.config.ts` — Added 3 missing Lucide icons (Database, List, LayoutGrid)
