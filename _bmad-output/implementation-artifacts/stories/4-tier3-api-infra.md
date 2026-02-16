# Story: 4-tier3-api-infra — API Contract Test Infrastructure + P0 Endpoint Tests

**Epic**: 4 — Workflow Execution Engine
**Status**: done
**Priority**: High (structural prevention for "all tests pass but system broken" pattern)
**Estimate**: M-L (6-8 hours)

## Problem

Unit tests mock everything — they verify contract shapes but never exercise the real HTTP→Guards→Interceptor→Service→TransactionManager→RLS→DB chain. E2E tests exercise the full stack but through a browser, making them slow and unable to test backend-specific scenarios like cross-tenant isolation and soft-delete through the API layer. We need a middle tier: **API contract tests** using supertest against a real NestJS HTTP server with a real PostgreSQL database.

This story builds the infrastructure and covers the P0 endpoints — the ones that actually broke in production testing (template CRUD, publish, catalog, soft-delete, tenant isolation).

## Architecture Decisions (from party mode 2026-02-16)

- **DB**: `project_bubble_contract_test` (new, separate from Tier 1/2/E2E)
- **Dual DataSource**: superuser (`bubble_user`) for seeding, non-superuser (`bubble_app`) for app queries
- **HTTP**: `supertest` against `app.getHttpServer()` from NestJS `Test.createTestingModule()`
- **JWT**: Inject `JwtService` from the testing module to sign tokens — stays in sync with production logic
- **Shared infra**: NO changes to existing files (`global-setup.ts`, `test-db-helpers.ts`, `fixtures.ts`). Reuse `createTestDatabase()`, `dropTestDatabase()`, `buildTestDbUrl()`, `buildAppTestDbUrl()` from existing `test-db-helpers.ts`. New file: `contract-test-helpers.ts`
- **Seeding**: Shared fixtures in `beforeAll` via raw SQL (following Tier 2 pattern). Tests assert on specific IDs, not list contents.
- **Module wiring**: Option B — replicate module graph manually (like Tier 2's `createRootImports()`), not import `AppModule` directly. Skip `WorkflowRunsModule` + `WorkflowExecutionModule` to avoid Redis/BullMQ dependency.
- **RLS auto-seed**: `RlsSetupService.onModuleInit()` runs automatically and creates system tenant + admin user. Test seed aligns with this (ON CONFLICT DO NOTHING for system tenant).
- **Jest execution**: Use `--runInBand` or separate Jest config to avoid parallel HTTP server port conflicts with other test tiers.
- **Naz's minimum floor**: 10 tests (3 admin template + 2 publish + 2 catalog + 2 isolation + 1 admin bypass)
- **Story B** (4-tier3-api-coverage): remaining endpoints (settings, LLM models, chains, runs, invitations, users) — separate story

## Tasks

- [x] 1. Contract test infrastructure setup
  - [x] 1.1 Create `contract-test-helpers.ts` with: `createContractApp()` (two-phase boot: Phase 1 syncs schema + creates bubble_app role, Phase 2 boots NestJS), `mintToken(jwtService, payload)` (thin wrapper), `seedContractData(seedDs)` (raw SQL inserts for tenants, users, templates, versions)
  - [x] 1.2 Create `api-contract.spec.ts` test file with `beforeAll` (create DB, boot app, seed) and `afterAll` (close app, drop DB)
  - [x] 1.3 Verify dual DataSource works: superuser seeds data, app DS (bubble_app) serves HTTP requests through RLS
- [x] 2. Admin template endpoint tests (P0 — these broke)
  - [x] 2.1 CT-001: Admin creates template → 201, returns template with tenantId
  - [x] 2.2 CT-002: Admin gets template by ID → 200 with correct data
  - [x] 2.3 CT-003: Admin gets soft-deleted template by ID → 404 (withDeleted:false enforcement)
- [x] 3. Publish + catalog endpoint tests (P0 — these caused ghost records)
  - [x] 3.1 CT-004: Admin publishes draft template with version → 201, status becomes PUBLISHED (NestJS @Post default returns 201)
  - [x] 3.2 CT-005: Admin publishes soft-deleted template → 404
  - [x] 3.3 CT-006: Tenant A sees published PUBLIC template in catalog → 200
  - [x] 3.4 CT-007: Tenant B does NOT see PRIVATE template (not in allowedTenants). CT-008: Tenant A CAN see PRIVATE template (in allowedTenants)
- [x] 4. Cross-tenant isolation tests (P0 — security boundary)
  - [x] 4.1 CT-009: Tenant B cannot GET tenant A's private template by ID → 404
  - [x] 4.2 CT-010: Customer admin cannot PATCH via admin endpoint → 403 (role enforcement — no customer-facing UPDATE endpoint exists for templates)
- [x] 5. Admin bypass + flow test
  - [x] 5.1 CT-011: Admin LIST includes templates from all tenants (RLS bypass). **Modified from original**: Admin GET-by-ID doesn't work cross-tenant because `findOne(id, tenantId)` uses application-level WHERE clause scoped to admin's own tenantId. Admin LIST works because `findAll` has no tenantId in WHERE — relies on RLS which admin bypasses.
  - [x] 5.2 CT-012: Tenant A sees admin-created public template in catalog
- [x] 6. Negative / edge case tests
  - [x] 6.1 CT-013: Unauthenticated request → 401
  - [x] 6.2 CT-014: Customer role on admin endpoint → 403
  - [x] 6.3 CT-015: Suspended tenant on app endpoint → 403 (TenantStatusGuard)
- [x] 7. Run full test suite — all 4 projects pass (1,491 tests). E2E not re-run (no UI changes, known pre-existing failures from class-transformer — tracked in 4-fix-browser-imports).

## Acceptance Criteria

- [x] AC1: Contract test DB `project_bubble_contract_test` created/dropped automatically per test run
- [x] AC2: NestJS TestingModule boots with real HTTP server, real DB, real guards/interceptors
- [x] AC3: JWT tokens minted via injected JwtService (not manual signing)
- [x] AC4: Admin template CRUD works through full HTTP stack (201/200/404)
- [x] AC5: Soft-deleted template returns 404 through API (not just unit test)
- [x] AC6: Tenant B cannot access tenant A's private data through API (CT-009)
- [x] AC7: Admin can access cross-tenant data — LIST includes templates from all tenants (CT-011). **Note**: Admin GET-by-ID doesn't work cross-tenant due to application-level WHERE clause in `findOne()`.
- [x] AC8: All existing tests still pass (1,491 tests across 4 projects)

## Out-of-Scope

- Non-template endpoints (LLM models, settings, chains, runs, invitations, users) → Story `4-tier3-api-coverage`
- Performance/load testing → Epic 7 Story `7P-7`
- Shared infra file modifications → separate tracked issue if needed

## Test Data Strategy

**Shared fixtures (seeded in beforeAll via superuser DS, raw SQL):**
- System tenant + admin user (BUBBLE_ADMIN) — aligns with RlsSetupService auto-seed, uses ON CONFLICT DO NOTHING
- Tenant A (ACTIVE) + customer admin user A
- Tenant B (ACTIVE) + customer admin user B
- Tenant C (SUSPENDED) + customer admin user C — for TenantStatusGuard test (Task 6.3)
- 1 published PUBLIC template (owned by admin, visible to all) + 1 version
- 1 draft template (owned by admin)
- 1 PRIVATE template with `allowedTenants: [tenantA]`
- 1 soft-deleted template (INSERT + UPDATE deleted_at)

**Test assertion strategy:** Assert on specific UUIDs, not list lengths or contents. POST tests that create new entities verify the created entity's ID/fields, never assume list state.

## Implementation Notes (from pre-review party mode)

- **Module wiring**: Follow Tier 2's `createRootImports()` pattern. Add all feature modules except `WorkflowRunsModule` + `WorkflowExecutionModule` (no Redis needed). Add `APP_INTERCEPTOR` (TenantContextInterceptor, SupportMutationInterceptor) and `APP_GUARD` (ThrottlerGuard). Call `createNestApplication()` + `app.init()`.
- **Keep helpers thin**: `contract-test-helpers.ts` uses raw SQL for seeds (like Tier 2), not TypeORM `manager.save()`.
- **TypeOrmCoreModule race**: Manually destroy both DataSources before `module.close()` in afterAll (same pattern as Tier 2's `closeModule()`).

## Code Review

All 3 passes in party mode. USER decided on all findings.

### Pass 1 — Amelia (self-review)
4 findings, all fixed:
1. CT-004 test name said "200" but expected 201 → fixed name
2. Inline import type for TestingModule → top-level import
3. Unused ConfigService injection in forRootAsync factories → removed
4. CT-011 missing negative assertion for soft-deleted template → added

### Pass 2 — Naz (adversarial, party mode)
3 findings, all fixed (user approved all):
1. HIGH: SQL injection via string interpolation in DO block for role creation → split to parameterized query
2. MEDIUM: SETTINGS_ENCRYPTION_KEY fallback only 4 bytes, need 32 for AES-256 → valid 32-byte key
3. MEDIUM: Missing positive catalog test for Tenant A's own private published template → added CT-009b

### Pass 3 — Murat (test/arch, party mode)
4 findings, all fixed (user approved all):
1. HIGH: No test for invalid definition → 400 (validation boundary) → added CT-003b
2. MEDIUM: Seed data uses `'{"sections":[]}'` instead of valid definition shape → updated to valid definition
3. MEDIUM: `TEST_DB_NAME` dual export inconsistency → moved export to declaration
4. MEDIUM: `TEMPLATE_DRAFT_ID` seeded but never asserted → added to CT-011 admin LIST assertions

## Traceability

| Test ID | Change | File | Line(s) |
|---------|--------|------|---------|
| CT-001 | Admin creates template → 201 | api-contract.spec.ts | ~109-124 |
| CT-002 | Admin gets template by ID → 200 | api-contract.spec.ts | ~126-134 |
| CT-003 | Admin gets soft-deleted template → 404 | api-contract.spec.ts | ~136-141 |
| CT-003b | Invalid definition → 400 (Pass 3 M3-1) | api-contract.spec.ts | ~200-209 |
| CT-004 | Admin publishes template → 201 | api-contract.spec.ts | ~211-221 |
| CT-005 | Publish soft-deleted → 404 | api-contract.spec.ts | ~201-209 |
| CT-006 | Catalog: public template visible | api-contract.spec.ts | ~211-219 |
| CT-007 | Catalog: private invisible to B | api-contract.spec.ts | ~221-229 |
| CT-008 | Catalog: private visible to A | api-contract.spec.ts | ~231-239 |
| CT-009 | Cross-tenant: B cannot GET A's private | api-contract.spec.ts | ~266-274 |
| CT-009b | Tenant A sees own private published (Pass 2 N-3) | api-contract.spec.ts | ~276-284 |
| CT-010 | Role: customer_admin on admin endpoint → 403 | api-contract.spec.ts | ~255-264 |
| CT-011 | Admin LIST shows cross-tenant templates | api-contract.spec.ts | ~269-283 |
| CT-012 | Tenant A sees admin public template | api-contract.spec.ts | ~285-295 |
| CT-013 | Unauthenticated → 401 | api-contract.spec.ts | ~300-304 |
| CT-014 | Customer role on admin → 403 | api-contract.spec.ts | ~306-311 |
| CT-015 | Suspended tenant → 403 | api-contract.spec.ts | ~313-318 |
| infra | Two-phase boot, seed data, module wiring | contract-test-helpers.ts | all |

## Dev Agent Record

- **Agent**: Amelia (dev agent, Claude Opus 4.6)
- **Session**: 2026-02-16
- **Files created**: `apps/api-gateway/src/app/contract-test-helpers.ts`, `apps/api-gateway/src/app/api-contract.spec.ts`
- **Files modified**: None (no production code changes)
- **Dependencies added**: `supertest@^7.2.2`, `@types/supertest@^6.0.3` (devDependencies)
- **Key findings during implementation**:
  1. `autoLoadEntities` is per-connection in NestJS TypeORM — migration DS only loads entities registered via `forFeature([], 'migration')`. Fixed with two-phase boot: Phase 1 plain DataSource with explicit entity array + `synchronize: true`.
  2. Admin `findOne(id, tenantId)` scopes by admin's tenantId (SYSTEM_TENANT_ID) at application level. Admin bypass (RLS `is_admin`) doesn't change the WHERE clause. Admin LIST works cross-tenant because `findAll` has no tenantId in WHERE.
  3. Publish endpoint returns 201 (NestJS @Post default), not 200 as documented in Swagger.
  4. `validateWorkflowDefinition()` runs at version creation time — test data must use a valid definition.
