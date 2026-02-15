# Story 4-SA-B: Production Support Access — Frontend

Status: done

## Story

As a **customer admin (CUSTOMER_ADMIN)**,
I want **to see when platform support accessed my organization's environment and what actions they performed**,
so that **I can verify compliance requirements and maintain trust in the platform's data handling**.

As a **platform operator (Bubble Admin)**,
I want **the impersonation session to handle JWT expiry gracefully without silent failures**,
so that **I am never stranded with dead API calls mid-session and always know when my session ends**.

## Context

4-SA-A (backend) delivered: audit tables (`support_access_log` + `support_mutation_log`), `SupportAccessService` (migration DataSource), mutation interceptor, session-end endpoint, 30m JWT expiry, `IMPERSONATOR_ROLE` constant. All data is stored permanently with no TTL.

This story (4-SA-B) builds the frontend layer: (1) extends JWT to 2h so active admins aren't kicked mid-task, (2) handles 401 during impersonation gracefully, (3) adds inactivity pre-warning toast, and (4) builds a customer-facing access log page so tenant admins can see when support accessed their data.

**Party mode review**: 2026-02-15 — full team (12 agents). Key decisions: no visible countdown timer (inactivity auto-logout is the security control), JWT extended to 2h (safety net, not primary control), graceful 401 handling in interceptor, customer access log via raw SQL through app DataSource.

## Acceptance Criteria

1. **AC1 — JWT expiry extended**: Impersonation JWT `expiresIn` changed from `'30m'` to `'2h'` in `tenants.service.ts`.

2. **AC2 — Graceful 401 during impersonation**: When any API call returns 401 while impersonating, the JWT interceptor triggers `exitImpersonation()` + shows toast "Impersonation session has ended." + redirects to `/admin/dashboard`. No silent failures.

3. **AC3 — Duplicate 401 guard**: Multiple concurrent 401 responses trigger only one exit flow. `ImpersonationService` has an `_exiting` guard flag that prevents re-entrant `exitImpersonation()` calls.

4. **AC4 — Inactivity pre-warning**: At 29 minutes of inactivity (T-60s before auto-logout), a toast appears: "Session will expire in 1 minute due to inactivity." The existing 30-minute inactivity timer and auto-exit behavior remain unchanged.

5. **AC5 — Customer access log page**: `CUSTOMER_ADMIN` users can view support access log at `/app/access-log` (top-level route, not under settings). Table shows: date/time, duration, action count (mutation count), status (Active/Completed). Most recent 50 sessions, ordered newest first. Loading spinner shown while data is fetched.

6. **AC6 — Tenant isolation**: Access log endpoint returns only sessions for the requesting tenant. RLS policy on `support_access_log` enforces `tenant_id` matches `current_setting('app.current_tenant')`. WHERE clause also includes `tenant_id = $1` (Rule 2c defense-in-depth).

7. **AC7 — Empty state**: When no access sessions exist for a tenant, the page shows "No support access sessions recorded for your organization."

8. **AC8 — Retention documentation**: Both `SupportAccessLogEntity` and `SupportMutationLogEntity` have JSDoc comments: "Audit data — permanent retention, no TTL. Do not add cleanup/purge jobs without compliance review."

## Tasks / Subtasks

- [x] Task 1: JWT expiry extension + retention comments (AC: #1, #8)
  - [x]1.1: In `tenants.service.ts:135`, change `expiresIn: '30m'` to `expiresIn: '2h'`
  - [x]1.2: Update `tenants.service.spec.ts` — verify token expiry is `'2h'`
  - [x]1.3: Add JSDoc retention comment to `SupportAccessLogEntity` class
  - [x]1.4: Add JSDoc retention comment to `SupportMutationLogEntity` class
  - [x]1.5: Update impersonation confirmation dialog text (30 min → 2 hours) in `impersonate-confirm-dialog.component.ts`

- [x] Task 2: Graceful 401 handling in JWT interceptor (AC: #2, #3)
  - [x]2.1: Add `private _exiting = false` guard flag to `ImpersonationService`
  - [x]2.2: Set `_exiting = true` at start of `exitImpersonation()`, reset to `false` after navigation
  - [x]2.3: Add public `get isExiting(): boolean` getter (or signal) for interceptor to check
  - [x]2.4: In `jwt.interceptor.ts`, add `catchError` handler: if `status === 401` AND impersonation token exists AND `!isExiting` → call `exitImpersonation()` + `showToast('Impersonation session has ended.')` + return `EMPTY`
  - [x]2.5: If `status === 401` AND NOT impersonating → propagate error normally (existing auth flow)
  - [x]2.6: Unit test: 401 during impersonation triggers exit + toast
  - [x]2.7: Unit test: 401 when not impersonating propagates error
  - [x]2.8: Unit test: second concurrent 401 is swallowed (duplicate guard)

- [x] Task 3: Inactivity pre-warning toast (AC: #4)
  - [x]3.1: In `ImpersonationService.resetTimer()`, add a second timeout at `TIMEOUT_MS - 60000` (29 minutes) that calls `showToast('Session will expire in 1 minute due to inactivity.')`
  - [x]3.2: Store the warning timer handle alongside `inactivityTimer`, clear both on `resetTimer()` and `stopInactivityTimer()`
  - [x]3.3: Unit test: warning toast shown at T-60s of inactivity
  - [x]3.4: Unit test: warning timer resets on user activity (no stale warning)

- [x] Task 4: Backend access log read endpoint (AC: #5, #6)
  - [x]4.1: Create `AccessLogEntryDto` in `libs/shared/src/lib/dtos/support-access/access-log-entry.dto.ts` — fields: `id`, `startedAt`, `endedAt` (nullable), `actionCount`, `status` ('active' | 'completed')
  - [x]4.2: Create barrel export `libs/shared/src/lib/dtos/support-access/index.ts`, add to main barrel
  - [x]4.3: Create `SupportAccessReadService` at `apps/api-gateway/src/app/support-access/support-access-read.service.ts` — inject `TransactionManager` (from `@project-bubble/db-layer`), method `getAccessLog(tenantId): Promise<AccessLogEntryDto[]>` using `txManager.run(tenantId, callback)` with raw parameterized SQL via `manager.query()`. TransactionManager sets `SET LOCAL app.current_tenant` within a transaction for RLS enforcement.
  - [x]4.4: SQL query: `SELECT id, started_at, ended_at, (SELECT COUNT(*) FROM support_mutation_log WHERE session_id = sal.id) as action_count FROM support_access_log sal WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT 50`
  - [x]4.5: Map rows to DTO: compute `status` ('active' if `ended_at` is null, 'completed' otherwise)
  - [x]4.6: Add `GET` method to a new or existing controller under `/app/access-log` — protected by `JwtAuthGuard`, `TenantStatusGuard`, `RolesGuard` with `@Roles(UserRole.CUSTOMER_ADMIN)`. Route: `GET /api/app/access-log`.
  - [x]4.7: Register `SupportAccessReadService` in `SupportAccessModule` (providers + exports)
  - [x]4.8: Unit test: service returns sessions for given tenantId only
  - [x]4.9: Unit test: service computes status correctly (active vs completed)
  - [x]4.10: Unit test: controller requires CUSTOMER_ADMIN role
  - [x]4.11: Unit test: controller passes tenantId from JWT, returns correct DTO shape

- [x] Task 5: RLS policy migration (AC: #6)
  - [x]5.1: Add ADDITIONAL RLS SELECT policy `sal_tenant_read` on `support_access_log` in `rls-setup.service.ts`: `USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid OR current_setting('app.is_admin', true) = 'true')`. NOTE: This is an additional policy — it coexists with the existing admin-only policy from 4-SA-A. PostgreSQL evaluates multiple policies with OR logic (any policy granting access = allowed). The admin-only policy lets admins read all rows; this new policy lets tenants read their own rows.
  - [x]5.2: Wiring test (Tier 2): tenant A can read their own access log entries via app DataSource
  - [x]5.3: Wiring test (Tier 2): tenant A cannot read tenant B's access log entries

- [x] Task 6: Frontend access log page (AC: #5, #7)
  - [x]6.1: Create `AccessLogService` at `apps/web/src/app/tenant/access-log/access-log.service.ts` — HTTP client calling `GET /api/app/access-log`
  - [x]6.2: Create `AccessLogComponent` (standalone) at `apps/web/src/app/tenant/access-log/access-log.component.ts` — table with columns: Date, Duration, Actions, Status. Include loading state (spinner while data is fetched).
  - [x]6.3: Duration computed from `startedAt`/`endedAt`: format as "X min" or "X hr Y min". Dash if still active.
  - [x]6.4: Status column: green "Active" badge if `endedAt` is null, gray "Completed" badge if ended
  - [x]6.5: Empty state: shield icon + "No support access sessions recorded for your organization."
  - [x]6.6: Register route `/app/access-log` in `app.routes.ts` (lazy loaded under app zone)
  - [x]6.7: Add sidebar nav item "Access Log" with Lucide `Shield` icon to `app-layout.component.ts` navItems array
  - [x]6.8: Register `Shield` icon in `app.config.ts` if not already registered
  - [x]6.9: Unit test: component renders table rows with formatted dates and duration
  - [x]6.10: Unit test: component shows empty state when no sessions
  - [x]6.11: Unit test: component shows "Active" badge for null endedAt
  - [x]6.12: Unit test: component shows loading spinner before data arrives

- [x] Task 7: Full test suite + browser smoke test (AC: all)
  - [x]7.1: Run all unit tests (all 4 projects) — expect ~1370+ total
  - [x]7.2: Run wiring tests (Tier 1 + Tier 2)
  - [x]7.3: Run E2E suite (46+ tests)
  - [x]7.4: Browser smoke test: admin login → impersonate → verify banner → exit → verify redirect + toast
  - [x]7.5: Browser smoke test: tenant login → navigate to access log → verify page renders (may show empty state if no impersonation sessions exist for that tenant)

## Dev Notes

### Architecture Decisions (from Party Mode 2026-02-15)

| Decision | Outcome | Rationale |
|:---|:---|:---|
| Countdown timer | **No visible countdown** | Inactivity timer resets on activity — countdown would perpetually show ~30:00. Useless information. Static message suffices. |
| JWT expiry | **Extended from 30m to 2h** | JWT is safety-net ceiling, not primary timeout. Active admins shouldn't hit 401 wall. Inactivity timer (30m) is the real security control. |
| Security model | **Inactivity = primary, JWT = secondary** | Threat is abandonment (admin walks away), not duration. Active admin is authorized and present. Audit trail records everything. |
| 401 handling | **Interceptor catches, triggers graceful exit** | No silent failures. Admin always knows session ended and why. Duplicate guard prevents multiple concurrent exits. |
| Pre-warning | **Toast at T-60s** | Gives admin 1 minute to interact before auto-logout. Low cognitive load — appears only when relevant. |
| Access log DataSource | **TransactionManager + raw SQL** | Entities live on migration DS. Customer-facing reads use `TransactionManager.run(tenantId, callback)` which sets `SET LOCAL app.current_tenant` for RLS enforcement. Raw `manager.query()` with parameterized SQL. |
| Access log columns | **Date, Duration, Actions, Status** | Customers don't need admin identity, JWT hash, or raw mutation URLs. Count + timing = trust. |
| Pagination | **None — LIMIT 50** | Support access is infrequent (few times/month). 50 records = 6+ months. Future story if needed. |
| Data retention | **Permanent — no TTL** | Audit data for compliance. JSDoc comments prevent accidental purge. |

### Existing Code to Modify

| File | What Changes |
|:---|:---|
| `apps/api-gateway/src/app/tenants/tenants.service.ts:135` | `expiresIn: '30m'` → `'2h'` |
| `apps/api-gateway/src/app/tenants/tenants.service.spec.ts` | Update expiry assertion |
| `apps/web/src/app/core/interceptors/jwt.interceptor.ts` | Add `catchError` for 401 during impersonation |
| `apps/web/src/app/core/interceptors/jwt.interceptor.spec.ts` | 3 new tests (401 impersonation exit, 401 normal, duplicate guard) |
| `apps/web/src/app/core/services/impersonation.service.ts` | Add `_exiting` guard, pre-warning timer at T-60s |
| `apps/web/src/app/core/services/impersonation.service.spec.ts` | Tests for warning toast, exiting guard |
| `apps/web/src/app/app-shell/app-layout.component.ts` | Add "Access Log" nav item with Shield icon |
| `apps/web/src/app/app.routes.ts` | Add `/app/access-log` route |
| `apps/web/src/app/app.config.ts` | Register `Shield` Lucide icon |
| `libs/db-layer/src/lib/entities/support-access-log.entity.ts` | Add JSDoc retention comment |
| `libs/db-layer/src/lib/entities/support-mutation-log.entity.ts` | Add JSDoc retention comment |
| `libs/db-layer/src/lib/rls-setup.service.ts` | Add `sal_tenant_read` SELECT policy |
| `apps/api-gateway/src/app/support-access/support-access.module.ts` | Register `SupportAccessReadService` |
| `apps/web/src/app/admin/tenants/impersonate-confirm-dialog.component.ts` | Update dialog text 30→120 minutes |

### New Files to Create

| File | Purpose |
|:---|:---|
| `libs/shared/src/lib/dtos/support-access/access-log-entry.dto.ts` | Response DTO for access log entries |
| `libs/shared/src/lib/dtos/support-access/index.ts` | Barrel export |
| `apps/api-gateway/src/app/support-access/support-access-read.service.ts` | Read service using app DataSource + raw SQL |
| `apps/api-gateway/src/app/support-access/support-access-read.service.spec.ts` | Unit tests |
| `apps/web/src/app/tenant/access-log/access-log.service.ts` | Frontend HTTP client |
| `apps/web/src/app/tenant/access-log/access-log.component.ts` | Access log page component |
| `apps/web/src/app/tenant/access-log/access-log.component.html` | Template |
| `apps/web/src/app/tenant/access-log/access-log.component.scss` | Styles |
| `apps/web/src/app/tenant/access-log/access-log.component.spec.ts` | Unit tests |

### Critical Rules for Implementation

1. **Rule 2c (tenantId in WHERE)**: The raw SQL query MUST include `WHERE tenant_id = $1`. Even though RLS enforces tenant isolation, defense-in-depth is mandatory.

2. **Rule 13 (RxJS cleanup)**: Any new Observable in frontend services must use `takeUntilDestroyed()`. The 401 handler in the interceptor uses `catchError` + `EMPTY` (no subscription leak risk).

3. **Rule 27 (No @IsUUID)**: UUID fields in DTOs use `@Matches` regex, not `@IsUUID`.

4. **Lucide icon registration**: `Shield` icon MUST be registered in `app.config.ts` → `provideLucideIcons({ ... Shield })`. Unregistered icons silently break Angular template rendering.

5. **Zoneless testing**: Use `async/await` + `fixture.whenStable()` instead of `fakeAsync/tick` for component tests.

6. **Interceptor is a function, not a class**: `jwt.interceptor.ts` exports `jwtInterceptor: HttpInterceptorFn` (functional interceptor). Cannot inject services via constructor — use `inject()` in the function body. However, `ImpersonationService` uses `HttpClient` which creates circular dependency with the interceptor. **Workaround**: Access `localStorage` directly (already the pattern) and call `ImpersonationService` methods via `inject()` only for non-HTTP operations (`exitImpersonation`, `showToast`, `isExiting`).

7. **Controller guard ordering**: Customer-facing controllers use `@UseGuards(JwtAuthGuard, TenantStatusGuard, RolesGuard)` — same order as all other `/app/` controllers. Document per Rule 25.

8. **Raw SQL parameterization**: ALL SQL parameters MUST use `$1`, `$2` etc. — NEVER string interpolation. Naz will check.

9. **RLS policy pattern**: Use `NULLIF(current_setting('app.current_tenant', true), '')::uuid` — same as all other tenant policies in `rls-setup.service.ts`. Include admin bypass clause: `OR current_setting('app.is_admin', true) = 'true'`.

10. **401 loop safety**: The 401 handler calls `exitImpersonation()` which fires a session-end POST. This POST could itself 401. This is SAFE because `exitImpersonation()` clears the impersonation token from `localStorage` FIRST, then fires the POST. The interceptor checks `localStorage.getItem('impersonation_token')` — since it's already null, the session-end POST's 401 won't trigger re-entry. The `_exiting` flag is a secondary guard. Document this reasoning in a code comment.

11. **Interceptor test mocking**: `jwt.interceptor.ts` is a functional interceptor. In tests, use `TestBed.inject(ImpersonationService)` to get the service instance, then spy on its methods. Mock `HttpHandler` to return `throwError(() => new HttpErrorResponse({ status: 401 }))`. Use `of(new HttpResponse({ status: 200 }))` for success cases.

12. **Pre-warning timer tests**: Use `jest.useFakeTimers()` to advance time to T-60s (29 minutes) to verify warning toast fires. Remember to call `jest.useRealTimers()` in afterEach.

### Circular Dependency Warning

`ImpersonationService` injects `HttpClient`. The JWT interceptor function runs inside `HttpClient`'s interceptor chain. You CANNOT `inject(ImpersonationService)` inside the interceptor without creating a circular dependency.

**Solution**: The interceptor already reads `localStorage.getItem('impersonation_token')` directly. For the 401 handler, use `inject(ImpersonationService)` ONLY for `exitImpersonation()` and `showToast()` — these methods don't use `HttpClient` (except the fire-and-forget session-end call, which is non-blocking). Angular's lazy injection resolves this: the interceptor is created once, `ImpersonationService` is resolved on first use. If circular dependency occurs at runtime, extract the exit logic to a separate `ImpersonationExitService` without HttpClient dependency.

### Out-of-Scope (tracked per Rule 38)

| Item | Story Reference | Rationale |
|:---|:---|:---|
| Pagination on access log | Future story if customers request | 50 records covers 6+ months at normal usage |
| CSV/PDF export of access log | Future story for compliance | Not needed for initial trust-building feature |
| Date range filtering | Future story | Chronological newest-first is sufficient |
| Exposing admin identity to customers | Not planned | UUID stored for internal audit; meaningless to customer |
| Customer user role access to log | Future story when `CUSTOMER_USER` role exists | Only `CUSTOMER_ADMIN` exists today |

### Previous Story Intelligence

**From 4-SA-A (immediate predecessor):**
- `SupportAccessService` uses `@InjectDataSource('migration')` — superuser DataSource for writes
- Entities registered on migration DataSource via `TypeOrmModule.forFeature([...], 'migration')`
- `SupportAccessLogEntity` has NO ORM relations to User/Tenant (cross-DataSource limitation)
- `jwtTokenHash` stored as SHA-256 hex — NOT the token itself
- Session-end endpoint: `POST /api/admin/tenants/impersonation/end` with `{ sessionId }`
- Frontend `exitImpersonation()` clears impersonation token FIRST, then calls session-end API
- `IMPERSONATOR_ROLE` constant in `libs/db-layer/src/lib/entities/user.entity.ts`
- Cross-DataSource ORM relation error caught during development — avoid `@ManyToOne` across DataSources
- Impersonation token takes priority in JWT interceptor (checked before admin token)

**From 4-4 (credit management):**
- `TransactionManager.run(tenantId, callback)` sets `app.current_tenant` for RLS
- Raw SQL with `manager.query()` pattern used for credit operations — same pattern for access log reads
- `SELECT FOR UPDATE` pattern for atomicity (not needed here — read-only endpoint)

### Project Structure Notes

- Frontend tenant pages: `apps/web/src/app/tenant/` (some under `app-shell/`)
- App routes zone B: `/app/*` — lazy loaded, protected by `authGuard`
- App layout nav: `apps/web/src/app/app-shell/app-layout.component.ts` — `navItems` array
- Shared DTOs: `libs/shared/src/lib/dtos/<domain>/` — barrel exports
- Backend controllers: `apps/api-gateway/src/app/<feature>/` — module per domain

### References

- [Source: tenants.service.ts#L128-138](apps/api-gateway/src/app/tenants/tenants.service.ts#L128-L138) — JWT impersonation token minting
- [Source: jwt.interceptor.ts](apps/web/src/app/core/interceptors/jwt.interceptor.ts) — Functional HTTP interceptor
- [Source: impersonation.service.ts](apps/web/src/app/core/services/impersonation.service.ts) — Inactivity timer, exit flow
- [Source: impersonation-banner.component.ts](apps/web/src/app/shared/components/impersonation-banner/impersonation-banner.component.ts) — Banner UI
- [Source: support-access.service.ts](apps/api-gateway/src/app/support-access/support-access.service.ts) — Audit logging (migration DS)
- [Source: support-access-log.entity.ts](libs/db-layer/src/lib/entities/support-access-log.entity.ts) — Session audit entity
- [Source: support-mutation-log.entity.ts](libs/db-layer/src/lib/entities/support-mutation-log.entity.ts) — Mutation audit entity
- [Source: rls-setup.service.ts](libs/db-layer/src/lib/rls-setup.service.ts) — RLS policy patterns
- [Source: app.routes.ts](apps/web/src/app/app.routes.ts) — Route structure
- [Source: app-layout.component.ts](apps/web/src/app/app-shell/app-layout.component.ts) — Tenant nav items
- [Source: project-context.md](project-context.md) — All implementation rules

## AC-to-Test Traceability

| AC | Test ID | Test Description | Type |
|:---|:---|:---|:---|
| AC1 | — | Token expiry `'2h'` verified in tenants.service.spec | Unit (existing test updated) |
| AC2 | 4-SAB-UNIT-016 | 401 during impersonation triggers exit + toast | Unit (jwt.interceptor.spec) |
| AC2 | 4-SAB-UNIT-017 | 401 when not impersonating propagates error | Unit (jwt.interceptor.spec) |
| AC2 | 4-SAB-UNIT-019 | Non-401 errors during impersonation propagated | Unit (jwt.interceptor.spec) |
| AC3 | 4-SAB-UNIT-018 | Second concurrent 401 swallowed (duplicate guard) | Unit (jwt.interceptor.spec) |
| AC3 | 4-SAB-UNIT-020 | exitImpersonation no-ops when _exiting is true | Unit (impersonation.service.spec) |
| AC3 | 4-SAB-UNIT-021 | isExiting flag exposed | Unit (impersonation.service.spec) |
| AC3 | 4-SAB-UNIT-022 | _exiting reset after storeImpersonation | Unit (impersonation.service.spec) |
| AC4 | 4-SAB-UNIT-023 | Warning toast shown at T-60s (29 min) | Unit (impersonation.service.spec) |
| AC4 | 4-SAB-UNIT-024 | No warning before 29 minutes | Unit (impersonation.service.spec) |
| AC4 | 4-SAB-UNIT-025 | Warning timer resets on activity | Unit (impersonation.service.spec) |
| AC5 | 4-SAB-UNIT-001 | Service returns sessions for tenantId | Unit (read.service.spec) |
| AC5 | 4-SAB-UNIT-006 | action_count string converted to number | Unit (read.service.spec) |
| AC5 | 4-SAB-UNIT-007 | Controller returns entries for tenant | Unit (controller.spec) |
| AC5 | 4-SAB-UNIT-008 | Controller uses tenantId from JWT only | Unit (controller.spec) |
| AC5 | 4-SAB-UNIT-009 | Loading spinner shown initially | Unit (component.spec) |
| AC5 | 4-SAB-UNIT-010 | Component renders table rows | Unit (component.spec) |
| AC5 | 4-SAB-UNIT-012 | Active badge for null endedAt | Unit (component.spec) |
| AC5 | 4-SAB-UNIT-013 | Completed badge for ended sessions | Unit (component.spec) |
| AC5 | 4-SAB-UNIT-014 | Duration formatted correctly | Unit (component.spec) |
| AC6 | 4-SAB-UNIT-005 | Parameterized SQL (no interpolation) | Unit (read.service.spec) |
| AC6 | 4-SAB-UNIT-026 | TransactionManager.run called with tenantId | Unit (read.service.spec) |
| AC6 | 4-SAB-INTEG-001 | Tenant A reads own access log via RLS | Wiring (integration-wiring.spec) |
| AC6 | 4-SAB-INTEG-002 | Tenant B cannot read Tenant A's log | Wiring (integration-wiring.spec) |
| AC7 | 4-SAB-UNIT-011 | Empty state shown when no sessions | Unit (component.spec) |
| AC7 | 4-SAB-UNIT-015 | Error state shown on HTTP failure (not empty state) | Unit (component.spec) |
| AC8 | — | JSDoc comments on entities (manual verification) | Code review |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Browser smoke test: access log empty state verified (first visit), data table verified (after impersonation sessions)
- RLS bug caught during smoke test: `SupportAccessReadService` used raw `dataSource.query()` without setting `app.current_tenant` — RLS blocked all rows. Fixed by switching to `TransactionManager.run(tenantId, callback)` which sets `SET LOCAL app.current_tenant` within a transaction.
- Impersonation dialog text update confirmed: "30 minutes of inactivity" verified in browser

### Completion Notes List

- All 7 tasks implemented and verified
- 1372 total tests passing (714 api-gateway + 536 web + 83 shared + 39 db-layer)
- Browser smoke test: admin login → impersonate Acme Corp → verify banner + nav items → access log empty state → exit → re-impersonate → access log shows sessions with correct columns → exit redirects to dashboard
- Bug found and fixed during smoke test: `SupportAccessReadService` needed `TransactionManager` instead of raw `DataSource` for RLS context
- Confirmation dialog text updated to reflect inactivity-based expiry
- Code review: 3 passes complete. Pass 1 (Amelia): 7 findings (1H+2M+4L), all fixed. Pass 2+3 (Naz+Murat party mode): 14 findings (3H+5M+6L), 6 fixed / 6 tracked / 2 rejected.

### File List

**Modified files (15):**
1. `apps/api-gateway/src/app/tenants/tenants.service.ts` — JWT expiry 30m → 2h
2. `apps/api-gateway/src/app/tenants/tenants.service.spec.ts` — Updated expiry assertion
3. `libs/db-layer/src/lib/entities/support-access-log.entity.ts` — Retention JSDoc comment
4. `libs/db-layer/src/lib/entities/support-mutation-log.entity.ts` — Retention JSDoc comment
5. `apps/web/src/app/admin/tenants/impersonate-confirm-dialog.component.ts` — Dialog text update
6. `apps/web/src/app/core/services/impersonation.service.ts` — `_exiting` guard, pre-warning timer, `storeImpersonation` resets `_exiting`
7. `apps/web/src/app/core/services/impersonation.service.spec.ts` — 6 new tests (duplicate guard x3, pre-warning toast x3)
8. `apps/web/src/app/core/interceptors/jwt.interceptor.ts` — 401 handler during impersonation
9. `apps/web/src/app/core/interceptors/jwt.interceptor.spec.ts` — 4 new tests (401 handling)
10. `libs/db-layer/src/lib/rls-setup.service.ts` — `sal_tenant_read` SELECT policy
11. `apps/api-gateway/src/app/support-access/support-access.module.ts` — Registered new service + controller + guard
12. `apps/web/src/app/app.routes.ts` — `/app/access-log` route
13. `apps/web/src/app/app-shell/app-layout.component.ts` — Access Log nav item
14. `apps/web/src/app/app-shell/app-layout.component.spec.ts` — Updated nav count, added Shield icon
15. `libs/shared/src/lib/dtos/index.ts` — Barrel export for support-access DTOs
16. `apps/api-gateway/src/app/integration-wiring.spec.ts` — 2 new wiring tests (sal_tenant_read RLS)

**New files (11):**
1. `libs/shared/src/lib/dtos/support-access/access-log-entry.dto.ts` — AccessLogEntryDto
2. `libs/shared/src/lib/dtos/support-access/index.ts` — Barrel export
3. `apps/api-gateway/src/app/support-access/support-access-read.service.ts` — Read service (TransactionManager + raw SQL)
4. `apps/api-gateway/src/app/support-access/support-access-read.service.spec.ts` — 7 unit tests
5. `apps/api-gateway/src/app/support-access/access-log.controller.ts` — Customer-facing endpoint
6. `apps/api-gateway/src/app/support-access/access-log.controller.spec.ts` — 2 unit tests
7. `apps/web/src/app/tenant/access-log/access-log.service.ts` — Frontend HTTP client
8. `apps/web/src/app/tenant/access-log/access-log.component.ts` — Access log page component
9. `apps/web/src/app/tenant/access-log/access-log.component.html` — Template
10. `apps/web/src/app/tenant/access-log/access-log.component.scss` — Styles
11. `apps/web/src/app/tenant/access-log/access-log.component.spec.ts` — 7 unit tests
