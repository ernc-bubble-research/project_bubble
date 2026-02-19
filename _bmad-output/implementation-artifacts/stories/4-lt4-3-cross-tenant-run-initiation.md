# Story 4-LT4-3: Cross-Tenant Run Initiation Fix

Status: done

## Story

As a **tenant user (customer admin or creator)**,
I want **to run published workflow templates that were created by the Bubble Admin**,
so that **I can use the platform's workflow execution engine as intended**.

## Context

**Bug discovered**: Live Test Round 4 (2026-02-17) — first real LLM test with Google AI Studio.

`workflow-runs.service.ts:57-58` does:
```typescript
manager.findOne(WorkflowTemplateEntity, {
  where: { id: dto.templateId, tenantId },
```

The `tenantId` is the requesting user's tenant. Templates are created by Bubble Admin (admin tenant) and published as public. When a tenant user (via impersonation or real login) tries to run a workflow, the template lookup returns null because the tenant IDs don't match. **Result: 404 — tenant users cannot run any workflows.**

Same bug on line 78 for the version lookup: `where: { id: tmpl.currentVersionId, tenantId }`.

**Root cause**: `initiateRun()` was written in Story 4-1/4-3 before the catalog visibility fix existed. When Story 4-FIX-A2 added `findPublishedOne()` to the catalog, nobody audited other template consumers. This is the same "local fix, missed consumers" pattern as Rule 2c violations.

**The correct pattern already exists**: `WorkflowTemplatesService.findPublishedOne()` (lines 337-374) queries `{ where: { id, status: PUBLISHED } }` without `tenantId`, then enforces visibility in application code (public templates pass, private templates check `allowedTenants`). RLS policies (`catalog_read_published` + `template_access`) provide database-level enforcement. This is a documented Rule 2c exception (project-context.md line 112).

**Party mode date**: 2026-02-18
**Attendees**: Murat (lead), Winston, Naz, Amelia, erinc (decision-maker)

## Key Decisions (from party mode)

1. **B1 approach — centralized method**: Add `findPublishedOneEntity()` to `WorkflowTemplatesService` returning raw `{ template: WorkflowTemplateEntity, version: WorkflowVersionEntity }`. Reuses the same visibility check as `findPublishedOne()`. Single source of truth.
2. **Version lookup handled automatically**: `findPublishedOneEntity()` loads both template + version. Version has no `tenantId` in WHERE (inherits authorization from parent template). Matches existing `findPublishedOne()` pattern (line 367).
3. **RLS is already correct**: `template_access` policy allows `visibility = 'public'`, `catalog_read_published` allows published + visible. The bug is in the application-level WHERE clause, not RLS.
4. **Don't touch asset lookups**: `validateAssetIds()` and `resolveSubjectFiles()` correctly use requesting `tenantId` — assets belong to the tenant's data vault. Verified correct, no change.
5. **Chain service bug documented for 4-6**: `workflow-chains.service.ts:290` has the same cross-tenant pattern. Not fixing now (chains are deferred to post-deployment). Must be fixed before building 4-6.
6. **Consumer audit required**: All `findOne(WorkflowTemplateEntity, ...)` call sites must be classified as admin-only (tenantId correct) or cross-tenant (needs fix).

## Acceptance Criteria

1. **AC1**: Tenant users (customer_admin, creator) can initiate a workflow run on an admin-created, publicly-published template without 404.
2. **AC2**: Private templates with `allowedTenants` containing the requesting tenant's ID are runnable.
3. **AC3**: Private templates NOT in `allowedTenants` return 404 (visibility enforcement).
4. **AC4**: Non-published templates (draft, archived) cannot be run — appropriate error returned.
5. **AC5**: `findPublishedOneEntity()` exists on `WorkflowTemplatesService`, reuses catalog visibility logic, returns raw entities.
6. **AC6**: Full consumer audit of `findOne(WorkflowTemplateEntity, ...)` completed and documented in this story.
7. **AC7**: Tier 2 wiring test proves RLS allows non-admin tenant to read a cross-tenant public template + its version.

## Tasks / Subtasks

- [x] 1. Add `findPublishedOneEntity()` to WorkflowTemplatesService (AC: #5)
  - [x] 1.1 Method signature: `findPublishedOneEntity(id: string, requestingTenantId: string): Promise<{ template: WorkflowTemplateEntity, version: WorkflowVersionEntity }>`
  - [x] 1.2 Reuse EXACT visibility logic from `findPublishedOne()`: query `{ id, status: PUBLISHED }` with `withDeleted: false`, check `visibility` + `allowedTenants`, load `currentVersionId` without tenantId
  - [x] 1.3 Throw `NotFoundException` if template not found, not published, or visibility check fails
  - [x] 1.4 Throw `BadRequestException` if `currentVersionId` is null or version not found
  - [x] 1.5 8 unit tests: public found, private+allowed found, private+not-allowed 404, non-published 404, soft-deleted 404, null currentVersionId, version not found, null allowedTenants 404

- [x] 2. Rewire `initiateRun()` to use `findPublishedOneEntity()` (AC: #1, #2, #3, #4)
  - [x] 2.1 Injected `WorkflowTemplatesService` into `WorkflowRunsService` constructor
  - [x] 2.2 Replaced inline template+version lookup with `findPublishedOneEntity(dto.templateId, tenantId)`
  - [x] 2.3 Destructured to `{ template, version }` — rest of `initiateRun()` unchanged
  - [x] 2.4 Updated all mocks, added cross-tenant test (4-LT4-3-UNIT-009), updated error propagation tests
  - [x] 2.5 No module changes needed — `WorkflowRunsModule` already imports `WorkflowsModule` (verified)

- [x] 3. Consumer audit + documentation (AC: #6)
  - [x] 3.1 Grepped all `findOne(WorkflowTemplateEntity` across codebase
  - [x] 3.2 Verified controller `@Roles()` for each call site
  - [x] 3.3 Consumer audit table completed in Dev Notes (7 call sites + 1 new)
  - [x] 3.4 Chain service bug (`workflow-chains.service.ts:290`) documented for Story 4-6
  - [x] 3.5 Updated `project-context.md` Rule 2c exceptions list with `findPublishedOneEntity()`

- [x] 4. Tier 2 wiring test for cross-tenant template read (AC: #7)
  - [x] 4.1 Raw `EntityManager` with `SET LOCAL app.current_tenant` pattern (appDs, non-superuser)
  - [x] 4.2 INTEG-001: Public template cross-tenant read passes (+ version read behavior documented)
  - [x] 4.3 INTEG-002: Private+allowed template visible
  - [x] 4.4 INTEG-003: Private+blocked template returns 0 rows
  - [x] 4.5 INTEG-004: Soft-deleted template — visible via RLS (template_access allows visibility=public), but `deleted_at IS NULL` filter blocks it (application code enforcement via withDeleted:false). Updated AC7 understanding — see Dev Notes.

## Dev Notes

### Architecture

- **DO NOT duplicate visibility logic** — `findPublishedOneEntity()` must be the SINGLE source of truth, alongside existing `findPublishedOne()` (DTO version). If visibility rules change, only one place to update.
- **Transaction isolation**: `findPublishedOneEntity()` opens its own `txManager.run(requestingTenantId, ...)`. This sets `app.current_tenant` to the requesting tenant, which activates RLS. The `catalog_read_published` policy allows SELECT on published+visible templates regardless of `tenant_id` match.
- **No change to credit/enqueue logic**: Everything after the template lookup (credit check, BullMQ enqueue, etc.) continues to use the requesting tenant's `tenantId`. Only the template+version READ is cross-tenant.

### Files to Touch

| File | Change |
|------|--------|
| `apps/api-gateway/src/app/workflows/workflow-templates.service.ts` | Add `findPublishedOneEntity()` method |
| `apps/api-gateway/src/app/workflows/workflow-templates.service.spec.ts` | Tests for new method |
| `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.ts` | Inject + call `findPublishedOneEntity()`, remove inline template lookup |
| `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.spec.ts` | Update mocks + add cross-tenant tests |
| Tier 2 wiring test file | Add cross-tenant template read tests |
| `docs/project-context.md` | Add `findPublishedOneEntity()` as Rule 2c documented exception |

### Critical Rules

- **Rule 2c**: This story creates a NEW documented exception for `findPublishedOneEntity()` — same as existing `findPublishedOne()` exception. Add to project-context.md.
- **Rule 31**: Tier 2 wiring test required for the cross-tenant RLS path.
- **Rule 32**: Fix now — this is the immediate next story.

### RLS Policy Reference

```sql
-- template_access (general USING):
tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
OR visibility = 'public'
OR NULLIF(current_setting('app.current_tenant', true), '')::uuid = ANY(allowed_tenants)
OR current_setting('app.is_admin', true) = 'true'

-- catalog_read_published (SELECT only):
(status = 'published' AND deleted_at IS NULL
 AND (visibility = 'public'
      OR NULLIF(current_setting('app.current_tenant', true), '')::uuid = ANY(allowed_tenants)))
OR current_setting('app.is_admin', true) = 'true'
```

Both policies OR together for SELECT operations. When `app.current_tenant` is a non-admin tenant and the template is `visibility = 'public'`, `template_access` grants access.

### Consumer Audit Template

| Call Site | File:Line | Controller Roles | Admin-Only? | Disposition |
|-----------|-----------|-----------------|-------------|-------------|
| `initiateRun` template+version lookup | `workflow-runs.service.ts:56-59` | BUBBLE_ADMIN, CUSTOMER_ADMIN, CREATOR | No — cross-tenant | **FIXED** — now calls `findPublishedOneEntity()` |
| `workflow-versions.service.ts:39` | createVersion | BUBBLE_ADMIN | Yes | Correct |
| `workflow-versions.service.ts:99` | updateVersion | BUBBLE_ADMIN | Yes | Correct |
| `workflow-chains.service.ts:290` | validateChainStep | BUBBLE_ADMIN | Yes (but cross-tenant when chains ship) | **Doc for 4-6** |
| `workflow-templates.service.ts` | findOne, update, softDelete, restore, publish, rollback | BUBBLE_ADMIN | Yes — all template CRUD is admin-only | Correct |
| `workflow-templates.service.ts` | findPublishedOne / findPublished / findAccessibleByTenant | N/A (catalog) | No — cross-tenant by design | Correct (documented Rule 2c exception) |
| `workflow-templates.service.ts` | findPublishedOneEntity | N/A (run initiation) | No — cross-tenant by design | **NEW Rule 2c exception (this story)** |
| **Audit complete** — grep verified all `findOne(WorkflowTemplateEntity` TypeORM call sites on 2026-02-18. Also grepped `SELECT.*FROM workflow_templates` for raw SQL: zero production raw SQL found (only test helpers and RLS policy definition in `rls-setup.service.ts`). ||||

### Previous Story Intelligence

- **Story 4-FIX-A2** established the `findPublishedOne()` pattern — follow the EXACT same approach for the entity version.
- **Story 4-5** (most recent) had 5 Rule 2c violations in failure paths — be extra careful about tenantId in all WHERE clauses for non-catalog-exception queries.
- **Story 4-RLS-A/B/C** established dual DataSource + RLS enforcement — Tier 2 wiring tests use `project_bubble_wiring_integ_test` database with `bubble_app` role.

### Out-of-Scope

| Item | Tracked In |
|------|-----------|
| Chain service cross-tenant bug (`workflow-chains.service.ts:290`) | Story 4-6 (post-deployment) |
| Consumer Audit as mandatory story section for visibility changes | Epic 4 Retrospective agenda item |
| `findPublished` / `findAccessibleByTenant` — already correct (no tenantId in WHERE) | N/A — verified correct |

### References

- [Source: workflow-runs.service.ts lines 43-88 — the bug]
- [Source: workflow-templates.service.ts lines 337-374 — findPublishedOne correct pattern]
- [Source: rls-setup.service.ts lines 259-269 — template_access policy]
- [Source: rls-setup.service.ts lines 338-349 — catalog_read_published policy]
- [Source: project-context.md lines 111-113 — documented Rule 2c exceptions]

## Test Traceability

| AC | Test File | Test ID | Status |
|----|-----------|---------|--------|
| AC1 | workflow-runs.service.spec.ts | 4-LT4-3-UNIT-009 (cross-tenant run initiation) | PASS |
| AC2 | workflow-templates.service.spec.ts | 4-LT4-3-UNIT-002 (private+allowed returns entities) | PASS |
| AC3 | workflow-templates.service.spec.ts | 4-LT4-3-UNIT-003 (private+not-allowed throws 404) | PASS |
| AC4 | workflow-templates.service.spec.ts | 4-LT4-3-UNIT-004 (non-published throws 404) | PASS |
| AC4 | workflow-templates.service.spec.ts | 4-LT4-3-UNIT-005 (soft-deleted throws 404, withDeleted:false) | PASS |
| AC5 | workflow-templates.service.spec.ts | 4-LT4-3-UNIT-001 (returns { template, version }) | PASS |
| AC5 | workflow-templates.service.spec.ts | 4-LT4-3-UNIT-006 (null currentVersionId error) | PASS |
| AC5 | workflow-templates.service.spec.ts | 4-LT4-3-UNIT-007 (version not found error) | PASS |
| AC5 | workflow-templates.service.spec.ts | 4-LT4-3-UNIT-008 (null allowedTenants treated as blocked) | PASS |
| AC6 | Story doc | Consumer audit table (7 call sites verified) | DONE |
| AC7 | integration-wiring.spec.ts | 4-LT4-3-INTEG-001 (public template cross-tenant read) | PASS |
| AC7 | integration-wiring.spec.ts | 4-LT4-3-INTEG-002 (private+allowed visible) | PASS |
| AC7 | integration-wiring.spec.ts | 4-LT4-3-INTEG-003 (private+blocked returns 0 rows) | PASS |
| AC7 | integration-wiring.spec.ts | 4-LT4-3-INTEG-004 (soft-deleted: visible via RLS, blocked by app code) | PASS |

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Soft-deleted template RLS finding: `template_access` policy allows `visibility='public'` which OR's with `catalog_read_published`, so soft-deleted public templates ARE visible via RLS. Application code's `withDeleted: false` is the enforcement layer. Updated test 4-LT4-3-INTEG-004 and AC7 expectation in story accordingly.
- Tier 3 contract test failures (2 suites, 38 tests) are pre-existing DB connection race conditions — unrelated to this story's changes.

### Code Review Findings
**Pass 1 (Amelia — self-review):**
- A1 (LOW): DRY duplication between `findPublishedOne()` and `findPublishedOneEntity()`. Resolution: TRACKED in Story 4-test-gaps (extract shared visibility helper).

**Pass 2 (Naz — adversarial):**
- N2-1 (MEDIUM): INTEG-001 version read was a non-assertion (conditional if/else). Resolution: FIXED — hard-asserted `toHaveLength(1)` based on `catalog_read_published_versions` RLS policy confirmation.
- N2-2 (MEDIUM): Behavioral drift risk between `findPublishedOne` and `findPublishedOneEntity`. Resolution: FIXED — added KEEP IN SYNC cross-reference comments to both method JSDoc blocks.
- N2-3 (LOW): project-context.md line 112 used stale `restricted` instead of `PRIVATE`. Resolution: FIXED.

**Pass 3 (Murat — test architect):**
- M3-1 (MEDIUM): INTEG-002 only asserted template visibility for private+allowed, not version. Resolution: FIXED — added version read assertion proving `catalog_read_published_versions` allows `allowed_tenants` path.
- M3-2 (LOW): Consumer audit only documented TypeORM grepping, not raw SQL. Resolution: FIXED — grepped `SELECT.*FROM workflow_templates` across all production code, confirmed zero raw SQL; documented in audit table footnote.

### Completion Notes List
- 8 new unit tests for `findPublishedOneEntity()` (4-LT4-3-UNIT-001 through 008)
- 1 new cross-tenant unit test for `initiateRun()` (4-LT4-3-UNIT-009)
- 4 new Tier 2 wiring tests (4-LT4-3-INTEG-001 through 004)
- Total: 13 new tests. All 144 tests in changed files pass (57 + 44 + 43).
- Consumer audit complete: 7 call sites verified, chain service bug documented for 4-6.
- `project-context.md` updated with `findPublishedOneEntity` Rule 2c exception.
- Pass 2 fixes: 3 findings (N2-1, N2-2, N2-3) all fixed.

### File List
| File | Change |
|------|--------|
| `apps/api-gateway/src/app/workflows/workflow-templates.service.ts` | Added `findPublishedOneEntity()` method |
| `apps/api-gateway/src/app/workflows/workflow-templates.service.spec.ts` | 8 new unit tests (001-008) |
| `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.ts` | Rewired `initiateRun()` to call `findPublishedOneEntity()`, removed inline template lookup |
| `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.spec.ts` | Updated mocks, 1 new cross-tenant test (009) |
| `apps/api-gateway/src/app/integration-wiring.spec.ts` | 4 new Tier 2 wiring tests (INTEG-001 through 004) |
| `project-context.md` | Added `findPublishedOneEntity` to Rule 2c exceptions |

### Out-of-Scope
| Item | Tracked In |
|------|-----------
| Chain service cross-tenant bug (`workflow-chains.service.ts:290`) | Story 4-6 (post-deployment) |
| RLS does not block soft-deleted public templates (template_access allows visibility=public) | Accepted — application code `withDeleted:false` is the enforcement layer. Not a security issue since RLS is defense-in-depth, not sole enforcement. |
| DRY duplication between `findPublishedOne()` and `findPublishedOneEntity()` (A1) | Story 4-test-gaps — extract shared private visibility helper |
