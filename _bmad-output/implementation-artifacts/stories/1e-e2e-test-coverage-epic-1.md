# Story 1E: E2E Test Framework & Smoke Tests

Status: done

## Story

As a **Developer**,
I want **Playwright E2E infrastructure with auth fixtures, test DB lifecycle, and 3 smoke tests**,
so that **all future E2E stories (2E, 3E) have a working framework and proven patterns to build on**.

## Background

The project has 878 unit tests but zero E2E tests. Unit tests mock everything and never start the actual server. Critical bugs were discovered during manual UI testing that unit tests completely missed (API gateway crashes, navigation 404s, auth flow failures). This story establishes the E2E testing foundation — framework, infrastructure, and 3 smoke tests that prove the stack works end-to-end. Epic-specific test scenarios are deferred to Stories 2E and 3E.

**Party Mode Consensus (2026-02-07):**
- Framework: **Playwright via `@nx/playwright`** (unanimous — Playwright over Cypress for modern Angular, auto-wait, trace viewer, better CI story)
- Scope: **Framework + infrastructure + 3 smoke tests ONLY** (not epic-specific scenarios)
- Test DB: **Ephemeral `project_bubble_test`**, created in `global-setup.ts`, dropped in `global-teardown.ts`
- Auth: **API-level login** (`POST /api/auth/login`), `storageState` reuse (no UI login per test)
- Server: **Playwright `webServer` config** — auto-start NestJS for CI, `reuseExistingServer: !process.env.CI` for local dev
- North Star (Story 3E): Login → Workflow Studio → Create workflow → Save → See in list

## Acceptance Criteria

1. **AC1: Playwright Installed** — `@nx/playwright` installed matching Nx workspace version. Cypress plugin removed from `nx.json`. `apps/web-e2e/` project created with `project.json` and `playwright.config.ts`.
2. **AC2: Test Database Lifecycle** — `global-setup.ts` creates `project_bubble_test` database, runs TypeORM `synchronize: true` to create all tables, seeds admin user. `global-teardown.ts` drops the test database. Tests use `.env.test` with `POSTGRES_DB=project_bubble_test`.
3. **AC3: Auth Fixture** — `auth.setup.ts` performs API-level login (`POST /api/auth/login` with seeded admin credentials), saves `storageState` to `playwright/.auth/admin.json`. All test projects depend on `setup` project. Auth state file is in `.gitignore`.
4. **AC4: WebServer Config** — `playwright.config.ts` includes `webServer` block that starts `npx nx serve api-gateway` on port 3000 and `npx nx serve web` on port 4200. Uses `reuseExistingServer: !process.env.CI`. `cwd: workspaceRoot` from `@nx/devkit`.
5. **AC5: Smoke Test — Health Check** — E2E test hits `GET /api` (app controller) and verifies 200 response. Proves API gateway starts without entity registration crashes.
6. **AC6: Smoke Test — Login Flow** — E2E test navigates to `/auth/login`, fills email/password, clicks login, asserts redirect to `/admin/dashboard`. Uses seeded admin credentials. Proves auth flow works browser-to-API-to-redirect.
7. **AC7: Smoke Test — Admin Navigation** — E2E test (using saved auth state) navigates to `/admin/dashboard`, verifies page loads, clicks sidebar links (Dashboard, Tenants, Workflows, Settings), asserts each page renders without 404. Proves all admin routes resolve to real components.

## Tasks / Subtasks

- [x] **Task 1: Install Playwright & Create E2E Project** (AC: 1)
  - [x]1.1 Install `@nx/playwright` matching workspace Nx version (`npm install -D @nx/playwright@22.3.3`)
  - [x]1.2 Install `playwright` and `@playwright/test` as devDependencies
  - [x]1.3 Create `apps/web-e2e/` directory with `project.json`, `tsconfig.json`
  - [x]1.4 Create `playwright.config.ts` using `nxE2EPreset` from `@nx/playwright/preset`
  - [x]1.5 Remove `@nx/cypress/plugin` entry from `nx.json` (replace with `@nx/playwright/plugin`)
  - [x]1.6 Add `playwright/.auth/` to root `.gitignore`
  - [x]1.7 Verify `npx nx e2e web-e2e` target is recognized (even if tests don't pass yet)

- [x] **Task 2: Test Database Lifecycle** (AC: 2)
  - [x]2.1 Create `.env.test` at project root with `POSTGRES_DB=project_bubble_test`, `REDIS_HOST=localhost`, `REDIS_PORT=6379` (all other vars same as `.env.example` but with safe test values for `JWT_SECRET`, `ADMIN_API_KEY`). Redis is required — BullMQ module initialization fails without it and the API gateway won't start.
  - [x]2.2 Create `apps/web-e2e/src/global-setup.ts`: connect to default `postgres` database, `CREATE DATABASE project_bubble_test IF NOT EXISTS`, then connect to test DB and run TypeORM `synchronize: true` with all project entities, seed admin user via direct SQL insert (hashed password using bcrypt)
  - [x]2.3 Create `apps/web-e2e/src/global-teardown.ts`: connect to default `postgres` database, terminate active connections to `project_bubble_test`, `DROP DATABASE project_bubble_test`
  - [x]2.4 Wire `globalSetup` and `globalTeardown` in `playwright.config.ts`

- [x] **Task 3: Auth Fixture with storageState** (AC: 3)
  - [x]3.1 Create `apps/web-e2e/src/auth.setup.ts` as a Playwright setup project: `POST /api/auth/login` with `{ email: 'admin@bubble.io', password: 'Admin123!' }`, extract JWT from response, set as cookie/localStorage, save `storageState` to `playwright/.auth/admin.json`
  - [x]3.2 Configure Playwright projects: `setup` project (matches `auth.setup.ts`), `chromium` project with `storageState: 'playwright/.auth/admin.json'` and `dependencies: ['setup']`
  - [x]3.3 Create `apps/web-e2e/src/fixtures.ts` re-exporting `test` and `expect` from `@playwright/test` (extension point for future custom fixtures)

- [x] **Task 4: WebServer Configuration** (AC: 4)
  - [x]4.1 Add `webServer` array to `playwright.config.ts`: first entry starts `npx nx serve api-gateway` on port 3000, second starts `npx nx serve web` on port 4200. Both use `reuseExistingServer: !process.env.CI`, `cwd: workspaceRoot`, `timeout: 120_000`
  - [x]4.2 Set `use.baseURL` to `http://localhost:4200` in Playwright config
  - [x]4.3 Verify local dev workflow: start servers manually → `npx nx e2e web-e2e` reuses them

- [x] **Task 5: Smoke Tests** (AC: 5, 6, 7)
  - [x]5.1 **Add missing `data-testid` attributes to login form** — the login component currently has ZERO `data-testid` attributes. Add: `data-testid="login-email"` to email input, `data-testid="login-password"` to password input, `data-testid="login-submit"` to submit button in `apps/web/src/app/auth/login/login.component.ts` (or its template)
  - [x]5.2 Create `apps/web-e2e/src/smoke/health.spec.ts`: `[1E-E2E-001]` — `GET /api` returns 200 with expected response body
  - [x]5.3 Create `apps/web-e2e/src/smoke/login.spec.ts`: `[1E-E2E-002]` — navigate to `/auth/login`, fill `[data-testid="login-email"]` and `[data-testid="login-password"]`, click `[data-testid="login-submit"]`, assert URL becomes `/admin/dashboard`. This test MUST use `test.use({ storageState: { cookies: [], origins: [] } })` to override the default authenticated state — it tests the actual login UI flow without pre-auth
  - [x]5.4 Create `apps/web-e2e/src/smoke/navigation.spec.ts`: `[1E-E2E-003]` — using auth storageState, navigate to `/admin/dashboard`, verify page heading visible, click sidebar links for Tenants (`/admin/tenants`), Workflows (`/admin/workflows`), Settings (`/admin/settings`), verify each loads without error (check for page-specific content, not 404)

- [x] **Task 6: Documentation & CI Prep** (AC: 1)
  - [x]6.1 Add `e2e` script to root `package.json`: `"e2e": "npx nx e2e web-e2e"`
  - [x]6.2 Add brief section to story dev notes on how to run E2E locally
  - [x]6.3 Ensure all 3 smoke tests pass with `npx nx e2e web-e2e`

## Dev Notes

### Framework Choice: Playwright via @nx/playwright

**Rationale:** Playwright provides auto-wait (no `cy.wait()` hacks), built-in trace viewer for debugging failures, native `storageState` for auth reuse, and first-class `webServer` config for auto-starting dev servers. The `@nx/playwright` plugin integrates with Nx targets and caching. Cypress is already installed but unused — it should be replaced, not run alongside Playwright.

### Key Implementation Details

**Database Strategy:**
- Docker Compose runs Postgres on port 5432 (image: `pgvector/pgvector:pg16`, user: `bubble_user`, password: `bubble_password`)
- `global-setup.ts` creates `project_bubble_test` on the SAME Postgres instance (no separate container)
- Use `new DataSource({...}).initialize()` from TypeORM with `synchronize: true` and ALL entity imports. **DO NOT use `createConnection()` — it is deprecated in TypeORM 0.3+.**
- Entity import path: `import { TenantEntity, UserEntity, ... } from '@project-bubble/db-layer'` — a barrel export at `libs/db-layer/src/lib/entities/index.ts` re-exports ALL 12 entities. Import them all for the DataSource config.
- Seed admin user: `email: 'admin@bubble.io'`, `password: 'Admin123!'` (bcrypt hashed), `role: 'bubble_admin'`, `tenantId: '00000000-0000-0000-0000-000000000000'` (system admin nil UUID — matches `AuthService.onModuleInit()`)
- **Import ALL 12 entities** — this is what caught the missing entity registration bug in Epic 3
- **Test DB has NO RLS policies.** `RlsSetupService` runs only inside NestJS `onModuleInit`, not during raw TypeORM sync. This is intentional for 1E — RLS testing is a 2E/3E concern when tenant-scoped operations are tested.

**Auth Strategy:**
- API-level auth: `POST http://localhost:3000/api/auth/login` returns `{ accessToken: string }` (**camelCase**, not snake_case)
- The Angular `AuthService` stores the JWT in localStorage under key **`bubble_access_token`** (see `apps/web/src/app/core/services/auth.service.ts` line 7: `const TOKEN_KEY = 'bubble_access_token'`)
- `auth.setup.ts` must: (1) call the login API, (2) extract `accessToken` from response, (3) set `localStorage.setItem('bubble_access_token', accessToken)` in a browser context, (4) save `storageState`
- Login smoke test: MUST explicitly override storageState with `test.use({ storageState: { cookies: [], origins: [] } })` — it tests the actual login UI flow without pre-auth
- Navigation smoke test: DOES use storageState — pre-authenticated
- **Throttle warning:** Login endpoint is rate-limited to 5 requests per 60 seconds (`@Throttle`). Not a problem for normal test runs (2 login calls), but could cause flakiness if tests are re-run rapidly in development. If hit, increase throttle limit in `.env.test` or add a brief wait.

**Server Startup:**
- `webServer` config starts BOTH api-gateway (port 3000) and web (port 4200). Playwright starts array entries in parallel but polls each `url` until responsive — order in the array doesn't matter as long as both URLs are checked
- For local dev: run `docker-compose up -d` first (Postgres + Redis), then `npx nx e2e web-e2e` auto-starts both servers
- For CI: everything starts from scratch (no `reuseExistingServer`)
- API gateway `main.ts` requires `JWT_SECRET` and `ADMIN_API_KEY` env vars to not be default values — `.env.test` must set non-default values
- **Redis is required** — Docker Compose must be running before E2E tests start. BullMQ module fails without Redis, crashing the API gateway

**Test ID Selectors:**
- Project has 298 `data-testid` occurrences across 49 files (Rule 10 in project-context.md)
- Use `page.getByTestId('login-email')` selector pattern
- If a needed `data-testid` is missing from an existing component, ADD IT (do not use CSS selectors)

### What This Story Does NOT Include

- Epic 1 test scenarios (auth CRUD, tenant management, user invitations) → Story 2E/3E
- Epic 2 test scenarios (Data Vault, file upload) → Story 2E
- Epic 3 test scenarios (Workflow Studio, wizard) → Story 3E
- Epic 3.1 test scenarios (Settings, Providers, LLM Models) → Story 2E
- CI/CD pipeline integration → Story 1.11 (deferred)
- Multiple browser testing (Firefox, WebKit) → only Chromium for now
- Performance/load testing → Story 7P-7

### Project Structure Notes

```
apps/
  web-e2e/                          # NEW — Playwright E2E project
    src/
      smoke/
        health.spec.ts              # [1E-E2E-001] API health check
        login.spec.ts               # [1E-E2E-002] Login flow
        navigation.spec.ts          # [1E-E2E-003] Admin nav routes
      auth.setup.ts                 # Auth fixture — API login + storageState
      env.ts                        # Shared dotenv loader (loads .env.test)
      global-setup.ts               # Create test DB + seed
      global-teardown.ts            # Drop test DB
      fixtures.ts                   # Re-export test/expect (extension point)
    project.json                    # Nx project config with e2e target
    tsconfig.json                   # TypeScript config
    playwright.config.ts            # Playwright config with webServer + projects
  web/                              # Existing Angular app (port 4200)
  api-gateway/                      # Existing NestJS API (port 3000)
.env.test                           # NEW — Test environment variables
.gitignore                          # MODIFIED — add playwright/.auth/, dist/.playwright/, .env.test
eslint.config.mjs                   # MODIFIED — add scope:e2e dep constraint
nx.json                             # MODIFIED — replace Cypress plugin with Playwright
package.json                        # MODIFIED — add @nx/playwright, playwright, dotenv deps + e2e scripts
apps/web/src/app/auth/login/
  login.component.html              # MODIFIED — add data-testid to form, email, password, submit, error
apps/web/src/app/admin/
  admin-layout.component.html       # MODIFIED — add data-testid to sidebar-nav and nav items
```

### Existing Infrastructure to Reuse

| Component | Location | Notes |
|-----------|----------|-------|
| All TypeORM entities | `libs/db-layer/src/lib/entities/` | Import ALL for `synchronize: true` in test DB |
| Auth controller | `apps/api-gateway/src/app/auth/auth.controller.ts` | `POST /api/auth/login` — throttled (5/min) |
| Login component | `apps/web/src/app/auth/login/login.component.ts` | **MISSING `data-testid`** — must be added (Task 5.1) |
| Admin layout | `apps/web/src/app/admin/admin-layout.component.ts` | Sidebar with nav links |
| App routes | `apps/web/src/app/app.routes.ts` | All admin routes: dashboard, tenants, workflows, settings |
| Docker Compose | `docker-compose.yml` | Postgres (pgvector:pg16) + Redis (alpine) |
| Env example | `.env.example` | Template for `.env.test` |

### References

- [Source: project-context.md#Rule-10] Test IDs Everywhere — `data-testid` on all interactive elements
- [Source: project-context.md#Rule-12] E2E Test Rule — every story MUST include E2E coverage
- [Source: project-context.md#Rule-12b] AC-to-Test Traceability — mapping table required
- [Source: sprint-status.yaml#L170-224] Retro note: E2E coverage is zero, unit tests miss real bugs
- [Source: architecture.md#Tech-Stack] Nx monorepo, Angular 21+, NestJS 11+, PostgreSQL 16+ (pgvector)
- [Source: .env.example] All environment variables needed for `.env.test`
- [Source: docker-compose.yml] Postgres config: user=bubble_user, password=bubble_password, db=bubble_db
- [Source: apps/api-gateway/src/main.ts] JWT_SECRET and ADMIN_API_KEY validation on startup
- [Source: Party Mode 2026-02-07] Unanimous consensus on Playwright, test DB strategy, auth fixture pattern

## Test Traceability

| AC | Test ID | Test File | Description |
|----|---------|-----------|-------------|
| AC1 | — | — | Verified by: `npx nx e2e web-e2e` target resolves |
| AC2 | — | global-setup.ts / global-teardown.ts | Verified by: DB created before tests, dropped after |
| AC3 | — | auth.setup.ts | Verified by: storageState file created, used by chromium project |
| AC4 | — | playwright.config.ts | Verified by: servers auto-start when not pre-running |
| AC5 | [1E-E2E-001] | smoke/health.spec.ts | GET /api returns 200 |
| AC6 | [1E-E2E-002] | smoke/login.spec.ts | Login form → API → redirect to dashboard |
| AC7 | [1E-E2E-003] | smoke/navigation.spec.ts | All admin sidebar routes load without 404 |

## Definition of Done

- [x] Playwright installed, `apps/web-e2e/` project exists with valid config
- [x] Cypress plugin removed from `nx.json`
- [x] Test database lifecycle works (create → seed → test → drop)
- [x] Auth fixture creates reusable `storageState`
- [x] All 3 smoke tests pass: health, login, navigation
- [x] `npx nx e2e web-e2e` runs successfully end-to-end
- [x] Smoke tests execute in under 30 seconds after servers are ready (wall-clock time for test execution only, excluding server startup)
- [x] Code review passed

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Nx graph resolution failed initially because `require.resolve()` in `playwright.config.ts` requires `global-setup.ts` and `global-teardown.ts` to exist at config parse time — fixed by creating placeholder stubs before real implementation.

### Completion Notes List
- All 6 tasks complete, all 7 ACs implemented
- 376 unit tests passing, 0 lint errors across 6 projects
- `dotenv` added as devDependency (was transitive only via `@nestjs/config`)
- `scope:e2e` tag added to `project.json` with matching eslint dep constraint
- `data-testid` added to login form (4 attrs) and admin-layout sidebar (dynamic nav items)
- Test DB seed: creates system tenant (nil UUID) + admin user matching `AuthService.onModuleInit()` pattern

### File List
**New files:**
- `apps/web-e2e/project.json`
- `apps/web-e2e/tsconfig.json`
- `apps/web-e2e/playwright.config.ts`
- `apps/web-e2e/src/env.ts`
- `apps/web-e2e/src/global-setup.ts`
- `apps/web-e2e/src/global-teardown.ts`
- `apps/web-e2e/src/auth.setup.ts`
- `apps/web-e2e/src/fixtures.ts`
- `apps/web-e2e/src/smoke/health.spec.ts`
- `apps/web-e2e/src/smoke/login.spec.ts`
- `apps/web-e2e/src/smoke/navigation.spec.ts`
- `.env.test` (gitignored)

**Modified files:**
- `.gitignore` — added `playwright/.auth/`, `dist/.playwright/`, `.env.test`
- `nx.json` — replaced `@nx/cypress/plugin` with `@nx/playwright/plugin`
- `eslint.config.mjs` — added `scope:e2e` dep constraint
- `package.json` — added `@nx/playwright`, `@playwright/test`, `dotenv` deps + `e2e`/`e2e:ui` scripts
- `apps/web/src/app/auth/login/login.component.html` — added 5 `data-testid` attributes
- `apps/web/src/app/admin/admin-layout.component.html` — added `data-testid` to sidebar-nav and nav items

### Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Original placeholder story created from Epic 3 discussion item #5 |
| 2026-02-07 | SM (Party Mode + Create-Story) | Complete rewrite: scoped to framework + infra + 3 smoke tests per party mode consensus. Playwright via @nx/playwright, test DB lifecycle, auth fixture, webServer config. |
| 2026-02-07 | Party Mode Review | 9 findings applied: (1) login data-testid missing — added subtask, (2) auth response camelCase + localStorage key documented, (3) .env.test needs Redis, (4) test DB has no RLS — noted as intentional, (5) createConnection deprecated → DataSource, (6) login test needs storageState override, (7) entity barrel export path clarified, (8) DoD timing tightened, (9) throttle rate noted. |
| 2026-02-07 | Dev (Claude Opus 4.6) | Implementation complete — all 6 tasks, 7 ACs. 376 unit tests, 0 lint errors. |
| 2026-02-07 | Code Review | 9 findings (3H, 4M, 2L) — all fixed: (H1) tenantId docs null→nil UUID, (H2) task checkboxes marked, (H3) test IDs + priority markers added, (M1) missing files documented, (M2) gitignore trailing newline, (M3/M4) error handling in setup/teardown, (L1) shared env loader, (L2) DoD + Dev Agent Record updated. |
| 2026-02-07 | Party Mode (TEA + Dev + Architect) | Post-implementation review — consensus: SHIP IT. Recommendations for 2E: (1) migration-based schema instead of synchronize:true, (2) seed factory/per-test fixtures for data isolation, (3) shared AUTH_STORAGE_KEY constant, (4) canary assertion in auth setup, (5) warn about reuseExistingServer reusing dev DB. |
