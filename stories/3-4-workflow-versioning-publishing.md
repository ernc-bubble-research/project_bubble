# Story 3.4: Workflow Versioning & Publishing

Status: done

## Story

As a **Bubble Admin**,
I want workflows to have a publish/draft lifecycle with version rollback,
so that editing a workflow does not break active runs and I can revert to previous versions if needed.

## CRITICAL CONTEXT

> **The original Epic 3 stories in epics.md are OBSOLETE for node-based references.** The **tech spec** (`_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md`) is the **ONLY authoritative reference** for Epic 3 implementation.

> **Stories 3.1 (Data Foundation) and 3.3 (CRUD API) are DONE.** All entities, DTOs, validators, RLS policies, services, and controllers are in place. This story EXTENDS existing services with publishing lifecycle and rollback logic.

> **This story is backend-only — NO Angular UI.** The UI is Story 3.2 (Workflow Builder Wizard).

> **BEHAVIOR CHANGE from Story 3.3:** In Story 3.3, `createVersion()` ALWAYS auto-updates `currentVersionId` to the newest version. In Story 3.4, this changes: for PUBLISHED templates, creating a new version does NOT auto-update `currentVersionId` — the admin must explicitly publish the new version. For DRAFT templates, auto-update behavior is preserved (since no version is "live" yet).

## Acceptance Criteria

1. **Given** a template in `draft` status with at least one version, **when** I call `POST /admin/workflow-templates/:id/publish`, **then** the template's status transitions to `published` and the response confirms the published state.

2. **Given** a template in `draft` status with NO versions (currentVersionId is null), **when** I call `POST /admin/workflow-templates/:id/publish`, **then** the API returns `400 Bad Request` with message "Cannot publish template without a version."

3. **Given** a template in `published` status, **when** I call `POST /admin/workflow-templates/:id/versions` with a new definition, **then** a new version is created BUT the template's `currentVersionId` remains unchanged (still points to the previously published version). The new version is a "draft version" available for review before publishing.

4. **Given** a template in `published` status with a newer draft version, **when** I call `POST /admin/workflow-templates/:id/publish` with `{ versionId: "uuid-of-new-version" }`, **then** the template's `currentVersionId` is updated to the specified version.

5. **Given** a template in `published` status, **when** I call `POST /admin/workflow-templates/:id/rollback/:versionId`, **then** the template's `currentVersionId` is updated to the specified previous version (which must belong to this template).

6. **Given** a rollback request with a `versionId` that does NOT belong to this template, **when** the API processes it, **then** it returns `404 Not Found` with message "Version not found for this template."

7. **Given** a template status transition via `PATCH /admin/workflow-templates/:id`, **when** the status change is invalid (e.g., `draft→archived`, `published→draft`), **then** the API returns `400 Bad Request` with the valid transitions for the current status.

8. **Given** valid status transitions, **then** the following are enforced:
   - `draft` → `published` (requires at least one version)
   - `published` → `archived`
   - `archived` → `draft` (re-open for editing)

9. **Given** a template in `draft` status, **when** I create a new version, **then** `currentVersionId` IS auto-updated (preserving Story 3.3 behavior for draft templates).

10. **Given** all new endpoints (publish, rollback), **then** each has complete Swagger documentation (`@ApiOperation`, `@ApiResponse` for 200/400/401/403/404).

## Tasks / Subtasks

- [x] Task 1: Add status transition validation to WorkflowTemplatesService (AC: #7, #8)
  - [x] 1.1 Add private `validateStatusTransition(currentStatus, newStatus)` method that enforces: draft→published, published→archived, archived→draft
  - [x] 1.2 Modify existing `update()` method: when `dto.status` is provided, call `validateStatusTransition()` BEFORE applying the change. If transition includes `draft→published`, verify `currentVersionId` is not null (AC #2).
  - [x] 1.3 Return `BadRequestException` with message listing valid transitions for current status when invalid transition attempted

- [x] Task 2: Add `publish()` method to WorkflowTemplatesService (AC: #1, #2, #4)
  - [x] 2.1 `publish(id, tenantId, versionId?)` — within `txManager.run()`:
    - If template status is not `draft` AND not `published`: throw `BadRequestException` ("Only draft or published templates can be published")
    - If template is `draft` and no `currentVersionId` and no `versionId` provided: throw `BadRequestException` ("Cannot publish template without a version")
    - If `versionId` is provided: verify version belongs to this template, update `currentVersionId` to it
    - If `versionId` is NOT provided (draft template): use existing `currentVersionId`
    - Set template status to `published`
    - Save and return response

- [x] Task 3: Add `rollback()` method to WorkflowTemplatesService (AC: #5, #6)
  - [x] 3.1 `rollback(id, tenantId, versionId)` — within `txManager.run()`:
    - Find template (NotFoundException if not found)
    - Verify template is `published` (BadRequestException if not — only published templates can be rolled back)
    - Find version by `versionId` AND verify `templateId` matches (NotFoundException if version doesn't belong to this template)
    - Update template's `currentVersionId` to the specified version
    - Save and return response

- [x] Task 4: Modify `createVersion()` in WorkflowVersionsService (AC: #3, #9)
  - [x] 4.1 After creating the new version, check template's current status:
    - If `status === 'draft'`: auto-update `currentVersionId` (existing behavior)
    - If `status === 'published'` or `status === 'archived'`: do NOT update `currentVersionId` (new behavior — version created as "draft version" for later publishing)
  - [x] 4.2 Return the version response regardless (caller can see the new version was created)

- [x] Task 5: Add `publish` and `rollback` endpoints to WorkflowTemplatesController (AC: #10)
  - [x] 5.1 `POST /:id/publish` — accepts optional `{ versionId?: string }` in body. Calls `workflowTemplatesService.publish(id, tenantId, versionId?)`. Returns `WorkflowTemplateResponseDto`.
  - [x] 5.2 `POST /:id/rollback/:versionId` — calls `workflowTemplatesService.rollback(id, tenantId, versionId)`. Returns `WorkflowTemplateResponseDto`. ParseUUIDPipe on both params.
  - [x] 5.3 Full `@ApiOperation`, `@ApiResponse` decorators (200, 400, 401, 403, 404)

- [x] Task 6: Create PublishWorkflowTemplateDto (AC: #4)
  - [x] 6.1 Create `libs/shared/src/lib/dtos/workflow/publish-workflow-template.dto.ts`
  - [x] 6.2 Fields: `versionId` (optional UUID string, `@IsOptional()`, `@IsUUID()`)
  - [x] 6.3 Export from `libs/shared/src/lib/dtos/workflow/index.ts`

- [x] Task 7: Unit Tests — Service (AC: all)
  - [x] 7.1 Add to existing `workflow-templates.service.spec.ts`:
    - [3.4-UNIT-001] publish: draft template with version → sets status=published
    - [3.4-UNIT-002] publish: draft template without version → throws BadRequestException
    - [3.4-UNIT-003] publish: published template with new versionId → updates currentVersionId
    - [3.4-UNIT-004] publish: archived template → throws BadRequestException
    - [3.4-UNIT-005] publish: versionId that doesn't belong to template → throws NotFoundException
    - [3.4-UNIT-005a] publish: template not found → throws NotFoundException
    - [3.4-UNIT-006] rollback: published template to valid version → updates currentVersionId
    - [3.4-UNIT-007] rollback: version not belonging to template → throws NotFoundException
    - [3.4-UNIT-008] rollback: draft template → throws BadRequestException
    - [3.4-UNIT-008a] rollback: template not found → throws NotFoundException
    - [3.4-UNIT-009] validateStatusTransition: draft→published → allowed
    - [3.4-UNIT-010] validateStatusTransition: published→archived → allowed
    - [3.4-UNIT-011] validateStatusTransition: archived→draft → allowed
    - [3.4-UNIT-012] validateStatusTransition: draft→archived → throws BadRequestException
    - [3.4-UNIT-013] validateStatusTransition: published→draft → throws BadRequestException
    - [3.4-UNIT-014] update with draft template without version → throws BadRequestException on publish via update
  - [x] 7.2 Add to existing `workflow-versions.service.spec.ts`:
    - [3.4-UNIT-015] createVersion: draft template → auto-updates currentVersionId (existing behavior)
    - [3.4-UNIT-016] createVersion: published template → does NOT update currentVersionId

- [x] Task 8: Unit Tests — Controller (AC: #10)
  - [x] 8.1 Add to existing `workflow-templates.controller.spec.ts`:
    - [3.4-UNIT-017] POST /:id/publish delegates to service.publish
    - [3.4-UNIT-018] POST /:id/publish with versionId delegates correctly
    - [3.4-UNIT-019] POST /:id/rollback/:versionId delegates to service.rollback

- [x] Task 9: Unit Tests — PublishWorkflowTemplateDto (AC: #4)
  - [x] 9.1 Add to existing `workflow-query.dto.spec.ts`:
    - [3.4-UNIT-020] valid dto with versionId → passes
    - [3.4-UNIT-021] valid dto without versionId (empty) → passes
    - [3.4-UNIT-022] invalid versionId (not UUID) → returns error

- [x] Task 10: Verify full test suite & lint (AC: all)
  - [x] 10.1 Run all tests across all 4 projects: `npx nx run-many -t test --all`
  - [x] 10.2 Run lint across all 4 projects: `npx nx run-many -t lint --all`
  - [x] 10.3 Report complete metrics: tests, lint errors, AND lint warnings per project

## Dev Notes

### Architecture Patterns to Follow

- **Extend existing services** — DO NOT create new service files. Add `publish()`, `rollback()`, and `validateStatusTransition()` to `WorkflowTemplatesService`. Modify `createVersion()` in `WorkflowVersionsService`.
- **Extend existing controllers** — Add `publish` and `rollback` endpoints to `WorkflowTemplatesController`.
- **Extend existing spec files** — Add new test cases to existing spec files. Only create a new spec file if the existing one exceeds 300 lines.
- **TransactionManager pattern** — All new methods via `txManager.run(tenantId, ...)`.
- **Defense-in-depth** — Include `tenantId` in all WHERE clauses (established in Story 3.3 code review).
- **Runtime enum validation** — Use existing `parseStatus()` method which already validates enum values.
- **BDD test format** — Use Given/When/Then comments in all new test bodies.
- **Test IDs** — `[3.4-UNIT-XXX]` with `[P0]`-`[P3]` priority markers.

### Critical Implementation Details

1. **`createVersion()` behavior change is the most important change.** Currently line 80-83 of `workflow-versions.service.ts` unconditionally updates `currentVersionId`. This must become CONDITIONAL based on template status. Read the template's status BEFORE the update and only auto-update if `status === 'draft'`.

2. **Status transition matrix:**
   ```
   draft     → published  (requires currentVersionId != null)
   published → archived
   archived  → draft      (re-opens for editing)
   ```
   All other transitions are INVALID.

3. **Publish with versionId vs without:**
   - `publish(id, tenantId)` — no versionId: uses existing `currentVersionId`. For draft templates being published for the first time.
   - `publish(id, tenantId, versionId)` — with versionId: updates `currentVersionId` to specified version THEN publishes. For publishing a specific draft version on already-published templates.

4. **Rollback is ONLY for published templates.** It doesn't change the template status — just switches which version is "current". The template stays `published`.

5. **`req.user` shape:** `tenant_id` (snake_case), `userId` (camelCase) — verified in Story 3.3.

6. **Existing `update()` method already accepts `status` changes via `parseStatus()`.** The change is to add transition validation BEFORE applying. The `parseStatus()` method validates the enum value; the new `validateStatusTransition()` validates the allowed transition.

### Entities Already Available (from Story 3.1)

```
libs/db-layer/src/lib/entities/
  workflow-template.entity.ts  — WorkflowTemplateEntity, WorkflowTemplateStatus, WorkflowVisibility
  workflow-version.entity.ts   — WorkflowVersionEntity
```

### Existing Services (from Story 3.3) — Files to MODIFY

```
apps/api-gateway/src/app/workflows/
  workflow-templates.service.ts    — ADD: publish(), rollback(), validateStatusTransition()
  workflow-templates.controller.ts — ADD: publish and rollback endpoints
  workflow-versions.service.ts     — MODIFY: createVersion() conditional currentVersionId update
```

### Existing DTOs — Files to ADD

```
libs/shared/src/lib/dtos/workflow/
  publish-workflow-template.dto.ts — NEW: optional versionId
  index.ts                         — MODIFY: add new export
```

### Previous Story Learnings (from Stories 3.1 and 3.3)

- **`@DeleteDateColumn` behavior:** `.softDelete(id)` sets `deleted_at` automatically. All `find*` queries filter `WHERE deleted_at IS NULL`. Use `withDeleted: true` to include soft-deleted.
- **Defense-in-depth tenantId:** All `findOne` WHERE clauses include `tenantId` (established in 3.3 code review H3/M1).
- **Runtime enum validation:** `parseStatus()` and `parseVisibility()` already exist in `WorkflowTemplatesService`.
- **23505 concurrent handling:** Version creation already catches unique constraint violations.
- **Template existence check:** `findAllByTemplate` already verifies template exists before querying versions.
- **PROCESS RULE:** Present code review findings BEFORE fixing. User chooses action per finding.
- **NO "acceptable for MVP" language.** Quality bar is production-grade.
- **BDD test format (Epic 3+):** Use Given/When/Then comments in test bodies.
- **Test ID format:** `[3.4-UNIT-XXX]` with `[P0]`-`[P3]` priority markers.

### Project Structure Notes

**NEW files (1):**
- `libs/shared/src/lib/dtos/workflow/publish-workflow-template.dto.ts`

**MODIFIED files (4):**
- `apps/api-gateway/src/app/workflows/workflow-templates.service.ts` — add publish(), rollback(), validateStatusTransition()
- `apps/api-gateway/src/app/workflows/workflow-templates.controller.ts` — add publish and rollback endpoints
- `apps/api-gateway/src/app/workflows/workflow-versions.service.ts` — modify createVersion() conditional auto-update
- `libs/shared/src/lib/dtos/workflow/index.ts` — add PublishWorkflowTemplateDto export

**MODIFIED test files (3-4):**
- `apps/api-gateway/src/app/workflows/workflow-templates.service.spec.ts` — add publish/rollback/transition tests
- `apps/api-gateway/src/app/workflows/workflow-templates.controller.spec.ts` — add publish/rollback controller tests
- `apps/api-gateway/src/app/workflows/workflow-versions.service.spec.ts` — add conditional auto-update tests
- `libs/shared/src/lib/dtos/workflow/workflow-query.dto.spec.ts` — add PublishWorkflowTemplateDto validation tests (if under 300 lines)

### References

- [Tech Spec §6.1: WorkflowTemplateEntity](../../_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md)
- [Tech Spec §6.2: WorkflowVersionEntity](../../_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md)
- [project-context.md §2: RLS & TransactionManager Rules](../../project-context.md)
- [Story 3.1: Data Foundation](./3-1-workflow-definition-data-foundation.md)
- [Story 3.3: CRUD API](./3-3-workflow-template-crud-api.md)
- [Epics §3.4: Versioning & Publishing](../../_bmad-output/planning-artifacts/epics.md)
- [Existing WorkflowTemplatesService](../../apps/api-gateway/src/app/workflows/workflow-templates.service.ts)
- [Existing WorkflowVersionsService](../../apps/api-gateway/src/app/workflows/workflow-versions.service.ts)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- All 10 tasks completed. 22 new test cases added (3.4-UNIT-001 through 3.4-UNIT-022, plus 005a and 008a bonus tests).
- Updated existing test [3.3-UNIT-008] to include currentVersionId so it passes new transition validation.
- Status transition validation uses static VALID_TRANSITIONS map on the service class.
- `createVersion()` conditional auto-update: checks `template.status === DRAFT` before updating `currentVersionId`.
- Defense-in-depth: all version lookups include `tenantId` in WHERE clause.
- PublishWorkflowTemplateDto with optional `@IsUUID()` versionId validated via class-validator.
- Full Swagger documentation on both new endpoints (publish, rollback).

### Code Review Fixes (2026-02-02)

- **[H1/H2] Added `tenantId` to all WHERE clauses in `WorkflowVersionsService`** — `createVersion()` template lookup, `findAllByTemplate()` template lookup, and `findOne()` version lookup were all missing `tenantId` in their WHERE conditions. Defense-in-depth violation. Fixed + tests updated.
- **[M1] `publish()` and `rollback()` now load `currentVersion` in response** — Previously returned `currentVersion: undefined` even when `currentVersionId` was set. Now consistent with `findOne()` behavior.
- **[L1] `rollback()` skips no-op save** — When `versionId === template.currentVersionId`, returns immediately without hitting DB save. New test [3.4-UNIT-006a] covers this.
- **[M2/M3] Git discrepancy acknowledged** — `app.module.ts` and `workflow-template-response.dto.ts` are uncommitted Story 3.3 changes mixed into git status. Not a 3.4 issue.
- **2 new tests added**: [3.3-UNIT-017b] (tenantId in findAllByTemplate WHERE), [3.4-UNIT-006a] (no-op rollback)

### Test Metrics

- **Total tests: 530** (db-layer: 21, shared: 53, web: 137, api-gateway: 319)
- **0 lint errors** across all 5 projects
- **Lint warnings**: 14 shared (pre-existing), 65 api-gateway (pre-existing), 0 web, 0 db-layer, 0 worker-engine

### File List

**NEW (1):**
- `libs/shared/src/lib/dtos/workflow/publish-workflow-template.dto.ts`

**MODIFIED (7):**
- `apps/api-gateway/src/app/workflows/workflow-templates.service.ts` — added `validateStatusTransition()`, `publish()`, `rollback()`; modified `update()` to enforce transitions; review: publish/rollback now load currentVersion, rollback skips no-op save
- `apps/api-gateway/src/app/workflows/workflow-templates.controller.ts` — added `POST /:id/publish` and `POST /:id/rollback/:versionId` endpoints
- `apps/api-gateway/src/app/workflows/workflow-versions.service.ts` — conditional `currentVersionId` auto-update (draft only); review: added `tenantId` to all WHERE clauses (createVersion, findAllByTemplate, findOne)
- `libs/shared/src/lib/dtos/workflow/index.ts` — added `PublishWorkflowTemplateDto` export
- `apps/api-gateway/src/app/workflows/workflow-templates.service.spec.ts` — 17 new tests (publish, rollback, transition validation, no-op rollback)
- `apps/api-gateway/src/app/workflows/workflow-templates.controller.spec.ts` — 3 new tests (controller delegation)
- `apps/api-gateway/src/app/workflows/workflow-versions.service.spec.ts` — 3 new tests (conditional auto-update, tenantId in findAllByTemplate)
- `libs/shared/src/lib/dtos/workflow/workflow-query.dto.spec.ts` — 3 new tests (PublishWorkflowTemplateDto validation)
