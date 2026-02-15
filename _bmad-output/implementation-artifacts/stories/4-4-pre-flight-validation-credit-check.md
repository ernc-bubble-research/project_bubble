# Story 4.4: Pre-Flight Validation & Credit Check

Status: done

## Story

As a **Creator**,
I want **the system to validate my inputs, check model availability, and verify my credit balance before accepting a workflow run**,
so that **I don't waste credits on invalid submissions, get clear errors for fixable problems, and always know my remaining budget**.

## Context

The current `WorkflowRunsService.initiateRun()` validates inputs and asset IDs but has zero credit enforcement. `creditsConsumed` is hardcoded to `0`. No model/provider availability check happens until the BullMQ processor picks up the job — meaning invalid runs get queued and fail later. This story adds a pre-flight validation layer that runs synchronously at submission time, before any BullMQ job is created.

**Two-pool credit model** (party mode decision 2026-02-15): Tenants have a monthly quota (from their subscription plan) AND purchased credits (persistent, bought separately). Monthly credits are derived from `SUM(credits_from_monthly)` — no reset cron needed. Purchased credits are a stored balance on TenantEntity, decremented atomically.

**Party mode review**: 2026-02-15 — 7 agents. Unanimous on two-pool model, monthly-first deduction, derived monthly tracking, SELECT FOR UPDATE atomicity, refund on FAILED only.

## Acceptance Criteria

1. **AC1 — Per-run cap check**: Template's `creditsPerRun` is checked against tenant's `maxCreditsPerRun` at submission. Returns 400 with message: "This workflow requires X credits per run. Your organization's per-run limit is Y."

2. **AC2 — Two-pool budget check**: Available credits = (monthly remaining + purchased). `monthlyRemaining = tenant.maxMonthlyRuns - SUM(credits_from_monthly WHERE tenant + this calendar month + NOT is_test_run)`. If `template.creditsPerRun > available`, returns 400: "Insufficient credits. Available: X (Y monthly + Z purchased). Required: N."

3. **AC3 — Monthly-first deduction**: Credits deducted from monthly quota first, then purchased. When cost=5 and monthlyRemaining=3: `creditsFromMonthly=3`, `creditsFromPurchased=2`. Invariant: `creditsFromMonthly + creditsFromPurchased === creditsConsumed`.

4. **AC4 — Derived monthly tracking**: Monthly usage computed via SUM query — no stored balance, no reset cron, no monthly counter column. Monthly remaining resets naturally at calendar month boundary.

5. **AC5 — Atomic deduction**: `SELECT ... FOR UPDATE` on tenant row. Credit check + `purchasedCredits` decrement + run creation all happen in single transaction. BullMQ enqueue happens AFTER commit.

6. **AC6 — Refund on FAILED**: When run status becomes `FAILED` (all retries exhausted, all files failed in fan-out): `creditsConsumed`, `creditsFromMonthly`, `creditsFromPurchased` all set to 0, AND `tenant.purchasedCredits += creditsFromPurchased` (refund purchased back to tenant balance). No refund on `completed_with_errors`.

7. **AC7 — Test run bypass**: `BUBBLE_ADMIN` and `IMPERSONATOR_ROLE` runs automatically set `isTestRun=true`, `creditsConsumed=0`. All credit checks are skipped. The `isTestRun` flag is derived from JWT role — NOT a user-provided DTO field.

8. **AC8 — Model/provider pre-flight**: Before credit check, validate: (a) model UUID from workflow definition exists AND `isActive=true`, (b) model's provider config exists AND `isActive=true`. Returns 400 with clear message if either fails.

9. **AC9 — Safety cap validation on tenant update**: `maxCreditsPerRun` cannot exceed `maxCreditsPerRunLimit`. Validated in `TenantsService.update()` (service-level, after Object.assign) — auto-clamped if exceeded. Both columns default 1000.

10. **AC10 — Descriptive error messages**: All pre-flight failures return 400 with actionable messages. User can understand what's wrong and how to fix it.

## Tasks / Subtasks

- [x] Task 1: Entity changes + DTOs (AC: 1, 2, 3, 9)
  - [x] 1.1: Add 3 columns to `TenantEntity`: `purchasedCredits` (int, default 0), `maxCreditsPerRunLimit` (int, default 1000), `maxCreditsPerRun` (int, default 1000)
  - [x] 1.2: Add 3 columns to `WorkflowRunEntity`: `isTestRun` (boolean, default false), `creditsFromMonthly` (int, default 0), `creditsFromPurchased` (int, default 0)
  - [x] 1.3: Update `UpdateTenantDto` — add optional fields for new columns. Cross-field validation (`maxCreditsPerRun <= maxCreditsPerRunLimit`) in SERVICE, not DTO: after `Object.assign(tenant, dto)` in `TenantsService.update()`, if `tenant.maxCreditsPerRun > tenant.maxCreditsPerRunLimit`, auto-clamp `maxCreditsPerRun = maxCreditsPerRunLimit` and log warning. Partial updates make DTO-level cross-validation impossible (only one field may be present).
  - [x] 1.4: Update `WorkflowRunResponseDto` — expose `isTestRun`, `creditsFromMonthly`, `creditsFromPurchased`
  - [x] 1.5: TypeORM synchronize will create columns (no manual migration needed in dev)

- [x] Task 2: Pre-flight validation service — model/provider checks (AC: 8, 10)
  - [x] 2.1: Create `PreFlightValidationService` in `apps/api-gateway/src/app/workflow-runs/`
  - [x] 2.2: Method `validateModelAvailability(modelUuid: string): Promise<void>` — loads `LlmModelEntity` by UUID, checks `isActive`, loads provider config by `providerKey`, checks `isActive`. Throws `BadRequestException` with clear messages.
  - [x] 2.3: Reuse existing `LlmModelService` and `LlmProviderConfigService` for lookups (NOT `LlmProviderFactory.getProvider()` — that builds/caches provider instances which is wasteful for a validation check)
  - [x] 2.4: Register `PreFlightValidationService` in `WorkflowRunsModule.providers`. Import `SettingsModule` into `WorkflowRunsModule.imports` for `LlmProviderConfigService` DI resolution. (`LlmModelService` is already available via `WorkflowsModule` import.)

- [x] Task 3: Credit check logic (AC: 1, 2, 3, 4, 5, 10)
  - [x] 3.1: Method `checkAndDeductCredits(tenantId, creditsPerRun, isTestRun, manager): Promise<{creditsFromMonthly, creditsFromPurchased}>` on `PreFlightValidationService`
  - [x] 3.2: If `isTestRun`, return `{0, 0}` immediately (skip all checks)
  - [x] 3.3: `SELECT ... FOR UPDATE` on tenant row to lock it
  - [x] 3.4: Per-run cap check: `creditsPerRun <= tenant.maxCreditsPerRun`
  - [x] 3.5: Monthly usage query: `SELECT COALESCE(SUM(credits_from_monthly), 0) FROM workflow_runs WHERE tenant_id = $1 AND is_test_run = false AND created_at >= date_trunc('month', NOW())` — uses existing index `['tenantId', 'createdAt']`
  - [x] 3.6: Compute `monthlyRemaining = tenant.maxMonthlyRuns - monthlyUsed`
  - [x] 3.7: Compute deduction split: `fromMonthly = Math.min(cost, monthlyRemaining)`, `fromPurchased = cost - fromMonthly`
  - [x] 3.8: Verify `fromPurchased <= tenant.purchasedCredits` — if not, 400 "Insufficient credits"
  - [x] 3.9: If `fromPurchased > 0`, decrement `tenant.purchasedCredits` via `manager.query('UPDATE tenants SET purchased_credits = purchased_credits - $1 WHERE id = $2', [fromPurchased, tenantId])`
  - [x] 3.10: Return `{creditsFromMonthly: fromMonthly, creditsFromPurchased: fromPurchased}`

- [x] Task 4: Integrate pre-flight into `initiateRun()` (AC: 1-5, 7, 8)
  - [x] 4.0: Update `initiateRun()` method signature to accept `userRole: string` as 4th parameter. Update `WorkflowRunsController.initiateRun()` to pass `req.user.role`. Update `req.user` type to include `role: string`.
  - [x] 4.1: Inject `PreFlightValidationService` into `WorkflowRunsService`
  - [x] 4.2: Determine `isTestRun` from user role (`BUBBLE_ADMIN` or `IMPERSONATOR_ROLE` → true)
  - [x] 4.3: After loading template+version but BEFORE input validation: call `validateModelAvailability(definition.execution.model)`
  - [x] 4.4: Create a NEW credit-check-and-create transaction that holds `FOR UPDATE` lock on tenant row. Do NOT merge all existing `txManager.run()` calls into one — keep template load (txn 1) and asset validation as separate read-only operations to minimize lock hold time. The new credit transaction replaces only the second `txManager.run()` (run creation), adding `FOR UPDATE` + credit check + deduction within it.
  - [x] 4.5: Set `creditsConsumed`, `creditsFromMonthly`, `creditsFromPurchased`, `isTestRun` on the new run entity
  - [x] 4.6: BullMQ enqueue remains AFTER transaction commit

- [x] Task 5: Credit refund on failure in processor (AC: 6)
  - [x] 5.1: In `markRunFailed()`: load the run entity to read `creditsFromPurchased`, then set `creditsConsumed=0`, `creditsFromMonthly=0`, `creditsFromPurchased=0`. If `creditsFromPurchased > 0`, acquire `FOR UPDATE` lock on tenant row, then increment `tenant.purchasedCredits` (refund). Same race condition risk as deduction — must lock.
  - [x] 5.2: In `finalizeRun()`: when `finalStatus === FAILED` (all files failed), same refund logic as 5.1. Must also acquire `FOR UPDATE` lock on tenant row before refunding `purchasedCredits`.
  - [x] 5.3: When `finalStatus === COMPLETED_WITH_ERRORS`, do NOT refund — credits stand

- [x] Task 6: Unit tests (AC: 1-8)
  - [x] 6.1: `PreFlightValidationService` — model active check, provider active check, model not found, provider not found
  - [x] 6.2: `PreFlightValidationService` — credit check: sufficient monthly only, monthly+purchased split, insufficient credits, per-run cap exceeded
  - [x] 6.3: `PreFlightValidationService` — test run bypass (returns 0,0 with no DB queries)
  - [x] 6.4: `WorkflowRunsService.initiateRun()` — credits set on run entity, isTestRun derived from role
  - [x] 6.5: `WorkflowExecutionProcessor` — refund on FAILED (markRunFailed + finalizeRun)
  - [x] 6.6: `WorkflowExecutionProcessor` — NO refund on COMPLETED_WITH_ERRORS
  - [x] 6.7: `TenantsService.update()` — maxCreditsPerRun auto-clamped when exceeds maxCreditsPerRunLimit after Object.assign
  - [x] 6.8: Test IDs: `[4-4-UNIT-001]` through `[4-4-UNIT-034]`

- [x] Task 7: Wiring tests + browser smoke test (AC: 1-10)
  - [x] 7.1: Tier 2 wiring test: credit deduction persists to DB (monthly split correct)
  - [x] 7.2: Tier 2 wiring test: credit refund on FAILED restores purchased credits to tenant
  - [x] 7.3: Tier 2 wiring test: new columns exist with correct defaults after sync
  - [x] 7.4: Tier 2 wiring test: SELECT FOR UPDATE prevents concurrent double-spend (two concurrent transactions). Use `dataSource.createQueryRunner()` for two independent query runners to test real PostgreSQL row locking. Cannot use `txManager.run()` for this — need manual transaction control to interleave operations.
  - [x] 7.5: Browser smoke test — dashboard loads, tenant detail with entitlements tab works, API returns new credit fields, auto-clamp verified via API

## Dev Notes

### Architecture Decisions (Party Mode 2026-02-15)

1. **Two-pool credit model**: Monthly quota (derived) + purchased credits (stored). Monthly resets naturally via time-windowed SUM query. No cron, no reset job, no stored monthly balance.

2. **Monthly-first deduction order**: Use included monthly credits before purchased. Standard SaaS pattern — "use what's free before paying extra."

3. **Derived monthly vs stored balance**: Monthly usage = `SUM(credits_from_monthly) WHERE this calendar month`. Pro: no reset mechanism needed. The index `['tenantId', 'createdAt']` on WorkflowRunEntity already supports this query efficiently.

4. **Atomicity via SELECT FOR UPDATE**: Prevents concurrent double-spend race condition. Two simultaneous run submissions for the same tenant cannot both pass the credit check — one will block on the row lock.

5. **isTestRun derived from role**: NOT a DTO field. Prevents users from self-declaring test runs. `BUBBLE_ADMIN` and `IMPERSONATOR_ROLE` → automatic test run.

6. **Refund scope**: Full refund on `FAILED` only. `completed_with_errors` means work was done — credits stand. Refund means: zero the run's credit fields AND increment tenant's `purchasedCredits` by `creditsFromPurchased`.

7. **Pre-flight validation as separate service**: Not inline in `initiateRun()`. Clean separation of concerns. Testable independently. Can be extended for future checks (token budget, rate limiting).

### Existing Code to Modify

| File | Changes |
|------|---------|
| `libs/db-layer/src/lib/entities/tenant.entity.ts` | Add 3 columns: `purchasedCredits`, `maxCreditsPerRunLimit`, `maxCreditsPerRun` |
| `libs/db-layer/src/lib/entities/workflow-run.entity.ts` | Add 3 columns: `isTestRun`, `creditsFromMonthly`, `creditsFromPurchased` |
| `libs/shared/src/lib/dtos/tenant/update-tenant.dto.ts` | Add optional fields with cross-field validation |
| `libs/shared/src/lib/dtos/workflow/workflow-run-response.dto.ts` | Expose new fields |
| `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.ts` | Integrate pre-flight, add credit-check-and-create txn, set credits, accept `userRole` param |
| `apps/api-gateway/src/app/workflow-runs/workflow-runs.controller.ts` | Pass `req.user.role` to `initiateRun()`, update `req.user` type to include `role` |
| `apps/api-gateway/src/app/workflow-runs/workflow-runs.module.ts` | Import `SettingsModule`, register `PreFlightValidationService` in providers |
| `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts` | Add refund logic with FOR UPDATE to `markRunFailed()` and `finalizeRun()` |
| `apps/api-gateway/src/app/tenants/tenants.service.ts` | Add post-assign cross-field validation for `maxCreditsPerRun` <= `maxCreditsPerRunLimit` |
| `libs/db-layer/src/lib/entities/index.ts` | Export new entities if needed |

### New Files

| File | Purpose |
|------|---------|
| `apps/api-gateway/src/app/workflow-runs/pre-flight-validation.service.ts` | Model/provider checks + credit check logic |
| `apps/api-gateway/src/app/workflow-runs/pre-flight-validation.service.spec.ts` | Unit tests |

### Critical Implementation Notes

1. **Transaction restructuring — keep lock scope tight**: Current `initiateRun()` uses TWO `txManager.run()` calls (lines 44-77 and 117-179). Do NOT merge both into a single transaction — that would hold the FOR UPDATE lock during template load, input validation, and asset validation (all read-only). Instead: keep txn 1 (template+version load) as-is, do input/asset validation outside any transaction (as today), then replace txn 2 with a new credit-check-and-create transaction that acquires `FOR UPDATE` on tenant row, checks credits, deducts, creates the run, and commits. BullMQ enqueue stays after commit. This minimizes lock contention.

2. **SELECT FOR UPDATE syntax with TransactionManager**: The `txManager.run(tenantId, ...)` sets `app.current_tenant` but does NOT automatically lock rows. Use `manager.query('SELECT * FROM tenants WHERE id = $1 FOR UPDATE', [tenantId])` to acquire the row lock within the transaction.

3. **Monthly SUM query**: Use `date_trunc('month', NOW())` for calendar month boundary. This is PostgreSQL-specific but the project is PostgreSQL-only. The query: `SELECT COALESCE(SUM(credits_from_monthly), 0) as total FROM workflow_runs WHERE tenant_id = $1 AND is_test_run = false AND created_at >= date_trunc('month', NOW())`.

4. **Refund in processor needs tenant update + FOR UPDATE**: Both `markRunFailed()` and `finalizeRun()` already use `txManager.run(tenantId, ...)`. For refund, first load the run to read `creditsFromPurchased`, then acquire `FOR UPDATE` lock on tenant row (same race condition risk as deduction — concurrent refund + new deduction could conflict), then update the run (zero credits) AND update the tenant (`purchased_credits += creditsFromPurchased`) in the same transaction.

5. **Model/provider validation uses existing services**: `LlmModelService.findOneById()` and `LlmProviderConfigService.findByProviderKey()` already exist. Do NOT use `LlmProviderFactory.getProvider()` for validation — it builds/caches provider instances (decrypts credentials, instantiates SDK client) which is wasteful for a simple availability check.

6. **Cross-field validation in SERVICE, not DTO**: Partial updates via `Object.assign(tenant, dto)` mean only one of `maxCreditsPerRun` / `maxCreditsPerRunLimit` may be in the DTO — DTO-level cross-validation is impossible. Validate in `TenantsService.update()` AFTER `Object.assign`: if `tenant.maxCreditsPerRun > tenant.maxCreditsPerRunLimit`, auto-clamp `maxCreditsPerRun = maxCreditsPerRunLimit` and log a warning. DTO should have basic `@IsOptional() @IsInt() @Min(1)` validators only.

7. **Controller must pass `role` to `initiateRun()`**: Current `req.user` type only has `{ tenantId, userId }`. The `isTestRun` derivation needs the user's role from JWT. Update controller to pass `req.user.role` as 4th argument. Ensure the JWT strategy populates `role` on the request user object (verify it does — check `JwtStrategy.validate()`).

8. **Defense-in-depth (Rule 2c)**: All entity lookups within the pre-flight service must include `tenantId` in WHERE for tenant-scoped entities. `LlmModelEntity` and `LlmProviderConfigEntity` are system-wide (no `tenant_id` column) — Rule 2c does NOT apply to them.

### Project Structure Notes

- Pre-flight service lives in `workflow-runs/` directory (alongside `WorkflowRunsService`), not in `workflow-execution/` (which is the BullMQ processor directory)
- Entity changes in `libs/db-layer/` — standard location for all entities
- DTO changes in `libs/shared/` — standard location for all DTOs
- Test IDs follow `[4-4-UNIT-XXX]` convention per project-context.md

### Testing Standards

- **Priority**: `[P0]` for credit check and refund tests (money), `[P1]` for model/provider checks
- **BDD format**: Given/When/Then comments in test bodies
- **Wiring tests**: Tier 2 against `project_bubble_wiring_integ_test` DB
- **Mock patterns**: Mock `TransactionManager` for unit tests, mock `LlmModelService`/`LlmProviderConfigService` for pre-flight tests
- **File size**: Keep spec files under 300 lines — split pre-flight tests from processor refund tests

### Party Mode Review Findings (2026-02-15 — all applied)

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | HIGH | Controller doesn't pass `role` to `initiateRun()` — `req.user` type only has `tenantId`+`userId` | Added Task 4.0: update signature + controller + type |
| 2 | MEDIUM | Wiring test 7.4 (concurrent double-spend) needs manual query runner guidance | Added `createQueryRunner()` note to Task 7.4 |
| 3 | MEDIUM | `maxCreditsPerRun` cross-field validation impossible in DTO (partial updates) | Moved to service-level auto-clamping in Task 1.3, AC9, Note 6 |
| 4 | MEDIUM | `PreFlightValidationService` needs `SettingsModule` import (not currently in `WorkflowRunsModule`) | Added Task 2.4: register service + import SettingsModule |
| 5 | HIGH | Refund path needs `FOR UPDATE` on tenant row (same race condition as deduction) | Updated Tasks 5.1+5.2 + Note 4 |
| 6 | LOW | Double-refund guard — naturally handled by `> 0` check on `creditsFromPurchased` | No change needed — confirmed correct |
| 7 | HIGH | "Merge into single transaction" holds lock too long — keep read-only ops separate | Rewrote Task 4.4 + Note 1: only lock for credit+create |

### Previous Story Intelligence (4-SA-A)

- `TransactionManager.run(tenantId, manager)` is the standard pattern for tenant-scoped transactions
- `IMPERSONATOR_ROLE` constant is in `@project-bubble/db-layer` (extracted in 4-SA-A)
- Jest mock clearing: `mockClear()` also clears `mockReturnValue` — must re-set if needed
- Fire-and-forget pattern: use `tap({complete, error})` for non-blocking side effects (4-SA-A interceptor)
- EPIPE errors in Jest output with Node.js v25.5.0 — redirect to file and grep

### Out-of-Scope (Rule 38 — tracked)

| Item | Tracked To | Reason |
|------|-----------|--------|
| Customer admin settings page for `maxCreditsPerRun` adjustment | Future story (post-Epic 4) | No customer-facing settings page exists yet. Both values admin-managed via existing tenant update endpoint. |
| Credit purchase flow/API | Future story (post-Epic 4) | `purchasedCredits` set by admin via tenant update for now. Payment integration is Phase 2. |
| Token budget check (prompt size vs context window) | Already exists in processor (line 182-188) | Context window check already happens at processing time. Interactive file deselection UI is Story 4-5 or separate. |
| Monthly quota per plan tier configuration | Existing `maxMonthlyRuns` column | Plan-tier-specific defaults are admin-managed. Automated plan-based assignment is Phase 2. |
| Refund for `completed_with_errors` | Intentional design decision — NOT a deferral | Work was done for successful files. Credits stand. User can retry failed files. |

### References

- [Party mode decisions: `retrospectives/epic-4-planning-2026-02-09.md` Topics 2, 4, 8](retrospectives/epic-4-planning-2026-02-09.md)
- [WorkflowRunsService: `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.ts`](apps/api-gateway/src/app/workflow-runs/workflow-runs.service.ts)
- [WorkflowExecutionProcessor: `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts`](apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts)
- [TenantEntity: `libs/db-layer/src/lib/entities/tenant.entity.ts`](libs/db-layer/src/lib/entities/tenant.entity.ts)
- [WorkflowRunEntity: `libs/db-layer/src/lib/entities/workflow-run.entity.ts`](libs/db-layer/src/lib/entities/workflow-run.entity.ts)
- [WorkflowTemplateEntity: `libs/db-layer/src/lib/entities/workflow-template.entity.ts` — `creditsPerRun` column](libs/db-layer/src/lib/entities/workflow-template.entity.ts)
- [LlmProviderFactory: `apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.ts`](apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.ts)
- [LlmModelEntity: `libs/db-layer/src/lib/entities/llm-model.entity.ts` — `isActive` field](libs/db-layer/src/lib/entities/llm-model.entity.ts)
- [LlmProviderConfigEntity: `libs/db-layer/src/lib/entities/llm-provider-config.entity.ts` — `isActive` field](libs/db-layer/src/lib/entities/llm-provider-config.entity.ts)
- [Project Context: `project-context.md` — Rule 2 (TransactionManager), Rule 2c (tenantId in WHERE)](project-context.md)
- [Epics: `_bmad-output/planning-artifacts/epics.md` — Story 4.4 acceptance criteria](planning-artifacts/epics.md)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References
- Pre-flight spec double-call pattern: `await expect().rejects.toThrow(Type)` consumes mock, second `.toThrow(/pattern/)` gets undefined. Fix: single assertion with regex.
- Controller spec TS2739: `mockRunResponse` missing new fields after DTO update. Fix: add `isTestRun`, `creditsFromMonthly`, `creditsFromPurchased`.
- Dev DB missing columns: `autoLoadEntities: true` on named 'migration' DataSource doesn't pick up entities from default DataSource's `forFeature()` registrations. Manual `ALTER TABLE` for dev DB.

### Completion Notes List
- All 7 tasks completed, all 10 ACs verified
- 40 new tests added (36 unit + 4 wiring) — includes 2 from Pass 3 review fixes
- Total test count: 1,344 (703 api-gateway + 39 db-layer + 83 shared + 519 web)
- Credit refund in processor uses inline SQL (not PreFlightValidationService.refundCredits) to avoid cross-module dependency between workflow-execution and workflow-runs modules
- Browser smoke test: dashboard loads, tenant detail/entitlements works, API returns credit fields, auto-clamp works via PATCH API
- Code review: 3 passes, 23 total findings, 17 fixed, 2 tracked, 4 rejected

### Code Review — Pass 1 (Amelia, self-review)
- **Date**: 2026-02-15
- **Findings**: 6 (2 HIGH, 3 MEDIUM, 1 LOW)
- **All fixed**: Yes — no code logic issues, all findings were metadata/label accuracy
- **Finding 1 (HIGH)**: `llm-provider-config.service.ts` missing from Change Log/File List → added
- **Finding 2 (HIGH)**: AC tags wrong on 5 `validateModelAvailability` tests: `[AC9]` → `[AC8]` → fixed
- **Finding 3 (MEDIUM)**: Traceability table AC7 test IDs: `019,020,021` → `021,022,023` → fixed; AC5 `024` → `025` → fixed; AC8 added `019` → fixed
- **Finding 4 (MEDIUM)**: `[4.4-UNIT-006]` AC tag: `[AC8]` → `[AC7]` → fixed
- **Finding 5 (MEDIUM)**: Multiple AC tag errors in `workflow-runs.service.spec.ts` → all fixed (018/019→AC8, 021/022/023→AC7, 026→AC8)
- **Finding 6 (LOW)**: Processor comment `(AC7)` → `(AC6)` for no-refund on COMPLETED_WITH_ERRORS → fixed
- **Tests re-verified**: 105 tests across 3 affected spec files, all passing

### Code Review — Pass 2 (Naz, adversarial)
- **Date**: 2026-02-15
- **Findings**: 13 (4 HIGH, 5 MEDIUM, 4 LOW)
- **Decisions**: 8 FIX, 1 TRACK, 4 REJECT (user decided all)
- **Finding 1 (HIGH)**: Monthly SUM query missing `AT TIME ZONE 'UTC'` → FIXED (timezone safety)
- **Finding 2 (HIGH)**: `finalizeRun()` missing pessimistic lock on run entity (TOCTOU on credit fields) → FIXED
- **Finding 3 (HIGH)**: `markRunFailed()` missing lock + idempotency guard (double-refund risk) → FIXED
- **Finding 4 (MEDIUM)**: Error messages expose monthly/purchased balances → FIXED (genericized)
- **Finding 5 (MEDIUM)**: Per-run cap error not actionable (shows limit, not workflow cost) → FIXED
- **Finding 6 (LOW)**: No DLQ-specific test for `markRunFailed` → REJECT (covered by onFailed tests)
- **Finding 7 (LOW)**: `refundCredits` not called in processor (uses inline SQL) → REJECT (intentional: cross-module boundary)
- **Finding 8 (MEDIUM)**: Auto-clamp gap — lowering `maxCreditsPerRunLimit` doesn't adjust `maxCreditsPerRun` → FIXED + unit test
- **Finding 9 (MEDIUM)**: BullMQ enqueue failure after credit deduction leaves orphaned credits → FIXED (compensating refund + 2 unit tests)
- **Finding 10 (MEDIUM)**: Monthly boundary wiring test missing → FIXED (INTEG-005)
- **Finding 11 (LOW)**: No test for `creditsPerRun ?? 1` default → REJECT (trivial coalescing)
- **Finding 12 (LOW)**: Frontend countdown timer for impersonation → TRACK (4-SA-B)
- **Finding 13 (HIGH)**: Negative `creditsFromPurchased` possible when `monthlyRemaining > creditsPerRun` → FIXED (Math.max guard + unit test)
- **Tests added**: 5 (UNIT-035 auto-clamp, UNIT-036/037 enqueue failure, UNIT-038 negative guard, INTEG-005 monthly boundary)
- **Post-fix test count**: 1,342

### Code Review — Pass 3 (Murat, test architect)
- **Date**: 2026-02-15
- **Findings**: 4 (2 MEDIUM, 2 LOW)
- **Decisions**: 3 FIX, 1 TRACK (user decided all)
- **Finding 1 (MEDIUM)**: Missing idempotency test for `markRunFailed` — code has guard but no test exercises it → FIXED (UNIT-039)
- **Finding 2 (MEDIUM)**: Compensating refund failure not handled — if refund throws, original enqueue error lost → FIXED (try/catch wrapper)
- **Finding 3 (LOW)**: No test for credit check failure propagation through `initiateRun()` → FIXED (UNIT-040)
- **Finding 4 (LOW)**: `creditsPerRun ?? 1` default untested → TRACK (trivial)
- **Tests added**: 2 (UNIT-039, UNIT-040)
- **Post-fix test count**: 1,344

### Change Log
| File | Action | Description |
|------|--------|-------------|
| `libs/db-layer/src/lib/entities/tenant.entity.ts` | Modified | Added `purchasedCredits`, `maxCreditsPerRunLimit`, `maxCreditsPerRun` columns |
| `libs/db-layer/src/lib/entities/workflow-run.entity.ts` | Modified | Added `isTestRun`, `creditsFromMonthly`, `creditsFromPurchased` columns |
| `libs/shared/src/lib/dtos/tenant/update-tenant.dto.ts` | Modified | Added optional fields for new columns with `@IsInt() @Min(0)` validators |
| `libs/shared/src/lib/dtos/workflow/workflow-run-response.dto.ts` | Modified | Exposed `isTestRun`, `creditsFromMonthly`, `creditsFromPurchased` |
| `apps/api-gateway/src/app/workflow-runs/pre-flight-validation.service.ts` | Created | Model/provider checks + credit check/deduct/refund logic |
| `apps/api-gateway/src/app/workflow-runs/pre-flight-validation.service.spec.ts` | Created | 17 unit tests for pre-flight service |
| `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.ts` | Modified | Integrated pre-flight, added credit txn with FOR UPDATE, isTestRun derivation |
| `apps/api-gateway/src/app/workflow-runs/workflow-runs.controller.ts` | Modified | Pass `req.user.role` to `initiateRun()` |
| `apps/api-gateway/src/app/workflow-runs/workflow-runs.module.ts` | Modified | Import SettingsModule, register PreFlightValidationService |
| `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts` | Modified | Credit refund in `markRunFailed()` + `finalizeRun()` with FOR UPDATE |
| `apps/api-gateway/src/app/tenants/tenants.service.ts` | Modified | Auto-clamp `maxCreditsPerRun` to `maxCreditsPerRunLimit` in `update()` |
| `apps/api-gateway/src/app/workflows/llm-models.service.ts` | Modified | Added `findOneById(uuid)` method |
| `apps/api-gateway/src/app/settings/llm-provider-config.service.ts` | Modified | Added `findByProviderKey(providerKey)` method |
| `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.spec.ts` | Modified | Added 9 new tests, updated 17 existing for role param |
| `apps/api-gateway/src/app/workflow-runs/workflow-runs.controller.spec.ts` | Modified | Added role to mock req, updated assertions |
| `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.spec.ts` | Modified | Added 6 new tests for credit refund |
| `apps/api-gateway/src/app/tenants/tenants.service.spec.ts` | Modified | Added 2 tests for auto-clamp |
| `apps/api-gateway/src/app/integration-wiring.spec.ts` | Modified | Added 4 wiring tests + WorkflowRunsModule import |

### File List
**New files (2):**
- `apps/api-gateway/src/app/workflow-runs/pre-flight-validation.service.ts`
- `apps/api-gateway/src/app/workflow-runs/pre-flight-validation.service.spec.ts`

**Modified files (16):**
- `libs/db-layer/src/lib/entities/tenant.entity.ts`
- `libs/db-layer/src/lib/entities/workflow-run.entity.ts`
- `libs/shared/src/lib/dtos/tenant/update-tenant.dto.ts`
- `libs/shared/src/lib/dtos/workflow/workflow-run-response.dto.ts`
- `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.ts`
- `apps/api-gateway/src/app/workflow-runs/workflow-runs.controller.ts`
- `apps/api-gateway/src/app/workflow-runs/workflow-runs.module.ts`
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts`
- `apps/api-gateway/src/app/tenants/tenants.service.ts`
- `apps/api-gateway/src/app/workflows/llm-models.service.ts`
- `apps/api-gateway/src/app/settings/llm-provider-config.service.ts`
- `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.spec.ts`
- `apps/api-gateway/src/app/workflow-runs/workflow-runs.controller.spec.ts`
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.spec.ts`
- `apps/api-gateway/src/app/tenants/tenants.service.spec.ts`
- `apps/api-gateway/src/app/integration-wiring.spec.ts`

## Test Traceability

| AC | Test File | Test ID(s) | Description | Status |
|----|-----------|------------|-------------|--------|
| AC1 | pre-flight-validation.service.spec.ts | 4.4-UNIT-007 | Per-run cap exceeded → 400 | PASS |
| AC2 | pre-flight-validation.service.spec.ts | 4.4-UNIT-011 | Insufficient total credits → 400 | PASS |
| AC3 | pre-flight-validation.service.spec.ts | 4.4-UNIT-008, 009, 010 | Monthly-first deduction split (3 scenarios) | PASS |
| AC4 | pre-flight-validation.service.spec.ts | 4.4-UNIT-012 | Monthly SUM query derives usage correctly | PASS |
| AC5 | integration-wiring.spec.ts | 4-4-INTEG-002, 004 | Credit deduction persists + FOR UPDATE prevents double-spend | PASS |
| AC5 | workflow-runs.service.spec.ts | 4.4-UNIT-025 | FOR UPDATE lock called in credit txn | PASS |
| AC6 | workflow-execution.processor.spec.ts | 4.4-UNIT-027, 028, 029, 030, 031, 032 | Refund on FAILED (markRunFailed + finalizeRun), no refund on COMPLETED/COMPLETED_WITH_ERRORS | PASS |
| AC6 | integration-wiring.spec.ts | 4-4-INTEG-003 | Refund restores purchased_credits in DB | PASS |
| AC7 | workflow-runs.service.spec.ts | 4.4-UNIT-021, 022, 023 | isTestRun derived from BUBBLE_ADMIN, IMPERSONATOR_ROLE, false for CUSTOMER_ADMIN | PASS |
| AC7 | pre-flight-validation.service.spec.ts | 4.4-UNIT-006 | Test runs return {0,0} with no DB queries | PASS |
| AC8 | pre-flight-validation.service.spec.ts | 4.4-UNIT-001, 002, 003, 004, 005 | Model/provider active checks (5 scenarios) | PASS |
| AC8 | workflow-runs.service.spec.ts | 4.4-UNIT-018, 019, 026 | validateModelAvailability called/propagated/skipped correctly | PASS |
| AC9 | tenants.service.spec.ts | 4.4-UNIT-033, 034, 035 | Auto-clamp maxCreditsPerRun to limit (including limit-lowered auto-clamp) | PASS |
| AC10 | pre-flight-validation.service.spec.ts | all | Error messages include model name, provider key, credit amounts | PASS |
| Schema | integration-wiring.spec.ts | 4-4-INTEG-001 | New columns exist with correct defaults after sync | PASS |
| AC2 | workflow-runs.service.spec.ts | 4.4-UNIT-040 | Credit check failure propagates and prevents run creation | PASS |
| AC5 | workflow-runs.service.spec.ts | 4.4-UNIT-036, 037 | BullMQ enqueue failure triggers compensating refund | PASS |
| AC6 | workflow-execution.processor.spec.ts | 4.4-UNIT-039 | markRunFailed idempotency guard — skip if already FAILED | PASS |
| AC4 | integration-wiring.spec.ts | 4-4-INTEG-005 | Monthly SUM excludes previous month runs (boundary test) | PASS |
| Defense | pre-flight-validation.service.spec.ts | 4.4-UNIT-038 | Negative creditsFromPurchased guard (Math.max) | PASS |
