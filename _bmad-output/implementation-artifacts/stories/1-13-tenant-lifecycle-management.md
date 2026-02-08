# Story 1-13: Tenant Lifecycle Management

Status: complete

## Story

**As a** Bubble Admin,
**I want** to archive and permanently delete tenants,
**So that** I can manage churned customers and comply with GDPR/data privacy requirements.

## Background

Tenant management currently supports create, read, update, and suspend/unsuspend. The suspend/unsuspend flow is **already implemented** (TenantStatus enum, UpdateTenantDto, frontend toggle + confirmation dialog, list filtering). What's missing:

- **Archived state**: A soft-delete state that preserves data but hides the tenant from normal operations. Reversible.
- **Hard delete**: Permanent, irreversible removal of a tenant and ALL associated data (GDPR right to erasure).
- **Auth blocking**: Suspended/archived tenant users are not currently blocked at the auth layer — they can still log in and make API calls.

**Party Mode Pre-Dev Review (2026-02-08):** 7 findings incorporated — acknowledged existing suspend/unsuspend implementation, defined explicit state machine, decided auth check approach (NestJS Guard), enumerated all 9 tenant-scoped entities for cascade delete, removed wrong assumptions (no S3, no migration scripts, synchronize:true).

### Already Implemented (DO NOT rebuild)

| Feature | Where |
|---------|-------|
| `TenantStatus` enum (`ACTIVE`, `SUSPENDED`) | `libs/db-layer/src/lib/entities/tenant.entity.ts` |
| `status` field in `UpdateTenantDto` with `@IsIn(['active', 'suspended'])` | `libs/shared/src/lib/dtos/tenant/update-tenant.dto.ts` |
| `status` in shared `Tenant` interface | `libs/shared/src/lib/types/tenant.types.ts` |
| Frontend suspend/unsuspend toggle + confirmation dialog | `tenant-detail.component.ts` (`confirmSuspendToggle()`) |
| Frontend status filter (all/active/suspended) with counts | `tenant-list.component.ts` (`filter`, `filteredTenants`) |
| Status badge component | `app-status-badge` used in list + detail |
| Impersonation blocks suspended tenants | `tenants.service.ts` (`impersonate()`) |

## Acceptance Criteria

1. **Archived Status** — `TenantStatus` enum extended with `ARCHIVED`. Shared `Tenant` interface and frontend types updated to include `'archived'`. `UpdateTenantDto` `@IsIn` validator remains `['active', 'suspended']` only — archived state is managed exclusively via dedicated endpoints.
2. **Archive Tenant** — Admin can archive a tenant via `PATCH /api/admin/tenants/:id/archive`. Allowed from `active` or `suspended` state. Sets status to `archived`.
3. **Unarchive Tenant** — Admin can restore an archived tenant via `PATCH /api/admin/tenants/:id/unarchive`. Sets status to `active`.
4. **Hard Delete** — Admin can permanently delete a tenant via `DELETE /api/admin/tenants/:id`. Only allowed when status is `archived`. Returns 400 if tenant is not archived. Returns 404 if tenant does not exist (inherited from `findOne()`).
5. **Cascade Delete** — Hard delete removes ALL tenant-scoped data across 9 entity types (users, folders, assets, workflow templates, workflow versions, workflow chains, workflow runs, knowledge chunks, invitations) plus physical files from local storage. Executed in a database transaction.
6. **Tenant Status Guard** — A new `TenantStatusGuard` checks tenant status on every authenticated request for non-admin users. Returns 403 with `"Account suspended"` or `"Account archived"` message. Bubble Admin users bypass this check.
7. **Frontend: Archive/Delete Controls** — Tenant detail page shows Archive/Unarchive button (conditionally based on status) and Delete button (only for archived tenants). Delete requires typing the tenant name to confirm.
8. **Frontend: Archived Filter** — Tenant list filter tabs extended with "Archived" option and count. Archived tenants shown with distinct visual styling (muted/greyed).

## State Machine

```
                 ┌─── suspend ───┐
                 v               │
    ┌─────────────────┐    ┌──────────┐
    │     ACTIVE      │    │SUSPENDED │
    └────────┬────────┘    └────┬─────┘
             │                  │
             │    unsuspend     │
             │◄─────────────────┘
             │
             ├──── archive ────►┌──────────┐
             │                  │ ARCHIVED │◄── archive (from suspended)
             │◄── unarchive ────┘────┬─────┘
                                     │
                                hard delete
                                     │
                                     v
                               [DELETED]
                            (terminal, irreversible)
```

**Transitions:**
- `active -> suspended` (existing)
- `suspended -> active` (existing)
- `active -> archived` (new)
- `suspended -> archived` (new)
- `archived -> active` (new — unarchive always restores to active)
- `archived -> [deleted]` (new — permanent, requires archived status)

## Tasks / Subtasks

- [x] Task 1: Extend TenantStatus enum + update shared types (AC: 1)
  - [x] 1.1: Add `ARCHIVED = 'archived'` to `TenantStatus` enum in `tenant.entity.ts`
  - [x] 1.2: Verify `UpdateTenantDto` validator `@IsIn` remains `['active', 'suspended']` only — archived status is managed exclusively via dedicated `/archive` and `/unarchive` endpoints (prevents bypassing the state machine via generic PATCH)
  - [x] 1.3: Update shared `Tenant` interface status type to `'active' | 'suspended' | 'archived'`
  - [x] 1.4: Update shared `UpdateTenantPayload` type if needed

- [x] Task 2: Backend archive/unarchive/delete endpoints (AC: 2, 3, 4)
  - [x] 2.1: Add `archive(id)` method to `TenantsService` — validates current status is `active` or `suspended`, sets to `archived`
  - [x] 2.2: Add `unarchive(id)` method to `TenantsService` — validates current status is `archived`, sets to `active`
  - [x] 2.3: Add `hardDelete(id)` method to `TenantsService` — validates current status is `archived`, delegates to cascade delete, then removes tenant row
  - [x] 2.4: Add `PATCH :id/archive` endpoint to `TenantsController`
  - [x] 2.5: Add `PATCH :id/unarchive` endpoint to `TenantsController`
  - [x] 2.6: Add `DELETE :id` endpoint to `TenantsController`
  - [x] 2.7: Update impersonate to also block archived tenants
  - [x] 2.8: Add `@ApiResponse` decorators for all new endpoints (200, 400, 401, 403, 404)

- [x] Task 3: Cascade delete implementation (AC: 5)
  - [x] 3.1: Delete all `InvitationEntity` where `tenant_id = X`
  - [x] 3.2: Delete all `WorkflowRunEntity` where `tenant_id = X`
  - [x] 3.3: Delete all `WorkflowChainEntity` where `tenant_id = X` (include soft-deleted via `withDeleted`)
  - [x] 3.4: Delete all `WorkflowVersionEntity` where `tenant_id = X`
  - [x] 3.5: Delete all `WorkflowTemplateEntity` where `tenant_id = X` (include soft-deleted via `withDeleted`)
  - [x] 3.6: Delete all `KnowledgeChunkEntity` where `tenant_id = X` (include soft-deleted)
  - [x] 3.7: Delete all `AssetEntity` where `tenant_id = X`
  - [x] 3.8: Delete all physical files from `uploads/<tenantId>/` directory
  - [x] 3.9: Delete all `FolderEntity` where `tenant_id = X`
  - [x] 3.10: Delete all `UserEntity` where `tenant_id = X`
  - [x] 3.11: Wrap all DB deletions in a single transaction via raw query or EntityManager
  - [x] 3.12: Delete physical files AFTER successful DB transaction (cannot roll back file system)

- [x] Task 4: Tenant Status Guard (AC: 6)
  - [x] 4.1: Create `TenantStatusGuard` in `apps/api-gateway/src/app/guards/` — must return `true` (pass through) when `request.user` is undefined (unauthenticated routes like login, health check)
  - [x] 4.2: Guard reads `request.user.tenantId` and queries `TenantEntity.status`
  - [x] 4.3: If status is `suspended` → throw `ForbiddenException('Account suspended. Contact your administrator.')`
  - [x] 4.4: If status is `archived` → throw `ForbiddenException('Account archived. Contact your administrator.')`
  - [x] 4.5: Bypass check for `BUBBLE_ADMIN` role (they manage all tenants)
  - [x] 4.6: Register guard globally via `APP_GUARD` in the app module (runs after JwtAuthGuard)

- [x] Task 5: Frontend updates (AC: 7, 8)
  - [x] 5.1: Add `archive(id)`, `unarchive(id)`, `hardDelete(id)` methods to `TenantService`
  - [x] 5.2: Add "Archived" filter tab to `tenant-list.component` with `archivedCount` computed signal
  - [x] 5.3: Add visual distinction for archived tenants in list (muted row styling)
  - [x] 5.4: Add Archive/Unarchive button to `tenant-detail.component` header (conditionally shown based on status)
  - [x] 5.4a: Update existing `confirmSuspendToggle()` and suspend/unsuspend button to only show when status is `active` or `suspended` (hide for archived tenants — the current binary toggle assumes only 2 states)
  - [x] 5.5: Add Delete button to `tenant-detail.component` (only shown when status is `archived`)
  - [x] 5.6: Create delete confirmation dialog — requires typing tenant name to confirm, explains irreversibility
  - [x] 5.7: Update `StatusBadgeComponent` to handle `'archived'` status (new color variant)
  - [x] 5.8: Add `data-testid` attributes to all new interactive elements
  - [x] 5.9: Add info tooltips to Archive and Delete buttons explaining consequences

- [x] Task 6: Unit tests (AC: 1-8)
  - [x] 6.1: Service tests: archive, unarchive, hardDelete, invalid transitions (e.g., archive already-archived)
  - [x] 6.2: Controller tests: new endpoints, HTTP status codes, error responses
  - [x] 6.3: TenantStatusGuard tests: suspended → 403, archived → 403, active → pass, admin bypass
  - [x] 6.4: Cascade delete tests: verify all entity repositories called with correct tenant_id
  - [x] 6.5: Frontend component tests: button visibility per state, filter tab counts, delete dialog

## Dev Notes

### Existing Code to Modify

| File | What Changes |
|------|-------------|
| `libs/db-layer/src/lib/entities/tenant.entity.ts` | Add `ARCHIVED` to `TenantStatus` enum |
| `libs/shared/src/lib/dtos/tenant/update-tenant.dto.ts` | Keep `@IsIn` as `['active', 'suspended']` — no change needed (archived managed via dedicated endpoints) |
| `libs/shared/src/lib/types/tenant.types.ts` | Extend `Tenant.status` union type |
| `apps/api-gateway/src/app/tenants/tenants.service.ts` | Add archive, unarchive, hardDelete methods |
| `apps/api-gateway/src/app/tenants/tenants.controller.ts` | Add 3 new endpoints |
| `apps/api-gateway/src/app/tenants/tenants.module.ts` | Import entities needed for cascade delete |
| `apps/web/src/app/core/services/tenant.service.ts` | Add archive, unarchive, hardDelete HTTP methods |
| `apps/web/src/app/admin/tenants/tenant-list.component.ts` | Add archived filter + count |
| `apps/web/src/app/admin/tenants/tenant-list.component.html` | Add archived tab + muted row styling |
| `apps/web/src/app/admin/tenants/tenant-detail.component.ts` | Add archive/unarchive/delete logic |
| `apps/web/src/app/admin/tenants/tenant-detail.component.html` | Add archive/unarchive/delete buttons + dialog |
| `apps/web/src/app/admin/tenants/tenant-detail.component.scss` | Styles for delete dialog |

### New Files

| File | Description |
|------|-------------|
| `apps/api-gateway/src/app/guards/tenant-status.guard.ts` | TenantStatusGuard — blocks suspended/archived tenant users |
| `apps/api-gateway/src/app/tenants/tenants.service.spec.ts` | Service unit tests (if not existing, or extend) |
| `apps/api-gateway/src/app/tenants/tenants.controller.spec.ts` | Controller unit tests (if not existing, or extend) |
| `apps/api-gateway/src/app/guards/tenant-status.guard.spec.ts` | Guard unit tests |
| `apps/web/src/app/admin/tenants/delete-confirm-dialog.component.ts` | Delete confirmation dialog — requires typing tenant name to confirm |

### Architecture & Pattern Notes

- **No database migrations.** The project uses `synchronize: true` in development. Adding `ARCHIVED` to the TypeORM enum will auto-sync the `tenant_status_enum` type in PostgreSQL. Production migration story is 7P-1.
- **No S3/cloud storage.** Files are stored locally at `uploads/<tenantId>/`. Physical file deletion uses `fs.rm(path, { recursive: true })` on the tenant's upload directory. Cloud storage migration is Story 7P-2.
- **Cascade delete is synchronous.** For the current project scale (dev/prototype), cascade delete runs synchronously within the DELETE request. Background job via BullMQ deferred to Epic 4 when the queue infrastructure is production-ready. Rationale: adding a BullMQ job for a prototype-only feature adds complexity with no user benefit — there are no large tenants yet.
- **Transaction scope.** All DB deletions happen inside a single `EntityManager` transaction (via `manager.getRepository()` pattern or raw queries). Physical file deletion happens AFTER the transaction commits successfully. Rationale: file system operations cannot be rolled back — if the DB transaction fails, no files should be deleted. If file deletion fails after DB commit, the orphaned files are acceptable (data is already gone from DB).
- **Soft-deleted entities.** `WorkflowTemplateEntity` and `WorkflowChainEntity` use `@DeleteDateColumn`. `KnowledgeChunkEntity` uses manual `deleted_at`. Cascade delete MUST use `withDeleted: true` (or raw queries) to also remove soft-deleted records. Rationale: GDPR hard delete means ALL data, including soft-deleted records.
- **TenantStatusGuard approach.** A NestJS Guard registered globally via `APP_GUARD` that runs after `JwtAuthGuard`. On each request: reads `request.user.tenantId`, queries `tenants` table for status, throws 403 if suspended/archived. Bubble Admin users (role `bubble_admin`) bypass the check entirely. Rationale: Guard is cleaner than modifying the interceptor; query cost is acceptable at current scale (~1 extra SELECT per request); no caching needed until load testing (7P-7) identifies it as a bottleneck.
- **Guard ordering.** The guard must run AFTER `JwtAuthGuard` (needs `request.user` populated). Register with low priority or ensure module ordering: `JwtAuthGuard` → `TenantStatusGuard` → route guards (AdminApiKeyGuard, RolesGuard). The guard should be a no-op (pass through) when `request.user` is undefined (unauthenticated routes like login).
- **TenantsService uses raw Repository** (exempted from TransactionManager rule). The `tenants` table has no `tenant_id` column and no RLS policy. However, cascade delete queries other tenant-scoped entities — these queries should use the EntityManager from the transaction, NOT the TransactionManager (since we're deleting across all entities for a specific tenant, not operating within RLS context).

### Cascade Delete Entity Order

Deletion order matters due to foreign key constraints. Delete in this order:

1. `InvitationEntity` (no FK dependencies)
2. `WorkflowRunEntity` (references WorkflowVersion, WorkflowChain — but these are nullable FKs)
3. `KnowledgeChunkEntity` (FK to AssetEntity with CASCADE, but delete explicitly to include soft-deleted)
4. `AssetEntity` (FK to FolderEntity with SET NULL)
5. `WorkflowVersionEntity` (FK to WorkflowTemplate with CASCADE, but delete explicitly)
6. `WorkflowChainEntity` (no FK to other tenant entities)
7. `WorkflowTemplateEntity` (after versions are deleted)
8. `FolderEntity` (self-referential parentId — delete children first or delete all at once)
9. `UserEntity` (last — referenced by createdBy/uploadedBy but these are not enforced FKs)
10. Physical files: `uploads/<tenantId>/` directory
11. `TenantEntity` itself (the row in tenants table)

### Key Design Decisions

1. **Unarchive always restores to `active`** (not to previous state). Rationale: tracking previous state adds complexity for no user value. If the admin wants the tenant suspended after unarchive, they can suspend it separately.
2. **Hard delete requires `archived` status.** Rationale: two-step safety — admin must first archive (reversible), then explicitly delete (irreversible). Prevents accidental deletion of active tenants.
3. **Delete confirmation requires typing tenant name.** Rationale: standard pattern for destructive actions (GitHub repo deletion, AWS resource deletion). Prevents misclicks.
4. **No audit trail in this story.** Audit logging is deferred to Epic 7 Story 7-2 (cross-cutting concern for ALL admin actions). The logger.warn pattern used for impersonation is acceptable interim.

### References

- [Source: libs/db-layer/src/lib/entities/tenant.entity.ts] — TenantEntity with existing TenantStatus enum
- [Source: apps/api-gateway/src/app/tenants/tenants.service.ts] — Existing CRUD + impersonate
- [Source: apps/api-gateway/src/app/tenants/tenants.controller.ts] — Existing endpoints
- [Source: apps/web/src/app/admin/tenants/tenant-detail.component.ts] — Existing suspend/unsuspend UI
- [Source: apps/web/src/app/admin/tenants/tenant-list.component.ts] — Existing status filter
- [Source: project-context.md:Rule 2] — TenantsService is exempt from TransactionManager (no tenant_id column)

## Test Traceability

| AC | Test ID | Test File | Test Description | Status |
|----|---------|-----------|------------------|--------|
| AC1 | 1-13-UNIT-001a | tenants.service.spec.ts | impersonate() throws BadRequestException for archived tenant | PASS |
| AC2 | 1-13-UNIT-002 | tenants.service.spec.ts | archive() sets status to archived from active | PASS |
| AC2 | 1-13-UNIT-002a | tenants.service.spec.ts | archive() sets status to archived from suspended | PASS |
| AC2 | 1-13-UNIT-002b | tenants.service.spec.ts | archive() rejects already-archived tenant | PASS |
| AC2 | 1-13-UNIT-002c | tenants.service.spec.ts | archive() throws NotFoundException for missing tenant | PASS |
| AC3 | 1-13-UNIT-003 | tenants.service.spec.ts | unarchive() sets status to active from archived | PASS |
| AC3 | 1-13-UNIT-003a | tenants.service.spec.ts | unarchive() rejects non-archived tenant | PASS |
| AC4 | 1-13-UNIT-004 | tenants.service.spec.ts | hardDelete() deletes archived tenant | PASS |
| AC4 | 1-13-UNIT-004a | tenants.service.spec.ts | hardDelete() rejects non-archived tenant | PASS |
| AC4 | 1-13-UNIT-004b | tenants.service.spec.ts | hardDelete() throws NotFoundException for missing tenant | PASS |
| AC5 | 1-13-UNIT-005 | tenants.service.spec.ts | hardDelete() cascade deletes all 9 entity types in transaction | PASS |
| AC5 | 1-13-UNIT-005a | tenants.service.spec.ts | hardDelete() deletes physical files after DB transaction | PASS |
| AC5 | 1-13-UNIT-005b | tenants.service.spec.ts | hardDelete() does not throw if physical file deletion fails | PASS |
| AC6 | 1-13-GUARD-001 | tenant-status.guard.spec.ts | Guard passes through when no user (unauthenticated route) | PASS |
| AC6 | 1-13-GUARD-002 | tenant-status.guard.spec.ts | Guard bypasses for BUBBLE_ADMIN role | PASS |
| AC6 | 1-13-GUARD-003 | tenant-status.guard.spec.ts | Guard passes through when user has no tenantId | PASS |
| AC6 | 1-13-GUARD-004 | tenant-status.guard.spec.ts | Guard passes through when tenant not found | PASS |
| AC6 | 1-13-GUARD-005 | tenant-status.guard.spec.ts | Guard allows active tenant | PASS |
| AC6 | 1-13-GUARD-006 | tenant-status.guard.spec.ts | Guard throws ForbiddenException for suspended tenant | PASS |
| AC6 | 1-13-GUARD-007 | tenant-status.guard.spec.ts | Guard throws ForbiddenException for archived tenant | PASS |
| AC6 | 1-13-GUARD-008 | tenant-status.guard.spec.ts | Guard queries tenant with correct id and select fields | PASS |
| AC2 | 1-13-CTRL-001 | tenants.controller.spec.ts | Archive a tenant | PASS |
| AC2 | 1-13-CTRL-002 | tenants.controller.spec.ts | Propagate BadRequestException for invalid archive transition | PASS |
| AC3 | 1-13-CTRL-003 | tenants.controller.spec.ts | Unarchive a tenant | PASS |
| AC3 | 1-13-CTRL-004 | tenants.controller.spec.ts | Propagate BadRequestException for non-archived tenant (unarchive) | PASS |
| AC4 | 1-13-CTRL-005 | tenants.controller.spec.ts | Hard delete an archived tenant | PASS |
| AC4 | 1-13-CTRL-006 | tenants.controller.spec.ts | Propagate BadRequestException for non-archived tenant (delete) | PASS |
| AC4 | 1-13-CTRL-007 | tenants.controller.spec.ts | Propagate NotFoundException for missing tenant | PASS |
| AC7 | 1-13-UNIT-DET-001 | tenant-detail.component.spec.ts | Show Archive button for active tenant | PASS |
| AC7 | 1-13-UNIT-DET-002 | tenant-detail.component.spec.ts | Show Suspend button for active tenant | PASS |
| AC7 | 1-13-UNIT-DET-003 | tenant-detail.component.spec.ts | NOT show Delete button for active tenant | PASS |
| AC7 | 1-13-UNIT-DET-004 | tenant-detail.component.spec.ts | NOT show Unarchive button for active tenant | PASS |
| AC7 | 1-13-UNIT-DET-005 | tenant-detail.component.spec.ts | Open archive confirmation dialog | PASS |
| AC7 | 1-13-UNIT-DET-006 | tenant-detail.component.spec.ts | Call tenantService.archive on confirmArchive | PASS |
| AC7 | 1-13-UNIT-DET-007 | tenant-detail.component.spec.ts | Show Unarchive button for archived tenant | PASS |
| AC7 | 1-13-UNIT-DET-008 | tenant-detail.component.spec.ts | Show Delete button for archived tenant | PASS |
| AC7 | 1-13-UNIT-DET-009 | tenant-detail.component.spec.ts | NOT show Suspend button for archived tenant | PASS |
| AC7 | 1-13-UNIT-DET-010 | tenant-detail.component.spec.ts | NOT show Archive button for archived tenant | PASS |
| AC7 | 1-13-UNIT-DET-011 | tenant-detail.component.spec.ts | Disable Impersonate for archived tenant | PASS |
| AC7 | 1-13-UNIT-DET-012 | tenant-detail.component.spec.ts | Open delete dialog | PASS |
| AC7 | 1-13-UNIT-DET-013 | tenant-detail.component.spec.ts | Call tenantService.unarchive on confirmUnarchive | PASS |
| AC8 | 1-13-UNIT-LIST-001 | tenant-list.component.spec.ts | Render archived filter tab | PASS |
| AC8 | 1-13-UNIT-LIST-002 | tenant-list.component.spec.ts | Apply muted styling to archived tenant rows | PASS |

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Story created from Epic 3 discussion item #3 |
| 2026-02-08 | Party Mode (Opus 4.6) | Complete rewrite. Acknowledged existing suspend/unsuspend. Defined state machine, auth guard approach, cascade delete order. 8 ACs, 6 tasks, 36 subtasks. |
| 2026-02-08 | Party Mode Review #2 (Opus 4.6) | 6 fixes: (HIGH) kept 'archived' out of UpdateTenantDto to enforce state machine; (MEDIUM) added subtask 5.4a for suspend toggle 3-state; (MEDIUM) added 8 missing test IDs (controller, impersonate, dialog, guard no-op); (LOW) added DeleteConfirmDialogComponent to New Files; (LOW) clarified guard no-op for unauthenticated routes; (LOW) added 404 to AC4. Now 25 test cases, 37 subtasks. |
| 2026-02-08 | Code Review (Opus 4.6) | 7 findings: (H1) TenantStatusGuard as APP_GUARD was no-op — moved to controller-level @UseGuards on 8 tenant-facing controllers; (M2) AssetEntity.workflowRunId FK cascade — deferred to Epic 4; (M3→L) FormsModule unused import removed; (M4→L) Guard clause added to confirmSuspendToggle(); (L5) Traceability table updated with 44 real test IDs; (L6) setTimeout pre-existing — dismissed; (L7) data-testid added to archive cancel button. Party mode validated: 5 fixed, 1 deferred, 1 dismissed. 880 total tests, 0 lint errors. |
