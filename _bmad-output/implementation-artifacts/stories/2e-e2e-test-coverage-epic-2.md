# Story 2E: Data & Configuration E2E Tests (Comprehensive)

Status: done

## Story

As a **Developer**,
I want **comprehensive E2E tests covering Data Vault operations, tenant isolation, Settings admin UI, and invitation management**,
so that **critical data flows (upload, folders, CRUD), multi-tenant RLS isolation, and invitation workflows are verified end-to-end beyond unit test coverage**.

## Background

Story 1E established the Playwright E2E framework with test DB lifecycle, auth fixture, and 3 smoke tests. This story builds on that foundation to prove the app "does useful work" — data flows from browser to database and back, multi-tenant isolation holds, and admin configuration round-trips correctly.

**Party Mode Consensus (2026-02-07):**
- Scope: **Data Vault E2E + Settings/LLM Admin E2E** (both in 2E, separate spec files)
- Framing: "Data & Configuration E2E" — proves the app does useful work
- Seed: **Hybrid** — extend global-setup with 2 tenants + tenant users; per-test API fixtures for mutations
- Auth: **3 storageState files** (admin, tenant-a, tenant-b)
- Multi-tenant isolation: **P0** — highest-value E2E test
- File upload: Real small files in `fixtures/files/`, Playwright `fileChooser` API
- Test count: **11 tests** across 4 spec files
- Settings: Include in 2E (3-4 tests, admin-only, low complexity)
- data-testid: **~25 new attributes** needed on Data Vault components (Settings already has them)

**Key insight from 1E party mode review:** Consider migration-based schema instead of `synchronize: true` for 2E since we're testing real data operations. Add schema validation step to global-setup.

## Acceptance Criteria

1. **AC1: Extended Seed Data** — `global-setup.ts` extended to seed 2 additional tenants (Tenant A `11111111-...`, Tenant B `22222222-...`) each with a `customer_admin` user. One pre-created folder per tenant for navigation tests. No pre-uploaded files (uploads are test-specific).
2. **AC2: Multi-Auth Fixture** — `auth.setup.ts` extended to create 3 storageState files: `admin.json` (existing), `tenant-a.json`, `tenant-b.json`. Each tenant user logs in via `POST /api/auth/login` and gets a separate storageState.
3. **AC3: Data Vault — Folder Operations** — E2E tests verify: create folder, navigate into folder, navigate via "All Files" root. Uses Tenant A auth.
4. **AC4: Data Vault — File Upload** — E2E test uploads a real small file (`.txt`) via file picker input, verifies file appears in the asset list. Uses Tenant A auth.
5. **AC5: Data Vault — File Operations** — E2E tests verify: uploaded file displays in list with correct name, archive file (soft delete), verify archived file no longer in list.
6. **AC6: Multi-Tenant Isolation (P0)** — E2E test: upload file as Tenant A → switch to Tenant B auth → verify file NOT visible in Tenant B's vault. Same for folders. This is the highest-priority test.
7. **AC7: Settings — LLM Models CRUD** — E2E tests verify: models list loads with seeded data, edit a model's display name, toggle model active/inactive. Uses admin auth.
8. **AC8: Settings — Provider Config CRUD** — E2E tests verify: providers list loads with seeded configs, edit a provider's display name. Uses admin auth.
9. **AC9: data-testid Coverage** — All Data Vault components have `data-testid` attributes sufficient for E2E selectors. Settings components already have them (from Story 3.1-3/3.1-4).
10. **AC10: Test File Fixtures** — Small test files stored in `apps/web-e2e/src/fixtures/files/` (git-tracked): `test-document.txt` (~100 bytes), `test-document.pdf` (~2KB).
11. **AC11: Invitation Dialog** — E2E test verifies: admin opens invite dialog from tenant detail Users tab, fills email + submits, error message displayed (SMTP not configured in test env). Dialog cancel closes correctly.
12. **AC12: Invitation List & Revoke** — E2E test verifies: admin sees seeded invitation in Users tab, clicks revoke, status changes from "pending" to "revoked", revoke button disappears.

## Tasks / Subtasks

- [x] Task 1: Extend global-setup seed data (AC: 1)
  - [x] 1.1 Add Tenant A (`11111111-0000-0000-0000-000000000000`, name: "Tenant Alpha") with `customer_admin` user (`tenant-a@test.io` / `TenantA123!`)
  - [x] 1.2 Add Tenant B (`22222222-0000-0000-0000-000000000000`, name: "Tenant Beta") with `customer_admin` user (`tenant-b@test.io` / `TenantB123!`)
  - [x] 1.3 Create one root folder per tenant ("Test Folder") via `FolderEntity` repository — MUST set `tenantId` explicitly on each folder (no RLS context in global-setup, raw TypeORM repos)
  - [x] 1.4 Add `SEED_TENANT_A_EMAIL`, `SEED_TENANT_A_PASSWORD`, `SEED_TENANT_B_EMAIL`, `SEED_TENANT_B_PASSWORD` to `.env.test`

- [x] Task 2: Extend auth fixture for multi-tenant (AC: 2)
  - [x] 2.1 Refactor `auth.setup.ts` to create 3 storageState files: `admin.json`, `tenant-a.json`, `tenant-b.json`
  - [x] 2.2 Each uses `POST /api/auth/login` with respective credentials → writes to `playwright/.auth/{name}.json`
  - [x] 2.3 Keep `admin.json` as default storageState in `playwright.config.ts` (do NOT change — 1E smoke tests depend on admin auth). Data Vault tests override per-file with `test.use({ storageState: 'playwright/.auth/tenant-a.json' })`
  - [x] 2.4 Extend `fixtures.ts` with a `tenantBPage` fixture that creates a **separate BrowserContext** with `tenant-b.json` storageState. Pattern: `const ctx = await browser.newContext({ storageState: 'playwright/.auth/tenant-b.json' }); const page = await ctx.newPage(); await use(page); await ctx.close();` — this allows isolation tests to use BOTH Tenant A (default page) and Tenant B (tenantBPage) in the same test

- [x] Task 3: Add data-testid attributes to Data Vault components (AC: 9)
  - [x] 3.1 `data-vault.component.html` — add: `data-vault` (root), `folder-sidebar`, `new-folder-btn`, `search-input`, `view-toggle-btn`, `file-area`, `loading-indicator`, `empty-state`, `bulk-actions`, `learn-selected-btn`, `archive-selected-btn`
  - [x] 3.2 `folder-tree.component.ts` — add: `folder-tree`, `folder-all-files`, `[attr.data-testid]="'folder-' + folder.id"` on each folder button, `[attr.data-testid]="'rename-folder-btn-' + folder.id"` on rename buttons
  - [x] 3.3 `file-card.component.ts` — add: `[attr.data-testid]="'file-item-' + asset().id"` (on both grid `.file-card` and list `.file-row`), `[attr.data-testid]="'file-checkbox-' + asset().id"`, `[attr.data-testid]="'index-btn-' + asset().id"`, `[attr.data-testid]="'deindex-btn-' + asset().id"`
  - [x] 3.4 `upload-zone.component.ts` — add: `upload-zone`, `file-input` (on the hidden `<input type="file">`), `upload-list`
  - [x] 3.5 `create-folder-dialog.component.ts` — add: `create-folder-dialog`, `folder-name-input`, `folder-error`, `folder-create-btn`, `folder-cancel-btn`

- [x] Task 4: Create test file fixtures (AC: 10)
  - [x] 4.1 Create `apps/web-e2e/src/fixtures/files/test-document.txt` (~100 bytes, plain text)
  - [x] 4.2 Create `apps/web-e2e/src/fixtures/files/test-document.pdf` (~2KB, minimal valid PDF — commit a real small PDF binary, do not generate programmatically)

- [x] Task 5: Data Vault — Folder E2E tests (AC: 3)
  - [x] 5.1 Create `apps/web-e2e/src/data-vault/folders.spec.ts`
  - [x] 5.2 `[2E-E2E-001a]` [P0] Navigate to Data Vault → folder tree visible, "All Files" active
  - [x] 5.3 `[2E-E2E-001b]` [P0] Create folder → dialog opens, enter name, submit → folder appears in tree
  - [x] 5.4 `[2E-E2E-001c]` [P1] Navigate into folder → folder becomes active, file area updates

- [x] Task 6: Data Vault — File Upload & Operations E2E tests (AC: 4, 5)
  - [x] 6.1 Create `apps/web-e2e/src/data-vault/files.spec.ts`
  - [x] 6.2 `[2E-E2E-002a]` [P0] Upload file via file input → file appears in asset list with correct name
  - [x] 6.3 `[2E-E2E-002b]` [P1] Archive file → file removed from list (soft delete via API)

- [x] Task 7: Multi-Tenant Isolation E2E tests (AC: 6)
  - [x] 7.1 Create `apps/web-e2e/src/data-vault/tenant-isolation.spec.ts`
  - [x] 7.2 `[2E-E2E-003a]` [P0] Upload file as Tenant A → switch to Tenant B context → file NOT visible in Tenant B's vault
  - [x] 7.3 `[2E-E2E-003b]` [P0] Create folder as Tenant A → Tenant B cannot see it

- [x] Task 8: Settings — LLM Admin E2E tests (AC: 7, 8)
  - [x] 8.1 Create `apps/web-e2e/src/settings/llm-admin.spec.ts`
  - [x] 8.2 `[2E-E2E-004a]` [P0] Settings page loads → LLM Models tab shows seeded models grouped by provider
  - [x] 8.3 `[2E-E2E-004b]` [P1] Edit model display name → verify change persists on reload
  - [x] 8.4 `[2E-E2E-004c]` [P1] Switch to Providers tab → provider configs list loads with seeded data
  - [x] 8.5 `[2E-E2E-004d]` [P1] Toggle model active/inactive → verify toggle state changes

- [x] **Task 9: [P1] Invitation E2E tests** (AC: 11, 12)
  - [x] 9.1 Add `data-testid` attributes to `invite-user-dialog.component.html` (5 attrs: dialog, email-input, submit-btn, cancel-btn, error)
  - [x] 9.2 Add `data-testid` attributes to `tenant-detail.component.html` Users tab (5 attrs: tab-users, invite-user-btn, invitation-revoke-{id}, invitation-row-{id}, invitation-status-{id})
  - [x] 9.3 Create `apps/web-e2e/src/admin/invitations.spec.ts`
  - [x] 9.4 `[2E-E2E-005a]` [P1] Invite dialog: open, fill email, submit → error message (SMTP not configured)
  - [x] 9.5 `[2E-E2E-005b]` [P1] Invitation list: seed via DB, navigate → row visible, revoke → status changes to "revoked"

- [x] Task 10: Run full test suite + lint (AC: all)
  - [x] 10.1 All unit tests pass for modified components (41 tests)
  - [x] 10.2 Lint passes with 0 errors across web and web-e2e
  - [x] 10.3 Update story status and change log

## Dev Notes

### Architecture Constraints

- **Data Vault is Zone B** (`/app/` routes) — requires tenant-context JWT. Tenant users have `customer_admin` role. The JWT includes `tenantId` which the `@TenantId()` decorator reads to scope all API calls. Data Vault route is `/app/data-vault` (not `/admin/`), which uses `AppLayoutComponent` (not admin layout). This is the **first time E2E tests navigate Zone B routes** — 1E only tested Zone C (`/admin/*`).
- **Settings is Zone C** (`/admin/` routes) — requires `bubble_admin` JWT. Uses existing `admin.json` storageState. Settings tabs already have `data-testid` attributes: `tab-llm-models`, `tab-providers`, `tab-system`.
- **RLS + API-level isolation**: The tenant isolation tests validate **API-level isolation** (the `@TenantId()` decorator + `TransactionManager` set `app.current_tenant` for every query). RLS policies are also created by `RlsSetupService.onModuleInit()` when the NestJS server starts against the test DB, providing defense-in-depth. However, the E2E tests verify the **full stack** (JWT → decorator → service → DB), not raw DB-level RLS alone. This is the correct level for E2E tests.
- **File upload endpoint**: `POST /app/assets` — multipart form, `file` field, optional `folderId`, max 10MB. Uses `@UseInterceptors(FileInterceptor('file'))`.
- **Folder nesting**: Max 3 levels. `FolderEntity` has `parentId` (nullable).
- **Asset soft delete**: `DELETE /app/assets/:id` — soft deletes (archives) the asset. No hard delete in MVP.

### Data Vault Component data-testid Plan

The Data Vault currently has **zero** `data-testid` attributes. Settings components (LlmModelsListComponent, ProviderConfigListComponent) already have comprehensive `data-testid` coverage from Stories 3.1-3 and 3.1-4.

**Components needing data-testid:**
| Component | File | Attributes to Add |
|-----------|------|-------------------|
| DataVaultComponent | `data-vault.component.html` | `data-vault`, `folder-sidebar`, `new-folder-btn`, `search-input`, `view-toggle-btn`, `file-area`, `loading-indicator`, `empty-state`, `bulk-actions`, `learn-selected-btn`, `archive-selected-btn` |
| FolderTreeComponent | `folder-tree.component.ts` (inline) | `folder-tree`, `folder-all-files`, `folder-{id}` (dynamic), `rename-folder-btn-{id}` (dynamic) |
| FileCardComponent | `file-card.component.ts` (inline) | `file-item-{id}` (dynamic, both views), `file-checkbox-{id}`, `index-btn-{id}`, `deindex-btn-{id}` |
| UploadZoneComponent | `upload-zone.component.ts` (inline) | `upload-zone`, `file-input`, `upload-list` |
| CreateFolderDialogComponent | `create-folder-dialog.component.ts` (inline) | `create-folder-dialog`, `folder-name-input`, `folder-error`, `folder-create-btn`, `folder-cancel-btn` |

### Seed Data Strategy

**Global seed (in `global-setup.ts`)** — deterministic, read-only baseline:
- System tenant (nil UUID) + bubble_admin user (existing from 1E)
- Tenant A (`11111111-0000-0000-0000-000000000000`) + customer_admin user
- Tenant B (`22222222-0000-0000-0000-000000000000`) + customer_admin user
- 1 root folder per tenant ("Test Folder")
- LLM models + provider configs (seeded by NestJS `onModuleInit` at server start)

**Per-test data** — tests that mutate (create folders, upload files) create their own data. Tests should NOT depend on other tests' side effects.

### Auth Strategy

| storageState File | User | Role | Used By |
|-------------------|------|------|---------|
| `playwright/.auth/admin.json` | `admin@bubble.io` | `bubble_admin` | Settings tests, smoke tests |
| `playwright/.auth/tenant-a.json` | `tenant-a@test.io` | `customer_admin` | Data Vault tests (default) |
| `playwright/.auth/tenant-b.json` | `tenant-b@test.io` | `customer_admin` | Tenant isolation tests |

### Test Directory Config

The `nxE2EPreset` sets `testDir: './src'`. Playwright will scan ALL `*.spec.ts` files under `./src/` including new subdirectories (`data-vault/`, `settings/`). Verify this works during implementation — if `nxE2EPreset` overrides the match pattern, add `testMatch: /\.spec\.ts$/` to the config.

### File Upload Testing

- Use `page.getByTestId('file-input').setInputFiles('path/to/test-document.txt')` for file picker
- Skip drag-and-drop testing (same backend flow, UI convenience only)
- Test files stored in `apps/web-e2e/src/fixtures/files/` and git-tracked (tiny files)

### Playwright Config Changes

- Default storageState stays `admin.json` (DO NOT CHANGE — 1E smoke tests depend on admin auth)
- Data Vault tests override per-file: `test.use({ storageState: 'playwright/.auth/tenant-a.json' })`
- Settings tests use default `admin.json` (no override needed)
- Isolation tests use `tenantBPage` fixture from `fixtures.ts` (separate BrowserContext with `tenant-b.json`)

### Test File Organization

```
apps/web-e2e/src/
├── smoke/           # 1E smoke tests (existing)
├── data-vault/      # 2E Data Vault tests (NEW)
│   ├── folders.spec.ts       # [2E-E2E-001a/b/c]
│   ├── files.spec.ts         # [2E-E2E-002a/b]
│   └── tenant-isolation.spec.ts  # [2E-E2E-003a/b]
├── settings/        # 2E Settings tests (NEW)
│   └── llm-admin.spec.ts     # [2E-E2E-004a/b/c/d]
├── fixtures/
│   └── files/
│       ├── test-document.txt
│       └── test-document.pdf
├── auth.setup.ts    # Extended: 3 auth states
├── fixtures.ts      # Extended: tenantBPage fixture
├── global-setup.ts  # Extended: 2 tenants + folders
├── global-teardown.ts
└── env.ts
```

### Project Structure Notes

**Files to create:**
- `apps/web-e2e/src/data-vault/folders.spec.ts`
- `apps/web-e2e/src/data-vault/files.spec.ts`
- `apps/web-e2e/src/data-vault/tenant-isolation.spec.ts`
- `apps/web-e2e/src/settings/llm-admin.spec.ts`
- `apps/web-e2e/src/fixtures/files/test-document.txt`
- `apps/web-e2e/src/fixtures/files/test-document.pdf`

**Files to modify:**
- `apps/web-e2e/src/global-setup.ts` — extend seed with 2 tenants + users + folders
- `apps/web-e2e/src/auth.setup.ts` — 3 auth states
- `apps/web-e2e/src/fixtures.ts` — add `tenantBPage` fixture
- `apps/web-e2e/playwright.config.ts` — NO storageState change needed (keep admin.json default)
- `apps/web/src/app/app/data-vault/data-vault.component.html` — add data-testid
- `apps/web/src/app/app/data-vault/folder-tree.component.ts` — add data-testid
- `apps/web/src/app/app/data-vault/file-card.component.ts` — add data-testid
- `apps/web/src/app/app/data-vault/upload-zone.component.ts` — add data-testid
- `apps/web/src/app/app/data-vault/create-folder-dialog.component.ts` — add data-testid
- `.env.test` — add tenant seed credentials
  - **Note**: `.env.test` is gitignored. Changes won't appear in git status. CI uses fallback defaults hardcoded in `auth.setup.ts` and `global-setup.ts`.

**Files NOT modified (already have data-testid):**
- `apps/web/src/app/admin/settings/llm-models-list.component.ts`
- `apps/web/src/app/admin/settings/provider-config-list.component.ts`

### References

- [Source: Story 1E — E2E infrastructure foundation](stories/1e-e2e-test-coverage-epic-1.md)
- [Source: Story 3.1-3 — LLM Model Admin UI (data-testid patterns)](stories/3.1-3-llm-model-admin-ui.md)
- [Source: Story 3.1-4 — Provider Credential Storage (data-testid patterns)](stories/3.1-4-provider-credential-storage.md)
- [Source: architecture.md — Hexagonal LLM pattern, RLS enforcement]
- [Source: project-context.md — Test ID format, Priority markers, data-testid rule]

### Previous Story Intelligence (1E)

Key learnings from Story 1E:
- `require.resolve()` in playwright.config.ts needs files to exist at config parse time — create stub files first
- `AuthService.onModuleInit()` only seeds in `NODE_ENV=development` — E2E tests use `NODE_ENV=test`, must seed manually
- `bubble_access_token` is the localStorage key (camelCase `accessToken` from API response)
- The `{}` destructuring pattern in Playwright fixtures triggers ESLint `no-empty-pattern` — use `// eslint-disable-next-line`
- `scope:e2e` module boundary already configured to allow `scope:shared` + `scope:db` imports

## Definition of Done

- [x] Extended seed creates 2 tenants + 2 tenant users + 1 folder each
- [x] 3 storageState files created by auth setup (admin, tenant-a, tenant-b)
- [x] Data Vault components have data-testid attributes (5 components)
- [x] 5 spec files with 13 tests total pass
- [x] Multi-tenant isolation test (P0) verifies file/folder isolation
- [x] Settings LLM admin tests verify CRUD round-trips
- [x] Test file fixtures are git-tracked in fixtures/files/
- [x] All 1028+ unit tests still pass
- [x] Lint passes with 0 errors
- [x] Code review passed — party mode review (4 findings: M1 accept, M2 fix, L1 fix, L2 fix)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation, no debugging required.

### Completion Notes List

- Extended `global-setup.ts` with 2 tenants (Alpha/Beta) + customer_admin users + 1 root folder each
- Refactored `auth.setup.ts` — extracted `createStorageState()` helper, 3 auth setups (admin, tenant-a, tenant-b)
- Extended `fixtures.ts` with `tenantBPage` fixture using separate BrowserContext
- Added ~25 `data-testid` attributes across 5 Data Vault components (data-vault.component.html, folder-tree, file-card, upload-zone, create-folder-dialog)
- Created test fixture files: `test-document.txt` (plain text) + `test-document.pdf` (minimal valid PDF)
- 4 spec files, 11 tests total: folders (3), files (2), tenant-isolation (2), llm-admin (4)
- Added tenant seed credentials to `.env.test`
- 878 unit tests pass, 0 lint errors

### File List

**Created:**
- `apps/web-e2e/src/data-vault/folders.spec.ts`
- `apps/web-e2e/src/data-vault/files.spec.ts`
- `apps/web-e2e/src/data-vault/tenant-isolation.spec.ts`
- `apps/web-e2e/src/settings/llm-admin.spec.ts`
- `apps/web-e2e/src/fixtures/files/test-document.txt`
- `apps/web-e2e/src/fixtures/files/test-document.pdf`

**Modified:**
- `apps/web-e2e/src/global-setup.ts` — extended seed with 2 tenants + users + folders
- `apps/web-e2e/src/auth.setup.ts` — refactored for 3 auth states
- `apps/web-e2e/src/fixtures.ts` — added tenantBPage fixture
- `apps/web/src/app/app/data-vault/data-vault.component.html` — data-testid attributes
- `apps/web/src/app/app/data-vault/folder-tree.component.ts` — data-testid attributes
- `apps/web/src/app/app/data-vault/file-card.component.ts` — data-testid attributes
- `apps/web/src/app/app/data-vault/upload-zone.component.ts` — data-testid attributes
- `apps/web/src/app/app/data-vault/create-folder-dialog.component.ts` — data-testid attributes
- `.env.test` — tenant seed credentials
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story status updated

### Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Original placeholder story created from Epic 3 discussion item #5 |
| 2026-02-07 | SM (Party Mode + Create-Story) | Complete rewrite per party mode consensus: Data Vault E2E + Settings E2E + tenant isolation. Hybrid seed strategy, 3 auth states, 11 tests across 4 spec files. data-testid plan for 5 components. |
| 2026-02-07 | Party Mode Review (TEA + Dev + Architect) | 11 findings (2H, 4M, 4L): (F5-HIGH) Keep admin.json default storageState — changing breaks 1E smoke tests, (F9-HIGH) RLS timing — test validates API-level isolation not raw DB-level, (F1) Zone B routing + JWT tenantId, (F2) tenantBPage browser context pattern, (F3) remove rename from AC3, (F4) commit real PDF, (F6) folder seed tenantId, (F7/F10) settings tabs already have data-testid, (F8) 5→4 spec files, (F11) testDir verification note. All fixes applied. |
| 2026-02-07 | Dev (Claude Opus 4.6) | Implementation complete — 6 files created, 10 files modified. 11 E2E tests across 4 spec files (folders 3, files 2, isolation 2, llm-admin 4). ~25 data-testid attributes on 5 Data Vault components. 3 auth states. Hybrid seed (3 tenants, 3 users, 2 folders). 878 unit tests pass, 0 lint errors. |
| 2026-02-07 | Dev (Code Review Fixes) | Fixed 9 review findings (3H, 4M, 2L): H1 — APIRequestContext type in auth.setup.ts, H2 — deterministic waits replacing waitForTimeout in tenant-isolation.spec.ts, H3 — page.once dialog handler in files.spec.ts, M1 — corrected archive endpoint (DELETE not PATCH) in dev notes, M2 — scoped edit button locator within models list, M3 — aria-pressed attribute check replacing isChecked() for custom toggle button, M4 — .env.test gitignored note, L1 — test count corrected to 11. |
| 2026-02-08 | Dev (Opus 4.6) | Comprehensive rewrite: added 2 invitation tests (005a dialog + 005b list/revoke). 8 data-testid attrs added (5 invite dialog, 3 tenant detail). Direct DB seeding for 005b (bypasses SMTP). Total: 13 tests across 5 spec files. 1028+ unit tests, 0 lint errors. |
| 2026-02-09 | Party Mode Review (TEA + Dev + SM) | 4 findings (0H, 2M, 2L): M1 — createTestDataSource() duplicates connection logic (ACCEPT — test-only, 2 call sites); M2 — .status-badge CSS selector replaced with data-testid invitation-status-{id}; L1 — text prefix row locator replaced with data-testid invitation-row-{id}; L2 — Tasks 1-8 checkboxes ticked to match Completion Notes. 2 data-testid attrs added to tenant-detail.component.html. |
