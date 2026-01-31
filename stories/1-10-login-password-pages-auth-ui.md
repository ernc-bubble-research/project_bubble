# Story 1.10: Login & Password Pages (Auth UI)

Status: done

## Story

As a **User**,
I want a clean login page and password-set page,
so that I can authenticate and access the application.

## Acceptance Criteria

1. **AC1: Login page**
   - Given I navigate to `/auth/login`
   - Then I see a branded login form with email and password fields, the Bubble logo, and a "Sign In" button
   - And the form validates email format and required fields before submission
   - And on invalid credentials, I see an inline error: "Invalid email or password"
   - And on successful login, I am redirected to `/app/workflows` (Creator/Customer Admin) or `/admin/dashboard` (Bubble Admin)

2. **AC2: Set-password page**
   - Given I navigate to `/auth/set-password` with a valid invitation/reset token
   - Then I see a password-set form with "New Password" and "Confirm Password" fields
   - And the form enforces minimum password requirements (8+ chars, mixed case, number)
   - And passwords must match
   - And on success, I am redirected to `/auth/login` with a success message

3. **AC3: Route guards**
   - Given I am NOT authenticated
   - When I navigate to any `/app/*` or `/admin/*` route
   - Then I am redirected to `/auth/login`
   - And the originally requested URL is preserved so I can be redirected back after login

4. **AC4: Authenticated redirect**
   - Given I AM authenticated
   - When I navigate to `/auth/login`
   - Then I am redirected to my role-appropriate home (`/app/workflows` or `/admin/dashboard`)

5. **AC5: Role-based post-login redirect**
   - Given I log in successfully
   - When my role is `bubble_admin`
   - Then I am redirected to `/admin/dashboard`
   - When my role is `customer_admin` or `creator`
   - Then I am redirected to `/app/workflows` (placeholder — Zone B not built yet, show a simple "Coming Soon" page)

6. **AC6: Logout**
   - Given I click "Logout" (or programmatically trigger logout)
   - Then the JWT is removed from localStorage
   - And I am redirected to `/auth/login`

7. **AC7: Visual design**
   - The auth pages follow Zone A aesthetic: "Clean, Minimal" per UX spec section 3.2
   - Centered card layout on a light background
   - Bubble logo above the form
   - Uses existing CSS variables (`--primary-600`, `--bg-surface`, `--border-color`, etc.)

8. **AC8: Unit tests**
   - Login component: renders form, validates inputs, calls AuthService.login(), handles errors, redirects on success
   - Set-password component: renders form, validates password requirements, validates match, handles success/error
   - Auth guard: redirects unauthenticated users, preserves return URL, allows authenticated users

## Tasks / Subtasks

> **Execution order:** Auth guard → Login page → Set-password page → Route updates → Placeholder app page → Tests → Build verification

- [x] **Task 1: Create Angular Auth Guard** (AC: 3, 4)
  - [x]1.1 Create `apps/web/src/app/core/guards/auth.guard.ts`
    - Implement `CanActivateFn` that checks `AuthService.isAuthenticated()`
    - If not authenticated: redirect to `/auth/login` with `returnUrl` query param
    - If authenticated: allow navigation
  - [x]1.2 Create `apps/web/src/app/core/guards/no-auth.guard.ts`
    - Inverse guard: redirect authenticated users away from `/auth/*` to role-appropriate home
    - `bubble_admin` → `/admin/dashboard`
    - `customer_admin` / `creator` → `/app/workflows`

- [x] **Task 2: Create Login Component** (AC: 1, 5, 7)
  - [x]2.1 Create `apps/web/src/app/auth/login/login.component.ts`
    - Standalone component with `ReactiveFormsModule`, `RouterModule`, `LucideAngularModule`
    - Form: email (required, email format), password (required)
    - On submit: call `AuthService.login(email, password)`
    - On success: check role from decoded JWT, redirect accordingly
    - Check for `returnUrl` query param — redirect there if present (only for same-origin paths)
    - On error: display inline error message below the form
    - Loading state: disable button, show "Signing in..."
  - [x]2.2 Create `apps/web/src/app/auth/login/login.component.html`
    - Centered card with Bubble logo (`bubble_logo.png`)
    - "Sign in to Bubble" heading
    - Email input with label
    - Password input with label and show/hide toggle
    - "Sign In" button (full width, primary style)
    - Error message area (conditionally shown)
  - [x]2.3 Create `apps/web/src/app/auth/login/login.component.scss`
    - Use Zone A aesthetic: clean white card, centered on `--bg-app` background
    - Card: `--bg-surface`, `--shadow-md`, `--radius-xl`, max-width ~400px
    - Logo: centered, ~48px height
    - Inputs: reuse `.form-input` pattern from tenant-detail
    - Button: reuse `.btn-primary` pattern
    - Error: red text using `--danger`

- [x] **Task 3: Create Set-Password Component** (AC: 2, 7)
  - [x]3.1 Create `apps/web/src/app/auth/set-password/set-password.component.ts`
    - Standalone component
    - Read `token` from query params
    - Form: newPassword (required, min 8 chars, must contain uppercase + lowercase + number), confirmPassword (must match)
    - On submit: call backend `POST /api/auth/set-password` with `{ token, password }`
    - On success: redirect to `/auth/login` with `?message=password-set`
    - On error: display inline error
    - **NOTE:** The backend endpoint for set-password does NOT exist yet. Create a placeholder service method that returns an error. This will be wired up properly in Story 1.12 (User Invitations) when invitation tokens are implemented. For now, the UI should be complete and testable with mocks.
  - [x]3.2 Create `apps/web/src/app/auth/set-password/set-password.component.html`
    - Same centered card layout as login
    - "Set Your Password" heading
    - Password requirements hint text
    - New password + confirm password fields
    - "Set Password" button
  - [x]3.3 Create `apps/web/src/app/auth/set-password/set-password.component.scss`
    - Same styling approach as login

- [x] **Task 4: Create Placeholder App Page** (AC: 5)
  - [x]4.1 Create `apps/web/src/app/app-shell/coming-soon.component.ts`
    - Simple standalone component: "Coming Soon — The Bubble workspace is under construction."
    - This is the placeholder for `/app/workflows` until Zone B is built (Epic 2+)
    - Include a logout button

- [x] **Task 5: Update Routes** (AC: 1-6)
  - [x]5.1 Update `apps/web/src/app/app.routes.ts`:
    - `/auth/login` → `LoginComponent` with `noAuthGuard`
    - `/auth/set-password` → `SetPasswordComponent` (no guard — accessed via token link)
    - `/app` → lazy-loaded shell with `authGuard`, default to `/app/workflows`
    - `/app/workflows` → `ComingSoonComponent`
    - `/admin` → keep existing lazy-loaded admin layout with `authGuard` + role check (bubble_admin only)
    - `/` → redirect based on auth status: `/auth/login` if unauthenticated, role-home if authenticated
    - `/**` → NotFoundComponent (keep existing)
  - [x]5.2 Register new Lucide icons if needed (`Eye`, `EyeOff` for password toggle, `LogOut` for logout)

- [x] **Task 6: Update AuthService** (AC: 1, 6)
  - [x]6.1 Add `logout()` method already exists — verify it clears localStorage and navigates to `/auth/login`
  - [x]6.2 Add `getRoleHome()` helper: returns `/admin/dashboard` for `bubble_admin`, `/app/workflows` for others
  - [x]6.3 Add `setPassword(token: string, password: string)` method — calls `POST /api/auth/set-password` (will 404 until backend endpoint is added in Story 1.12)

- [x] **Task 7: Unit tests** (AC: 8)
  - [x]7.1 Create `apps/web/src/app/core/guards/auth.guard.spec.ts`
  - [x]7.2 Create `apps/web/src/app/auth/login/login.component.spec.ts`
  - [x]7.3 Create `apps/web/src/app/auth/set-password/set-password.component.spec.ts`
  - [x]7.4 Verify all existing tests still pass (159 total: 11 db-layer + 78 api-gateway + 70 web)

- [x] **Task 8: Build verification** (AC: 1-8)
  - [x]8.1 `nx lint web` — passes
  - [x]8.2 `nx test web` — all pass
  - [x]8.3 `nx build web` — passes
  - [x]8.4 `nx test api-gateway` — all pass (no backend changes, but verify no regressions)

## Dev Notes

### Scope Boundaries

- **No backend changes.** The `POST /api/auth/login` endpoint already exists (Story 1.7). The set-password backend endpoint is deferred to Story 1.12.
- **No "Forgot Password" flow.** Not in the acceptance criteria. Can be added in a future story.
- **No email verification.** Story 1.12 handles invitations and email.
- **Zone B (tenant workspace) is NOT built.** The `/app/workflows` route shows a placeholder "Coming Soon" page.
- **Admin API key bypass still works.** The admin dashboard is accessible via API key (no JWT needed for admin API calls). The route guard only protects Angular navigation, not API auth.

### Architecture Decisions

**Functional `CanActivateFn` guards (not class-based):** Angular 21 prefers functional guards. Use `inject()` inside the guard function to get `AuthService` and `Router`.

**Form validation approach:** Use Angular `ReactiveFormsModule` with `FormGroup`/`FormControl` and built-in validators (`Validators.required`, `Validators.email`, `Validators.minLength`). Custom validator for password complexity (uppercase + lowercase + number).

**Password show/hide toggle:** Use Lucide `Eye`/`EyeOff` icons. Toggle input type between `text` and `password`.

**Success message on login page:** When redirected from set-password with `?message=password-set`, show a green success banner: "Password set successfully. Please sign in."

**Return URL handling:** Store the return URL from the `returnUrl` query parameter. After successful login, navigate to the return URL if it starts with `/` (same-origin safety check). Default to role-appropriate home otherwise.

### Previous Story Intelligence (Story 1.9)

- **Test count:** 159 (11 db-layer + 78 api-gateway + 70 web)
- **AuthService.login()** already exists on the Angular side — calls `POST /api/auth/login`, stores JWT in localStorage under `bubble_access_token`
- **JWT payload shape:** `{ sub: userId, tenant_id: tenantId, role: 'bubble_admin' | 'customer_admin' | 'creator', exp: timestamp }`
- **AuthService.isAuthenticated()** already checks token existence and expiry
- **AuthService.getCurrentUser()** decodes JWT and returns user object
- **AuthService.logout()** already clears localStorage
- **Lucide icons already configured** in `app.config.ts` — add `Eye`, `EyeOff`, `LogOut` to the icon provider
- **Global CSS variables** in `styles.scss` — reuse `--primary-600`, `--bg-surface`, `--shadow-md`, `--radius-xl`, `--danger`, etc.
- **`bubble_logo.png`** is in `apps/web/public/` (used in admin sidebar already)

### CRITICAL: Existing AuthService Methods (DO NOT DUPLICATE)

The Angular `AuthService` at `apps/web/src/app/core/services/auth.service.ts` already has:
- `login(email, password)` — calls backend, stores token
- `logout()` — clears token
- `getToken()` — reads from localStorage
- `getCurrentUser()` — decodes JWT
- `isAuthenticated()` — checks token + expiry

**DO NOT** create a new auth service. Extend the existing one with `getRoleHome()` and `setPassword()`.

### UX Design Notes

- **Zone A aesthetic:** "Clean, Minimal" — per UX spec §3.2
- **No wireframes exist** for login/set-password pages (acknowledged gap in UX spec)
- Recommended layout: centered card (max-width ~400px) on `--bg-app` background
- Logo above form, standard input fields, full-width primary button
- Error messages in `--danger` color below the form
- Loading state on submit button

### Existing Patterns to Follow

**Form input styling** — reuse from `tenant-detail.component.scss`:
```scss
.form-input {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text-main);
  background: var(--bg-app);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}
```

**Button styling** — global `.btn-primary` class in `styles.scss`

**Proxy config** — `apps/web/proxy.conf.json` proxies `/api` to `http://localhost:3000`

### Project Structure Notes

```
apps/web/src/app/
├── auth/                                    (NEW)
│   ├── login/
│   │   ├── login.component.ts               (NEW)
│   │   ├── login.component.html             (NEW)
│   │   ├── login.component.scss             (NEW)
│   │   └── login.component.spec.ts          (NEW)
│   └── set-password/
│       ├── set-password.component.ts        (NEW)
│       ├── set-password.component.html      (NEW)
│       ├── set-password.component.scss      (NEW)
│       └── set-password.component.spec.ts   (NEW)
├── app-shell/                               (NEW)
│   └── coming-soon.component.ts             (NEW)
├── core/
│   ├── guards/                              (NEW)
│   │   ├── auth.guard.ts                    (NEW)
│   │   ├── auth.guard.spec.ts               (NEW)
│   │   └── no-auth.guard.ts                 (NEW)
│   └── services/
│       └── auth.service.ts                  (MODIFY — add getRoleHome(), setPassword())
├── app.routes.ts                            (MODIFY — add auth routes, guards)
└── app.config.ts                            (MODIFY — register Eye, EyeOff, LogOut icons)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 1.10 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — §3.2 Zoning Strategy, §3.5 Zone A Routes]
- [Source: project-context.md — Angular 21+, Standalone Components, Signals]
- [Source: stories/1-9-user-management-admin-creation.md — Test count (159), guard chain, AuthService patterns]
- [Source: apps/web/src/app/core/services/auth.service.ts — Existing login/logout/token methods]
- [Source: apps/web/src/styles.scss — CSS variables and global styles]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Initial tests used Jasmine syntax (createSpyObj) — fixed to Jest (jest.fn/jest.spyOn)
- Login/set-password tests crashed Jest worker due to unhandled router navigation errors — fixed with DummyComponent wildcard route and mockResolvedValue on navigateByUrl/navigate
- Dashboard, admin-layout, and tenant-detail tests missing Lucide icon providers (BarChart3, CircleCheck, CircleX, Users, Menu, Info) — pre-existing issue from Story 1.9 icon migration, fixed here

### Completion Notes List

- All 8 ACs met
- AC8: 101 web tests pass (31 new: 8 guard, 12 login, 11 set-password)
- Pre-existing test failures from Story 1.9 icon migration fixed (dashboard, admin-layout, tenant-detail specs needed updated icon providers)
- Set-password backend endpoint deferred to Story 1.12 as noted in story
- AuthService extended with getRoleHome() and setPassword() — no duplication

### File List

- `apps/web/src/app/core/guards/auth.guard.ts` (NEW — authGuard + adminGuard)
- `apps/web/src/app/core/guards/no-auth.guard.ts` (NEW)
- `apps/web/src/app/core/guards/auth.guard.spec.ts` (NEW)
- `apps/web/src/app/auth/_auth-shared.scss` (NEW — shared auth page styles)
- `apps/web/src/app/auth/login/login.component.ts` (NEW)
- `apps/web/src/app/auth/login/login.component.html` (NEW)
- `apps/web/src/app/auth/login/login.component.scss` (NEW — imports shared)
- `apps/web/src/app/auth/login/login.component.spec.ts` (NEW)
- `apps/web/src/app/auth/set-password/set-password.component.ts` (NEW)
- `apps/web/src/app/auth/set-password/set-password.component.html` (NEW)
- `apps/web/src/app/auth/set-password/set-password.component.scss` (NEW — imports shared)
- `apps/web/src/app/auth/set-password/set-password.component.spec.ts` (NEW)
- `apps/web/src/app/app-shell/coming-soon.component.ts` (NEW)
- `apps/web/src/app/app.routes.ts` (MODIFIED — auth routes, guards, adminGuard on /admin)
- `apps/web/src/app/app.config.ts` (MODIFIED — Eye, EyeOff, LogOut icons)
- `apps/web/src/app/core/services/auth.service.ts` (MODIFIED — getRoleHome(), setPassword())
- `apps/web/src/app/admin/admin-layout.component.spec.ts` (MODIFIED — added Menu icon)
- `apps/web/src/app/admin/dashboard/dashboard.component.spec.ts` (MODIFIED — added Lucide icons)
- `apps/web/src/app/admin/tenants/tenant-detail.component.spec.ts` (MODIFIED — added Info icon)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5 | **Date:** 2026-01-31 | **Outcome:** Approved (with fixes applied)

### Issues Found & Fixed

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| H1 | HIGH | `isLoading` never reset on successful login — button stuck disabled | Added `this.isLoading = false` in success handler |
| H2 | HIGH | No test coverage for `returnUrl` redirect (AC3 requirement) | Added `returnUrl` test to login spec |
| M1 | MEDIUM | Admin route `/admin/*` had no role check — any authenticated user could access | Created `adminGuard` checking `bubble_admin` role, added to admin route |
| M2 | MEDIUM | No `customer_admin` role test coverage (AC5 mentions 3 roles) | Added `customer_admin` tests to login spec and guard spec |
| M3 | MEDIUM | Login and set-password SCSS nearly identical (DRY violation) | Extracted shared styles to `_auth-shared.scss`, both components import it |
| L1 | LOW | Task checkboxes not marked complete in story file | Marked all `- [ ]` as `- [x]` |
| L2 | LOW | `loginForm!` uses non-null assertion (not fixed — common Angular pattern) | N/A — accepted |

### Post-Review Verification

- **Tests:** 101 pass (was 96, +5 new: returnUrl, customer_admin login, customer_admin guard, adminGuard allow, adminGuard reject)
- **Lint:** 0 errors, 1 pre-existing warning
- **Build:** Passes (1 pre-existing SCSS budget warning on tenant-detail)
