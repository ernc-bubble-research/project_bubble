# Story 3.5: Workflow Visibility & Access Control

Status: ready-for-dev

## Story

As a **Bubble Admin**,
I want to configure which tenants can access each workflow template via visibility settings and a tenant allow-list,
so that I can offer different workflow libraries to different customers while maintaining centralized control.

## CRITICAL CONTEXT

> **Stories 3.1 (Data Foundation), 3.3 (CRUD API), and 3.4 (Versioning & Publishing) are DONE.** The entity fields (`visibility`, `allowedTenants`), RLS custom policy (`template_access`), DTOs, and PATCH update endpoint already exist. This story validates end-to-end behavior, adds a dedicated visibility management endpoint, adds a tenant-accessible workflow catalog endpoint, and ensures the Tenant Entitlements tab shows accessible workflows.

> **The tech spec** (`_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md`) is the authoritative reference.

> **This story is backend-focused.** The Admin UI visibility configuration is part of Story 3.2 (Workflow Builder Wizard) and Story 3.7 (Template Library). This story builds the API layer and validates RLS enforcement. The only UI addition is a read-only "Accessible Workflows" section on the Tenant Entitlements tab (Story 1.5).

> **The custom RLS policy `template_access` already exists** in `rls-setup.service.ts`. It allows: own-tenant templates, public templates, and templates where current tenant is in `allowed_tenants`. This story validates that policy works correctly through integration-level tests and builds API endpoints that rely on it.

## Acceptance Criteria

1. **Given** I am editing a workflow template via `PATCH /admin/workflow-templates/:id`, **when** I set `visibility: "private"` without providing `allowedTenants`, **then** the template is saved with `visibility=private` and `allowedTenants=null` (effectively visible to NO other tenants — only the owning tenant).

2. **Given** I am editing a workflow template, **when** I set `visibility: "private"` and `allowedTenants: ["tenant-uuid-1", "tenant-uuid-2"]`, **then** the template is only accessible to those two tenants AND the owning tenant.

3. **Given** the custom RLS policy `template_access` on `workflow_templates`, **when** a tenant queries templates (via the Creator workflow catalog), **then** they see: (a) templates where `visibility=public`, (b) templates where their `tenant_id` is in `allowed_tenants`, (c) templates owned by their own `tenant_id`. They do NOT see private templates from other tenants that don't include them.

4. **Given** an authenticated Creator or Customer Admin, **when** they call `GET /app/workflow-templates`, **then** they receive a list of published workflow templates accessible to their tenant (RLS-enforced), with visibility badges indicating public/private.

5. **Given** a Bubble Admin viewing the template list (`GET /admin/workflow-templates`), **then** each template response already includes `visibility` and `allowedTenants` fields (no new work — already satisfied by existing `WorkflowTemplateResponseDto` from Story 3.3). This AC is pre-satisfied.

6. **Given** a Bubble Admin on the Tenant Detail page (Story 1.5 entitlements), **when** they view the "Accessible Workflows" section, **then** they see a read-only list of workflow templates accessible to that tenant (public + specifically allowed).

7. **Given** all new endpoints, **then** each has complete Swagger documentation (`@ApiOperation`, `@ApiResponse` for 200/400/401/403).

## Tasks / Subtasks

- [ ] Task 1: Create tenant-facing Workflow Catalog endpoint (AC: #3, #4, #7)
  - [ ] 1.1 Create `apps/api-gateway/src/app/workflows/workflow-catalog.controller.ts` — `@Controller('app/workflow-templates')`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(UserRole.BUBBLE_ADMIN, UserRole.CUSTOMER_ADMIN, UserRole.CREATOR)`
  - [ ] 1.2 `GET /` — calls a new `findPublished(tenantId, query)` method on WorkflowTemplatesService. Returns published templates accessible to the calling tenant. RLS policy handles filtering automatically.
  - [ ] 1.3 Accept optional query params: `limit` (default 50, max 200), `offset` (default 0) — reuse `ListWorkflowTemplatesQueryDto` but status is implicitly `published` (not filterable).
  - [ ] 1.4 Full Swagger decorators: `@ApiTags('Workflow Catalog')`, `@ApiBearerAuth()`, `@ApiOperation`, `@ApiResponse` (200, 401, 403)

- [ ] Task 2: Add `findPublished()` method to WorkflowTemplatesService (AC: #3, #4)
  - [ ] 2.1 `findPublished(tenantId, query)` — within `txManager.run(tenantId, ...)`:
    - QueryBuilder on WorkflowTemplateEntity
    - `.andWhere('template.status = :status', { status: 'published' })` — only published
    - `.andWhere('template.deleted_at IS NULL')` — exclude soft-deleted
    - `.take(query.limit)` / `.skip(query.offset)`
    - `.orderBy('template.updatedAt', 'DESC')`
    - **DO NOT** eagerly load `currentVersion` relation — this is a list/catalog view, not a detail view. Loading full YAML definitions per template would be wasteful.
    - RLS custom policy automatically enforces visibility (public + allowed_tenants + own tenant)
  - [ ] 2.2 Response maps to `WorkflowTemplateResponseDto[]` (with `currentVersion: undefined` since relation is not loaded)

- [ ] Task 3: Add tenant-accessible-workflows endpoint to TenantsController (AC: #6, #7)
  - [ ] 3.1 Add `GET /admin/tenants/:id/accessible-workflows` to `TenantsController`
  - [ ] 3.2 Implementation: call `workflowTemplatesService.findAccessibleByTenant(tenantId)` — within `txManager.run(tenantId, ...)` find all published templates visible to that tenant (same RLS logic — run query AS that tenant)
  - [ ] 3.3 Returns `WorkflowTemplateResponseDto[]` — name, description, visibility, status
  - [ ] 3.4 Full Swagger decorators (200, 400, 401, 403, 404)

- [ ] Task 4: Add `findAccessibleByTenant()` to WorkflowTemplatesService (AC: #6)
  - [ ] 4.1 `findAccessibleByTenant(tenantId)` — can delegate to `findPublished(tenantId, { limit: 200, offset: 0 })` to avoid duplicating QueryBuilder logic. Alternatively, implement directly within `txManager.run(tenantId, ...)`:
    - QueryBuilder: `WHERE status = 'published' AND deleted_at IS NULL`
    - RLS enforces tenant visibility automatically
    - `.orderBy('template.name', 'ASC')`
    - **DO NOT** load `currentVersion` relation (same as `findPublished`)
  - [ ] 4.2 Returns mapped `WorkflowTemplateResponseDto[]`

- [ ] Task 5: Validate visibility enforcement with private+allowedTenants (AC: #1, #2, #3)
  - [ ] 5.1 Add validation in `update()`: when `visibility` is set to `public`, auto-clear `allowedTenants` to `null` (public templates don't need allow-lists)
  - [ ] 5.2 Validate all UUIDs in `allowedTenants` are well-formed (already handled by DTO `@IsUUID('4', { each: true })`)

- [ ] Task 6: Inject WorkflowTemplatesService into TenantsModule (AC: #6)
  - [ ] 6.1 Add `WorkflowsModule` to `TenantsModule` imports (or use `forwardRef` if circular)
  - [ ] 6.2 Inject `WorkflowTemplatesService` into `TenantsController`
  - [ ] 6.3 If circular dependency arises, create a lightweight `WorkflowAccessService` in a shared module instead

- [ ] Task 7: Unit Tests — WorkflowTemplatesService (AC: #1, #2, #3, #4)
  - [ ] 7.1 Add to `workflow-templates.service.spec.ts`:
    - [3.5-UNIT-001] findPublished: returns only published templates (via txManager with tenantId)
    - [3.5-UNIT-002] findPublished: respects pagination limit/offset
    - [3.5-UNIT-003] findAccessibleByTenant: returns templates accessible to specific tenant
    - [3.5-UNIT-004] update: setting visibility=private preserves allowedTenants
    - [3.5-UNIT-005] update: setting visibility=public clears allowedTenants to null

- [ ] Task 8: Unit Tests — Workflow Catalog Controller (AC: #4, #7)
  - [ ] 8.1 Create `apps/api-gateway/src/app/workflows/workflow-catalog.controller.spec.ts`:
    - [3.5-UNIT-006] GET / delegates to service.findPublished with tenantId from JWT
    - [3.5-UNIT-007] GET / passes query params (limit, offset)

- [ ] Task 9: Unit Tests — TenantsController accessible-workflows (AC: #6, #7)
  - [ ] 9.1 Add to `tenants.controller.spec.ts` — **NOTE:** This file uses `Test.createTestingModule()` pattern (NOT direct constructor instantiation). You must add `WorkflowTemplatesService` as a mock provider in the TestingModule `providers` array. Follow the existing mock pattern with `useValue: { findAccessibleByTenant: jest.fn() }`.
    - [3.5-UNIT-008] GET /:id/accessible-workflows delegates to workflowTemplatesService.findAccessibleByTenant
    - [3.5-UNIT-009] GET /:id/accessible-workflows returns 404 for non-existent tenant

- [ ] Task 10: Verify full test suite & lint (AC: all)
  - [ ] 10.1 Run all tests: `npx nx run-many -t test --all`
  - [ ] 10.2 Run lint: `npx nx run-many -t lint --all`
  - [ ] 10.3 Report complete metrics per project

## Dev Notes

### Architecture Patterns to Follow

- **Extend existing services** — Add `findPublished()` and `findAccessibleByTenant()` to `WorkflowTemplatesService`. Do NOT create new service files for this.
- **New controller for tenant-facing catalog** — `WorkflowCatalogController` at `/app/workflow-templates` is separate from the admin controller at `/admin/workflow-templates`. Different roles, different filtering logic. This follows the established two-controller pattern (see `llm-models.controller.ts` which has `AppLlmModelsController` + `AdminLlmModelsController`).
- **TransactionManager pattern** — All new methods via `txManager.run(tenantId, ...)`. The RLS policy does the heavy lifting for visibility filtering.
- **Defense-in-depth** — Include `tenantId` in all WHERE clauses alongside RLS.
- **QueryBuilder soft-delete** — Always add `.andWhere('template.deleted_at IS NULL')` to QueryBuilder queries (per Story 3.3 learnings).
- **BDD test format** — Use Given/When/Then comments in all new test bodies.
- **Test IDs** — `[3.5-UNIT-XXX]` with `[P0]`-`[P3]` priority markers.

### Critical Implementation Details

1. **RLS does the visibility filtering automatically.** The `template_access` policy in `rls-setup.service.ts` enforces:
   ```sql
   USING (
     tenant_id = current_setting('app.current_tenant', true)::uuid
     OR visibility = 'public'
     OR current_setting('app.current_tenant', true)::uuid = ANY(allowed_tenants)
   )
   ```
   When `findPublished()` runs inside `txManager.run(tenantId, ...)`, RLS is set for that tenant. The query only needs to filter by `status = 'published'` — RLS handles the rest.

2. **`findAccessibleByTenant()` runs AS the target tenant.** When the admin calls `GET /admin/tenants/:id/accessible-workflows`, the service runs `txManager.run(targetTenantId, ...)` so that RLS shows what THAT tenant would see. This is the same impersonation-style query pattern.

3. **Auto-clear `allowedTenants` when setting `visibility=public`.** This prevents stale data — if a template was private with an allow-list and is changed to public, the allow-list should be cleared since it's irrelevant.

4. **The existing `update()` method already handles `visibility` and `allowedTenants`.** See `workflow-templates.service.ts` lines where `dto.visibility` and `dto.allowedTenants` are applied. The only addition needed is the auto-clear logic for public visibility.

5. **Module dependency for TenantsController.** The TenantsController needs access to `WorkflowTemplatesService`. Options:
   - **Preferred:** Import `WorkflowsModule` in `TenantsModule` (WorkflowsModule already exports its services)
   - **Fallback:** If circular dependency, use `@Inject(forwardRef(() => WorkflowTemplatesService))`

6. **`req.user` shape:** `tenant_id` (snake_case), `userId` (camelCase) — verified in Stories 3.3 and 3.4.

7. **Guards are globally available.** `JwtAuthGuard` and `RolesGuard` work in the new `WorkflowCatalogController` without importing `AuthModule` into `WorkflowsModule`. The existing admin controllers in `WorkflowsModule` already use these guards successfully. No additional module imports needed for auth.

8. **`allowedTenants` UUID existence is NOT validated against the tenants table.** The DTO validates UUID format (`@IsUUID('4', { each: true })`), but does not check whether each UUID references a real tenant. This is acceptable — a stale or invalid UUID simply won't match any tenant in the RLS policy, so it's harmless. Tenant existence validation can be added later if needed.

### What Already Exists (DO NOT recreate)

```
libs/db-layer/src/lib/entities/
  workflow-template.entity.ts  — WorkflowTemplateEntity with visibility + allowedTenants fields

libs/db-layer/src/lib/rls-setup.service.ts
  — Custom RLS policy `template_access` on workflow_templates (visibility-based access)
  — Custom RLS policy on workflow_chains (same pattern)

libs/shared/src/lib/dtos/workflow/
  update-workflow-template.dto.ts  — visibility (enum), allowedTenants (UUID[]) already defined
  workflow-template-response.dto.ts — visibility and allowedTenants in response
  list-workflow-templates-query.dto.ts — limit, offset, status, visibility filters

apps/api-gateway/src/app/workflows/
  workflow-templates.service.ts  — update() already handles visibility + allowedTenants changes
  workflow-templates.controller.ts — PATCH /:id already accepts visibility/allowedTenants
```

### Files to CREATE

```
apps/api-gateway/src/app/workflows/
  workflow-catalog.controller.ts          (NEW — tenant-facing GET /app/workflow-templates)
  workflow-catalog.controller.spec.ts     (NEW — unit tests)
```

### Files to MODIFY

```
apps/api-gateway/src/app/workflows/
  workflow-templates.service.ts           (ADD: findPublished(), findAccessibleByTenant(); MODIFY: update() auto-clear allowedTenants on public)
  workflow-templates.service.spec.ts      (ADD: 5 new tests)
  workflows.module.ts                     (ADD: WorkflowCatalogController registration)

apps/api-gateway/src/app/tenants/
  tenants.controller.ts                   (ADD: GET /:id/accessible-workflows endpoint)
  tenants.controller.spec.ts              (ADD: 2 new tests)
  tenants.module.ts                       (ADD: WorkflowsModule import)
```

### Previous Story Learnings (from Stories 3.1, 3.3, 3.4)

- **Defense-in-depth tenantId:** All `findOne` WHERE clauses include `tenantId` — recurring issue caught in code review across 3.3 and 3.4.
- **QueryBuilder soft-delete:** Explicit `deleted_at IS NULL` required on all QueryBuilder queries (Story 3.3 learning).
- **Runtime enum validation:** `parseVisibility()` already exists in `WorkflowTemplatesService`.
- **Two-controller pattern:** Follow `llm-models.controller.ts` pattern — separate controllers for admin vs app routes with different role requirements.
- **`@DeleteDateColumn` behavior:** `.softDelete()` sets `deleted_at` automatically. All `find*` queries auto-filter. Use `withDeleted: true` to include.
- **PROCESS RULE:** Present code review findings BEFORE fixing. User chooses action per finding.
- **NO "acceptable for MVP" language.** Quality bar is production-grade.

### Project Structure Notes

- The `WorkflowCatalogController` follows the established two-controller pattern (admin + app) used by LLM models.
- The `GET /admin/tenants/:id/accessible-workflows` is an EXTENSION of the existing TenantsController — adding a sub-resource endpoint to the existing admin tenant routes.
- No new DTOs needed — existing `WorkflowTemplateResponseDto` and `ListWorkflowTemplatesQueryDto` are sufficient.

### References

- [Tech Spec §6.1: WorkflowTemplateEntity](../../_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md)
- [Tech Spec §6.6: RLS Registration](../../_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md)
- [project-context.md §2: RLS & TransactionManager Rules](../../project-context.md)
- [project-context.md §2c: Defense-in-Depth tenantId Rule](../../project-context.md)
- [Story 3.1: Data Foundation](./3-1-workflow-definition-data-foundation.md)
- [Story 3.3: CRUD API](./3-3-workflow-template-crud-api.md)
- [Story 3.4: Versioning & Publishing](./3-4-workflow-versioning-publishing.md)
- [Existing WorkflowTemplatesService](../../apps/api-gateway/src/app/workflows/workflow-templates.service.ts)
- [Existing RLS Setup Service](../../libs/db-layer/src/lib/rls-setup.service.ts)
- [Existing TenantsController](../../apps/api-gateway/src/app/tenants/tenants.controller.ts)
- [Epics §3.5: Visibility & Access Control](../../_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
