# Story 4-FIX-B: Admin UI & Settings Fixes

Status: ready-for-dev

## Story

As a **bubble admin**,
I want **admin panel bugs fixed in provider management, data vault rendering, and user visibility**,
so that **the admin experience is reliable and all system data is accurately represented in the UI**.

## Context

During Live Test Round 1 (2026-02-12), several admin UI issues were discovered that affect the management experience. These are not execution-pipeline-blocking but represent real bugs that need fixing before continuing with new feature development.

### Source: Live Test Round 1 Party Mode Triage (2026-02-12)
- 2 High, 3 Medium items
- All items verified by team consensus during party mode discussion

## Acceptance Criteria

1. **AC1: Provider Deactivation Cascades to Models (H1 — HIGH)**
   - Given a provider config (e.g., "Mock LLM") has associated models
   - When the admin deactivates the provider
   - Then all models associated with that provider are also deactivated
   - When the admin reactivates the provider
   - Then models are NOT automatically reactivated (admin must manually reactivate desired models)
   - **Rationale:** Deactivation cascades down (safety — prevent orphaned active models pointing to dead provider). Reactivation does NOT cascade up (intentional — admin chooses which models to bring back).

2. **AC2: Data Vault List Renders Immediately (H3 — HIGH)**
   - Given a tenant user navigates to the Data Vault
   - When the component initializes
   - Then the file/folder list renders immediately without requiring a manual refresh or second navigation
   - **Root cause:** Likely Angular change detection timing — signal or observable not triggering initial render
   - Verify the fix works for both empty vaults (show empty state) and populated vaults (show contents)

3. **AC3: Admin Users Endpoint Shows All Users for Tenant (H4 — HIGH)**
   - Given a user was created directly in the database (e.g., via SQL INSERT during testing or migration)
   - When the admin views the tenant detail page user list
   - Then ALL users for that tenant are visible, regardless of how they were created
   - **Root cause:** The users endpoint or the tenant detail component may be filtering by invitation status or some other criteria that excludes directly-created users
   - Verify the endpoint returns users by `tenantId` only, without additional filters that would hide valid users

4. **AC4: Bulk Activate/Deactivate for Model Groups (M1 — MEDIUM)**
   - Given the admin views the LLM Models management page
   - When multiple models belong to the same provider
   - Then the admin can activate or deactivate all models for a provider in a single action
   - UI: Add a toggle or button at the provider group level (e.g., "Activate All" / "Deactivate All" for each provider section)
   - Individual model toggles remain for fine-grained control

5. **AC5: Models Default to Private (M2 — MEDIUM)**
   - Given the admin creates a new LLM model
   - When no visibility preference is specified
   - Then the model defaults to `isPublic: false` (private)
   - Existing models in the database should NOT be mass-updated (only affects new models going forward)
   - **Rationale:** New models should be private by default until explicitly made public — prevents accidental exposure of untested models to tenants

## Tasks

- [ ] Task 1: Add cascade deactivation logic — when provider is deactivated, deactivate all its models (AC1)
- [ ] Task 2: Add unit tests for provider deactivation cascade behavior (AC1)
- [ ] Task 3: Debug and fix data vault list initial render timing (AC2)
- [ ] Task 4: Add unit test for data vault initial render (AC2)
- [ ] Task 5: Fix admin users endpoint to show all users for tenant regardless of creation method (AC3)
- [ ] Task 6: Add unit test for users endpoint returning all tenant users (AC3)
- [ ] Task 7: Add bulk activate/deactivate UI for model groups (AC4)
- [ ] Task 8: Change model `isPublic` default to `false` in entity and create DTO (AC5)

## Definition of Done

- [ ] All tasks completed
- [ ] All unit tests passing
- [ ] E2E suite still passes (46+ tests)
- [ ] Story file updated (tasks checked, Dev Agent Record, traceability)
- [ ] No lint errors

## Out-of-Scope

| Item | Tracked In |
|------|-----------|
| Provider type registry (backend-driven dropdown) | Story 4-PR (between Epic 4 and Epic 5) |
| Data vault drag-drop file management | Epic 5 |
| Data vault list view visual redesign | Story 7-7 (UI polish pass) |
| Provider test connection button | Epic 4 (requires SDK integration) |

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
