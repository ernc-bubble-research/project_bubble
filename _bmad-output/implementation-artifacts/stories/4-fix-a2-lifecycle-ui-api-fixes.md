# Story 4-FIX-A2: Workflow Lifecycle UI & API Fixes

Status: ready-for-dev

## Story

As a **bubble admin and tenant user**,
I want **workflow publishing, catalog access, file upload, and run submission fixed**,
so that **the full workflow lifecycle works end-to-end from creation to execution**.

## Context

During Live Test Round 1 (2026-02-12), several issues were found in the workflow lifecycle — from publishing templates to running them as a tenant user. This story fixes the UI/API layer issues that prevent the workflow lifecycle from functioning.

### Key Architecture Decision: Catalog RLS Policy (Option A)
Workflow templates are created by bubble_admin but shared with tenants. The existing `tenant_isolation_policy` RLS blocks tenant users from seeing admin-created templates. Solution:
- Add `catalog_read_published` RLS SELECT policy on `workflow_templates` (published + public OR tenant in allowed_tenants)
- Add `catalog_read_published_versions` RLS SELECT policy on `workflow_versions` (version's parent template is published)
- Create `findPublishedOne(id, requestingTenantId)` method — no tenantId in WHERE, visibility check in application code
- **Note:** RLS is currently bypassed by superuser (`bubble_user`). WHERE clauses are the active security layer. RLS policies are forward-looking for Story 4-RLS. This is a documented Rule 2c exception.

### Source: Live Test Round 1 Party Mode Triage (2026-02-12)
- C2 (CRITICAL): Publish button missing
- C3 (CRITICAL): Catalog tenant filtering
- H2 (HIGH): Duplicate hash 409
- H5 (HIGH): Double-dot accept attribute
- H6 (HIGH): Instant redirect after run

## Acceptance Criteria

1. **AC1: Add Publish/Unpublish Buttons to Workflow Settings Modal (C2 — CRITICAL)**
   - Given a workflow template with status `DRAFT`
   - When the admin opens the settings modal
   - Then a "Publish" button is visible (primary style) that PATCHes the template status to `PUBLISHED`
   - Given a workflow template with status `PUBLISHED`
   - When the admin opens the settings modal
   - Then an "Unpublish" button is visible (secondary/warning style) that PATCHes status back to `DRAFT`
   - Unpublishing does NOT stop running workflow runs — they complete normally. Only blocks new runs.
   - The existing Archive/Unarchive buttons remain unchanged
   - Status badge updates immediately in the UI after action
   - **File:** `workflow-settings-modal.component.ts`

2. **AC2: Fix Catalog findOne — Add findPublishedOne + RLS Policy (C3 — CRITICAL)**
   - Given a workflow template created by bubble_admin with status `PUBLISHED`
   - When a tenant user requests the template detail via the catalog endpoint
   - Then the endpoint returns the template successfully (not 404)
   - Implementation:
     - Add `catalog_read_published` RLS SELECT policy on `workflow_templates` in `RlsSetupService`
     - Add `catalog_read_published_versions` RLS SELECT policy on `workflow_versions` in `RlsSetupService`
     - Create `findPublishedOne(id, requestingTenantId)` in `WorkflowTemplatesService`
     - Method queries `{ where: { id, status: PUBLISHED } }` — no tenantId in WHERE (documented Rule 2c exception)
     - For `restricted` visibility: verify `requestingTenantId` is in `allowedTenants` array
     - Update `WorkflowCatalogController.findOne()` to call `findPublishedOne`
     - Admin-facing `findOne(id, tenantId)` remains unchanged
   - **Shared infra note:** `RlsSetupService` modification is tracked as part of this story (party mode approved 2026-02-12)

3. **AC3: Return Existing Asset on Duplicate Hash (H2 — HIGH)**
   - Given a user uploads a file whose SHA-256 hash matches an existing asset in the same tenant
   - When the upload request is processed
   - Then the existing asset is returned (HTTP 200) instead of throwing ConflictException (HTTP 409)
   - Return the standard `AssetResponseDto` — no extra flag needed (idempotent upload)
   - **File:** `assets.service.ts` lines 42-51

4. **AC4: Fix Double-Dot Accept Attribute (H5 — HIGH)**
   - Given the file upload input component renders accept attributes for file type restrictions
   - When the accept attribute is generated
   - Then it produces `.pdf,.docx,.txt` (single dot) NOT `..pdf,..docx,..txt` (double dot)
   - Verify the file type preset groups also produce correct accept strings

5. **AC5: Remove Auto-Redirect After Run Submission (H6 — HIGH)**
   - Given a tenant user submits a workflow run
   - When the run is queued successfully
   - Then the success message remains visible until user manually navigates away
   - Remove the `setTimeout(() => this.goBack(), 2000)` auto-redirect timer
   - The "Back to Workflows" button stays available for manual navigation
   - **File:** `workflow-run-form.component.ts` lines 730-731

6. **AC6: Update All Documentation for Catalog RLS Decision**
   - Update `project-context.md` — document Rule 2c exception for `findPublishedOne`
   - Update operations runbook — document the new RLS policies
   - Note in story file: "RLS is currently bypassed by superuser. Access control enforced by WHERE clauses. RLS policies added for future Story 4-RLS hardening."

7. **AC7: Browser Smoke Test (Rule 26)**
   - As admin: publish a template via settings modal, verify status changes
   - As tenant user: browse catalog, see published template, click into detail
   - As tenant user: verify restricted template NOT visible if not in allowed_tenants
   - As tenant user: upload duplicate file, verify no error (returns existing)
   - As tenant user: submit workflow run, verify no instant redirect

## Tasks

- [ ] Task 1: Add `catalog_read_published` + `catalog_read_published_versions` RLS policies to `RlsSetupService` (AC2 — shared infra, party mode approved)
- [ ] Task 2: Create `findPublishedOne(id, requestingTenantId)` method in `WorkflowTemplatesService` (AC2)
- [ ] Task 3: Update `WorkflowCatalogController.findOne()` to call `findPublishedOne` (AC2)
- [ ] Task 4: Add Publish/Unpublish buttons to `workflow-settings-modal.component.ts` (AC1)
- [ ] Task 5: Change duplicate hash handling to return existing asset (AC3)
- [ ] Task 6: Fix double-dot accept attribute generation (AC4)
- [ ] Task 7: Remove setTimeout auto-redirect from run form submission (AC5)
- [ ] Task 8: Update project-context.md and operations runbook for catalog RLS decision (AC6)
- [ ] Task 9: Browser smoke test — publish, catalog, duplicate upload, run submission (AC7)
- [ ] Task 10: Update existing unit tests that assert old behavior (409 on duplicate, findOne with tenantId)

## Definition of Done

- [ ] All tasks completed
- [ ] All unit tests passing
- [ ] E2E suite still passes (46+ tests)
- [ ] Browser smoke test completed (Rule 26)
- [ ] Story file updated (tasks checked, Dev Agent Record, traceability)
- [ ] Documentation updated (project-context.md, operations runbook)
- [ ] No lint errors

## Out-of-Scope

| Item | Tracked In |
|------|-----------|
| Full run status tracking UI (progress, live updates) | Epic 5 Story 5-1 (Interactive Report Dashboard) |
| Provider type registry (backend-driven) | Story 4-PR (between Epic 4 and Epic 5) |
| Data vault drag-drop file management | Epic 5 |
| Data vault visual polish | Epic 5 / Story 7-7 |
| Select vault files when running workflow | Epic 5 (run form UX) |
| Full RLS enablement (non-superuser role) | Story 4-RLS |

## Dev Agent Record

_To be filled during implementation_

- **Agent:**
- **Date Started:**
- **Date Completed:**
- **Tests Added:**
- **Total Test Count:**

## Test Traceability

| AC ID | Test File | Test Description | Status |
|-------|-----------|------------------|--------|
| AC1 | | | |
| AC2 | | | |
| AC3 | | | |
| AC4 | | | |
| AC5 | | | |
| AC6 | | | |
| AC7 | | | |
