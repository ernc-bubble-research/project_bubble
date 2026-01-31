# Story 1.5: Tenant Configuration (Credits & Entitlements)

Status: done

## Story

As a **Bubble Admin**,
I want to configure a tenant's limits (run quota, asset retention) and general settings,
so that I can enforce pricing tiers and control tenant resource allocation.

## Acceptance Criteria

1. **AC1: Editable General tab**
   - Given I am on the Tenant Detail page (`/admin/tenants/:id`) General tab
   - When I modify the Tenant Name, Primary Contact, Plan Tier, or Data Residency fields
   - Then the "Save Changes" button becomes enabled (was disabled when pristine)
   - And "Cancel" resets the form to the last-saved state
   - And clicking "Save Changes" sends `PATCH /api/admin/tenants/:id` with the changed fields
   - And on success, a toast confirms "Tenant updated successfully"
   - And on error, a toast shows the error message

2. **AC2: Entitlements tab — Run Quota**
   - Given I navigate to the Entitlements tab on Tenant Detail
   - Then I see a "Run Quota" section with:
     - `Max Monthly Runs` numeric input (editable, default 50)
     - `Current Usage` progress bar showing `used / max` with percentage
     - `Reset Date` (read-only, auto-calculated: first of next month)

3. **AC3: Entitlements tab — Asset Retention**
   - Given I am on the Entitlements tab
   - Then I see an "Asset Retention" section with:
     - `Retention Days` numeric input (editable, default 30, min 1, max 365)
     - Helper text: "Soft-deleted files are purged after this period"

4. **AC4: Entitlements tab — Workflow Access placeholder**
   - Given I am on the Entitlements tab
   - Then I see a "Workflow Access" section with a read-only informational message: "Workflow access is managed per-workflow from Workflow Studio. Public workflows are available to all tenants."
   - And a link/button "Go to Workflow Studio" navigates to `/admin/workflows`
   - Note: Workflow visibility (public/private + per-tenant allow-list) is an Epic 3 concern. This is a placeholder only.

5. **AC5: Entitlements tab — Save**
   - Given I modify any entitlements field (quota, retention)
   - Then "Save Entitlements" becomes enabled
   - And clicking it sends `PATCH /api/admin/tenants/:id` with the entitlements payload
   - And on success, a toast confirms "Entitlements updated successfully"

6. **AC6: Suspend/Activate toggle**
   - Given I am on the Tenant Detail page and the tenant status is `active`
   - When I click the "Suspend" button
   - Then a confirmation dialog appears: "Suspend [Tenant Name]? Users will lose access. This can be reversed."
   - And on confirm, it sends `PATCH /api/admin/tenants/:id` with `{ status: 'suspended' }`
   - And the status badge updates to "Suspended" and the button text changes to "Activate"
   - And vice versa for activating a suspended tenant

7. **AC7: Backend PATCH endpoint**
   - Given a `PATCH /api/admin/tenants/:id` request with valid admin API key
   - Then it accepts partial updates for: `name`, `primaryContact`, `planTier`, `dataResidency`, `status`, `maxMonthlyRuns`, `assetRetentionDays`
   - And it validates: `name` is non-empty string, `maxMonthlyRuns` >= 0, `assetRetentionDays` between 1-365, `status` is valid enum, `planTier` is valid enum
   - And it returns the updated tenant object
   - And it returns 404 if tenant not found

8. **AC8: Database schema for entitlements**
   - Given the TenantEntity in `libs/db-layer`
   - Then it has new columns: `primary_contact` (string, nullable), `plan_tier` (enum: free/starter/professional/enterprise, default: free), `data_residency` (string, default: 'eu-west'), `max_monthly_runs` (integer, default: 50), `asset_retention_days` (integer, default: 30)
   - And the Tenant TypeORM entity reflects these columns

9. **AC9: Frontend Tenant type updated**
   - Given the shared `Tenant` type and DTOs
   - Then `UpdateTenantDto` exists in `libs/shared/src/lib/dtos/tenant/` with class-validator decorations
   - And the `Tenant` interface in `libs/shared/src/lib/types/tenant.types.ts` includes all new fields
   - And the frontend `TenantService` has an `update(id, payload)` method

## Tasks / Subtasks

> **Execution order matters.** Database changes first, then backend API, then frontend integration.

- [x] **Task 1: Database — Extend TenantEntity** (AC: 8)
  - [x] 1.1 Add columns to `libs/db-layer/src/lib/entities/tenant.entity.ts`:
    - `primaryContact`: `@Column({ name: 'primary_contact', nullable: true, default: null })` — string
    - `planTier`: `@Column({ name: 'plan_tier', type: 'enum', enum: PlanTier, default: PlanTier.FREE })` — new enum `PlanTier { FREE = 'free', STARTER = 'starter', PROFESSIONAL = 'professional', ENTERPRISE = 'enterprise' }`
    - `dataResidency`: `@Column({ name: 'data_residency', default: 'eu-west' })` — string
    - `maxMonthlyRuns`: `@Column({ name: 'max_monthly_runs', type: 'int', default: 50 })` — integer
    - `assetRetentionDays`: `@Column({ name: 'asset_retention_days', type: 'int', default: 30 })` — integer
  - [x] 1.2 Export `PlanTier` enum from `libs/db-layer/src/lib/entities/tenant.entity.ts`
  - [x] 1.3 Export `PlanTier` from `libs/db-layer/src/lib/entities/index.ts` barrel
  - [x] 1.4 Run TypeORM synchronize (dev mode auto-sync) to verify schema — `nx serve api-gateway` briefly or check that `synchronize: true` is set in dev

- [x] **Task 2: Shared DTOs & Types** (AC: 9)
  - [x] 2.1 Create `libs/shared/src/lib/dtos/tenant/update-tenant.dto.ts`:
    ```typescript
    import { IsString, IsOptional, IsInt, Min, Max, IsEnum, IsArray, MaxLength } from 'class-validator';

    export class UpdateTenantDto {
      @IsOptional() @IsString() @MaxLength(255) name?: string;
      @IsOptional() @IsString() @MaxLength(255) primaryContact?: string;
      @IsOptional() @IsEnum(['free', 'starter', 'professional', 'enterprise']) planTier?: string;
      @IsOptional() @IsString() @MaxLength(50) dataResidency?: string;
      @IsOptional() @IsEnum(['active', 'suspended']) status?: string;
      @IsOptional() @IsInt() @Min(0) maxMonthlyRuns?: number;
      @IsOptional() @IsInt() @Min(1) @Max(365) assetRetentionDays?: number;
    }
    ```
  - [x] 2.2 Export from `libs/shared/src/lib/dtos/tenant/index.ts`
  - [x] 2.3 Update `libs/shared/src/lib/types/tenant.types.ts` — add new fields to `Tenant` interface:
    ```typescript
    export interface Tenant {
      id: string;
      name: string;
      status: 'active' | 'suspended';
      primaryContact: string | null;
      planTier: 'free' | 'starter' | 'professional' | 'enterprise';
      dataResidency: string;
      maxMonthlyRuns: number;
      assetRetentionDays: number;
      createdAt: string;
      updatedAt: string;
    }
    ```
  - [x] 2.4 Add `UpdateTenantPayload` type to `tenant.types.ts`:
    ```typescript
    export type UpdateTenantPayload = Partial<Pick<Tenant, 'name' | 'primaryContact' | 'planTier' | 'dataResidency' | 'status' | 'maxMonthlyRuns' | 'assetRetentionDays'>>;
    ```

- [x] **Task 3: Backend — PATCH endpoint** (AC: 7)
  - [x] 3.1 Add `update(id: string, dto: UpdateTenantDto)` method to `apps/api-gateway/src/app/tenants/tenants.service.ts`:
    - Find tenant by ID (404 if not found)
    - Apply partial update using `Object.assign(tenant, dto)` or spread
    - Save and return updated entity
  - [x] 3.2 Add `@Patch(':id')` endpoint to `apps/api-gateway/src/app/tenants/tenants.controller.ts`:
    ```typescript
    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
      return this.tenantService.update(id, dto);
    }
    ```
  - [x] 3.3 Ensure `ValidationPipe` is applied (should already be global from Story 1.1/1.2)
  - [x] 3.4 Unit tests for update:
    - Valid partial update returns updated tenant
    - Tenant not found returns 404
    - Invalid `maxMonthlyRuns` (negative) returns 400
    - Invalid `assetRetentionDays` (0 or 366) returns 400
    - Status change from active to suspended works
    - Status change from suspended to active works

- [x] **Task 4: Frontend — TenantService update method** (AC: 9)
  - [x] 4.1 Add `update(id: string, payload: UpdateTenantPayload): Observable<Tenant>` to `apps/web/src/app/core/services/tenant.service.ts`
    - `return this.http.patch<Tenant>(\`${this.baseUrl}/${id}\`, payload);`

- [x] **Task 5: Frontend — Editable General tab** (AC: 1)
  - [x] 5.1 Update `tenant-detail.component.ts`:
    - Add form state signals: `editName`, `editContact`, `editPlanTier`, `editResidency`
    - Add `isDirty = computed(() => ...)` that compares current form values to loaded tenant values
    - Add `saveGeneral()` method: builds payload from changed fields only, calls `tenantService.update()`, shows toast on success/error
    - Add `cancelGeneral()` method: resets form signals to loaded tenant values
  - [x] 5.2 Update `tenant-detail.component.html`:
    - Tenant Name input: remove `readonly`, bind to `editName` signal with `(input)` event
    - Primary Contact input: remove placeholder "—", bind to `editContact` signal
    - Plan Tier select: remove `disabled`, bind to `editPlanTier`, populate options: Free, Starter, Professional, Enterprise
    - Data Residency select: remove `disabled`, bind to `editResidency`, populate options: EU West (eu-west), EU Central (eu-central), US East (us-east)
    - "Save Changes" button: `[disabled]="!isDirty()"`, `(click)="saveGeneral()"`
    - "Cancel" button: `(click)="cancelGeneral()"`, `[disabled]="!isDirty()"`
  - [x] 5.3 Add toast feedback: use existing `ImpersonationService.showToast()` pattern or create a simple reusable toast (prefer reuse — move toast from ImpersonationService to a shared `ToastService` if time permits, otherwise duplicate the pattern in-component for now)

- [x] **Task 6: Frontend — Entitlements tab** (AC: 2, 3, 4, 5)
  - [x] 6.1 Create entitlements tab content within `tenant-detail.component.html` (inside the existing tab structure, no new component needed):
    - **Run Quota section**: `maxMonthlyRuns` numeric input, usage progress bar (placeholder: show `0 / {max}` since no real usage data yet), reset date (computed: first of next month)
    - **Asset Retention section**: `assetRetentionDays` numeric input with min=1 max=365, helper text
    - **Workflow Access section**: read-only placeholder with informational text ("Workflow access is managed per-workflow from Workflow Studio") and a "Go to Workflow Studio" link to `/admin/workflows`
  - [x] 6.2 Add entitlements state signals to `tenant-detail.component.ts`:
    - `editMaxRuns`, `editRetentionDays` signals
    - `isEntitlementsDirty = computed(() => ...)` comparison
    - `saveEntitlements()` method: builds payload, calls `tenantService.update()`, shows toast
    - `cancelEntitlements()` method: resets to loaded values
  - [x] 6.3 Add "Save Entitlements" and "Cancel" buttons at bottom of Entitlements tab
  - [x] 6.4 Style the entitlements tab using existing design tokens:
    - Section headers: 16px, 600 weight, `--text-main`
    - Progress bar: height 8px, `--primary-600` fill, `--border-default` background, `--radius-full` border-radius
    - Info box: `--bg-surface`, `--border-default` border, `--radius-md`, 16px padding

- [x] **Task 7: Frontend — Suspend/Activate toggle** (AC: 6)
  - [x] 7.1 Create a simple confirmation dialog for suspend/activate (reuse pattern from `impersonate-confirm-dialog.component.ts`):
    - Can be inline in tenant-detail using `@if` conditional, or a separate component
    - Text: "Suspend [Name]? Users will lose access. This can be reversed." / "Activate [Name]? Users will regain access."
    - Confirm button: "Suspend" (danger) or "Activate" (primary)
  - [x] 7.2 Wire the existing "Suspend" / "Activate" button in the header card:
    - Show "Suspend" when status is active, "Activate" when suspended
    - On confirm: call `tenantService.update(id, { status: 'suspended' | 'active' })`
    - On success: reload tenant data, show toast, update status badge

- [x] **Task 8: Unit tests** (AC: 1-9)
  - [x] 8.1 Backend: `tenants.service.spec.ts` — add tests for `update()`:
    - Partial update works (name only, entitlements only)
    - Not found returns 404
    - Invalid values rejected by class-validator
  - [x] 8.2 Frontend: `tenant-detail.component.spec.ts` — add tests:
    - General tab form is editable
    - Save button disabled when pristine, enabled when dirty
    - Save sends PATCH request with correct payload
    - Cancel resets form
    - Entitlements tab renders quota, retention sections, and workflow access placeholder
    - Suspend button triggers confirmation dialog
  - [x] 8.3 Run `nx test web` and `nx test api-gateway` — all pass

- [x] **Task 9: Build verification and lint** (AC: 1-9)
  - [x] 9.1 `nx lint web` — passes
  - [x] 9.2 `nx lint api-gateway` — passes
  - [x] 9.3 `nx build web` — passes
  - [x] 9.4 `nx build api-gateway` — passes

## Dev Notes

### Angular Patterns (CRITICAL — Carry Forward from Story 1.4)

**Standalone Components ONLY.** Every component must be standalone. No NgModules.

**Signals for state management.** Use Angular Signals for all form state. DO NOT use Reactive Forms (FormGroup/FormControl) — the project has established a signals-based pattern:

```typescript
// Form state signals (initialized from loaded tenant)
editName = signal('');
editContact = signal('');
editPlanTier = signal<'free' | 'starter' | 'professional' | 'enterprise'>('free');
editResidency = signal('eu-west');
editMaxRuns = signal(50);
editRetentionDays = signal(30);

// Dirty tracking
isDirty = computed(() => {
  const t = this.tenant();
  if (!t) return false;
  return this.editName() !== t.name || this.editContact() !== (t.primaryContact ?? '') || ...;
});
```

**Template binding for inputs:**
```html
<input type="text" [value]="editName()" (input)="editName.set($any($event.target).value)" />
<select [value]="editPlanTier()" (change)="editPlanTier.set($any($event.target).value)">
  <option value="free">Free</option>
  ...
</select>
```

### Lucide Angular Icons (CRITICAL — from Story 1.3/1.4 learnings)

**DO NOT use `LucideAngularModule.pick()`** — use `LUCIDE_ICONS` injection token at app config level.

Icons already registered in `app.config.ts`: LayoutDashboard, Building2, GitBranch, Settings, AlertTriangle, Copy, ArrowLeft, X, Clock.

New icons potentially needed for this story:
- `Save` — for save buttons (or use text-only buttons)
- `ShieldCheck` / `ShieldOff` — for suspend/activate (optional, can use text-only)
- `Check` — for checkbox visual (if not using native checkbox)

Add any new icons to `app.config.ts` provider.

### DTOs — Shared Brain Rule

All DTOs and interfaces MUST live in `libs/shared`. Import from `@project-bubble/shared`.

The `UpdateTenantDto` goes in `libs/shared/src/lib/dtos/tenant/update-tenant.dto.ts`.

**IMPORTANT:** Use `class-validator` decorators for backend validation. The same DTO class is shared with frontend but decorators are only enforced server-side via `ValidationPipe`.

### Backend — PATCH Pattern

Use partial update pattern consistent with existing code:

```typescript
async update(id: string, dto: UpdateTenantDto): Promise<TenantEntity> {
  const tenant = await this.tenantRepository.findOneBy({ id });
  if (!tenant) throw new NotFoundException('Tenant not found');

  // Apply only provided fields
  Object.assign(tenant, dto);
  return this.tenantRepository.save(tenant);
}
```

**NOTE:** The existing `tenantRepository` is injected via `@InjectRepository(TenantEntity)` in `tenants.service.ts`. This is acceptable for now because:
- RLS is NOT enforced yet (Story 1.8 adds RLS)
- Admin operations bypass RLS anyway (`bypass_rls` concept from architecture)
- The `TransactionManager` pattern is required AFTER Story 1.8

### TypeORM Column Mapping

The entity uses `snake_case` for database column names and `camelCase` for TypeScript properties:

```typescript
@Column({ name: 'primary_contact', nullable: true, default: null })
primaryContact!: string | null;

@Column({ name: 'plan_tier', type: 'enum', enum: PlanTier, default: PlanTier.FREE })
planTier!: PlanTier;
```

**TypeORM `synchronize: true`** is set in dev mode, so schema changes auto-apply. No manual migration needed for dev.

### CSS Design Tokens (from styles.scss — already established)

Reuse existing design tokens:
- **Forms:** `--bg-surface`, `--border-default`, `--radius-md` for inputs
- **Progress bar:** `--primary-600` fill, `--border-default` track
- **Section headers:** `--text-main`, 16px, 600 weight
- **Buttons:** `.btn-primary`, `.btn-outline`, `.btn-danger` utility classes (if defined in styles.scss)
- **Toast:** Reuse the toast pattern from `app.html` and `ImpersonationService`

### UX Spec References (CRITICAL)

- **Entitlements tab layout:** UX Spec §4.9b — Run quota with progress bar, asset retention input, workflow access checklist
- **General tab (editable):** UX Spec §4.9b — same layout as Story 1.4 but now editable with Save/Cancel
- **Suspend/Activate:** UX Spec §4.9b — header card action buttons
- **Tab navigation:** Horizontal tabs below header card, active tab: `--primary-600` underline + text color

### What This Story Does NOT Include

- **No workflow access management on tenant level** — Workflow visibility (public/private + per-tenant allow-list) is managed at the workflow level in Epic 3 (Workflow Studio). The Entitlements tab shows a read-only placeholder linking to Workflow Studio.
- **No real usage tracking** — Epics 4+ track actual run usage. The progress bar shows `0 / {max}` placeholder.
- **No credit deduction logic** — FR37 "upfront deduction" is an Epic 4 concern. This story only sets the `maxMonthlyRuns` limit.
- **No Users tab** — Story 1.9 adds user management.
- **No Usage tab** — Requires execution data from Epic 4.
- **No Audit tab** — Story 7.2 adds audit logging.
- **No RLS enforcement** — Story 1.8 adds Row-Level Security. Current admin operations use direct repository access.
- **No email notifications** — No notification when a tenant is suspended/activated.

### Previous Story Intelligence (Story 1.4)

Key learnings from Story 1.4 implementation:

- **Test routing:** Always use `DummyComponent` + catch-all route `{ path: '**', component: DummyComponent }` in test providers. `provideRouter([])` causes NG04002 crashes.
- **ESLint accessibility:** Modal overlays need `role="dialog"` `aria-modal="true"`. Use eslint-disable for intentional backdrop click dismiss. Add `tabindex="-1"` to modal containers.
- **Shared Brain Rule enforcement:** Code review caught a duplicate interface in frontend — always import from `@project-bubble/shared`.
- **TenantStatus enum:** Use `TenantStatus.SUSPENDED` from `@project-bubble/db-layer`, not string literal `'suspended'`.
- **AbortController for cleanup:** Used in inactivity timer for clean event listener removal — good pattern to follow.
- **Toast pattern:** `ImpersonationService` has `showToast()` / `dismissToast()` / `toastMessage` signal. Consider extracting to a shared `ToastService` or duplicating the pattern.

### Git Intelligence

Recent commits:
- `6bf6d79` feat(story-1.4): impersonation action with company logo integration
- `504f78e` feat(story-1.3): Bubble Admin Dashboard "The Lobby" with code review fixes
- `96b946a` feat(story-1.2): tenant provisioning API with admin guard
- `358f299` feat(story-1.1): monorepo & infrastructure initialization

Existing API endpoints (from Stories 1.2 + 1.4) that this story builds on:
- `GET /api/admin/tenants` — returns `Tenant[]`
- `GET /api/admin/tenants/:id` — returns `Tenant` or 404
- `POST /api/admin/tenants` — body: `{ name }`, returns 201 or 409
- `POST /api/admin/tenants/:id/impersonate` — returns `{ token, tenant: { id, name } }`
- **NEW:** `PATCH /api/admin/tenants/:id` — body: `UpdateTenantDto`, returns updated `Tenant`

### Project Structure Notes

```
libs/db-layer/src/lib/entities/
└── tenant.entity.ts              (MODIFY: add new columns + PlanTier enum)

libs/shared/src/lib/
├── dtos/tenant/
│   ├── update-tenant.dto.ts      (NEW)
│   └── index.ts                  (MODIFY: add UpdateTenantDto export)
└── types/
    └── tenant.types.ts           (MODIFY: add new fields to Tenant interface)

apps/api-gateway/src/app/tenants/
├── tenants.service.ts            (MODIFY: add update() method)
├── tenants.controller.ts         (MODIFY: add PATCH endpoint)
└── tenants.service.spec.ts       (MODIFY: add update tests)

apps/web/src/app/
├── app.config.ts                 (MODIFY: add new Lucide icons if needed)
├── admin/tenants/
│   ├── tenant-detail.component.ts    (MODIFY: add form state, save/cancel logic, entitlements)
│   ├── tenant-detail.component.html  (MODIFY: make editable, add entitlements tab content)
│   ├── tenant-detail.component.scss  (MODIFY: add entitlements styles)
│   └── tenant-detail.component.spec.ts (MODIFY: add new tests)
└── core/services/
    └── tenant.service.ts         (MODIFY: add update() method)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 1.5 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — §4.9b Tenant Detail (Entitlements tab)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — §4.9b Tenant Detail (General tab, Suspend/Activate)]
- [Source: _bmad-output/planning-artifacts/architecture.md — TypeORM Repository pattern, Shared Brain Rule]
- [Source: project-context.md — Shared Brain Rule, Security by Consumption Rule, Strict Naming Rule]
- [Source: stories/1-4-impersonation-action.md — Dev Agent Record, test patterns, Lucide patterns, toast pattern]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- SCSS budget warning: tenant-detail.component.scss at 5.23KB exceeds 4KB budget (non-blocking)

### Completion Notes List

- Created shared `ToastService` to decouple toast notifications from `ImpersonationService`
- Entitlements tab Workflow Access section is a read-only placeholder per design decision (Epic 3 concern)
- Usage progress bar shows `0 / max (0%)` placeholder — real usage tracking comes in Epic 4
- Used `eslint-disable` for dialog overlay click accessibility (same pattern as impersonate dialog from Story 1.4)

### Change Log

| Change | Date | Reason |
|:---|:---|:---|
| Created | 2026-01-31 | Story creation from create-story workflow |
| Revised | 2026-01-31 | Removed per-tenant workflow access checklist; workflow visibility moves to Epic 3 (workflow-centric: public/private + allow-list). Entitlements tab now shows read-only placeholder. |
| Implemented | 2026-01-31 | All 9 tasks completed. Tests: 23/23 api-gateway, 58/58 web. Lint and build pass. |
| Review fixes | 2026-01-31 | Fixed H1 (controller update tests), H2+H3 (DTO union types + MinLength), M1 (toast timer leak), M2 (NaN guard on number inputs), M3 (story checkboxes). |

### File List

- `libs/db-layer/src/lib/entities/tenant.entity.ts` — MODIFIED: Added PlanTier enum, primaryContact, planTier, dataResidency, maxMonthlyRuns, assetRetentionDays columns
- `libs/db-layer/src/lib/entities/index.ts` — MODIFIED: Added PlanTier export
- `libs/shared/src/lib/dtos/tenant/update-tenant.dto.ts` — NEW: UpdateTenantDto with class-validator decorators
- `libs/shared/src/lib/dtos/tenant/index.ts` — MODIFIED: Added UpdateTenantDto export
- `libs/shared/src/lib/types/tenant.types.ts` — MODIFIED: Added new fields to Tenant interface, added UpdateTenantPayload type
- `libs/shared/src/lib/types/index.ts` — MODIFIED: Added UpdateTenantPayload export
- `apps/api-gateway/src/app/tenants/tenants.service.ts` — MODIFIED: Added update() method
- `apps/api-gateway/src/app/tenants/tenants.controller.ts` — MODIFIED: Added PATCH ':id' endpoint
- `apps/api-gateway/src/app/tenants/tenants.service.spec.ts` — MODIFIED: Added update() tests, updated mock tenant
- `apps/api-gateway/src/app/tenants/tenants.controller.spec.ts` — MODIFIED: Updated mock tenant with new fields
- `apps/web/src/app/core/services/toast.service.ts` — NEW: Shared toast notification service
- `apps/web/src/app/core/services/tenant.service.ts` — MODIFIED: Added update() method, UpdateTenantPayload import
- `apps/web/src/app/app.ts` — MODIFIED: Added ToastService injection
- `apps/web/src/app/app.html` — MODIFIED: Added shared toast rendering
- `apps/web/src/app/admin/tenants/tenant-detail.component.ts` — MODIFIED: Added form signals, dirty tracking, save/cancel, entitlements, suspend/activate
- `apps/web/src/app/admin/tenants/tenant-detail.component.html` — MODIFIED: Editable General tab, Entitlements tab, Suspend/Activate dialog
- `apps/web/src/app/admin/tenants/tenant-detail.component.scss` — MODIFIED: Added entitlements, progress bar, dialog, info-box styles
- `apps/web/src/app/admin/tenants/tenant-detail.component.spec.ts` — MODIFIED: Added 12 new tests for form state, dirty tracking, save, entitlements
