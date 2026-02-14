# Story 4-FIX-B: Admin UI & Settings Fixes

Status: done

## Story

As a Bubble Admin,
I want the LLM model management UI and related admin endpoints to work correctly and follow safe-by-default patterns,
so that I can reliably manage models, see all tenant users, and trust that new models start in a safe inactive state.

## Context

During Live Test Round 1 (2026-02-12), 5 admin UI issues were discovered (2 High, 2 Medium, 1 High simplified). Party mode pre-implementation review (2026-02-14) refined scope: H1 full Model Reassignment UX deferred to separate story — only a simple runtime guard is included here.

### Source: Live Test Round 1 Party Mode Triage + Pre-Impl Review (2026-02-14)

- H1: Provider deactivation doesn't cascade to models → **simplified to runtime guard only**
- H3: Data vault list doesn't render immediately (zoneless CD bug)
- H4: Admin users endpoint doesn't show directly-inserted DB users
- M1: No bulk activate/deactivate for model groups
- M2: Models default active, should default inactive

## Acceptance Criteria

1. **AC1 (H1 — Runtime guard):** When the execution engine processes a workflow run, it checks that both the resolved LLM model (`isActive`) and its provider config (`isActive`) are active before calling the LLM. If either is inactive, the job fails immediately with a clear error message using the MODEL's `displayName`: "The configured model '[model.displayName]' is currently disabled by your administrator. Please contact your admin to re-enable it or select a different model." (User-friendly — always references the model name since that's what users see in workflow config. Does NOT reference internal "isActive" flag or provider key.)

2. **AC2 (H3 — Zoneless change detection):** The Data Vault page renders all file cards and UI elements immediately on navigation, without requiring the user to click or interact to trigger rendering. Signal updates from async HTTP callbacks trigger view updates automatically.

3. **AC3 (H4 — Users tab shows actual users):** The admin users endpoint (`GET /admin/tenants/:tenantId/users`) correctly returns all users for the specified tenant. The tenant-detail "Users" tab displays both the actual users table (from the admin users endpoint) AND the invitations table. Users are loaded when switching to the Users tab.

4. **AC4 (M1 — Bulk model status):** The LLM models list UI includes "Activate All" and "Deactivate All" buttons in each provider group header. A new backend endpoint `PATCH /api/admin/llm-models/bulk-status` accepts `{ providerKey: string, isActive: boolean }` and updates all models for that provider in a single query. The UI refreshes the model list after bulk operation.

5. **AC5 (M2 — Default inactive):** New LLM models default to `isActive: false` across all layers: entity column default, service DTO fallback, form dialog initial value, DTO Swagger docs. Existing models are NOT migrated (only new models affected).

6. **AC6 (Tests):** All new behavior has unit tests. Existing test suite passes (1237 tests, 0 lint errors). Browser smoke test passes per Rule 26.

7. **AC7 (Docs):** Out-of-scope items documented. Dev Agent Record completed. Story file tasks all checked.

## Tasks / Subtasks

### H1 — Runtime guard for inactive model/provider (AC1)

- [x] Task 1: Add active-check in `WorkflowExecutionProcessor.process()` (AC: 1)
  - [x] 1.1: After `llmProviderFactory.getProvider(modelUuid)` resolves model + provider, query `LlmProviderConfigEntity` by `model.providerKey` to check `isActive`
  - [x] 1.2: If model `isActive === false` OR provider config `isActive === false`, throw a descriptive `Error` with user-friendly message (see AC1 wording)
  - [x] 1.3: Add unit tests: (a) model inactive → job fails with expected message, (b) provider inactive → job fails with expected message, (c) both active → proceeds normally, (d) providerKey has no matching provider config → NotFoundException (distinct from disabled message)

### H3 — Data Vault zoneless change detection fix (AC2)

- [x] Task 2: Fix signal-driven rendering in `DataVaultComponent` (AC: 2)
  - [x] 2.1: Investigate the exact change detection failure — signals updated inside `subscribe()` callback of `route.paramMap` pipe. Root cause: Angular zoneless mode does not auto-detect signal writes inside RxJS subscription callbacks from `ActivatedRoute`
  - [x] 2.2: Apply fix — use `ChangeDetectorRef.markForCheck()` after signal writes inside subscribe callbacks, OR refactor to use `toSignal()` from `@angular/core/rxjs-interop` for route params (preferred, cleaner)
  - [x] 2.3: Verify `loadAssets()` and `loadFolders()` also trigger re-render properly — same pattern in their subscribe callbacks
  - [x] 2.4: Add/update component tests verifying that `filteredAssets` computed signal reflects data after async load without manual trigger
  - [x] 2.5: Check `LlmModelsListComponent` for same zoneless CD pattern — if same one-line fix applies, fix it here; if different pattern, document as separate finding only (scope boundary: no deep refactors of other components)

### H4 — Admin users endpoint investigation (AC3)

- [x] Task 3: Investigate and fix admin users endpoint (AC: 3)
  - [x] 3.1: Write a targeted test: seed a user directly via `manager.save(UserEntity, {...})` with explicit `tenantId`, then call `findAllByTenant(tenantId)` and assert the user appears in results
  - [x] 3.2: Check if `UserEntity.email` global `unique: true` constraint could prevent insertion of test users with duplicate emails across tenants — this is a plausible root cause
  - [x] 3.3: Check frontend `tenant-detail.component.html` template for any client-side filtering that might hide users (e.g., status filter, role filter, or conditional rendering)
  - [x] 3.4: If bug found → fix. If no bug found → document investigation findings in Dev Agent Record with steps attempted

### M1 — Bulk activate/deactivate for model groups (AC4)

- [x] Task 4: Backend — Bulk status endpoint (AC: 4)
  - [x] 4.1: Create `BulkUpdateModelStatusDto` in `libs/shared/src/lib/dtos/workflow/` with `providerKey: string` and `isActive: boolean` (both required, validated). Export from barrel file.
  - [x] 4.2: Add `bulkUpdateStatus(dto)` method to `LlmModelsService` — use `this.repo.update({ providerKey: dto.providerKey }, { isActive: dto.isActive })`, return affected count
  - [x] 4.3: Add `PATCH /api/admin/llm-models/bulk-status` endpoint to `AdminLlmModelsController` with Swagger docs
  - [x] 4.4: Unit tests: service method (updates correct models, returns count), controller endpoint (validates DTO, calls service)

- [x] Task 5: Frontend — Bulk toggle buttons per provider group (AC: 4)
  - [x] 5.1: Add `bulkUpdateStatus(dto)` method to `LlmModelService` (Angular HTTP service)
  - [x] 5.2: Add "Activate All" and "Deactivate All" buttons in `llm-models-list.component.html` provider header (next to model count)
  - [x] 5.3: Add `onBulkToggle(providerKey, isActive)` handler in component — call bulk endpoint, update local signal state on success
  - [x] 5.4: Add `data-testid` attributes for bulk buttons: `bulk-activate-{providerKey}`, `bulk-deactivate-{providerKey}`
  - [x] 5.5: Component unit tests: bulk button click triggers service call, local state updated, error banner on failure

### M2 — Default models to inactive (AC5)

- [x] Task 6: Flip isActive defaults across all layers (AC: 5)
  - [x] 6.1: Entity: `libs/db-layer/src/lib/entities/llm-model.entity.ts` — change `default: true` to `default: false`
  - [x] 6.2: Service: `apps/api-gateway/src/app/workflows/llm-models.service.ts` — change `dto.isActive ?? true` to `dto.isActive ?? false`
  - [x] 6.3: Form dialog: `apps/web/src/app/admin/settings/llm-model-form-dialog.component.ts` — change `isActive: [true]` to `isActive: [false]`, and reset value from `true` to `false`
  - [x] 6.4: DTO Swagger: `libs/shared/src/lib/dtos/workflow/create-llm-model.dto.ts` — change `example: true, default: true` to `example: false, default: false`
  - [x] 6.5: Added targeted tests: service defaults to isActive:false when omitted ([4-FIX-B-UNIT-015]), form defaults to false ([4-FIX-B-UNIT-016])

### Finalization

- [x] Task 7: Browser smoke test (AC: 6)
  - [x] 7.1: Settings > Models: bulk buttons visible per provider group, deactivate/activate round-trip works, Add Model form defaults isActive to unchecked
  - [x] 7.2: Data Vault (impersonated as Acme Corp): renders immediately with 7 files and folders sidebar — no blank screen

- [x] Task 8: Run full test suite, update story file (AC: 6, 7)
  - [x] 8.1: Full suite: api-gateway 612, web 515, db-layer 27, shared 83 = **1237 total** (0 failures, +23 new tests including Pass 2 + Pass 3 fixes)
  - [x] 8.2: Lint: 0 errors, 18 warnings (all pre-existing)
  - [x] 8.3: Dev Agent Record completed, all tasks checked, traceability table filled

## Dev Notes

### Architecture & Patterns

- **Processor active check (H1):** The `WorkflowExecutionProcessor.process()` method already calls `llmProviderFactory.getProvider(modelUuid)` which resolves the `LlmModelEntity`. After this call, query the `LlmProviderConfigEntity` by `model.providerKey` to check `isActive`. This check goes BEFORE the `provider.generate()` call. The provider factory returns `{ provider, model }` — need to also load the `LlmProviderConfigEntity` (inject `LlmProviderConfigService` or the repo directly).
- **Zoneless CD (H3):** The project uses zoneless Angular (no `zone.js`). Signal writes inside RxJS `subscribe()` callbacks from `ActivatedRoute.paramMap` may not trigger change detection. Two fix options: (A) inject `ChangeDetectorRef` and call `markForCheck()` after signal writes, (B) convert `paramMap` subscription to `toSignal()` which integrates with Angular's reactivity system natively. Option B is preferred per project's signal-first architecture. Check all components with similar pattern.
- **Bulk endpoint (M1):** Uses `Repository.update()` (not raw SQL) since this is a simple `SET is_active = X WHERE provider_key = Y` — no RETURNING needed, no tenant scoping (LLM models are system-wide). Return affected count via TypeORM's `UpdateResult.affected`.
- **UserEntity global email unique constraint (H4):** `@Column({ unique: true })` on `email` means two tenants cannot have a user with the same email. This is by design (email is the login key). Investigation should focus on: (a) whether the directly-inserted user's `tenant_id` matches the tenant being viewed, (b) whether `status` filtering is happening anywhere (it's not in `findAllByTenant`), (c) whether the user was inserted with correct column names (snake_case in DB vs camelCase in TypeORM entity).
- **RLS context:** The `users` table has `auth_select_all` policy with `USING (true)` — all users are visible to SELECT. Tenant filtering is purely application-side via `WHERE { tenantId }`.

### Source Locations

| Component | Path | Relevant Lines |
|-----------|------|----------------|
| Processor | `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts` | `process()` ~line 110-175 |
| LLM Provider Factory | `apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.ts` | `getProvider()` |
| Provider Config Service | `apps/api-gateway/src/app/settings/llm-provider-config.service.ts` | entire file |
| Provider Config Entity | `libs/db-layer/src/lib/entities/llm-provider-config.entity.ts` | `isActive` column |
| LLM Model Entity | `libs/db-layer/src/lib/entities/llm-model.entity.ts` | `isActive` default line 31 |
| Models Service | `apps/api-gateway/src/app/workflows/llm-models.service.ts` | `create()` line 49, `update()` |
| Models Controller | `apps/api-gateway/src/app/workflows/llm-models.controller.ts` | `AdminLlmModelsController` — add bulk endpoint here |
| Models List UI (TS) | `apps/web/src/app/admin/settings/llm-models-list.component.ts` | `onToggleActive()` lines 94-114 |
| Models List UI (HTML) | `apps/web/src/app/admin/settings/llm-models-list.component.html` | provider header lines 48-52 |
| Model Form Dialog | `apps/web/src/app/admin/settings/llm-model-form-dialog.component.ts` | form init line 53, reset line 83 |
| Create DTO | `libs/shared/src/lib/dtos/workflow/create-llm-model.dto.ts` | `isActive` lines 42-45 |
| Data Vault | `apps/web/src/app/app/data-vault/data-vault.component.ts` | `ngOnInit()` lines 65-72, signal writes in callbacks |
| Users Service | `apps/api-gateway/src/app/users/users.service.ts` | `findAllByTenant()` lines 79-87 |
| Admin Users Controller | `apps/api-gateway/src/app/users/admin-users.controller.ts` | `findAll()` lines 47-56 |
| User Entity | `libs/db-layer/src/lib/entities/user.entity.ts` | `email unique: true` line 25, `tenantId` line 37 |
| LLM Model HTTP Service | `apps/web/src/app/core/services/llm-model.service.ts` | Add `bulkUpdateStatus()` method |

### Project Structure Notes

- LLM models are **system-wide** (not tenant-scoped) — no tenantId in WHERE needed (Rule 2c does not apply)
- Users ARE tenant-scoped — Rule 2c applies to H4 investigation
- The `AdminLlmModelsController` at `/admin/llm-models` uses `@Roles(UserRole.BUBBLE_ADMIN)` — no TenantStatusGuard needed
- New DTO goes in `libs/shared/src/lib/dtos/workflow/` alongside existing LLM model DTOs
- Lucide icons: if any new icons are needed (e.g., `toggle-left`, `toggle-right`), register in `app.config.ts`

### Testing Standards

- Unit tests: Jest, use `beforeEach` for setup, `describe`/`it` blocks
- Angular tests: `TestBed.configureTestingModule` with `provideExperimentalZonelessChangeDetection()`
- API tests: `@nestjs/testing` with `Test.createTestingModule`, mock repositories
- Browser smoke test: `./scripts/dev-servers.sh start`, manual verification, `./scripts/dev-servers.sh stop`
- Rule 29: E2E suite must still pass (46+ tests)

### References

- [Source: sprint-status.yaml — 4-FIX-B line items, lines 413-418]
- [Source: party mode session 2026-02-14 — H1/H3/H4/M1/M2 discussion, 2 rounds of user feedback]
- [Source: project-context.md — Rules 2c, 13, 26, 31, 32]
- [Source: memory/h1-model-reassignment-story-notes.md — full H1 UX deferred to separate story]
- [Source: 4-fix-a2-lifecycle-ui-api-fixes.md — previous story Dev Agent Record, out-of-scope table]

## Out-of-Scope

| Item | Tracked In |
|------|-----------|
| Full Model Reassignment UX (warning dialog, per-workflow dropdown, "apply all") | New story after 4-FIX-B — notes in `memory/h1-model-reassignment-story-notes.md` |
| User-friendly error message improvement for disabled models (beyond current wording) | Same H1 reassignment story |
| Workflow count per model in models list ("X workflows use this model") | Same H1 reassignment story |
| Provider cascade (deactivating provider auto-deactivates its models) | Same H1 reassignment story |
| Email invitation flow | Not built yet — separate infrastructure concern |
| Data vault visual polish / list view redesign | Story 7-7 (UI polish pass) or Epic 5 |
| Migration of existing models' isActive from true to false | Not needed — only new models affected by default change |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- **H1 finding**: Active check already exists in `LlmProviderFactory.getProvider()` — checks both `model.isActive` and `providerConfig.isActive`. Updated error messages to match AC1 user-friendly wording instead of adding redundant check in processor.
- **H3 root cause**: Angular zoneless mode — signal writes inside RxJS `subscribe()` callbacks from async HTTP calls don't trigger change detection. Fix: `ChangeDetectorRef.markForCheck()` after every signal write in subscribe callbacks.
- **H3 Angular 21 API**: `provideExperimentalZonelessChangeDetection` was removed; renamed to `provideZonelessChangeDetection` in `@angular/core`.
- **H4 conclusion**: No backend bug. `findAllByTenant()` correctly queries by `tenantId` with no status filter. Root cause: the tenant-detail.component.html "Users" tab only rendered invitations, not actual `UserEntity` records. **Fixed in Pass 2**: created `TenantUsersService` Angular service, added `users` signal + `loadUsers()` to `TenantDetailComponent`, added users table above invitations table in Users tab. Both users AND invitations now visible.
- **M1 design**: Bulk endpoint uses optimistic local signal update (not full reload) — sets `isActive` on matching `providerKey` models in local state after API success. More responsive UX.
- **H3 CD test limitation**: Unit tests [4-FIX-B-UNIT-005, 006] confirm signal values are set after async load, but cannot reproduce the async CD gap that triggers the bug in production (mock observables are synchronous, and `fixture.whenStable()` drains microtasks + forces CD). The actual H3 fix (`markForCheck()`) was verified via browser smoke test (Task 7.2). This is a known limitation of unit-testing Angular zoneless CD timing.

### Completion Notes List

1. H1: Updated 2 error messages in `llm-provider.factory.ts`, added 4 processor tests, updated 2 existing factory tests
2. H3: Added `ChangeDetectorRef.markForCheck()` in 4 locations (DataVaultComponent) + 3 locations (LlmModelsListComponent), added 2 component tests
3. H4: Added 1 targeted backend test confirming service works. **Pass 2 fix**: Created `TenantUsersService`, added users list to tenant-detail Users tab, added 4 component tests [4-FIX-B-UNIT-H4-001 through H4-004].
4. M1: Created `BulkUpdateModelStatusDto`, added service method + controller endpoint + Angular service method + UI buttons + SCSS. Added 3 backend tests + 1 Angular service test + 3 component tests.
5. M2: Flipped 4 defaults (entity, service, form, DTO). Added 2 targeted tests.
6. Total new tests: 21 (4 processor + 2 data-vault + 1 users backend + 4 users frontend + 4 backend LLM + 1 Angular service + 3 component + 2 default)
7. **Pass 1 review fixes**: (a) Added `@MaxLength(50)` to `BulkUpdateModelStatusDto.providerKey`, (b) Added `validateProviderKey()` call in `bulkUpdateStatus()`, (c) Updated processor test descriptions for accuracy, (d) Added [4-FIX-B-UNIT-017] for valid-provider-zero-match, (e) Updated [4-FIX-B-UNIT-009] to test unknown provider rejection
8. **Pass 2 review fixes**: (a) H4 — added users list to tenant-detail Users tab (frontend was only showing invitations), (b) F1 — differentiated processor test UNIT-001/UNIT-002 mock messages, (c) F2 — added `updatedAt` to optimistic bulk toggle update, (d) F4 — added `@Transform` trim to `BulkUpdateModelStatusDto.providerKey`
9. **Pass 3 review fixes**: (a) Fixed H4-004 false positive — mocked InvitationService, assert `getAll` called with tenantId, (b) Created `tenant-users.service.spec.ts` with 2 HTTP tests [H4-005, H4-006], (c) Fixed `users().length || '—'` falsy footgun → explicit ternary, (d) Documented H3 CD unit test limitation in Dev Agent Record

### Change Log

| File | Change |
|------|--------|
| `apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.ts` | Updated 2 error messages to user-friendly AC1 wording |
| `apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.spec.ts` | Updated 2 tests (UNIT-024, UNIT-026) for new message format |
| `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.spec.ts` | Added 4 tests [4-FIX-B-UNIT-001 through 004] |
| `apps/web/src/app/app/data-vault/data-vault.component.ts` | Added `ChangeDetectorRef`, `markForCheck()` in 4 subscribe callbacks |
| `apps/web/src/app/app/data-vault/data-vault.component.spec.ts` | Fixed zoneless provider name, added 2 tests [4-FIX-B-UNIT-005, 006] |
| `apps/web/src/app/admin/settings/llm-models-list.component.ts` | Added `ChangeDetectorRef.markForCheck()` in 3 callbacks, added `bulkTogglingProvider` signal + `onBulkToggle()` handler |
| `apps/web/src/app/admin/settings/llm-models-list.component.html` | Added bulk Activate/Deactivate buttons per provider group header |
| `apps/web/src/app/admin/settings/llm-models-list.component.scss` | Updated provider-header layout (flex space-between), added btn-sm + btn-outline styles |
| `apps/web/src/app/admin/settings/llm-models-list.component.spec.ts` | Added `bulkUpdateStatus` mock, added 3 tests [4-FIX-B-UNIT-012 through 014] |
| `apps/api-gateway/src/app/users/users.service.spec.ts` | Added 1 test [4-FIX-B-UNIT-007] |
| `libs/shared/src/lib/dtos/workflow/bulk-update-model-status.dto.ts` | **NEW** — BulkUpdateModelStatusDto |
| `libs/shared/src/lib/dtos/workflow/index.ts` | Added barrel export for BulkUpdateModelStatusDto |
| `apps/api-gateway/src/app/workflows/llm-models.service.ts` | Added `bulkUpdateStatus()` method, changed default `isActive ?? true` → `isActive ?? false` |
| `apps/api-gateway/src/app/workflows/llm-models.service.spec.ts` | Added `update` mock, added 3 tests [4-FIX-B-UNIT-008, 009, 015] |
| `apps/api-gateway/src/app/workflows/llm-models.controller.ts` | Added `PATCH bulk-status` endpoint, imported `BulkUpdateModelStatusDto` |
| `apps/api-gateway/src/app/workflows/llm-models.controller.spec.ts` | Added `bulkUpdateStatus` mock, added 1 test [4-FIX-B-UNIT-010] |
| `apps/web/src/app/core/services/llm-model.service.ts` | Added `bulkUpdateStatus()` method, imported `BulkUpdateModelStatusDto` |
| `apps/web/src/app/core/services/llm-model.service.spec.ts` | Added 1 test [4-FIX-B-UNIT-011] |
| `libs/db-layer/src/lib/entities/llm-model.entity.ts` | Changed `default: true` → `default: false` |
| `apps/web/src/app/admin/settings/llm-model-form-dialog.component.ts` | Changed form default `isActive: [true]` → `[false]`, reset `true` → `false` |
| `apps/web/src/app/admin/settings/llm-model-form-dialog.component.spec.ts` | Added 1 test [4-FIX-B-UNIT-016] |
| `libs/shared/src/lib/dtos/workflow/create-llm-model.dto.ts` | Changed `example: true, default: true` → `example: false, default: false` |
| `apps/web/src/app/core/services/tenant-users.service.ts` | **NEW** — TenantUsersService (Pass 2 H4 fix) |
| `apps/web/src/app/admin/tenants/tenant-detail.component.ts` | Added TenantUsersService, users signal, loadUsers() (Pass 2 H4 fix) |
| `apps/web/src/app/admin/tenants/tenant-detail.component.html` | Added users table section above invitations in Users tab (Pass 2 H4 fix) |
| `apps/web/src/app/admin/tenants/tenant-detail.component.scss` | Added `.users-section` style (Pass 2 H4 fix) |
| `apps/web/src/app/admin/tenants/tenant-detail.component.spec.ts` | Added TenantUsersService mock, 4 tests [4-FIX-B-UNIT-H4-001 through H4-004], added Lucide icons (Pass 2 H4 fix) |
| `libs/shared/src/lib/dtos/workflow/bulk-update-model-status.dto.ts` | Added `@Transform` trim on providerKey (Pass 2 F4 fix) |
| `apps/web/src/app/admin/settings/llm-models-list.component.ts` | Added `updatedAt` to optimistic bulk toggle (Pass 2 F2 fix) |
| `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.spec.ts` | Differentiated UNIT-002 mock message (Pass 2 F1 fix) |
| `apps/web/src/app/admin/tenants/tenant-detail.component.spec.ts` | Added InvitationService mock, fixed H4-004 assertion (Pass 3 fix) |
| `apps/web/src/app/admin/tenants/tenant-detail.component.html` | Fixed `users().length \|\| '—'` falsy footgun → explicit ternary (Pass 3 fix) |
| `apps/web/src/app/core/services/tenant-users.service.spec.ts` | **NEW** — 2 HTTP tests [H4-005, H4-006] (Pass 3 fix) |

### File List

**New files:** 3
- `libs/shared/src/lib/dtos/workflow/bulk-update-model-status.dto.ts`
- `apps/web/src/app/core/services/tenant-users.service.ts`
- `apps/web/src/app/core/services/tenant-users.service.spec.ts`

**Modified files:** 28 (listed in Change Log above)

### Traceability

| AC | Test(s) | Status |
|----|---------|--------|
| AC1 | [4-FIX-B-UNIT-001] model inactive, [4-FIX-B-UNIT-002] provider inactive, [4-FIX-B-UNIT-003] both active, [4-FIX-B-UNIT-004] missing provider config | PASS |
| AC2 | [4-FIX-B-UNIT-005] filteredAssets signal renders, [4-FIX-B-UNIT-006] folders signal renders | PASS |
| AC3 | [4-FIX-B-UNIT-007] directly-inserted users appear in findAllByTenant, [4-FIX-B-UNIT-H4-001] load users on tab switch, [4-FIX-B-UNIT-H4-002] render users table, [4-FIX-B-UNIT-H4-003] empty state, [4-FIX-B-UNIT-H4-004] also loads invitations, [4-FIX-B-UNIT-H4-005] HTTP GET endpoint wiring, [4-FIX-B-UNIT-H4-006] empty response | PASS |
| AC4 | [4-FIX-B-UNIT-008] bulk update affected count, [4-FIX-B-UNIT-009] unknown provider rejected, [4-FIX-B-UNIT-010] controller delegates, [4-FIX-B-UNIT-011] Angular HTTP PATCH, [4-FIX-B-UNIT-012] buttons render, [4-FIX-B-UNIT-013] bulk deactivate updates state, [4-FIX-B-UNIT-014] error banner on failure, [4-FIX-B-UNIT-017] valid provider zero match | PASS |
| AC5 | [4-FIX-B-UNIT-015] service defaults to inactive, [4-FIX-B-UNIT-016] form defaults to inactive | PASS |
| AC6 | 1237 total tests (612+515+27+83), 0 failures, 0 lint errors, browser smoke test passed | PASS |
| AC7 | All 8 tasks checked, Dev Agent Record complete, traceability filled, out-of-scope table documented | PASS |
