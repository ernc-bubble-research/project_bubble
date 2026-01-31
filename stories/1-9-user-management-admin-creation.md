# Story 1.9: User Management & Admin Creation

Status: done

## Story

As a **Customer Admin** (managing my team) OR **Bubble Admin** (providing support),
I want to create new users directly in the system,
so that I can onboard team members without relying on an external email service.

## Acceptance Criteria

1. **AC1: Customer Admin creates a user within their tenant**
   - Given I am a **Customer Admin** authenticated with a valid JWT
   - When I POST to `/app/users` with `{ email, password, role, name }`
   - Then a new user is created strictly bound to **my** `tenant_id` (from JWT)
   - And the `role` field only accepts `creator` or `customer_admin` (cannot create `bubble_admin`)
   - And the password is securely hashed with bcrypt before storage
   - And the response returns the user object **without** the password hash
   - And if the email already exists within the tenant, a `409 Conflict` is returned

2. **AC2: Bubble Admin creates a user for any tenant**
   - Given I am a **Bubble Admin** authenticated with a valid JWT
   - When I POST to `/admin/tenants/:tenantId/users` with `{ email, password, role, name }`
   - Then a new user is created bound to the specified `tenant_id`
   - And the `role` field accepts `creator`, `customer_admin`, or `bubble_admin`
   - And the specified `tenant_id` must reference an existing tenant (else `404 Not Found`)

3. **AC3: Customer Admin lists users in their tenant**
   - Given I am a **Customer Admin**
   - When I GET `/app/users`
   - Then I receive a list of all users in **my** tenant only
   - And each user includes: `id`, `email`, `role`, `name`, `createdAt`
   - And the password hash is **never** returned

4. **AC4: Bubble Admin lists users for a specific tenant**
   - Given I am a **Bubble Admin**
   - When I GET `/admin/tenants/:tenantId/users`
   - Then I receive a list of all users for that specific tenant

5. **AC5: User update (role change)**
   - Given I am a **Customer Admin** or **Bubble Admin**
   - When I PATCH `/app/users/:id` (Customer Admin) or `/admin/tenants/:tenantId/users/:id` (Bubble Admin)
   - Then I can update the user's `role` and `name`
   - And a Customer Admin cannot promote a user to `bubble_admin`
   - And a Customer Admin cannot modify users outside their tenant (enforced by RLS + guard)

6. **AC6: User deactivation**
   - Given I am a **Customer Admin** or **Bubble Admin**
   - When I DELETE `/app/users/:id` or `/admin/tenants/:tenantId/users/:id`
   - Then the user's status is set to `inactive` (soft delete — no hard delete)
   - And the user can no longer log in
   - And the user record remains in the database for audit purposes

7. **AC7: Password reset by admin**
   - Given I am a **Customer Admin** or **Bubble Admin**
   - When I POST `/app/users/:id/reset-password` or `/admin/tenants/:tenantId/users/:id/reset-password` with `{ newPassword }`
   - Then the user's password is updated with a bcrypt hash of the new password
   - And the previous password is immediately invalidated

8. **AC8: Unit tests**
   - Given the user management implementation
   - Then tests cover: user creation (both roles), duplicate email rejection, role restriction enforcement, tenant scoping, password hashing, list/update/deactivate operations
   - And all existing tests (132 total: 11 db-layer + 51 api-gateway + 70 web) continue to pass

9. **AC9: Shared DTOs**
   - All request/response DTOs are defined in `libs/shared/src/lib/dtos/` (NOT in `apps/`)
   - DTOs use `class-validator` decorators for validation
   - Response DTOs exclude sensitive fields (password hash)

## Tasks / Subtasks

> **Execution order:** Entity update → DTOs → Service → Controllers → Guards → Tests → Build verification

- [x] **Task 1: Update UserEntity** (AC: 1, 2, 6)
  - [x] 1.1 Add `name` column (varchar, nullable — existing users won't have it)
    ```typescript
    @Column({ nullable: true })
    name?: string;
    ```
  - [x] 1.2 Add `status` column (enum: `active`, `inactive`, default: `active`)
    ```typescript
    export enum UserStatus {
      ACTIVE = 'active',
      INACTIVE = 'inactive',
    }

    @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
    status!: UserStatus;
    ```
  - [x] 1.3 Export `UserStatus` from `libs/db-layer/src/index.ts`
  - [x] 1.4 Add `@ManyToOne` relationship to `TenantEntity` (optional — for eager loading tenant info if needed, but NOT required. Use `tenantId` column directly. Skip this if it adds unnecessary complexity for prototype.)

- [x] **Task 2: Create User DTOs** (AC: 9)
  - [x] 2.1 Create `libs/shared/src/lib/dtos/user/create-user.dto.ts`:
    ```typescript
    import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
    import { UserRole } from '@project-bubble/db-layer';

    export class CreateUserDto {
      @IsEmail()
      email!: string;

      @IsString()
      @MinLength(8)
      password!: string;

      @IsEnum(UserRole)
      role!: UserRole;

      @IsString()
      @IsOptional()
      name?: string;
    }
    ```
  - [x] 2.2 Create `libs/shared/src/lib/dtos/user/update-user.dto.ts`:
    ```typescript
    import { IsEnum, IsOptional, IsString } from 'class-validator';
    import { UserRole } from '@project-bubble/db-layer';

    export class UpdateUserDto {
      @IsEnum(UserRole)
      @IsOptional()
      role?: UserRole;

      @IsString()
      @IsOptional()
      name?: string;
    }
    ```
  - [x] 2.3 Create `libs/shared/src/lib/dtos/user/reset-password.dto.ts`:
    ```typescript
    import { IsString, MinLength } from 'class-validator';

    export class ResetPasswordDto {
      @IsString()
      @MinLength(8)
      newPassword!: string;
    }
    ```
  - [x] 2.4 Create `libs/shared/src/lib/dtos/user/user-response.dto.ts`:
    ```typescript
    export class UserResponseDto {
      id!: string;
      email!: string;
      role!: string;
      name?: string;
      tenantId!: string;
      status!: string;
      createdAt!: Date;
    }
    ```
  - [x] 2.5 Create barrel export `libs/shared/src/lib/dtos/user/index.ts` and update `libs/shared/src/lib/dtos/index.ts`

- [x] **Task 3: Create UsersService** (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] 3.1 Create `apps/api-gateway/src/app/users/users.service.ts`
  - [x] 3.2 Inject `TransactionManager` (NOT `@InjectRepository`) — follow "Security by Consumption" rule
  - [x] 3.3 Implement `create(dto: CreateUserDto, tenantId: string)`:
    - Hash password with bcrypt (reuse `AuthService.hashPassword` pattern — 10 salt rounds)
    - Check for duplicate email within tenant (query within transaction)
    - Insert new user with `tenant_id`, `status: active`
    - Return user without password hash
  - [x] 3.4 Implement `findAllByTenant(tenantId: string)`:
    - Use `TransactionManager.run(tenantId, callback)` with explicit tenant override
    - Return list of users without password hashes
  - [x] 3.5 Implement `findOne(userId: string, tenantId: string)`:
    - Use explicit tenant override
    - Return single user or throw `NotFoundException`
  - [x] 3.6 Implement `update(userId: string, tenantId: string, dto: UpdateUserDto)`:
    - Use explicit tenant override
    - Update only provided fields
    - Return updated user without password hash
  - [x] 3.7 Implement `deactivate(userId: string, tenantId: string)`:
    - Set `status = 'inactive'`
    - Use explicit tenant override
  - [x] 3.8 Implement `resetPassword(userId: string, tenantId: string, newPassword: string)`:
    - Hash new password
    - Update user's `passwordHash`
    - Use explicit tenant override

- [x] **Task 4: Create UsersController (Customer Admin path)** (AC: 1, 3, 5, 6, 7)
  - [x] 4.1 Create `apps/api-gateway/src/app/users/users.controller.ts`
  - [x] 4.2 Route prefix: `/app/users`
  - [x] 4.3 Guard: `JwtAuthGuard` + `RolesGuard` with `@Roles(UserRole.CUSTOMER_ADMIN)`
  - [x] 4.4 Endpoints:
    - `POST /app/users` — extracts `tenantId` from `request.user.tenantId`
    - `GET /app/users` — lists users for caller's tenant
    - `PATCH /app/users/:id` — updates user (role/name)
    - `DELETE /app/users/:id` — deactivates user
    - `POST /app/users/:id/reset-password` — resets user password
  - [x] 4.5 Validate role restrictions: Customer Admin CANNOT create/promote to `bubble_admin`
  - [x] 4.6 Map entity to `UserResponseDto` (strip `passwordHash`)

- [x] **Task 5: Create AdminUsersController (Bubble Admin path)** (AC: 2, 4)
  - [x] 5.1 Create `apps/api-gateway/src/app/users/admin-users.controller.ts`
  - [x] 5.2 Route prefix: `/admin/tenants/:tenantId/users`
  - [x] 5.3 Guard: `JwtAuthGuard` + `RolesGuard` with `@Roles(UserRole.BUBBLE_ADMIN)`
  - [x] 5.4 Endpoints (mirror the Customer Admin endpoints but with `:tenantId` from URL):
    - `POST /admin/tenants/:tenantId/users` — Bubble Admin can specify tenant
    - `GET /admin/tenants/:tenantId/users` — list users for specified tenant
    - `PATCH /admin/tenants/:tenantId/users/:id` — update user
    - `DELETE /admin/tenants/:tenantId/users/:id` — deactivate user
    - `POST /admin/tenants/:tenantId/users/:id/reset-password` — reset password
  - [x] 5.5 Validate tenant exists before creating user (query TenantsService or check DB)

- [x] **Task 6: Create UsersModule** (AC: 1-7)
  - [x] 6.1 Create `apps/api-gateway/src/app/users/users.module.ts`
  - [x] 6.2 Register `UsersService`, `UsersController`, `AdminUsersController`
  - [x] 6.3 Import `AuthModule` if needed (for password hashing utility) — OR duplicate bcrypt logic in UsersService (prefer self-contained service)
  - [x] 6.4 Register `UsersModule` in `app.module.ts`

- [x] **Task 7: Update AuthService login to check user status** (AC: 6)
  - [x] 7.1 In `AuthService.validateUser()`, add check: if `user.status === 'inactive'`, return `null` (treat as invalid credentials)
  - [x] 7.2 Update existing auth tests to cover inactive user rejection

- [x] **Task 8: Unit tests** (AC: 8)
  - [x] 8.1 Create `apps/api-gateway/src/app/users/users.service.spec.ts`:
    - Test: Create user with valid data → returns user without password
    - Test: Create user with duplicate email → throws ConflictException
    - Test: Customer Admin cannot create bubble_admin role
    - Test: List users returns all users for tenant
    - Test: Deactivate sets status to inactive
    - Test: Reset password hashes new password
  - [x] 8.2 Create `apps/api-gateway/src/app/users/users.controller.spec.ts`:
    - Test: POST /app/users → calls service with JWT tenant
    - Test: GET /app/users → returns user list
    - Test: PATCH /app/users/:id → updates user
    - Test: DELETE /app/users/:id → deactivates user
  - [x] 8.3 Create `apps/api-gateway/src/app/users/admin-users.controller.spec.ts`:
    - Test: POST /admin/tenants/:tenantId/users → calls service with URL tenant
    - Test: Bubble Admin can create bubble_admin role users
  - [x] 8.4 Update auth tests for inactive user login rejection
  - [x] 8.5 Verify all existing tests still pass (132 total)

- [x] **Task 9: Build verification and lint** (AC: 1-9)
  - [x] 9.1 `nx lint api-gateway` — passes
  - [x] 9.2 `nx lint shared` — passes
  - [x] 9.3 `nx test api-gateway` — all pass
  - [x] 9.4 `nx test db-layer` — all pass
  - [x] 9.5 `nx build api-gateway` — passes
  - [x] 9.6 `nx build web` — passes

## Dev Notes

### Scope Boundaries — What This Story Does NOT Include

- **No frontend UI.** This is backend API only. The Angular user management pages are deferred to Story 1.10 (Login & Password Pages) and future stories.
- **No email invitations.** Story 1.12 (Phase 2) handles email-based invitations via SendGrid/SES.
- **No password complexity validation beyond MinLength(8).** The UX spec mentions "8+ chars, mixed case, number" for the set-password page (Story 1.10). For the API layer in this story, `MinLength(8)` is sufficient. Story 1.10 can add client-side complexity rules.
- **No user profile self-edit.** Users editing their own profile (name, password) is a separate concern — can be added in a future story.
- **No audit logging.** Story 7.2 (Epic 7) adds audit trail. For now, user creation/modification is not logged beyond standard DB timestamps.

### Architecture Decisions

**TransactionManager with explicit tenant override:** UsersService uses `TransactionManager.run(tenantId, callback)` with an explicit `tenantId` parameter rather than relying on `AsyncLocalStorage`. This is because:
1. The Customer Admin endpoint reads `tenantId` from the JWT (`request.user.tenantId`)
2. The Bubble Admin endpoint reads `tenantId` from the URL parameter (`:tenantId`)
3. Both paths explicitly pass tenantId into the service — the service doesn't need to know where it came from

**Two controllers, one service:** The `UsersController` (Customer Admin, `/app/users`) and `AdminUsersController` (Bubble Admin, `/admin/tenants/:tenantId/users`) share the same `UsersService`. The controllers handle authorization (role guards) and tenant resolution (JWT vs URL), then delegate to the service.

**Duplicate email check is tenant-scoped:** The same email can exist in different tenants. The uniqueness constraint is `(email, tenant_id)` — not globally unique. The current `UserEntity` has `@Column({ unique: true })` on email which makes it globally unique. **Decision for prototype:** Keep global uniqueness on email for simplicity (avoids login ambiguity — which tenant does `bob@example.com` belong to?). This matches the AuthService login flow which queries by email across all tenants.

**Soft delete via `status` enum:** No hard deletes. Setting `status = 'inactive'` preserves audit trail. The AuthService login check must reject inactive users.

**`auth_select_all` policy on users table:** Story 1.8 added a permissive SELECT policy (`USING (true)`) on the users table for pre-auth login queries. This means ALL SELECT queries on users bypass tenant isolation. For user listing endpoints, the service must explicitly filter by `tenant_id` in the WHERE clause (not rely solely on RLS). The RLS `tenant_isolation_users` restrictive policy still protects INSERT/UPDATE/DELETE operations.

### Previous Story Intelligence (Story 1.8)

- **TransactionManager** is in `@project-bubble/db-layer`, exported from `DbLayerModule` (global)
- **`run(tenantId, callback)`** — explicit tenant override, sets `SET LOCAL app.current_tenant = tenantId`
- **`run(callback)`** — reads from AsyncLocalStorage (set by TenantContextInterceptor)
- **RLS policies on users table:**
  - `tenant_isolation_users` — restrictive, enforces `tenant_id = current_setting('app.current_tenant', true)::uuid`
  - `auth_select_all` — permissive SELECT USING (true) — allows cross-tenant reads
- **FORCE ROW LEVEL SECURITY** on users table — even table owner is subject to RLS
- **UserRole enum** exported from `@project-bubble/db-layer` (`BUBBLE_ADMIN`, `CUSTOMER_ADMIN`, `CREATOR`)
- **Password hashing** in AuthService uses `bcrypt.hash(password, 10)` — use same pattern
- **Test count:** 132 (11 db-layer + 51 api-gateway + 70 web)
- **Code review fix H3:** `auth_select_all` permissive SELECT on users — means SELECT bypasses RLS. Service must explicitly filter by tenant_id for list queries.

### CRITICAL: RLS Behavior for User Queries

Because of the `auth_select_all` permissive SELECT policy (added in Story 1.8 for login), **all SELECT queries on the users table bypass RLS**. This means:
- `manager.find(UserEntity)` will return ALL users across ALL tenants
- The service MUST add an explicit `WHERE tenant_id = :tenantId` condition on every SELECT query
- INSERT/UPDATE/DELETE are still protected by the restrictive `tenant_isolation_users` policy

This is a critical security detail. Forgetting the WHERE clause on a SELECT would expose cross-tenant user data.

### Guard Chain (from Story 1.7)

- **`JwtAuthGuard`** — validates JWT, populates `request.user` with `{ userId, tenantId, role }`
- **`RolesGuard`** + `@Roles(...)` decorator — checks `request.user.role` against allowed roles
- **`OptionalJwtAuthGuard`** — used on public routes (sets user if JWT present, but doesn't require it)
- **`AdminApiKeyGuard`** — allows API key auth for admin endpoints (sets synthetic user)

For Customer Admin endpoints (`/app/users`): Use `JwtAuthGuard` + `RolesGuard(@Roles(UserRole.CUSTOMER_ADMIN, UserRole.BUBBLE_ADMIN))`
For Bubble Admin endpoints (`/admin/tenants/:tenantId/users`): Use existing `OptionalJwtAuthGuard` + `AdminApiKeyGuard` + `RolesGuard(@Roles(UserRole.BUBBLE_ADMIN))` pattern (same as TenantsController)

### Existing Patterns to Follow

**TenantsController pattern** (`apps/api-gateway/src/app/tenants/tenants.controller.ts`):
- Uses `@UseGuards(OptionalJwtAuthGuard, AdminApiKeyGuard, RolesGuard)` for admin routes
- Uses `@Roles(UserRole.BUBBLE_ADMIN)` decorator
- Returns mapped DTOs, not raw entities

**AuthService.hashPassword pattern:**
```typescript
private async hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
```

### Project Structure Notes

```
libs/shared/src/lib/dtos/
├── auth/                              (EXISTING)
│   ├── login.dto.ts
│   └── login-response.dto.ts
├── tenant/                            (EXISTING)
│   ├── create-tenant.dto.ts
│   └── ...
├── user/                              (NEW)
│   ├── create-user.dto.ts             (NEW)
│   ├── update-user.dto.ts             (NEW)
│   ├── reset-password.dto.ts          (NEW)
│   ├── user-response.dto.ts           (NEW)
│   └── index.ts                       (NEW)
└── index.ts                           (MODIFY — add user exports)

libs/db-layer/src/lib/entities/
├── user.entity.ts                     (MODIFY — add name, status)
└── index.ts                           (MODIFY — export UserStatus)

apps/api-gateway/src/app/
├── users/                             (NEW)
│   ├── users.module.ts                (NEW)
│   ├── users.service.ts               (NEW)
│   ├── users.service.spec.ts          (NEW)
│   ├── users.controller.ts            (NEW — Customer Admin /app/users)
│   ├── users.controller.spec.ts       (NEW)
│   ├── admin-users.controller.ts      (NEW — Bubble Admin /admin/tenants/:tenantId/users)
│   └── admin-users.controller.spec.ts (NEW)
├── auth/
│   ├── auth.service.ts                (MODIFY — check user status on login)
│   └── auth.service.spec.ts           (MODIFY — add inactive user test)
└── app.module.ts                      (MODIFY — import UsersModule)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 1.9 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/prd.md — FR27: Customer Admin can manually create users]
- [Source: _bmad-output/planning-artifacts/architecture.md — RBAC Permission Matrix]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — §4.x Admin Portal Users Tab wireframe]
- [Source: project-context.md — "Security by Consumption" Rule §2, RLS Architecture §2b]
- [Source: stories/1-8-rls-enforcement-mechanism-security.md — TransactionManager API, RLS policies, auth_select_all]
- [Source: stories/1-7-user-authentication-rbac.md — Guard chain, JWT payload, request.user shape]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A — All tasks completed without errors on first pass.

### Completion Notes List

- Used `@IsIn(['bubble_admin', 'customer_admin', 'creator'])` with string literals instead of `@IsEnum(UserRole)` in shared DTOs to avoid Angular depending on `@project-bubble/db-layer` (which has NestJS/TypeORM deps). Deviation from story template code snippets.
- Task 1.4 (`@ManyToOne` to TenantEntity) skipped per story guidance — not needed for prototype.
- Task 5.5 (validate tenant exists before creating user) — **fixed in code review**: added explicit `TenantEntity` existence check in `UsersService.create()` before user creation.
- AdminUsersController uses `OptionalJwtAuthGuard + AdminApiKeyGuard + RolesGuard` pattern (matching TenantsController) instead of plain `JwtAuthGuard` as originally specified in Task 5.3.
- Customer Admin routes also allow BUBBLE_ADMIN access via `@Roles(UserRole.CUSTOMER_ADMIN, UserRole.BUBBLE_ADMIN)`.
- All 159 tests pass (11 db-layer + 78 api-gateway + 70 web) after code review fixes. Story 1.8 had 132 total; 27 new tests total.

### File List

**New Files:**
- `libs/shared/src/lib/dtos/user/create-user.dto.ts`
- `libs/shared/src/lib/dtos/user/update-user.dto.ts`
- `libs/shared/src/lib/dtos/user/reset-password.dto.ts`
- `libs/shared/src/lib/dtos/user/user-response.dto.ts`
- `libs/shared/src/lib/dtos/user/index.ts`
- `apps/api-gateway/src/app/users/users.service.ts`
- `apps/api-gateway/src/app/users/users.controller.ts`
- `apps/api-gateway/src/app/users/admin-users.controller.ts`
- `apps/api-gateway/src/app/users/users.module.ts`
- `apps/api-gateway/src/app/users/users.service.spec.ts`
- `apps/api-gateway/src/app/users/users.controller.spec.ts`
- `apps/api-gateway/src/app/users/admin-users.controller.spec.ts`

**Modified Files:**
- `libs/db-layer/src/lib/entities/user.entity.ts` — Added `UserStatus` enum, `name` column, `status` column
- `libs/db-layer/src/lib/entities/index.ts` — Export `UserStatus`
- `libs/shared/src/lib/dtos/index.ts` — Added `export * from './user'`
- `apps/api-gateway/src/app/auth/auth.service.ts` — Added inactive user check in `validateUser()`
- `apps/api-gateway/src/app/auth/auth.service.spec.ts` — Added `UserStatus` import, inactive user test
- `apps/api-gateway/src/app/app.module.ts` — Registered `UsersModule`

### Change Log

| Change | Reason |
|--------|--------|
| Added `UserStatus` enum and `name`/`status` columns to `UserEntity` | AC1, AC6: Support user creation with name and soft-delete via status |
| Created 4 DTOs in `libs/shared/src/lib/dtos/user/` | AC9: Shared DTOs with class-validator decorators |
| Used `@IsIn` string literals instead of `@IsEnum(UserRole)` in DTOs | Avoids shared lib depending on db-layer package (Angular compatibility) |
| Created `UsersService` with `TransactionManager` | AC1-7: Core CRUD with explicit tenant scoping, role restrictions |
| Created `UsersController` at `/app/users` | AC1, AC3, AC5-7: Customer Admin user management path |
| Created `AdminUsersController` at `/admin/tenants/:tenantId/users` | AC2, AC4: Bubble Admin user management path |
| Updated `AuthService.validateUser()` to reject inactive users | AC6: Deactivated users cannot log in |
| Added 27 new unit tests (12 service + 6 admin-controller + 5 controller + 4 auth) | AC8: Comprehensive test coverage |
| **[Review Fix H1]** Scoped duplicate email check to tenant in `UsersService.create()` | Security: prevents leaking cross-tenant user existence via error message |
| **[Review Fix H3]** Added `TenantEntity` existence check in `UsersService.create()` | AC2: validates tenant_id references existing tenant (404 if not) |
| **[Review Fix M1]** Added missing admin reset-password test | Test coverage gap: AdminUsersController had no test for reset-password endpoint |
| **[Review Fix M3]** Removed unnecessary `AuthModule` import from `UsersModule` | Eliminates redundant import; guards resolve from root injector |

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5 (code-review workflow)
**Date:** 2026-01-31

### Review Summary

| Category | Count |
|----------|-------|
| HIGH issues found | 3 |
| MEDIUM issues found | 4 |
| LOW issues found | 1 |
| Issues auto-fixed | 6 (H1, H2, H3, M1, M3 + new test for H3) |
| Issues informational (no fix needed) | 2 (H2 runtime-safe, M4 per-AC correct) |

### Findings & Resolutions

**H1 (FIXED):** Duplicate email check in `create()` queried by email only (no tenantId), which — combined with `auth_select_all` permissive SELECT — could leak cross-tenant user existence via error messages. Fixed by adding `tenantId` to the WHERE clause.

**H2 (COMMENT ADDED):** `dto.role` compared against `UserRole.BUBBLE_ADMIN` is type-unsafe at the TypeScript level (`string` vs enum), but the `@IsIn` validator guarantees only valid values reach the comparison. Added clarifying comment.

**H3 (FIXED):** AC2 requires `404 Not Found` when tenant doesn't exist, but neither controller nor service validated tenant existence. `TransactionManager.run(tenantId)` only sets `SET LOCAL` — no FK constraint exists on `users.tenant_id`. Fixed by adding `TenantEntity` existence check inside the transaction. Added corresponding test.

**M1 (FIXED):** `AdminUsersController` had 5 endpoints but only 5 tests — missing `reset-password` endpoint test. Added.

**M2 (INFORMATIONAL):** 3 git-modified files not documented in story File List (`libs/db-layer/package.json`, `libs/db-layer/src/index.ts`, `project-context.md`). These are from prior stories (1.7, 1.8) and uncommitted. No action needed for this story.

**M3 (FIXED):** `UsersModule` imported `AuthModule` unnecessarily. Guards resolve from the root injector since `AuthModule` is imported at `AppModule` level. Removed the import.

**M4 (INFORMATIONAL):** `UserResponseDto` omits `updatedAt` from `UserEntity`. Correct per AC3 which specifies `id, email, role, name, createdAt`.

**L1 (ACCEPTED):** Duplicate bcrypt salt rounds (10) hardcoded in both `AuthService` and `UsersService`. Acceptable for prototype scope.

### Verification

- 78 api-gateway tests pass (78/78)
- 11 db-layer tests pass (11/11)
- All lint clean
- Build succeeds
