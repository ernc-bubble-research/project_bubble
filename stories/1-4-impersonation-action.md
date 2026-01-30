# Story 1.4: Impersonation Action

Status: done

## Story

As a **Bubble Admin**,
I want to click "Impersonate" on a tenant's detail page,
so that I can view their workspace as if I were their admin, to provide support or debug issues.

## Acceptance Criteria

1. **AC1: Tenant Detail page with Impersonate button**
   - Given I navigate to `/admin/tenants/:id`
   - Then I see a Tenant Detail page with a header card showing: tenant name, status badge, creation date, tier (placeholder "—"), user count (placeholder "—")
   - And action buttons: "Impersonate" (danger outline with AlertTriangle icon), "Suspend/Activate" toggle, "Edit" (outline)
   - And tabbed navigation below: General, Entitlements, Users, Usage, Audit (only General tab functional in this story)
   - And a breadcrumb: "Tenants / [Tenant Name]"

2. **AC2: General tab with tenant info**
   - Given I am on the Tenant Detail General tab
   - Then I see a form displaying: Tenant Name (editable), Tenant ID (read-only, copyable), Created date, Primary Contact (placeholder), Plan Tier (placeholder dropdown), Data Residency (placeholder dropdown)
   - And "Cancel" and "Save Changes" buttons (Save disabled until a field changes — placeholder, no save API in this story)

3. **AC3: Impersonation confirmation dialog**
   - Given I click the "Impersonate" button
   - Then a confirmation dialog appears with text: "You are about to impersonate [Tenant Name]. This action is audit-logged. You will see their workspace as if you were their admin. Session auto-reverts after 60 minutes."
   - And two buttons: "Cancel" (outline) and "Impersonate" (danger filled)

4. **AC4: Impersonation token generation**
   - Given I confirm the impersonation dialog
   - When the frontend calls `POST /api/admin/tenants/:id/impersonate`
   - Then the API returns a temporary JWT containing `{ sub: adminUserId, tenant_id: targetTenantId, role: 'impersonator', impersonating: true, iat, exp }`
   - And the token expires in 60 minutes
   - And the frontend stores this token (localStorage key: `impersonation_token`)
   - And the UI redirects to `/app/workflows` (Zone B — currently placeholder, redirects to `/admin/dashboard`)

5. **AC5: Impersonation banner**
   - Given an impersonation session is active (impersonation_token exists in localStorage)
   - Then a fixed banner appears at the very top of the viewport (z-index: 9999)
   - And the banner is 40px tall, background `--danger` (#dc2626) with gradient to #b91c1c
   - And text reads: "Viewing as: [Tenant Name] — Impersonation Mode" (white, 13px, 600 weight)
   - And an "Exit Impersonation" button (white outline) is right-aligned
   - And the main layout shifts down 40px to accommodate the banner
   - And the sidebar top also shifts down 40px

6. **AC6: Exit impersonation**
   - Given the impersonation banner is visible
   - When I click "Exit Impersonation"
   - Then the `impersonation_token` is removed from localStorage
   - And the UI redirects to `/admin/dashboard` (The Lobby)
   - And the banner disappears
   - And the layout returns to normal (no 40px shift)

7. **AC7: Inactivity timeout**
   - Given an impersonation session is active
   - When 60 minutes pass without user interaction (mouse/keyboard/touch events)
   - Then the impersonation token is automatically cleared
   - And the UI redirects to `/admin/dashboard`
   - And a toast/notification says "Impersonation session expired due to inactivity"

8. **AC8: Tenant list navigation from Dashboard**
   - Given I am on the Dashboard ("The Lobby")
   - When I click "Manage" on a tenant row
   - Then I navigate to `/admin/tenants/:id` (Tenant Detail page)

9. **AC9: API guard for impersonation endpoint**
   - Given the `POST /api/admin/tenants/:id/impersonate` endpoint
   - Then it requires a valid `x-admin-api-key` header (reuses existing AdminGuard)
   - And it validates the tenant exists and is active (returns 404 if not found, 400 if suspended)
   - And it returns 200 with `{ token: string, tenant: { id, name } }`

## Tasks / Subtasks

> **Execution order matters.** Backend API first, then frontend components, then integration.

- [x] **Task 1: Backend — Impersonation endpoint** (AC: 4, 9)
  - [x]1.1 Create `ImpersonateResponseDto` in `libs/shared/src/lib/dtos/impersonate-response.dto.ts` with `token: string` and `tenant: { id: string, name: string }`
  - [x]1.2 Add `POST /admin/tenants/:id/impersonate` to existing `TenantController` in `apps/api-gateway`
  - [x]1.3 Implement impersonation logic in `TenantService`:
    - Fetch tenant by ID, validate exists and is active
    - Generate JWT with `@nestjs/jwt` `JwtService.sign()`: payload `{ sub: 'admin', tenant_id: id, role: 'impersonator', impersonating: true }`, expires in `60m`
    - Return token + tenant summary
  - [x]1.4 Register `JwtModule` in the API gateway's tenant module (use `JWT_SECRET` from env)
  - [x]1.5 Unit tests: valid impersonation returns token, tenant not found returns 404, suspended tenant returns 400

- [x] **Task 2: Frontend — Tenant Detail page** (AC: 1, 2, 8)
  - [x]2.1 Create `apps/web/src/app/admin/tenants/tenant-detail.component.ts` (standalone)
  - [x]2.2 Create corresponding `.html` and `.scss` files
  - [x]2.3 Header card: tenant name + status badge, metadata row (created, tier placeholder, users placeholder)
  - [x]2.4 Action buttons: "Impersonate" (danger outline + AlertTriangle icon), "Suspend" (danger ghost, placeholder), "Edit" (outline, placeholder)
  - [x]2.5 Tab navigation: General | Entitlements | Users | Usage | Audit — only General tab active
  - [x]2.6 General tab: form with Tenant Name (editable), Tenant ID (read-only + copy button), Created date, Plan Tier dropdown (placeholder), Data Residency dropdown (placeholder)
  - [x]2.7 Breadcrumb: "Tenants / [Tenant Name]" with link back to `/admin/tenants`
  - [x]2.8 Add route in `admin.routes.ts`: `{ path: 'tenants/:id', loadComponent: ... }`

- [x] **Task 3: Frontend — Tenant List page** (AC: 8)
  - [x]3.1 Create `apps/web/src/app/admin/tenants/tenant-list.component.ts` (standalone)
  - [x]3.2 Create corresponding `.html` and `.scss` files
  - [x]3.3 Table with columns: Name, Plan (placeholder), Users, Runs Used, Storage (placeholder), Status badge
  - [x]3.4 Filter tabs: All | Active | Suspended (with count badges)
  - [x]3.5 Row click navigates to `/admin/tenants/:id`
  - [x]3.6 "+ Create Tenant" button in header (reuses existing create-tenant-modal logic or navigates to dashboard)
  - [x]3.7 Add route in `admin.routes.ts`: `{ path: 'tenants', loadComponent: ... }`

- [x] **Task 4: Frontend — Impersonation service & confirmation dialog** (AC: 3, 4, 6, 7)
  - [x]4.1 Create `apps/web/src/app/core/services/impersonation.service.ts`:
    - `impersonate(tenantId: string): Observable<ImpersonateResponse>` — POST to API
    - `exitImpersonation(): void` — clear localStorage, redirect to `/admin/dashboard`
    - `isImpersonating(): Signal<boolean>` — reads from localStorage
    - `getImpersonatedTenant(): Signal<{id: string, name: string} | null>`
    - `startInactivityTimer()` / `resetInactivityTimer()` — 60-minute timeout
  - [x]4.2 Create `apps/web/src/app/admin/tenants/impersonate-confirm-dialog.component.ts` (standalone modal)
    - Confirmation text per UX spec §4.9b
    - Cancel + Impersonate (danger) buttons
  - [x]4.3 Wire "Impersonate" button in tenant-detail to open the confirmation dialog
  - [x]4.4 On confirm: call impersonation service, store token + tenant info in localStorage, redirect

- [x] **Task 5: Frontend — Impersonation banner** (AC: 5, 6)
  - [x]5.1 Create `apps/web/src/app/shared/components/impersonation-banner/impersonation-banner.component.ts` (standalone)
  - [x]5.2 Fixed position, 40px height, z-index 9999, danger red background with gradient
  - [x]5.3 Text: "Viewing as: [Tenant Name] — Impersonation Mode" + "Exit Impersonation" button
  - [x]5.4 Add banner to `app.html` (root level, above `<router-outlet />`) — conditionally shown via `isImpersonating()` signal
  - [x]5.5 Add CSS class to body or app container that shifts layout down 40px when banner is active

- [x] **Task 6: Frontend — Inactivity timeout** (AC: 7)
  - [x]6.1 Implement inactivity detection in `ImpersonationService`: listen for `mousemove`, `keydown`, `touchstart` events
  - [x]6.2 Use `setTimeout` / `clearTimeout` pattern — reset timer on each interaction
  - [x]6.3 After 60 minutes idle: clear impersonation, redirect, show toast notification
  - [x]6.4 Toast: create a simple toast/notification component or inline snackbar for "Impersonation session expired due to inactivity"

- [x] **Task 7: Add Lucide icons needed** (AC: 1, 5)
  - [x]7.1 Add new icons to `app.config.ts` Lucide provider: `AlertTriangle`, `Copy`, `ArrowLeft`, `X`, `Clock`
  - [x]7.2 Use `<lucide-icon>` elements in tenant-detail and banner components

- [x] **Task 8: Unit tests** (AC: 1-9)
  - [x]8.1 Test `TenantDetailComponent` — renders header card, tabs, breadcrumb, Impersonate button
  - [x]8.2 Test `TenantListComponent` — renders table, filter tabs, row click navigates
  - [x]8.3 Test `ImpersonationService` — impersonate() calls API, exitImpersonation() clears storage, isImpersonating() returns signal
  - [x]8.4 Test `ImpersonateConfirmDialogComponent` — renders text, cancel/confirm buttons
  - [x]8.5 Test `ImpersonationBannerComponent` — shows tenant name, exit button clears impersonation
  - [x]8.6 Backend: test impersonate endpoint (valid, not found, suspended)
  - [x]8.7 Run `nx test web` and `nx test api-gateway` — all pass

- [x] **Task 9: Build verification and lint** (AC: 1-9)
  - [x]9.1 `nx lint web` — passes
  - [x]9.2 `nx lint api-gateway` — passes
  - [x]9.3 `nx build web` — passes
  - [x]9.4 `nx build api-gateway` — passes

## Dev Notes

### Angular Patterns (CRITICAL)

**Standalone Components ONLY.** Every component must be standalone with explicit imports. Do NOT create NgModules.

```typescript
@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  selector: 'app-tenant-detail',
  templateUrl: './tenant-detail.component.html',
  styleUrl: './tenant-detail.component.scss',
})
export class TenantDetailComponent { }
```

**Signals for state management.** Use Angular Signals for all component state:

```typescript
tenant = signal<Tenant | null>(null);
loading = signal(false);
isImpersonating = signal(false);
activeTab = signal<'general' | 'entitlements' | 'users' | 'usage' | 'audit'>('general');
```

**Functional route guards.** Angular 21 uses `CanActivateFn` (class-based guards are deprecated):

```typescript
export const impersonationGuard: CanActivateFn = (route, state) => {
  const impersonationService = inject(ImpersonationService);
  // guard logic here
};
```

**Lazy-loaded routes.** Use `loadComponent` for route-level code splitting:

```typescript
{ path: 'tenants', loadComponent: () => import('./tenants/tenant-list.component').then(m => m.TenantListComponent) },
{ path: 'tenants/:id', loadComponent: () => import('./tenants/tenant-detail.component').then(m => m.TenantDetailComponent) },
```

### Lucide Angular Icons (CRITICAL — from Story 1.3 learnings)

**DO NOT use `LucideAngularModule.pick()`** — it returns `ModuleWithProviders` which is invalid in standalone component imports.

**Correct pattern:**

1. Register icons at app config level via injection token:
```typescript
// app.config.ts
import { LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { LayoutDashboard, Building2, GitBranch, Settings, AlertTriangle, Copy, ArrowLeft, X, Clock } from 'lucide-angular';

providers: [
  {
    provide: LUCIDE_ICONS,
    multi: true,
    useValue: new LucideIconProvider({ LayoutDashboard, Building2, GitBranch, Settings, AlertTriangle, Copy, ArrowLeft, X, Clock }),
  },
]
```

2. In components, import plain `LucideAngularModule` (without `.pick()`):
```typescript
imports: [LucideAngularModule]
```

3. In templates:
```html
<lucide-icon name="alert-triangle" [size]="16"></lucide-icon>
```

4. In tests, provide icons via `LUCIDE_ICONS` token:
```typescript
providers: [{
  provide: LUCIDE_ICONS, multi: true,
  useValue: new LucideIconProvider({ AlertTriangle, Copy }),
}]
```

### DTOs — Shared Brain Rule

All DTOs and interfaces MUST live in `libs/shared`. Import from `@project-bubble/shared`.

The `ImpersonateResponseDto` goes in `libs/shared/src/lib/dtos/impersonate-response.dto.ts`:
```typescript
export class ImpersonateResponseDto {
  token!: string;
  tenant!: { id: string; name: string };
}
```

Re-export via barrel: `libs/shared/src/lib/dtos/index.ts` → `libs/shared/src/index.ts`.

**IMPORTANT:** When re-exporting types/interfaces, use `export type { ... }` due to `isolatedModules` (learned in Story 1.3).

### Backend — JWT for Impersonation

Use `@nestjs/jwt` which is already a dependency (or add it if not present):

```typescript
// In tenant.module.ts or the api-gateway module
import { JwtModule } from '@nestjs/jwt';

JwtModule.register({
  secret: process.env.JWT_SECRET || 'dev_secret_key_change_in_prod',
  signOptions: { expiresIn: '60m' },
})
```

In the controller:
```typescript
@Post(':id/impersonate')
async impersonate(@Param('id') id: string): Promise<ImpersonateResponseDto> {
  return this.tenantService.impersonate(id);
}
```

In the service:
```typescript
async impersonate(tenantId: string): Promise<ImpersonateResponseDto> {
  const tenant = await this.tenantRepository.findOneBy({ id: tenantId });
  if (!tenant) throw new NotFoundException('Tenant not found');
  if (tenant.status === 'suspended') throw new BadRequestException('Cannot impersonate suspended tenant');

  const token = this.jwtService.sign({
    sub: 'admin',
    tenant_id: tenantId,
    role: 'impersonator',
    impersonating: true,
  });

  return { token, tenant: { id: tenant.id, name: tenant.name } };
}
```

**Note:** The existing `TenantController` uses `@UseGuards(AdminGuard)` — the impersonate endpoint inherits this guard. No new guard needed for this story.

### Frontend — localStorage Pattern for Impersonation

```typescript
const IMPERSONATION_TOKEN_KEY = 'impersonation_token';
const IMPERSONATION_TENANT_KEY = 'impersonation_tenant';

// Store
localStorage.setItem(IMPERSONATION_TOKEN_KEY, token);
localStorage.setItem(IMPERSONATION_TENANT_KEY, JSON.stringify({ id, name }));

// Read
const token = localStorage.getItem(IMPERSONATION_TOKEN_KEY);
const tenant = JSON.parse(localStorage.getItem(IMPERSONATION_TENANT_KEY) || 'null');

// Clear
localStorage.removeItem(IMPERSONATION_TOKEN_KEY);
localStorage.removeItem(IMPERSONATION_TENANT_KEY);
```

### Inactivity Timer Pattern

```typescript
private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
private readonly TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

startInactivityTimer(): void {
  const events = ['mousemove', 'keydown', 'touchstart', 'click'];
  events.forEach(e => document.addEventListener(e, () => this.resetTimer()));
  this.resetTimer();
}

private resetTimer(): void {
  if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
  this.inactivityTimer = setTimeout(() => this.onTimeout(), this.TIMEOUT_MS);
}

private onTimeout(): void {
  this.exitImpersonation();
  // Show toast: "Impersonation session expired due to inactivity"
}
```

**IMPORTANT:** Clean up event listeners when impersonation ends (use `AbortController` or manual removeEventListener).

### CSS Design Tokens (from Story 1.3 — already in styles.scss)

All design tokens are already defined in `apps/web/src/styles.scss`. Key tokens for this story:
- **Banner:** `--danger` (#dc2626) for impersonation banner background
- **Buttons:** Use existing `.btn-primary`, `.btn-outline`, `.btn-danger` utility classes
- **Tabs:** `--primary-600` (#4f46e5) underline for active tab
- **Cards:** `--bg-surface`, `--radius-lg`, `--shadow-sm`
- **Text:** `--text-main`, `--text-secondary`

### UX Spec References (CRITICAL)

- **Tenant Detail page layout:** UX Spec §4.9b — header card with action buttons, tabbed navigation
- **Impersonation banner:** UX Spec §5.11 — fixed top, 40px, danger red, z-index 9999
- **Impersonation confirmation dialog:** UX Spec §4.9b — specific wording and button layout
- **Tenant List page:** UX Spec §4.9a — table with filter tabs
- **Modal pattern:** UX Spec §5.9 — overlay, container, animation (reuse from Story 1.3)

### What This Story Does NOT Include

- **No JWT-based authentication flow** — Story 1.7 adds full user auth. The impersonation token is a standalone temporary token, not integrated with the auth system yet.
- **No actual tenant workspace** — Zone B (`/app/*`) is still a placeholder. Impersonation redirects to `/app/workflows` which currently redirects back to `/admin/dashboard`.
- **No audit logging** — Story 7.2 adds audit trails. The confirmation dialog mentions "audit-logged" but actual logging is not implemented here.
- **No Entitlements/Users/Usage/Audit tabs** — Stories 1.5, 1.9, and later. Only General tab is functional.
- **No tenant edit/save functionality** — The General tab form is read-only display with placeholder edit UI. Save API comes with Story 1.5.
- **No suspend/activate API** — The button exists but is a placeholder. Story 1.5 adds this.
- **No real User Count or Runs data** — Placeholders shown ("—"). Real data requires Stories 1.9 and 4.x.

### Project Structure Notes

```
apps/api-gateway/src/
└── tenants/
    ├── tenant.controller.ts          (ADD impersonate endpoint)
    ├── tenant.service.ts             (ADD impersonate method)
    └── tenant.module.ts              (ADD JwtModule import)

apps/web/src/app/
├── app.html                          (ADD impersonation banner)
├── app.config.ts                     (ADD new Lucide icons)
├── admin/
│   ├── admin.routes.ts               (ADD tenants/:id route, tenants route)
│   └── tenants/
│       ├── tenant-list.component.ts
│       ├── tenant-list.component.html
│       ├── tenant-list.component.scss
│       ├── tenant-list.component.spec.ts
│       ├── tenant-detail.component.ts
│       ├── tenant-detail.component.html
│       ├── tenant-detail.component.scss
│       ├── tenant-detail.component.spec.ts
│       └── impersonate-confirm-dialog.component.ts
├── core/
│   └── services/
│       ├── tenant.service.ts         (EXISTING — add getOne if not present)
│       └── impersonation.service.ts  (NEW)
└── shared/
    └── components/
        └── impersonation-banner/
            ├── impersonation-banner.component.ts
            ├── impersonation-banner.component.html
            ├── impersonation-banner.component.scss
            └── impersonation-banner.component.spec.ts

libs/shared/src/lib/dtos/
└── impersonate-response.dto.ts       (NEW)
```

### Previous Story Intelligence (Story 1.3)

Key learnings from Story 1.3 implementation:

- **`isolatedModules`** — Always use `export type { ... }` for re-exporting interfaces/types from barrel files
- **Lucide Angular** — Use `LUCIDE_ICONS` injection token at app config level, NOT `LucideAngularModule.pick()` in component imports
- **Admin API Key interceptor** — already wired in `app.config.ts` via `withInterceptors([adminApiKeyInterceptor])`. The impersonation API call will automatically get the `x-admin-api-key` header since it targets `/api/admin/*`.
- **Signals pattern** — Story 1.3 established: `signal()` for state, `computed()` for derived, `effect()` for side effects
- **Modal pattern** — Story 1.3 created `CreateTenantModalComponent` with overlay, backdrop blur, animation. Reuse the same CSS approach for the impersonation confirmation dialog.
- **Test pattern** — Must provide `LUCIDE_ICONS` in test providers when using Lucide icons. Must provide `HttpClientTestingModule` for service tests.
- **Proxy config** — `/api` requests are proxied to `http://localhost:3000` in dev (already configured in `proxy.conf.json`)
- **Build verification** — Use `nx build web` (not `--no-cache`), `nx lint web`, `nx test web`

### Git Intelligence

Recent commits:
- `504f78e` feat(story-1.3): Bubble Admin Dashboard "The Lobby" with code review fixes
- `96b946a` feat(story-1.2): tenant provisioning API with admin guard
- `358f299` feat(story-1.1): monorepo & infrastructure initialization

The existing API endpoints (from Story 1.2) that this story builds on:
- `GET /api/admin/tenants` — returns `Tenant[]`
- `GET /api/admin/tenants/:id` — returns `Tenant` or 404
- `POST /api/admin/tenants` — body: `{ name }`, returns 201 or 409
- **NEW:** `POST /api/admin/tenants/:id/impersonate` — returns `{ token, tenant: { id, name } }`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 1.4 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — §4.8 Admin Dashboard "The Lobby" (Manage button)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — §4.9a Tenant List]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — §4.9b Tenant Detail (Impersonate button, confirmation dialog)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — §5.11 Impersonation Banner]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — §3.4 Sidebar Design Zone C]
- [Source: _bmad-output/planning-artifacts/architecture.md — Bubble Admin bypass_rls / Global Tenant ID, JWT auth, RLS]
- [Source: project-context.md — Shared Brain Rule, Security by Consumption Rule, Strict Naming Rule]
- [Source: stories/1-3-bubble-admin-dashboard-the-lobby.md — Dev Agent Record, Lucide patterns, modal patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Angular test workers crashed with NG04002 (Cannot match any routes) when `provideRouter([])` was used with empty routes and `router.navigate()` was called during tests. Fixed by adding `DummyComponent` and catch-all route `{ path: '**', component: DummyComponent }`.
- ESLint errors for `click-events-have-key-events` and `interactive-supports-focus` on modal overlay div. Fixed with eslint-disable for overlay click (intentional backdrop dismiss) and `tabindex="-1"` on modal container.
- Unused `computed` import in `impersonation.service.ts` — removed.

### Completion Notes List

- All 9 acceptance criteria implemented and verified
- Backend: `POST /api/admin/tenants/:id/impersonate` with JWT generation, 404/400 guards
- Frontend: Tenant Detail page, Tenant List page, Impersonation service, Confirmation dialog, Banner, Inactivity timeout
- Tests: 18 backend (3 suites), 47 frontend (10 suites) — all passing
- Lint: web and api-gateway both clean
- Builds: web and api-gateway both passing

### Change Log

| Change | Date | Reason |
|:---|:---|:---|
| Created | 2026-01-30 | Story creation from create-story workflow |
| Implemented | 2026-01-30 | All 9 tasks completed via dev-story workflow |
| Code Review | 2026-01-30 | 9 issues found (3H/4M/2L), 7 fixed: shared brain DTO, banner spec router, error toast, sidebar shift, enum usage, File List docs |

### File List

**New Files:**
- `libs/shared/src/lib/dtos/tenant/impersonate-response.dto.ts`
- `apps/web/src/app/admin/tenants/tenant-detail.component.ts`
- `apps/web/src/app/admin/tenants/tenant-detail.component.html`
- `apps/web/src/app/admin/tenants/tenant-detail.component.scss`
- `apps/web/src/app/admin/tenants/tenant-detail.component.spec.ts`
- `apps/web/src/app/admin/tenants/tenant-list.component.ts`
- `apps/web/src/app/admin/tenants/tenant-list.component.html`
- `apps/web/src/app/admin/tenants/tenant-list.component.scss`
- `apps/web/src/app/admin/tenants/tenant-list.component.spec.ts`
- `apps/web/src/app/admin/tenants/impersonate-confirm-dialog.component.ts`
- `apps/web/src/app/core/services/impersonation.service.ts`
- `apps/web/src/app/core/services/impersonation.service.spec.ts`
- `apps/web/src/app/shared/components/impersonation-banner/impersonation-banner.component.ts`
- `apps/web/src/app/shared/components/impersonation-banner/impersonation-banner.component.html`
- `apps/web/src/app/shared/components/impersonation-banner/impersonation-banner.component.scss`
- `apps/web/src/app/shared/components/impersonation-banner/impersonation-banner.component.spec.ts`

**Modified Files:**
- `libs/shared/src/lib/dtos/tenant/index.ts` — added ImpersonateResponseDto export
- `apps/api-gateway/src/app/tenants/tenants.service.ts` — added impersonate() method
- `apps/api-gateway/src/app/tenants/tenants.controller.ts` — added POST :id/impersonate endpoint
- `apps/api-gateway/src/app/tenants/tenants.module.ts` — added JwtModule.registerAsync
- `apps/api-gateway/src/app/tenants/tenants.service.spec.ts` — added impersonate tests
- `apps/web/src/app/app.ts` — added ImpersonationBannerComponent and ImpersonationService
- `apps/web/src/app/app.html` — added impersonation banner, layout shift, toast
- `apps/web/src/app/app.config.ts` — added AlertTriangle, Copy, ArrowLeft, X, Clock icons
- `apps/web/src/app/app.routes.ts` — added tenants and tenants/:id routes
- `apps/web/src/styles.scss` — added impersonation-active padding, sidebar shift, and toast styles
- `apps/web/src/environments/environment.development.ts` — existing env file (no story-specific changes)
