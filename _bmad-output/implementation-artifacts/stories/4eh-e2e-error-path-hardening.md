# Story 4EH: E2E Error Path Hardening

Status: done

## Story

As a **developer or QA engineer**,
I want **E2E tests covering critical error paths across all epics (1-4), plus fixes for the 2 known flaky tests**,
so that **we have regression protection for error handling, validation, and graceful degradation, and the E2E suite is reliable with zero known flaky tests**.

## Context

This is the final implementation story in Epic 4 before the retrospective. It adds error-path E2E tests and fixes 2 pre-existing flaky tests.

**Party Mode Decisions (locked):**
- **Q1 — Priority error paths**: Auth errors (P0), form validation (P0), API 4xx + resource not found (P1), cross-tenant UI navigation (P1). Skip: network simulation (brittle/complex), credit exhaustion (covered by unit+contract tests in 4-4).
- **Q2 — Fix 2 flaky tests in this story**: Archive file timing (files.spec.ts) + login redirect timeout (login.spec.ts).
- **Q3 — Sizing**: 6 tasks, ~12-15 tests. Within Rule 11.
- **Q4 — Runtime actions only**: No new seed data in global-setup.ts. All error paths triggered at runtime (wrong credentials, empty forms, invalid navigation).
- **Q5 — No shared infra changes**: No modifications to global-setup.ts, fixtures.ts, test-db-helpers.ts, playwright.config.ts, or env.ts.
- **Q6 — Resource-not-found test**: Navigate to non-existent execution UUID, verify graceful error (not crash).
- **Q7 — Cross-tenant UI navigation**: Tenant B browses to Tenant A execution detail URL in browser, verify error handling.
- **Q8 — Convention documentation**: Document "1-2 error paths per XE story" convention in out-of-scope for future reference.

**Current E2E State:**
- 62 total tests (56 pass, 2 pre-existing flaky, 4 chain-skipped)
- 20 spec files across `smoke/`, `admin/`, `data-vault/`, `workflow-studio/`, `settings/`, `epic4/`
- 2 flaky tests:
  - `login.spec.ts` line 22: `waitForURL('**/admin/dashboard', { timeout: 15_000 })` — times out sporadically
  - `files.spec.ts` line 61: `toHaveCount(0, { timeout: 10_000 })` — race condition after archive dialog

**Existing Error Tests (for reference, NOT re-testing):**
- `[1E-E2E-002b]` Wrong password shows error message (login.spec.ts)
- `[1E-E2E-002c]` Unauthenticated user redirected to login
- `[1E-E2E-005a]` Non-admin redirected from /admin/ routes
- `[1E-E2E-005b]` Suspended tenant gets 403 on /api/app/*
- `[2E-E2E-005a]` Invitation email failure shows error
- `[3E-E2E-006a]` Wizard empty required fields shows validation error
- `[4-hide-chain-ui-E2E-001]` Removed routes show 404 page
- `[4E-E2E-004b]` Tenant B cannot view Tenant A run detail via API

**Flaky Test Root Causes:**
1. **Login redirect** (`login.spec.ts:22`): `page.waitForURL()` uses a single-shot check with timeout. If the redirect is slow (server cold start, CI load), it times out. Fix: Replace with `expect(page).toHaveURL()` which uses Playwright's auto-retry polling.
2. **Archive file** (`files.spec.ts:61`): After `dialog.accept()`, the archive API call + UI re-render is async. The `toHaveCount(0)` assertion can fire before the API response arrives. Fix: Use `expect().toPass()` polling wrapper or add a `waitForResponse` before the count assertion.

**Error Path Categories:**
| Category | Priority | Tests | Spec Location |
|----------|----------|-------|---------------|
| Flaky test fixes | P0 | 2 fixes (0 new tests) | login.spec.ts, files.spec.ts |
| Auth error paths | P0 | 2 new tests | smoke/login.spec.ts |
| Form validation errors | P0 | 1 new test | epic4/catalog.spec.ts |
| API 4xx + not-found | P1 | 3 new tests | epic4/execution-detail.spec.ts, epic4/catalog.spec.ts |
| Cross-tenant UI errors | P1 | 2 new tests | epic4/isolation.spec.ts |
| Regression gate | gate | 0 new (run all) | all spec files |

## Acceptance Criteria

### AC1: Flaky Test Fixes
**Given** the 2 known flaky E2E tests
**When** the fixes are applied
**Then** `login.spec.ts` uses `expect(page).toHaveURL()` polling instead of `waitForURL()`
**And** `files.spec.ts` uses `waitForResponse` or `toPass()` polling after archive action
**And** both tests pass consistently (run 3x to verify stability)

### AC2: Auth Error Path Tests
**Given** an unauthenticated or incorrectly-authenticated user
**When** they attempt to access protected routes
**Then** a test verifies that submitting login with invalid email format shows a client-side validation error
**And** a test verifies that navigating to `/app/` routes with a garbage/expired token redirects to login (not crash)

### AC3: Form Validation Error Tests
**Given** a user interacting with forms that have required fields
**When** they submit without filling required fields
**Then** a test verifies that the workflow run form disables submit when required inputs are empty (button disabled state)

### AC4: API 4xx + Resource Not Found Tests
**Given** a user navigating to resources that don't exist or are invalid
**When** they enter an invalid URL
**Then** a test verifies that navigating to `/app/executions/00000000-0000-0000-0000-999999999999` (non-existent UUID) shows a graceful error (not a crash or blank page)
**And** a test verifies that navigating to `/app/workflows/run/not-a-uuid` shows an error (malformed template ID)
**And** a test verifies that a generic non-existent top-level route like `/completely-invalid-route` shows the 404 page

### AC5: Cross-Tenant UI Navigation Tests
**Given** Tenant B is logged in
**When** they navigate directly to Tenant A's execution detail URL in the browser
**Then** a test verifies the page shows an error state or empty state (not Tenant A's data)
**And** a test verifies navigating to a non-existent execution as Tenant B shows an error (not Tenant A cross-leak)

### AC6: Regression Gate
**Given** all new and existing E2E tests
**When** the full suite runs
**Then** 0 flaky tests remain (previously-flaky tests now stable)
**And** all new error path tests pass
**And** all pre-existing tests still pass (70 total: 58 existing pass + 8 new + 4 chain-skipped = 66 pass + 4 skip)

## Tasks / Subtasks

- [x] Task 1: Fix 2 flaky E2E tests (AC: #1)
  - [x] 1.1 Fix `login.spec.ts` — replaced `page.waitForURL()` + `expect().toHaveURL()` with single `expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15_000 })`
  - [x] 1.2 Fix `files.spec.ts` — added `waitForResponse` filtering on `DELETE /api/app/assets/` before `toHaveCount(0)` assertion
  - [x] 1.3 Verified stability — both fixed tests pass across 3 consecutive full suite runs

- [x] Task 2: Auth error path tests (AC: #2)
  - [x] 2.1 Added `[4EH-E2E-001a]` to `login.spec.ts`: invalid email format → `data-testid="login-email-error"` visible with "valid email" text
  - [x] 2.2 Added `[4EH-E2E-001b]` to `login.spec.ts`: garbage JWT in localStorage → navigate to `/app/data-vault` → redirected to `/auth/login`

- [x] Task 3: Form validation error tests (AC: #3)
  - [x] 3.1 Added `[4EH-E2E-002a]` to `epic4/catalog.spec.ts`: navigate to run form → submit button is disabled when required inputs empty
  - ~~3.2 Duplicate workflow name 409~~ — DROPPED: Backend explicitly allows duplicate names (names are NOT unique). See Out-of-Scope.

- [x] Task 4: API 4xx + resource not found tests (AC: #4)
  - [x] 4.1 Added `[4EH-E2E-003a]` to `epic4/execution-detail.spec.ts`: non-existent UUID → `detail-not-found` state visible
  - [x] 4.2 Added `[4EH-E2E-003b]` to `epic4/catalog.spec.ts`: `/app/workflows/run/not-a-uuid` → `run-form-error` state visible
  - [x] 4.3 Added `[4EH-E2E-003c]` to `smoke/navigation.spec.ts`: `/completely-invalid-route` → 404 heading visible (used top-level route since Angular child routing under `/app/` doesn't cascade to root wildcard)

- [x] Task 5: Cross-tenant UI navigation tests (AC: #5)
  - [x] 5.1 Added `[4EH-E2E-004a]` to `epic4/isolation.spec.ts`: Tenant B → Tenant A execution detail → `detail-not-found` visible + `detail-status-badge` NOT visible
  - [x] 5.2 Added `[4EH-E2E-004b]` to `epic4/isolation.spec.ts`: Tenant B → non-existent execution → `detail-not-found` visible

- [x] Task 6: Regression gate (AC: #6)
  - [x] 6.1 Stopped dev servers
  - [x] 6.2 Ran full E2E suite 3 times consecutively
  - [x] 6.3 Verified: 66 pass, 0 fail, 4 skip (chain-skipped). Zero flaky tests.

## Dev Notes

### Flaky Test Fix Details

**Login redirect fix (`login.spec.ts:22`):**
```typescript
// BEFORE (flaky — single-shot waitForURL):
await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });
await expect(page).toHaveURL(/\/admin\/dashboard/);

// AFTER (stable — polling toHaveURL):
await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15_000 });
```
Remove the `waitForURL` entirely. `expect(page).toHaveURL()` uses Playwright's auto-retry mechanism which polls until the assertion passes or times out. This is strictly more robust than `waitForURL`.

**Archive file fix (`files.spec.ts:61`):**
```typescript
// BEFORE (flaky — immediate count check after dialog):
page.once('dialog', (dialog) => dialog.accept());
await page.getByTestId('archive-selected-btn').click();
await expect(page.locator('[data-testid^="file-item-"]')).toHaveCount(0, { timeout: 10_000 });

// AFTER (stable — wait for API response, then check):
const archiveResponsePromise = page.waitForResponse(
  (resp) => resp.url().includes('/api/app/assets/') && resp.request().method() === 'DELETE' && resp.ok()
);
page.once('dialog', (dialog) => dialog.accept());
await page.getByTestId('archive-selected-btn').click();
await archiveResponsePromise;
await expect(page.locator('[data-testid^="file-item-"]')).toHaveCount(0, { timeout: 10_000 });
```
The `waitForResponse` ensures we don't check the DOM until after the API has responded, giving Angular time to re-render.

### Error Path Test Patterns

**Auth error — invalid email format:**
The login form likely has HTML5 `type="email"` validation or Angular reactive form validators. Fill with `not-an-email`, submit, check for visible error.

**Auth error — garbage token:**
Use `storageState: { cookies: [], origins: [] }` (unauthenticated). Before navigating, inject a garbage token into localStorage:
```typescript
await page.goto('/auth/login'); // need a page context first
await page.evaluate(() => localStorage.setItem('bubble_access_token', 'garbage.jwt.token'));
await page.goto('/app/data-vault');
await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 });
```

**Run form empty submit:**
Navigate to `/app/workflows/run/${SEED_PUBLISHED_TEMPLATE_ID}`, wait for form to load, click submit without filling inputs. Assert validation error visible and no navigation away.

**Duplicate workflow name (409) — DROPPED:**
Investigation revealed that backend explicitly allows duplicate workflow template names. Unit test `[3.3-UNIT-002]` confirms: "Given duplicate name, when create is called, then it succeeds (names are not unique)." No 409 error to test. Moved to Out-of-Scope.

**Non-existent execution UUID:**
Navigate to `/app/executions/00000000-0000-0000-0000-999999999999`. The API will return 404. The component should show an error banner or redirect. Assert: error state visible OR redirect to execution list.

**Malformed template ID in run URL:**
Navigate to `/app/workflows/run/not-a-uuid`. The API call will fail (400 or 404). Assert: error state visible, not a crash.

**Cross-tenant UI navigation (Tenant B → Tenant A detail):**
Different from existing `[4E-E2E-004b]` which tests API-level access. This tests BROWSER navigation:
```typescript
test('Tenant B navigates to Tenant A execution detail URL', async ({ tenantBPage }) => {
  await tenantBPage.goto(`/app/executions/${SEED_RUN_COMPLETED_ID}`);
  // Should show error state, empty state, or redirect — NOT Tenant A's data
  // The component will call GET /api/app/workflow-runs/:id which returns 404 (RLS)
  // Component should handle 404 gracefully
  await expect(tenantBPage.getByTestId('error-banner')).toBeVisible({ timeout: 10_000 });
  // OR: await expect(tenantBPage).toHaveURL(/\/app\/executions$/, { timeout: 10_000 });
});
```

### Test ID Numbering Convention

Continue from existing test IDs:
- Auth error tests: `[4EH-E2E-001a]`, `[4EH-E2E-001b]`
- Form validation: `[4EH-E2E-002a]`
- API 4xx/not-found: `[4EH-E2E-003a]`, `[4EH-E2E-003b]`, `[4EH-E2E-003c]`
- Cross-tenant UI: `[4EH-E2E-004a]`, `[4EH-E2E-004b]`

### Console Error Monitoring

For error path tests that intentionally trigger errors: the console error monitoring pattern (used in wizard.spec.ts and isolation.spec.ts) may catch expected console.error() calls. For tests that expect API errors, filter known patterns:
```typescript
const ignoredErrors = ['401', '403', '404', 'Unauthorized'];
const unexpectedErrors = consoleErrors.filter(e => !ignoredErrors.some(ie => e.includes(ie)));
expect(unexpectedErrors).toHaveLength(0);
```

### Files Modified (NO new files)

All new tests added to EXISTING spec files — no new spec files created:
- `apps/web-e2e/src/smoke/login.spec.ts` — fix flaky + 2 new auth error tests
- `apps/web-e2e/src/data-vault/files.spec.ts` — fix flaky archive test
- `apps/web-e2e/src/epic4/catalog.spec.ts` — 2 new tests (run form validation + malformed URL)
- `apps/web-e2e/src/epic4/execution-detail.spec.ts` — 1 new not-found test
- `apps/web-e2e/src/epic4/isolation.spec.ts` — 2 new cross-tenant UI tests
- `apps/web-e2e/src/smoke/navigation.spec.ts` — 1 new 404 route test

### Project Structure Notes

- No new files created — all tests added to existing spec files
- No shared infra changes (global-setup.ts, fixtures.ts, test-db-helpers.ts, playwright.config.ts, env.ts)
- No new seed data — all error paths triggered at runtime

### References

- [Source: apps/web-e2e/src/smoke/login.spec.ts] — flaky test #1 (line 22)
- [Source: apps/web-e2e/src/data-vault/files.spec.ts] — flaky test #2 (lines 55-63)
- [Source: apps/web-e2e/src/fixtures.ts] — tenantBPage fixture definition
- [Source: apps/web-e2e/src/epic4/isolation.spec.ts] — cross-tenant test patterns, JWT extraction
- [Source: apps/web-e2e/src/workflow-studio/02-wizard.spec.ts] — console error monitoring pattern, validation assertion pattern
- [Source: apps/web-e2e/src/epic4/catalog.spec.ts] — run form navigation pattern
- [Source: apps/web-e2e/src/epic4/execution-detail.spec.ts] — detail page assertion patterns
- [Source: apps/web-e2e/src/smoke/navigation.spec.ts] — 404 page heading assertion
- [Source: project-context.md] — Rules 10, 12, 12b, 26, 27, 29, 30

## Out-of-Scope

| Item | Tracked In |
|------|-----------|
| Network simulation tests (offline, slow 3G) | Future XE story — brittle, not reliable in CI |
| Credit exhaustion error path | Covered by unit+contract tests in Story 4-4 |
| 500 server error pages | Requires mock server — future infrastructure story |
| Test run modal error paths | Covered by unit tests in Story 4-7b |
| Retry button error paths | Covered by unit tests in Story 4-5 |
| Duplicate workflow name 409 test | Backend explicitly allows duplicate names (`names are not unique` — confirmed by unit test `[3.3-UNIT-002]`). No 409 to test. |
| **Convention: 1-2 error paths per XE story** | Future XE stories should include 1-2 error path tests alongside happy paths (party mode Q8 decision). This story establishes the error path baseline; future stories maintain it incrementally. |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Archive flaky fix: initial implementation used `PATCH` method and `/assets` URL pattern — test timed out on `waitForResponse`. Investigation: `AssetService.archive()` uses `DELETE /api/app/assets/:id`. Fixed filter to match actual API.
- Duplicate name test: investigated backend — `[3.3-UNIT-002]` confirms names are NOT unique. Dropped Task 3.2.
- `/app/nonexistent` route: Angular child route matching under `/app/` parent doesn't cascade to root wildcard. Changed to `/completely-invalid-route` which hits root `**` wildcard directly.

### Completion Notes List

- 8 new E2E tests added (2 auth, 1 form validation, 3 API 4xx/not-found, 2 cross-tenant UI)
- 2 flaky tests fixed (login redirect + archive timing)
- 0 new files created — all tests added to existing spec files
- 0 shared infra changes
- 66 pass, 0 fail, 4 skip across 3 consecutive runs
- AC3 reduced from 2 tests to 1 (duplicate name not applicable)
- Total E2E: 70 tests (66 pass + 4 chain-skipped)

### File List

| File | Change |
|------|--------|
| `apps/web-e2e/src/smoke/login.spec.ts` | Flaky fix (line 22) + 2 new tests `[4EH-E2E-001a]`, `[4EH-E2E-001b]` |
| `apps/web-e2e/src/data-vault/files.spec.ts` | Flaky fix — added `waitForResponse` for `DELETE /api/app/assets/` |
| `apps/web-e2e/src/epic4/catalog.spec.ts` | 2 new tests `[4EH-E2E-002a]`, `[4EH-E2E-003b]` |
| `apps/web-e2e/src/epic4/execution-detail.spec.ts` | 1 new test `[4EH-E2E-003a]` |
| `apps/web-e2e/src/epic4/isolation.spec.ts` | 2 new tests `[4EH-E2E-004a]`, `[4EH-E2E-004b]` |
| `apps/web-e2e/src/smoke/navigation.spec.ts` | 1 new test `[4EH-E2E-003c]` |
| `apps/web/src/app/auth/login/login.component.html` | Added `data-testid="login-email-error"` to validation span (N2-1 fix) |
