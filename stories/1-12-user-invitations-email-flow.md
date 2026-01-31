# Story 1.12: User Invitations & Email Flow

Status: done

## Story

As a **Customer Admin**,
I want to invite colleagues via email,
so that they can set their own passwords and onboard themselves.

## Acceptance Criteria

1. **AC1: Invite user via email**
   - Given I am a Customer Admin
   - When I submit an invitation for `bob@example.com` with a role (`creator` or `customer_admin`)
   - Then an invitation record is created with a secure, hashed token and 72-hour expiry
   - And an email is sent to `bob@example.com` containing a link: `{FRONTEND_URL}/auth/set-password?token={raw_token}`
   - And the invitation appears in the tenant's invitation list with status `pending`

2. **AC2: Accept invitation (set password)**
   - Given Bob clicks the invitation link
   - When he navigates to `/auth/set-password?token={raw_token}`
   - Then the existing set-password page validates the token against the backend
   - And Bob sets his password (using the existing password complexity validation)
   - And a new User record is created in the correct tenant with the invited role
   - And the invitation status is updated to `accepted`
   - And Bob is redirected to `/auth/login` with `?message=password-set`

3. **AC3: Expired/invalid token**
   - Given a token that is expired (>72 hours) or already used
   - When Bob navigates to `/auth/set-password?token={invalid_token}`
   - Then the backend returns an error
   - And the set-password page shows "This invitation link has expired or is invalid."

4. **AC4: Duplicate email guard**
   - Given `bob@example.com` already exists as a user in ANY tenant (email is globally unique)
   - When I try to invite `bob@example.com`
   - Then the API returns a 409 Conflict error: "A user with this email already exists"

5. **AC5: Resend invitation**
   - Given an invitation exists with status `pending`
   - When I click "Resend" on the invitation
   - Then the old token is invalidated
   - And a new token and email are generated and sent

6. **AC6: Revoke invitation**
   - Given an invitation exists with status `pending`
   - When I click "Revoke"
   - Then the invitation status is updated to `revoked`
   - And the token can no longer be used

7. **AC7: Bubble Admin can invite on behalf of tenant**
   - Given I am a Bubble Admin viewing a tenant's user management
   - When I invite `bob@example.com` for that tenant
   - Then the same flow as AC1 occurs, scoped to that tenant

8. **AC8: Unit tests**
   - Backend: InvitationsService (create, accept, resend, revoke, expired token, duplicate email)
   - Backend: AuthController set-password endpoint
   - Backend: EmailService (mocked provider)
   - Frontend: Invite dialog component (form validation, API call, error handling)
   - All existing tests continue to pass

## Tasks / Subtasks

> **Execution order:** Email service → Invitation entity + RLS → Shared DTOs → Backend invitation service → Auth set-password endpoint → Backend controllers → Frontend invitation service → Frontend invite UI + Users tab → Auth service verify → Lucide icons → Tests → Build verification

- [x] **Task 1: Create Email Service** (AC: 1, 5)
  - [x] 1.1 Install `nodemailer` + `@types/nodemailer` as dependencies
    - Rationale: nodemailer is transport-agnostic (SMTP, SendGrid, SES) — avoids vendor lock-in. For prototype, use SMTP (Mailtrap/Ethereal for dev). Production can swap to SendGrid/SES transport without code changes.
  - [x] 1.2 Create `apps/api-gateway/src/app/email/email.service.ts`
    - Injectable NestJS service
    - Constructor creates nodemailer transport from env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`)
    - `sendInvitationEmail(to: string, token: string, inviterName: string, tenantName: string): Promise<void>`
    - Email body: HTML template with magic link `{FRONTEND_URL}/auth/set-password?token={token}`
    - Include inviter name and tenant name in email for context
  - [x] 1.3 Create `apps/api-gateway/src/app/email/email.module.ts`
    - Export `EmailService` for use in other modules
  - [x] 1.4 Add environment variables to `.env.example`:
    ```
    # Email (SMTP — use Mailtrap/Ethereal for dev, SendGrid SMTP or AWS SES SMTP for production)
    SMTP_HOST=sandbox.smtp.mailtrap.io
    SMTP_PORT=2525
    SMTP_USER=
    SMTP_PASS=
    SMTP_FROM=noreply@bubble.app
    FRONTEND_URL=http://localhost:4200
    INVITATION_EXPIRY_HOURS=72
    ```

- [x] **Task 2: Create Invitation Entity & Migration** (AC: 1, 2, 3, 6)
  - [x] 2.1 Create `libs/db-layer/src/lib/entities/invitation.entity.ts`
    ```typescript
    @Entity('invitations')
    export class InvitationEntity {
      @PrimaryGeneratedColumn('uuid') id: string;
      @Column() email: string;
      @Column({ name: 'token_hash' }) tokenHash: string;
      @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
      @Column({ type: 'enum', enum: UserRole }) role: UserRole;
      @Column({ name: 'invited_by', type: 'uuid' }) invitedBy: string;
      @Column({ name: 'inviter_name', nullable: true }) inviterName: string;
      @Column({ type: 'enum', enum: InvitationStatus, default: InvitationStatus.PENDING }) status: InvitationStatus;
      @Column({ name: 'expires_at', type: 'timestamp' }) expiresAt: Date;
      @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
      @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
    }
    ```
    - `InvitationStatus` enum: `PENDING`, `ACCEPTED`, `EXPIRED`, `REVOKED`
    - **NOTE:** `tokenHash` stores bcrypt hash — raw token is NEVER stored in DB
  - [x] 2.2 Export `InvitationEntity` and `InvitationStatus` from `libs/db-layer/src/lib/entities/index.ts` and `libs/db-layer/src/index.ts`
  - [x] 2.3 Register entity in `InvitationsModule` via `TypeOrmModule.forFeature([InvitationEntity])` — the project uses `autoLoadEntities: true` so entities are auto-discovered from feature modules (NOT from a central entity list)
  - [x] 2.4 Add `'invitations'` to the `tenantScopedTables` array in `libs/db-layer/src/lib/rls-setup.service.ts` — this automatically creates the tenant isolation RLS policy on startup. Also add a permissive SELECT policy `auth_accept_invitations` (same pattern as `auth_select_all` on users table) to allow the unauthenticated `accept` endpoint to query invitations cross-tenant.
  - [x] 2.5 No migration needed — the project uses `synchronize: true` (TypeORM auto-creates tables from entities in dev). The `invitations` table will be auto-created when the entity is registered.

- [x] **Task 3: Create Shared DTOs** (AC: 1, 2, 5, 6)
  - [x] 3.1 Create `libs/shared/src/lib/dtos/invitation/invite-user.dto.ts`
    ```typescript
    export class InviteUserDto {
      @IsEmail() email: string;
      @IsIn(['customer_admin', 'creator']) role: string;
      @IsString() @IsOptional() name?: string;
    }
    ```
  - [x] 3.2 Create `libs/shared/src/lib/dtos/invitation/accept-invitation.dto.ts`
    ```typescript
    export class AcceptInvitationDto {
      @IsString() @IsNotEmpty() token: string;
      @IsString() @MinLength(8) password: string;
    }
    ```
  - [x] 3.3 Create `libs/shared/src/lib/dtos/invitation/invitation-response.dto.ts`
    ```typescript
    export class InvitationResponseDto {
      id: string;
      email: string;
      role: string;
      status: string;
      invitedBy: string;
      inviterName?: string;
      expiresAt: string;
      createdAt: string;
    }
    ```
  - [x] 3.4 Create `libs/shared/src/lib/dtos/invitation/index.ts` and update `libs/shared/src/lib/dtos/index.ts` to re-export
  - [x] 3.5 Define `InvitationStatus` enum in `libs/db-layer/src/lib/entities/invitation.entity.ts` (same file as the entity — follows existing pattern where `UserRole` and `UserStatus` enums are defined in `user.entity.ts`). If the frontend needs the status values, add a type alias `InvitationStatus` in `libs/shared/src/lib/types/` (same pattern as `UserRole` type alias in `libs/shared/src/lib/types/user.types.ts`)

- [x] **Task 4: Create Invitations Service** (AC: 1, 2, 3, 4, 5, 6)
  - [x] 4.1 Create `apps/api-gateway/src/app/invitations/invitations.service.ts`
    - Inject `TransactionManager` and `EmailService`
    - **`create(dto: InviteUserDto, tenantId: string, inviterId: string, inviterName: string): Promise<InvitationResponseDto>`**
      - Generate crypto-random token (`crypto.randomBytes(32).toString('hex')`)
      - Hash token with bcrypt before storing
      - Check for existing user with same email (globally — use AuthService exemption pattern since this is a cross-tenant check)
      - Check for existing pending invitation for same email + tenant (prevent spam)
      - Create invitation record with `expiresAt = now + INVITATION_EXPIRY_HOURS`
      - Send email via `EmailService`
      - Return invitation response (without token)
    - **`accept(dto: AcceptInvitationDto): Promise<void>`**
      - Find all PENDING invitations (not expired), compare token hash with bcrypt
      - If no match or expired → throw `BadRequestException('Invalid or expired invitation')`
      - Create user record directly (hash password with bcrypt, insert into tenant) — do NOT call `UsersService.create()` because it requires `callerRole` and uses `TransactionManager.run()` which sets RLS context. The accept flow is unauthenticated and cross-tenant. Instead, replicate the user creation logic with direct repository access (same exemption pattern as `AuthService`).
      - Update invitation status to `ACCEPTED`
      - This is a cross-tenant operation (user doesn't have JWT) — inject `DataSource` or `Repository<UserEntity>` directly via `TypeOrmModule.forFeature([UserEntity, InvitationEntity])`
    - **`resend(invitationId: string, tenantId: string): Promise<void>`**
      - Validate invitation exists, is PENDING, belongs to tenant
      - Invalidate old token (update `tokenHash` to new value)
      - Generate new token, update `expiresAt`
      - Resend email
    - **`revoke(invitationId: string, tenantId: string): Promise<void>`**
      - Update status to `REVOKED`
    - **`findAllByTenant(tenantId: string): Promise<InvitationResponseDto[]>`**
      - Return all invitations for tenant (any status)
  - [x] 4.2 Create `apps/api-gateway/src/app/invitations/invitations.module.ts`
    - Import `EmailModule`, `TypeOrmModule.forFeature([InvitationEntity, UserEntity])`, export `InvitationsService`
  - [x] 4.3 Add `InvitationsModule` to `apps/api-gateway/src/app/app.module.ts` imports array (required for NestJS to discover the module)

- [x] **Task 5: Create Set-Password Backend Endpoint** (AC: 2, 3)
  - [x] 5.1 Add `POST /auth/set-password` to `apps/api-gateway/src/app/auth/auth.controller.ts`
    - No JWT guard (public endpoint — user doesn't have an account yet)
    - Body: `AcceptInvitationDto` (token + password)
    - Delegates to `InvitationsService.accept()`
    - Returns 200 on success, 400 on invalid/expired token
  - [x] 5.2 Import `InvitationsModule` in `AuthModule` (or wherever AuthController is declared)

- [x] **Task 6: Create Invitation Controllers** (AC: 1, 5, 6, 7)
  - [x] 6.1 Create `apps/api-gateway/src/app/invitations/invitations.controller.ts` (Customer Admin)
    - Route: `/app/invitations`
    - Guards: `JwtAuthGuard`, `RolesGuard` (customer_admin)
    - `POST /` — create invitation (tenantId from JWT)
    - `GET /` — list invitations for tenant
    - `POST /:id/resend` — resend invitation
    - `DELETE /:id` — revoke invitation
  - [x] 6.2 Create `apps/api-gateway/src/app/invitations/admin-invitations.controller.ts` (Bubble Admin)
    - Route: `/admin/tenants/:tenantId/invitations`
    - Guards: `JwtAuthGuard`, `RolesGuard` (bubble_admin)
    - Same CRUD operations but with `tenantId` from URL param

- [x] **Task 7: Frontend — Invitation Service** (AC: 1, 5, 6)
  - [x] 7.1 Create `apps/web/src/app/core/services/invitation.service.ts`
    - Follow existing pattern (e.g., `TenantService`): inject `HttpClient`, define `baseUrl`
    - For Bubble Admin context: `baseUrl = '/api/admin/tenants/${tenantId}/invitations'`
    - Methods: `create(tenantId, dto)`, `getAll(tenantId)`, `resend(tenantId, id)`, `revoke(tenantId, id)`
    - Return `Observable<InvitationResponseDto>` / `Observable<InvitationResponseDto[]>` / `Observable<void>`

- [x] **Task 8: Frontend — Invite User Dialog & Users Tab** (AC: 1, 4)
  - [x] 8.1 Create `apps/web/src/app/admin/tenants/invite-user-dialog.component.ts`
    - Dialog/modal component triggered from tenant detail Users tab
    - Form: email (required, email format), role (dropdown: creator, customer_admin), name (optional)
    - On submit: call `InvitationService.create()`
    - On success: close dialog, emit event to refresh invitation list
    - On 409 error: show "A user with this email already exists"
  - [x] 8.2 Create `invite-user-dialog.component.html` and `invite-user-dialog.component.scss`
    - Modal overlay pattern consistent with existing admin UI (see `ImpersonateConfirmDialogComponent` for pattern)
  - [x] 8.3 Implement the Users tab content in `tenant-detail.component.html`
    - The Users tab currently shows a placeholder: `"Users tab — coming in a future story."`
    - Replace placeholder with: "Invite User" button + invitation list table
    - Add `showInviteDialog = signal(false)` to tenant-detail component
    - Conditionally render `<app-invite-user-dialog>` when `showInviteDialog()` is true
  - [x] 8.4 Add invitation list view within the Users tab
    - Columns: Email, Role, Status, Invited Date, Expiry, Actions (Resend/Revoke)
    - Status badges: pending (yellow), accepted (green), expired (gray), revoked (red)
    - Load invitations via `InvitationService.getAll(tenantId)` when Users tab is activated

- [x] **Task 9: Frontend — Update Auth Service** (AC: 2)
  - [x] 9.1 Verify `apps/web/src/app/core/services/auth.service.ts`
    - `setPassword()` method already exists and calls `POST /api/auth/set-password` — verify it matches the new backend DTO shape (`{ token, password }`)
    - If the DTO shape matches, no changes needed here
  - [x] 9.2 Verify set-password component works end-to-end with the new backend endpoint
    - The component already reads `token` from query params and sends to backend
    - Should work without changes if the backend returns the expected response shape

- [x] **Task 10: Register Lucide Icons** (AC: 1)
  - [x] 10.1 Add any new Lucide icons needed for invitation UI to `apps/web/src/app/app.config.ts`
    - Candidates: `Mail`, `Send`, `UserPlus`, `RefreshCw`, `XCircle` (for resend/revoke actions)

- [x] **Task 11: Unit Tests** (AC: 8)
  - [x] 11.1 Create `apps/api-gateway/src/app/invitations/invitations.service.spec.ts`
    - Test create: happy path, duplicate email, duplicate pending invitation
    - Test accept: happy path, expired token, invalid token, already accepted
    - Test resend: happy path, not found, already accepted
    - Test revoke: happy path, not found
  - [x] 11.2 Create `apps/api-gateway/src/app/email/email.service.spec.ts`
    - Test sendInvitationEmail with mocked nodemailer transport
  - [x] 11.3 Create `apps/api-gateway/src/app/invitations/invitations.controller.spec.ts`
    - Test CRUD endpoints with mocked service
  - [x] 11.4 Create `apps/web/src/app/admin/tenants/invite-user-dialog.component.spec.ts`
    - Test form validation, submission, error handling
  - [x] 11.5 Verify all existing tests still pass:
    - `nx test db-layer` — 11 tests
    - `nx test api-gateway` — 78+ tests
    - `nx test web` — 101+ tests

- [x] **Task 12: Build Verification** (AC: 1-8)
  - [x] 12.1 `nx lint api-gateway` — passes
  - [x] 12.2 `nx lint web` — passes
  - [x] 12.3 `nx test api-gateway` — all pass
  - [x] 12.4 `nx test web` — all pass
  - [x] 12.5 `nx build api-gateway` — passes
  - [x] 12.6 `nx build web` — passes

## Dev Notes

### Scope Boundaries

- **Email provider is nodemailer with SMTP transport.** For prototype, use Mailtrap/Ethereal. Production can switch to SendGrid SMTP or AWS SES SMTP relay by changing env vars only — no code changes needed.
- **No "Forgot Password" flow.** The set-password endpoint uses invitation tokens only. Password reset is a separate feature.
- **No email templates library.** Inline HTML template in the email service. Can be extracted to a template engine later.
- **No rate limiting on invitations.** Can be added as a future enhancement.
- **RLS applies to invitations table.** Invitations are tenant-scoped. The `accept` endpoint is an exception (like login) — needs cross-tenant access.

### Architecture Decisions

**Token security:** Raw token is sent in email URL. Only bcrypt hash is stored in DB. On accept, iterate pending invitations and `bcrypt.compare()` against each. This prevents token exposure if DB is compromised.

**Cross-tenant access for `accept`:** The `accept` method is called by unauthenticated users (they don't have a JWT yet). This is the same pattern as `AuthService.login()` — it's exempted from the TransactionManager/RLS requirement. Use direct repository access.

**Email transport abstraction:** Using nodemailer means the transport layer is configurable. `createTransport({ host, port, auth })` for SMTP. Later, can use `nodemailer-sendgrid-transport` or `@aws-sdk/client-ses` as a drop-in transport without changing service code.

**Invitation vs. direct user creation:** Story 1.9 created `POST /app/users` for admin-created users (password set by admin). Story 1.12 adds the self-service flow where the invited user sets their own password. Both paths create a User record — the invitation flow just adds the email + token step before user creation.

**Guard/Decorator pattern for controllers:** Use `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.CUSTOMER_ADMIN)` on controller class or individual routes. Import from:
- `JwtAuthGuard` from `../auth/guards/jwt-auth.guard`
- `RolesGuard` from `../auth/guards/roles.guard`
- `Roles` decorator from `../auth/decorators/roles.decorator`
- `UserRole` from `@project-bubble/db-layer`

### Previous Story Intelligence (Story 1.10)

- **Set-password component already exists** at `apps/web/src/app/auth/set-password/`
- It reads `token` from query params and calls `AuthService.setPassword(token, password)`
- `AuthService.setPassword()` calls `POST /api/auth/set-password` — this endpoint doesn't exist yet and is created in this story (Task 5)
- Password complexity validation already implemented: 8+ chars, uppercase, lowercase, number
- On success, redirects to `/auth/login?message=password-set` which shows a green success banner
- **101 web tests**, **78 API tests**, **11 DB tests** = 190 total currently passing

### CRITICAL: Existing Code to Reuse (DO NOT DUPLICATE)

- **`AuthService.hashPassword()`** — bcrypt with 10 salt rounds. Reuse for hashing invitation tokens AND user passwords.
- **`AuthService` exemption pattern** — Direct repository access without TransactionManager for cross-tenant operations (login, token validation). The `accept` method in InvitationsService follows this same pattern.
- **`SetPasswordComponent`** — Frontend already built. Should work as-is once backend endpoint exists.
- **`AuthService.setPassword()`** — Frontend HTTP method already exists. Verify DTO shape matches.
- **`TenantService` pattern** — Frontend HTTP service pattern (inject `HttpClient`, define `baseUrl`, return `Observable<T>`). Follow for `InvitationService`.

### CRITICAL: DO NOT Call UsersService.create() from InvitationsService.accept()

`UsersService.create()` requires `callerRole` parameter and uses `TransactionManager.run(tenantId, ...)` which sets RLS context. The invitation `accept` flow is **unauthenticated** (no JWT, no caller role). Instead:
- Inject `Repository<UserEntity>` and `Repository<InvitationEntity>` directly via `TypeOrmModule.forFeature()`
- Hash password with bcrypt (same 10 salt rounds)
- Create user record directly with repository.save()
- This is the same cross-tenant exemption pattern used by `AuthService`

Also note: `UsersService.create()` checks email uniqueness **within tenant only** (`WHERE email = ? AND tenant_id = ?`). For AC4 (global email uniqueness), the `create` method in InvitationsService must check globally (`WHERE email = ?`) using direct repository access.

### CRITICAL: User Entity Email Uniqueness

The `users` table has `email` column with a UNIQUE constraint (globally, not per-tenant). This means:
- Before creating an invitation, check if a user with that email exists in ANY tenant
- This check must bypass RLS (cross-tenant) — same exemption as AuthService
- Return 409 Conflict if email already taken

### Project Structure Notes

```
apps/api-gateway/src/app/
├── auth/
│   └── auth.controller.ts                    (MODIFY — add POST /auth/set-password)
├── email/                                     (NEW)
│   ├── email.service.ts                       (NEW)
│   ├── email.service.spec.ts                  (NEW)
│   └── email.module.ts                        (NEW)
├── invitations/                               (NEW)
│   ├── invitations.service.ts                 (NEW)
│   ├── invitations.service.spec.ts            (NEW)
│   ├── invitations.controller.ts              (NEW — Customer Admin)
│   ├── invitations.controller.spec.ts         (NEW)
│   ├── admin-invitations.controller.ts        (NEW — Bubble Admin)
│   └── invitations.module.ts                  (NEW)

libs/db-layer/src/lib/entities/
├── invitation.entity.ts                       (NEW)
└── index.ts                                   (MODIFY — export InvitationEntity)

libs/shared/src/lib/dtos/
├── invitation/                                (NEW)
│   ├── invite-user.dto.ts                     (NEW)
│   ├── accept-invitation.dto.ts               (NEW)
│   ├── invitation-response.dto.ts             (NEW)
│   └── index.ts                               (NEW)
└── index.ts                                   (MODIFY — re-export invitation DTOs)

libs/db-layer/src/lib/
├── entities/
│   ├── invitation.entity.ts                   (NEW — entity + InvitationStatus enum)
│   └── index.ts                               (MODIFY — export InvitationEntity, InvitationStatus)
├── rls-setup.service.ts                       (MODIFY — add 'invitations' to tenantScopedTables + auth policy)
└── index.ts                                   (MODIFY — re-export new entity/enum)

apps/api-gateway/src/app/
└── app.module.ts                              (MODIFY — add InvitationsModule to imports)

apps/web/src/app/
├── admin/tenants/
│   ├── invite-user-dialog.component.ts        (NEW)
│   ├── invite-user-dialog.component.html      (NEW)
│   ├── invite-user-dialog.component.scss      (NEW)
│   ├── invite-user-dialog.component.spec.ts   (NEW)
│   ├── tenant-detail.component.ts             (MODIFY — add showInviteDialog signal, invitation loading)
│   └── tenant-detail.component.html           (MODIFY — implement Users tab content)
├── core/services/
│   ├── invitation.service.ts                  (NEW)
│   └── auth.service.ts                        (VERIFY — setPassword() shape match)
└── app.config.ts                              (MODIFY — new Lucide icons if needed)
```

### Environment Setup Required

Before running this story, the developer needs:
1. A Mailtrap account (free tier) for dev email testing — or use Ethereal (nodemailer's test service)
2. Add SMTP credentials to `.env` (not committed)
3. No migration needed — `synchronize: true` auto-creates the `invitations` table from the entity on startup

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 1.12 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture.md — §Decision Impact Analysis, Phase 2: Email Provider Integration]
- [Source: _bmad-output/planning-artifacts/prd.md — FR27_INVITE: Customer Admin can invite users via email]
- [Source: project-context.md — Shared Brain Rule, Security by Consumption Rule, TransactionManager exemptions]
- [Source: stories/1-10-login-password-pages-auth-ui.md — Set-password component, AuthService.setPassword()]
- [Source: apps/api-gateway/src/app/auth/auth.service.ts — hashPassword(), login exemption pattern]
- [Source: apps/api-gateway/src/app/users/users.service.ts — create() with TransactionManager]
- [Source: libs/db-layer/src/lib/entities/user.entity.ts — User entity, email uniqueness constraint]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None — all tasks completed without blocking issues.

### Completion Notes List

- All 12 tasks completed successfully
- 219 total tests passing (98 api-gateway + 110 web + 11 db-layer)
- Both builds pass (api-gateway + web)
- Both lints pass (api-gateway + web)
- Budget warning on tenant-detail.component.scss (6.50 kB vs 4.00 kB budget) — non-blocking, due to added Users tab styles
- Used `inject()` pattern for Angular DI (project lint rule: @angular-eslint/prefer-inject)
- Used `forwardRef()` to resolve circular dependency between AuthModule and InvitationsModule

### Change Log

- Installed nodemailer + @types/nodemailer
- Fixed pre-existing auth.controller.spec.ts to include InvitationsService mock
- Updated rls-setup.service.spec.ts to account for new invitations table RLS (8 queries instead of 4)
- Fixed invite-user-dialog to use inject() instead of constructor injection per project lint rules

**Code Review Fixes (2026-01-31):**
- [H1] Fixed user `name` field: added `name` column to InvitationEntity for invited user's name, separated from `inviterName` (inviter's name)
- [H2] Added `tokenPrefix` column to InvitationEntity — `accept()` now queries by prefix to avoid O(n) bcrypt scan of all pending invitations
- [M1] `resend()` now looks up tenant name from TenantEntity instead of passing empty string to email
- [M2] Added `InvitationsService` to project-context.md RLS exemption table
- [M3] Added `auth_insert_users` (INSERT on users) and `auth_update_invitations` (UPDATE on invitations) permissive RLS policies for pre-auth flows
- [M4] Fixed `inviterName` field semantics — `inviterName` now always stores the inviter's name; `name` stores the invited user's optional name
- [L1] Added package.json/package-lock.json to File List
- Updated rls-setup.service.spec.ts expected query count from 8 to 10
- Updated invitations.service.spec.ts for tokenPrefix, name field, and resend tenant lookup

### File List

**New Files:**
- `apps/api-gateway/src/app/email/email.service.ts`
- `apps/api-gateway/src/app/email/email.module.ts`
- `apps/api-gateway/src/app/email/email.service.spec.ts`
- `apps/api-gateway/src/app/invitations/invitations.service.ts`
- `apps/api-gateway/src/app/invitations/invitations.module.ts`
- `apps/api-gateway/src/app/invitations/invitations.service.spec.ts`
- `apps/api-gateway/src/app/invitations/invitations.controller.ts`
- `apps/api-gateway/src/app/invitations/invitations.controller.spec.ts`
- `apps/api-gateway/src/app/invitations/admin-invitations.controller.ts`
- `libs/db-layer/src/lib/entities/invitation.entity.ts`
- `libs/shared/src/lib/dtos/invitation/invite-user.dto.ts`
- `libs/shared/src/lib/dtos/invitation/accept-invitation.dto.ts`
- `libs/shared/src/lib/dtos/invitation/invitation-response.dto.ts`
- `libs/shared/src/lib/dtos/invitation/index.ts`
- `libs/shared/src/lib/types/invitation.types.ts`
- `apps/web/src/app/core/services/invitation.service.ts`
- `apps/web/src/app/admin/tenants/invite-user-dialog.component.ts`
- `apps/web/src/app/admin/tenants/invite-user-dialog.component.html`
- `apps/web/src/app/admin/tenants/invite-user-dialog.component.scss`
- `apps/web/src/app/admin/tenants/invite-user-dialog.component.spec.ts`

**Modified Files:**
- `.env.example` — added SMTP + invitation env vars
- `package.json` — added nodemailer + @types/nodemailer dependencies
- `package-lock.json` — lockfile update for nodemailer
- `project-context.md` — added InvitationsService to RLS exemption table
- `libs/db-layer/src/lib/entities/index.ts` — export InvitationEntity, InvitationStatus
- `libs/db-layer/src/index.ts` — re-export invitation entity
- `libs/db-layer/src/lib/rls-setup.service.ts` — added invitations to tenantScopedTables + 4 auth policies
- `libs/db-layer/src/lib/rls-setup.service.spec.ts` — updated expected query count to 10
- `libs/shared/src/lib/dtos/index.ts` — re-export invitation DTOs
- `libs/shared/src/lib/types/index.ts` — re-export InvitationStatus type
- `apps/api-gateway/src/app/app.module.ts` — added InvitationsModule
- `apps/api-gateway/src/app/auth/auth.controller.ts` — added POST /auth/set-password
- `apps/api-gateway/src/app/auth/auth.controller.spec.ts` — added InvitationsService mock
- `apps/api-gateway/src/app/auth/auth.module.ts` — added forwardRef InvitationsModule
- `apps/web/src/app/admin/tenants/tenant-detail.component.ts` — added invitation signals + methods
- `apps/web/src/app/admin/tenants/tenant-detail.component.html` — implemented Users tab
- `apps/web/src/app/admin/tenants/tenant-detail.component.scss` — added Users tab styles
- `apps/web/src/app/app.config.ts` — added Lucide icons
