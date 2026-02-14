# Story 4-TESTFIX: Live Test Round 2 Fixes

Status: done

## Story

As a Bubble Admin using impersonation to test tenant workflows,
I want the impersonated session to have full tenant-admin access to `/app/` endpoints and the Data Vault to render icons correctly,
so that I can run workflows, view results, and manage files without errors during testing.

## Context

During Live Test Round 2 (2026-02-14), 5 of 6 fixes from Story 4-FIX-B were verified as PASS. Two new findings emerged:

1. **Finding 1 (HIGH — Impersonation role mismatch):** The impersonation JWT (created in `tenants.service.ts:111-118`) sets `role: "impersonator"`, but all `/app/` controllers use `@Roles(BUBBLE_ADMIN, CUSTOMER_ADMIN, CREATOR)`. The `RolesGuard` does strict `requiredRoles.includes(user.role)` at line 25, which rejects `"impersonator"` since it's not in the `UserRole` enum. Result: impersonated admins get 403 Forbidden on all tenant-scoped endpoints (workflow-runs, workflow-catalog, assets, folders, ingestion, knowledge, etc.).

2. **Finding 2 (LOW — Missing Lucide icons):** `File` and `FileType` icons are not registered in `app.config.ts`. These are used by `file-card.component.ts:253-254` for text MIME types (`file-type`) and the default fallback (`file`). Result: console errors in Data Vault when viewing text files or files with unrecognized MIME types.

### Party Mode Decision (2026-02-14)

Three options were evaluated for the impersonation fix:
- **Option A** (add `impersonator` to UserRole enum + all `@Roles()` decorators) — Rejected: messy, requires changes to every controller.
- **Option B** (change JWT `role` to `customer_admin` with `impersonating: true` flag) — Rejected: JWT would lie about the actual role.
- **Option C** (map `impersonator` → `CUSTOMER_ADMIN` in `RolesGuard`) — **SELECTED**: Single-file change, JWT stays honest, guard handles the mapping. Impersonated sessions get `CUSTOMER_ADMIN` effective permissions.

### Pre-Implementation Review (Party Mode — 2026-02-14)

Reviewed by Amelia (dev), Naz (adversarial), Murat (test architect), Winston (architect). 3 findings applied:
1. **Naz — Magic string:** `'impersonator'` exists in 2 locations with no shared constant. Acknowledged, deferred to next auth story as drive-by.
2. **Naz + Murat — Missing test:** Added `4-TF-UNIT-005` for mixed-role scenario `[BUBBLE_ADMIN, CREATOR]` (no CUSTOMER_ADMIN).
3. **Murat — Smoke test specificity:** Clarified Task 3.3 to verify workflow runs page (original LT2 failure point).

### Source: Live Test Round 2 Session (2026-02-14)

## Acceptance Criteria

1. **AC1 (Impersonation role mapping):** When a user with `role: "impersonator"` in their JWT accesses an endpoint decorated with `@Roles(...)`, the `RolesGuard` maps `"impersonator"` to `UserRole.CUSTOMER_ADMIN` for the role check. The impersonated session is granted access if `CUSTOMER_ADMIN` is among the required roles. The JWT payload itself is NOT modified — only the effective role used for the authorization check.

2. **AC2 (Impersonation denied on admin-only endpoints):** Impersonated sessions (`role: "impersonator"`) are correctly denied access to endpoints that require `BUBBLE_ADMIN` only (e.g., `@Roles(UserRole.BUBBLE_ADMIN)`). The mapping to `CUSTOMER_ADMIN` means impersonation does NOT grant admin-only access. This is a safety constraint — verify with a test.

3. **AC3 (Lucide icon registration):** `File` and `FileType` icons from `lucide-angular` are imported and registered in `app.config.ts`. The Data Vault `file-card.component.ts` renders icons for text MIME types and fallback without console errors.

4. **AC4 (Tests):** All new behavior has unit tests. Existing test suite passes (1244 tests, 0 lint errors in changed files).

5. **AC5 (Browser smoke test):** After implementation, a browser smoke test confirms: (a) impersonated admin can navigate to Data Vault and see files, (b) impersonated admin can access workflow-related `/app/` endpoints without 403, (c) Data Vault file cards for text files render icons without console errors.

## Tasks / Subtasks

### Task 1: RolesGuard impersonator → CUSTOMER_ADMIN mapping (AC: 1, 2)

- [x] 1.1: In `roles.guard.ts`, before the `requiredRoles.includes()` check, map `user.role === 'impersonator'` to `UserRole.CUSTOMER_ADMIN` as the effective role for authorization
  - File: `apps/api-gateway/src/app/auth/guards/roles.guard.ts`
  - Line 25: Replace `return requiredRoles.includes(user.role as UserRole);` with mapping logic
  - Do NOT modify the request object or JWT — only the local comparison variable
- [x] 1.2: Add unit tests to `roles.guard.spec.ts`:
  - `[4-TF-UNIT-001]` impersonator role grants access when CUSTOMER_ADMIN is in required roles ✓
  - `[4-TF-UNIT-002]` impersonator role grants access when multiple roles including CUSTOMER_ADMIN are required ✓
  - `[4-TF-UNIT-003]` impersonator role is DENIED when only BUBBLE_ADMIN is required (AC2 safety test) ✓
  - `[4-TF-UNIT-004]` impersonator role is DENIED when only CREATOR is required (impersonator maps to CUSTOMER_ADMIN, not CREATOR) ✓
  - `[4-TF-UNIT-005]` impersonator role is DENIED when required roles are `[BUBBLE_ADMIN, CREATOR]` (no CUSTOMER_ADMIN in the list — mixed-role gap from party mode review) ✓
  - File: `apps/api-gateway/src/app/auth/guards/roles.guard.spec.ts`

### Task 2: Register missing Lucide icons (AC: 3)

- [x] 2.1: Add `File` and `FileType` to the import statement in `app.config.ts`
  - File: `apps/web/src/app/app.config.ts`
  - Add to both the import block (from `lucide-angular`) and the `LucideIconProvider` object
- [x] 2.2: Verify `file-card.component.ts` icon names match registration:
  - Line 253: `'file-type'` → maps to Lucide `FileType` (kebab-case `file-type` maps to PascalCase `FileType`) ✓
  - Line 254: `'file'` → maps to Lucide `File` (kebab-case `file` maps to PascalCase `File`) ✓
  - No code changes needed in `file-card.component.ts` — only registration

### Task 3: Browser smoke test (AC: 5)

- [x] 3.1: Start dev servers, log in as admin, impersonate Acme Corp
- [x] 3.2: Verify Data Vault renders 7 file cards with icons (0 console errors, 0 warnings)
- [x] 3.3: Verify impersonated admin can access `/app/` endpoints — specifically workflow runs page loads with "Run" button visible (no 403)

### Task 4: Run full test suite + finalize (AC: 4)

- [x] 4.1: Run `npx nx run-many -t test --all` — 1244 tests pass (619 api + 515 web + 83 shared + 27 db-layer), 0 failures
- [x] 4.2: Run `npx nx run-many -t lint --all` — 0 errors in changed files (pre-existing E2E lint warnings only)
- [x] 4.3: Update this story file: check all tasks, fill Dev Agent Record, update status

## Dev Notes

### Implementation Details

**RolesGuard change (Task 1):**
```typescript
// Map impersonator sessions to CUSTOMER_ADMIN for role checks.
// JWT payload is NOT modified — only the local authorization comparison.
const effectiveRole =
  user.role === 'impersonator'
    ? UserRole.CUSTOMER_ADMIN
    : (user.role as UserRole);
return requiredRoles.includes(effectiveRole);
```

This is a 3-line change. The `effectiveRole` variable is local — the JWT `user.role` field remains `"impersonator"` for logging, audit trail, and other guards (like `TenantStatusGuard` which already handles impersonation correctly by bypassing `BUBBLE_ADMIN` only).

**Magic string note (party mode review — Naz):** The string `'impersonator'` now exists in 2 locations: `tenants.service.ts:115` (JWT creation) and `roles.guard.ts` (mapping). No shared constant exists. Extracting to a constant (e.g., `IMPERSONATOR_ROLE` in `libs/shared`) is deferred — not worth a separate story but should be picked up as a drive-by in the next story that touches auth.

**TenantStatusGuard:** No changes needed. It already runs tenant status checks for impersonated sessions (bypasses only for `BUBBLE_ADMIN`). This is correct behavior — impersonated sessions should see the tenant's actual status.

**Lucide icons (Task 2):**
Both `File` and `FileType` are confirmed valid exports from `lucide-angular`. The kebab-case icon names in templates (`file`, `file-type`) automatically map to PascalCase registration names (`File`, `FileType`).

### Project Structure Notes

- Guard: `apps/api-gateway/src/app/auth/guards/roles.guard.ts` (single file, no module registration needed)
- Guard test: `apps/api-gateway/src/app/auth/guards/roles.guard.spec.ts` (existing file, 6 tests — added 5 more = 11 total)
- Icon config: `apps/web/src/app/app.config.ts` (added 2 imports + 2 provider entries)
- No shared infra changes. No new files created. No DTOs modified.

### References

- [Source: roles.guard.ts](apps/api-gateway/src/app/auth/guards/roles.guard.ts) — line 25, impersonator mapping
- [Source: roles.guard.spec.ts](apps/api-gateway/src/app/auth/guards/roles.guard.spec.ts) — 11 tests (6 existing + 5 new)
- [Source: tenants.service.ts](apps/api-gateway/src/app/tenants/tenants.service.ts) — lines 111-118, impersonation JWT creation
- [Source: user.entity.ts](libs/db-layer/src/lib/entities/user.entity.ts) — lines 9-13, UserRole enum
- [Source: app.config.ts](apps/web/src/app/app.config.ts) — Lucide icon registration (File, FileType added)
- [Source: file-card.component.ts](apps/web/src/app/app/data-vault/file-card.component.ts) — lines 250-255, getIcon() method
- [Source: project-context.md](project-context.md) — Rule 7 (Lucide icons MUST be registered)

### Out-of-Scope

| Item | Story Reference |
|------|----------------|
| Full Model Reassignment UX (H1 from LT1) | Separate story — see `memory/h1-model-reassignment-story-notes.md` |
| Provider Registry (M3 from LT1) | Story 4-PR (between Epic 4 and Epic 5) |
| LLM Generation Parameters | Story 4-GP (after 4-PR) — see `memory/llm-generation-params-story-notes.md` |
| Extract `'impersonator'` to shared constant | Drive-by in next auth-touching story (Naz party mode finding) |

## Test Traceability

| AC ID | Test File | Test Description | Status |
|-------|-----------|------------------|--------|
| AC1 | roles.guard.spec.ts | [4-TF-UNIT-001] impersonator maps to CUSTOMER_ADMIN | ✓ |
| AC1 | roles.guard.spec.ts | [4-TF-UNIT-002] impersonator with multiple required roles | ✓ |
| AC2 | roles.guard.spec.ts | [4-TF-UNIT-003] impersonator denied for BUBBLE_ADMIN only | ✓ |
| AC2 | roles.guard.spec.ts | [4-TF-UNIT-004] impersonator denied for CREATOR only | ✓ |
| AC2 | roles.guard.spec.ts | [4-TF-UNIT-005] impersonator denied for ADMIN+CREATOR (no CA) | ✓ |
| AC3 | app.config.ts | Manual verification — File + FileType icons registered | ✓ |
| AC5 | Browser smoke test | Impersonation + Data Vault icons + workflow page access | ✓ |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — no issues encountered during implementation.

### Completion Notes List

- 5 new unit tests added (4-TF-UNIT-001 through 005), all passing
- 2 Lucide icons registered (File, FileType)
- Browser smoke test: 3/3 checks pass (impersonation, Data Vault icons, workflow page access)
- Total tests: 1244 (up from 1237, +5 guard tests +2 previously skipped now running)
- 0 lint errors in changed files

### File List

| File | Change |
|------|--------|
| `apps/api-gateway/src/app/auth/guards/roles.guard.ts` | Added impersonator → CUSTOMER_ADMIN mapping |
| `apps/api-gateway/src/app/auth/guards/roles.guard.spec.ts` | Added 5 impersonator unit tests |
| `apps/web/src/app/app.config.ts` | Registered File + FileType Lucide icons |
