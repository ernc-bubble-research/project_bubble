# Story: 4-fix-published-template-404 — TransactionManager Bypass Fix + Soft-Delete Audit

**Epic**: 4 — Workflow Execution Engine
**Status**: done
**Priority**: Critical (data integrity — ghost records, operations on deleted entities)
**Estimate**: S (2-3 hours)

## Problem

Two independent bugs cause ghost records, 404s on published templates, and the ability to operate on soft-deleted entities:

### Bug 1: TransactionManager if/else if
`transaction-manager.ts:37-41` uses `if/else if` for `bypassRls` vs `tenantId`, making them mutually exclusive. When BUBBLE_ADMIN calls endpoints (context has BOTH `bypassRls=true` AND `tenantId`), only `bypassRls` is set — `tenantId` is silently dropped. The same pattern repeats at L46-56 for the `SET LOCAL` execution: only `is_admin` OR `current_tenant` is set, never both.

### Bug 2: Missing withDeleted:false
12 `manager.findOne()` calls on soft-deletable entities (WorkflowTemplateEntity, WorkflowChainEntity) lack explicit `withDeleted: false`. Soft-deleted records can be found, updated, published, and used to initiate runs.

## Root Cause

- **Bug 1**: `if/else if` instead of two independent `if` blocks — both in context reading (L37-41) and SET LOCAL execution (L46-56).
- **Bug 2**: TypeORM `EntityManager.findOne()` does NOT automatically exclude soft-deleted records. Only Repository methods do. Every call needs explicit `withDeleted: false`.

## Tasks

- [x] 1. Fix TransactionManager: two independent `if` blocks (context reading L37-41 + SET LOCAL execution L46-56)
  - [x] 1.1 Change `if/else if` at L37-41 to two independent `if` statements
  - [x] 1.2 Change `if/else if` at L46-56 to two independent `if` statements (set BOTH `current_tenant` AND `is_admin` when both present)
  - [x] 1.3 Update existing unit tests for TransactionManager
- [x] 2. Fix soft-delete in workflow-templates.service.ts (5 locations + 1 cleanup)
  - [x] 2.1 `findOne()` L126-128: add `withDeleted: false`
  - [x] 2.2 `update()` L153-155: add `withDeleted: false`
  - [x] 2.3 `softDelete()` L197-199: add `withDeleted: false` (prevent double-delete)
  - [x] 2.4 `publish()` L238-240: add `withDeleted: false`
  - [x] 2.5 `rollback()` L291-293: add `withDeleted: false`
  - [x] 2.6 `findPublishedOne()` L338-342: add `withDeleted: false`, remove manual `template.deletedAt` check
- [x] 3. Fix soft-delete in workflow-chains.service.ts (4 locations + 1 cross-entity)
  - [x] 3.1 `findOne()` L115-117: add `withDeleted: false`
  - [x] 3.2 `update()` L135-137: add `withDeleted: false`
  - [x] 3.3 `softDelete()` L186-188: add `withDeleted: false`
  - [x] 3.4 `publish()` L235-237: add `withDeleted: false`
- [x] 4. Fix soft-delete in cross-service queries (3 locations)
  - [x] 4.1 `validateReferencedWorkflows()` L286-288 (chains service): add `withDeleted: false`
  - [x] 4.2 `createVersion()` + `findAllByTemplate()` (versions service): add `withDeleted: false`
  - [x] 4.3 `initiateRun()` L56-58 (runs service): add `withDeleted: false`
- [x] 5. Regression tests
  - [x] 5.1 Update Tier 2 wiring test [MW-1-INTEG-013]: admin context now sets current_tenant (was null)
  - [x] 5.2 Update TransactionManager unit test [1H.1-UNIT-003]: expects BOTH SET LOCAL calls
  - [x] 5.3 5 new unit tests for workflow-templates (UNIT-001 through UNIT-005)
  - [x] 5.4 5 new unit tests for workflow-chains (UNIT-006 through UNIT-010)
  - [x] 5.5 2 new unit tests for workflow-versions (UNIT-011 through UNIT-012)
  - [x] 5.6 1 new unit test for workflow-runs (UNIT-013)
- [x] 6. Run full test suite (all 4 projects + E2E) — 1473 unit + 46 E2E = ALL PASS

## Acceptance Criteria

- [x] AC1: TransactionManager sets BOTH `app.current_tenant` AND `app.is_admin` when context has `bypassRls=true` + `tenantId`
- [x] AC2: Tier 2 wiring test verifies admin context sets current_tenant (previously was null)
- [x] AC3: `findOne()` on soft-deleted WorkflowTemplateEntity throws NotFoundException
- [x] AC4: `publish()` on soft-deleted template throws NotFoundException
- [x] AC5: `initiateRun()` on soft-deleted template throws NotFoundException
- [x] AC6: `findPublishedOne()` uses `withDeleted: false` (no manual deletedAt check)
- [x] AC7: All 14 locations have explicit `withDeleted: false` (12 original + 2 in versions service)
- [x] AC8: All existing tests pass (unit + E2E)

## Out-of-Scope

- Tier 3 API contract tests — separate story `4-tier3-api-tests`
- `findAllByTemplate()` in versions service also got `withDeleted: false` (bonus — was originally scoped as out-of-scope but trivially fixable during implementation)
- QueryBuilder queries (`findAll`, `findPublished`, `findAccessibleByTenant` in templates; `findAll` in chains) use explicit `.andWhere('...deleted_at IS NULL')` instead of `withDeleted: false`. This is correct — `withDeleted` is a `findOne`/`find` option, not available on QueryBuilder. Audited and confirmed equivalent behavior.

## Code Review

All 3 passes in party mode:
- Pass 1 (Amelia): self-review, presents work
- Pass 2 (Naz): adversarial review, presents own findings in party mode
- Pass 3 (Murat): test/arch review, presents own findings in party mode
USER decides on all findings. No unilateral rejections.

## Traceability

| Test ID | Change | File | Line(s) |
|---------|--------|------|---------|
| [1H.1-UNIT-003] | TransactionManager sets BOTH current_tenant + is_admin | libs/db-layer/src/lib/transaction-manager.ts | L37-56 |
| [MW-1-INTEG-013] | Admin context now sets current_tenant | libs/db-layer/src/lib/transaction-manager.ts | L37-56 |
| [4-FIX-404-UNIT-001] | findOne withDeleted:false | apps/api-gateway/src/app/workflows/workflow-templates.service.ts | L126-128 |
| [4-FIX-404-UNIT-002] | update withDeleted:false | apps/api-gateway/src/app/workflows/workflow-templates.service.ts | L153-155 |
| [4-FIX-404-UNIT-003] | publish withDeleted:false | apps/api-gateway/src/app/workflows/workflow-templates.service.ts | L238-240 |
| [4-FIX-404-UNIT-004] | rollback withDeleted:false | apps/api-gateway/src/app/workflows/workflow-templates.service.ts | L291-293 |
| [4-FIX-404-UNIT-005] | softDelete withDeleted:false | apps/api-gateway/src/app/workflows/workflow-templates.service.ts | L197-199 |
| [4-FIX-404-UNIT-006] | chains findOne withDeleted:false | apps/api-gateway/src/app/workflows/workflow-chains.service.ts | L115-117 |
| [4-FIX-404-UNIT-007] | chains update withDeleted:false | apps/api-gateway/src/app/workflows/workflow-chains.service.ts | L135-137 |
| [4-FIX-404-UNIT-008] | chains softDelete withDeleted:false | apps/api-gateway/src/app/workflows/workflow-chains.service.ts | L186-188 |
| [4-FIX-404-UNIT-009] | chains publish withDeleted:false | apps/api-gateway/src/app/workflows/workflow-chains.service.ts | L235-237 |
| [4-FIX-404-UNIT-010] | validateReferencedWorkflows withDeleted:false | apps/api-gateway/src/app/workflows/workflow-chains.service.ts | L286-288 |
| [4-FIX-404-UNIT-011] | createVersion withDeleted:false | apps/api-gateway/src/app/workflows/workflow-versions.service.ts | L39-41 |
| [4-FIX-404-UNIT-012] | findAllByTemplate withDeleted:false | apps/api-gateway/src/app/workflows/workflow-versions.service.ts | L98-100 |
| [4-FIX-404-UNIT-013] | initiateRun withDeleted:false | apps/api-gateway/src/app/workflow-runs/workflow-runs.service.ts | L56-58 |
| [4-FIX-404-UNIT-014] | bypassRls=true without tenantId sets only is_admin | libs/db-layer/src/lib/transaction-manager.ts | L37-58 |

## Dev Agent Record

- **Agent**: Amelia (dev agent, Opus 4.6)
- **Session**: 2026-02-16
- **Implementation notes**:
  - TransactionManager: Changed two `if/else if` blocks to independent `if` blocks at L37-41 (context reading) and L46-56 (SET LOCAL execution)
  - Soft-delete: Added `withDeleted: false` to 14 locations across 4 services (6 templates, 5 chains, 2 versions, 1 runs)
  - findPublishedOne: Replaced manual `template.deletedAt` check with proper `withDeleted: false`
  - 14 new regression tests + 2 updated existing tests + 2 updated assertions
  - Test totals: 1473 unit (was 1460) + 46 E2E = ALL PASS
