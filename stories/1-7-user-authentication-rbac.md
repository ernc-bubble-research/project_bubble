# Story 1.7: User Authentication & RBAC

Status: done

## Story

As a **User**,
I want to log in and receive a secure JWT,
so that the system knows my identity, tenant context, and permissions.

## Acceptance Criteria

1. **AC1: UserEntity exists**
   - Given the database layer
   - Then a `UserEntity` exists with: `id` (UUID PK), `email` (unique), `passwordHash`, `role` (enum: `bubble_admin`, `customer_admin`, `creator`), `tenantId` (FK string), `createdAt`, `updatedAt`
   - And the entity follows the established `snake_case` DB / `camelCase` TS column naming pattern
   - And TypeORM synchronize creates the `users` table

2. **AC2: Password hashing**
   - Given a user is created with a plaintext password
   - Then the password is hashed using `bcrypt` before storage
   - And the original plaintext password is never stored or logged
   - And password comparison uses `bcrypt.compare()` for timing-safe validation

3. **AC3: Login endpoint**
   - Given valid credentials (email + password)
   - When I `POST /api/auth/login` with `{ email, password }`
   - Then I receive a JWT containing `sub` (User ID), `tenant_id`, `role`
   - And the JWT expires in 24 hours
   - And the response includes basic user info (id, email, role, tenantId)

4. **AC4: Login validation**
   - Given invalid credentials
   - When I `POST /api/auth/login`
   - Then I receive 401 Unauthorized with message "Invalid email or password"
   - And the error message does NOT reveal whether the email exists (prevent enumeration)

5. **AC5: JWT Strategy (Passport)**
   - Given a request with a valid `Authorization: Bearer <token>` header
   - Then the `JwtStrategy` extracts `sub`, `tenant_id`, `role` from the token
   - And attaches a `user` object to `request.user`
   - And the strategy uses the same `JWT_SECRET` from environment

6. **AC6: JwtAuthGuard**
   - Given a route protected by `@UseGuards(JwtAuthGuard)`
   - When a request arrives without a valid JWT
   - Then it returns 401 Unauthorized
   - And when a request has a valid JWT, it passes through with `request.user` populated

7. **AC7: RolesGuard + @Roles() decorator**
   - Given a route decorated with `@Roles(UserRole.BUBBLE_ADMIN)`
   - When a user with role `creator` tries to access it
   - Then it returns 403 Forbidden
   - And when a user with role `bubble_admin` accesses it, it passes through

8. **AC8: Protect existing admin endpoints**
   - Given the existing `/api/admin/tenants` endpoints
   - Then they are protected by BOTH `JwtAuthGuard` AND `RolesGuard` with `@Roles(UserRole.BUBBLE_ADMIN)`
   - And the `AdminApiKeyGuard` remains as a FALLBACK for backward compatibility (OR-based: either valid JWT with admin role OR valid API key)
   - Note: This ensures existing Story 1.2-1.5 functionality is not broken during transition

9. **AC9: Shared DTOs and types**
   - Given the shared library
   - Then `LoginDto`, `LoginResponseDto` exist in `libs/shared/src/lib/dtos/auth/`
   - And `User` interface, `UserRole` enum exist in `libs/shared/src/lib/types/`
   - And all are exported via barrel files

10. **AC10: Frontend AuthService + JWT interceptor**
    - Given the Angular web app
    - Then an `AuthService` exists with `login()`, `logout()`, `getToken()`, `getCurrentUser()`, `isAuthenticated()`
    - And a `JwtInterceptor` attaches the Bearer token to all API requests
    - And the admin API key interceptor still works alongside the JWT interceptor
    - Note: No login UI in this story — that's Story 1.10. AuthService is the foundation.

11. **AC11: Unit tests**
    - Given the auth system
    - Then backend tests cover: login success, login failure, JWT strategy validation, RolesGuard allow/deny, password hashing
    - And frontend tests cover: AuthService token management, JwtInterceptor token attachment

## Tasks / Subtasks

> **Execution order:** Database first, then backend auth core, then guards, then protect existing endpoints, then frontend foundation, then tests.

- [x] **Task 1: Install bcrypt** (AC: 2)
  - [x] 1.1 `npm install bcrypt` and `npm install -D @types/bcrypt`
  - [x] 1.2 Verify bcrypt works: `node -e "require('bcrypt')"`

- [x] **Task 2: Database — Create UserEntity** (AC: 1)
  - [x] 2.1 Create `libs/db-layer/src/lib/entities/user.entity.ts`:
    ```typescript
    export enum UserRole {
      BUBBLE_ADMIN = 'bubble_admin',
      CUSTOMER_ADMIN = 'customer_admin',
      CREATOR = 'creator',
    }

    @Entity('users')
    export class UserEntity {
      @PrimaryGeneratedColumn('uuid')
      id!: string;

      @Column({ unique: true })
      email!: string;

      @Column({ name: 'password_hash' })
      passwordHash!: string;

      @Column({ type: 'enum', enum: UserRole, default: UserRole.CREATOR })
      role!: UserRole;

      @Column({ name: 'tenant_id' })
      tenantId!: string;

      @CreateDateColumn({ name: 'created_at' })
      createdAt!: Date;

      @UpdateDateColumn({ name: 'updated_at' })
      updatedAt!: Date;
    }
    ```
  - [x] 2.2 Export `UserEntity` and `UserRole` from `libs/db-layer/src/lib/entities/index.ts`
  - [x] 2.3 Verify schema auto-sync creates the `users` table

- [x] **Task 3: Shared DTOs & Types** (AC: 9)
  - [x] 3.1 Create `libs/shared/src/lib/types/user.types.ts`:
    ```typescript
    export interface User {
      id: string;
      email: string;
      role: 'bubble_admin' | 'customer_admin' | 'creator';
      tenantId: string;
      createdAt: string;
      updatedAt: string;
    }
    ```
  - [x] 3.2 Create `libs/shared/src/lib/dtos/auth/login.dto.ts`:
    ```typescript
    export class LoginDto {
      @IsEmail()
      email!: string;

      @IsString()
      @MinLength(8)
      password!: string;
    }
    ```
  - [x] 3.3 Create `libs/shared/src/lib/dtos/auth/login-response.dto.ts`:
    ```typescript
    export class LoginResponseDto {
      accessToken!: string;
      user!: {
        id: string;
        email: string;
        role: string;
        tenantId: string;
      };
    }
    ```
  - [x] 3.4 Create barrel `libs/shared/src/lib/dtos/auth/index.ts` and export from main barrel
  - [x] 3.5 Export `User` type from `libs/shared/src/lib/types/index.ts`

- [x] **Task 4: Backend — AuthModule core** (AC: 3, 4, 5)
  - [x] 4.1 Create `apps/api-gateway/src/app/auth/auth.module.ts`:
    - Import `PassportModule`, `JwtModule` (async config from ConfigService)
    - Import `TypeOrmModule.forFeature([UserEntity])`
    - Providers: `AuthService`, `JwtStrategy`
    - Controllers: `AuthController`
    - Exports: `AuthService`, `JwtModule`, `PassportModule`
  - [x] 4.2 Create `apps/api-gateway/src/app/auth/auth.service.ts`:
    - `validateUser(email, password)` — find user by email, compare bcrypt hash, return user or null
    - `login(dto: LoginDto)` — validate, generate JWT with `{ sub: user.id, tenant_id: user.tenantId, role: user.role }`, return `LoginResponseDto`
    - `hashPassword(password: string)` — bcrypt hash with 10 rounds
  - [x] 4.3 Create `apps/api-gateway/src/app/auth/auth.controller.ts`:
    ```typescript
    @Controller('auth')
    export class AuthController {
      @Post('login')
      async login(@Body() dto: LoginDto): Promise<LoginResponseDto> { ... }
    }
    ```
  - [x] 4.4 Create `apps/api-gateway/src/app/auth/strategies/jwt.strategy.ts`:
    - Extract JWT from `Authorization: Bearer` header
    - Validate and return `{ userId: payload.sub, tenantId: payload.tenant_id, role: payload.role }`
  - [x] 4.5 Register `AuthModule` in `AppModule` imports
  - [x] 4.6 Update JWT config: change expiration from `60m` to `24h` and move JwtModule to AuthModule (remove from TenantsModule, import AuthModule in TenantsModule instead)

- [x] **Task 5: Backend — Guards and decorators** (AC: 6, 7)
  - [x] 5.1 Create `apps/api-gateway/src/app/auth/guards/jwt-auth.guard.ts`:
    ```typescript
    @Injectable()
    export class JwtAuthGuard extends AuthGuard('jwt') {}
    ```
  - [x] 5.2 Create `apps/api-gateway/src/app/auth/guards/roles.guard.ts`:
    - Read `@Roles()` metadata from handler/class via `Reflector`
    - If no roles specified, allow (public endpoint)
    - Compare `request.user.role` against required roles
    - Return 403 if no match
  - [x] 5.3 Create `apps/api-gateway/src/app/auth/decorators/roles.decorator.ts`:
    ```typescript
    export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
    ```

- [x] **Task 6: Protect existing admin endpoints** (AC: 8)
  - [x] 6.1 Update `AdminApiKeyGuard` to be an OR-guard: allow access if EITHER valid API key header OR valid JWT with `bubble_admin` role
    - Check `request.user?.role === 'bubble_admin'` first (JWT path)
    - Fall back to API key check if no JWT user present
    - This ensures backward compatibility during transition
  - [x] 6.2 Add `@UseGuards(JwtAuthGuard)` to `TenantsController` (alongside existing `AdminApiKeyGuard`)
    - NOTE: JwtAuthGuard should NOT throw if no token — it should set `request.user = null` and let `AdminApiKeyGuard` handle the fallback
    - Use a custom `OptionalJwtAuthGuard` that catches the 401 and sets user to null instead
  - [x] 6.3 Verify existing tests still pass with the updated guard logic

- [x] **Task 7: Frontend — AuthService + JwtInterceptor** (AC: 10)
  - [x] 7.1 Create `apps/web/src/app/core/services/auth.service.ts`:
    - `login(email, password): Observable<LoginResponseDto>` — POST to `/api/auth/login`
    - `logout()` — clear stored token
    - `getToken(): string | null` — read from localStorage
    - `getCurrentUser(): User | null` — decode JWT payload
    - `isAuthenticated(): boolean` — check token exists and not expired
    - Store token in `localStorage` under key `bubble_access_token`
  - [x] 7.2 Create `apps/web/src/app/core/interceptors/jwt.interceptor.ts`:
    - Check if token exists via `AuthService.getToken()`
    - If exists, clone request with `Authorization: Bearer ${token}` header
    - Skip for requests that already have `x-admin-api-key` header (backward compat)
  - [x] 7.3 Register `JwtInterceptor` as a provider in `app.config.ts` (alongside existing `AdminApiKeyInterceptor`)
  - [x] 7.4 Export `User` type from shared, create `LoginPayload` type for frontend use

- [x] **Task 8: Seed a test admin user** (AC: 3)
  - [x] 8.1 Create a temporary seed script or add logic in `AuthService` constructor (dev-only):
    - On app startup (dev only), check if any `bubble_admin` user exists
    - If not, create one with email `admin@bubble.io`, hashed password `Admin123!`
    - Log credentials to console on creation
    - Guard with `NODE_ENV !== 'production'` check
  - [ ] 8.2 ~~Alternatively, add a `POST /api/auth/seed-admin` endpoint guarded by `AdminApiKeyGuard`~~ (Not implemented — dev seed via onModuleInit is sufficient for prototype)

- [x] **Task 9: Unit tests** (AC: 11)
  - [x] 9.1 Create `apps/api-gateway/src/app/auth/auth.service.spec.ts`:
    - Test: login with valid credentials returns JWT + user
    - Test: login with wrong password returns 401
    - Test: login with non-existent email returns 401 (same error message)
    - Test: password hashing produces valid bcrypt hash
    - Test: password comparison works correctly
  - [x] 9.2 Create `apps/api-gateway/src/app/auth/auth.controller.spec.ts`:
    - Test: POST /auth/login calls service and returns response
    - Test: POST /auth/login with invalid body returns 400
  - [x] 9.3 Create `apps/api-gateway/src/app/auth/guards/roles.guard.spec.ts`:
    - Test: allows access when user role matches
    - Test: denies access (403) when user role doesn't match
    - Test: allows access when no roles specified
  - [x] 9.4 Update `apps/api-gateway/src/app/tenants/tenants.controller.spec.ts`:
    - Ensure existing tests still pass with updated guard chain
  - [x] 9.5 Create `apps/web/src/app/core/services/auth.service.spec.ts`:
    - Test: login stores token
    - Test: logout clears token
    - Test: getToken returns stored token
    - Test: isAuthenticated returns true when token valid, false when expired/missing
  - [x] 9.6 Create `apps/web/src/app/core/interceptors/jwt.interceptor.spec.ts`:
    - Test: attaches Bearer header when token exists
    - Test: passes through without header when no token

- [x] **Task 10: Build verification and lint** (AC: 1-11)
  - [x] 10.1 `nx lint api-gateway` — passes
  - [x] 10.2 `nx lint web` — passes
  - [x] 10.3 `nx test api-gateway` — all pass
  - [x] 10.4 `nx test web` — all pass
  - [x] 10.5 `nx build api-gateway` — passes
  - [x] 10.6 `nx build web` — passes

## Dev Notes

### Scope Boundaries — What This Story Does NOT Include

- **No login UI.** Story 1.10 builds the `/auth/login` and `/auth/set-password` pages. This story builds the backend auth + frontend `AuthService`/`JwtInterceptor` foundation.
- **No user CRUD endpoints.** Story 1.9 adds `POST /api/users`, user listing, etc. This story creates `UserEntity` but only exposes login.
- **No RLS enforcement.** Story 1.8 adds `TransactionInterceptor` + `SET LOCAL app.current_tenant`. This story puts `tenantId` in the JWT but doesn't enforce isolation.
- **No route guards in Angular.** Story 1.10 adds Angular route guards (`canActivate`) for Zone A/B/C. This story only builds `AuthService` and `JwtInterceptor`.
- **No refresh tokens.** Simple access token only for prototype. Refresh token flow is a future enhancement.
- **No password reset flow.** Story 1.12 adds email-based password reset.
- **No rate limiting on login.** Can be added later with `@nestjs/throttler`.

### Architecture Decisions

**JWT over sessions:** Architecture specifies JWT-based auth. No server-side sessions. Token is self-contained with `sub`, `tenant_id`, `role`.

**bcrypt over argon2:** bcrypt is well-established, has excellent NestJS ecosystem support, and is simpler to configure. argon2 is technically superior but adds native compilation complexity. For a prototype, bcrypt is the right choice.

**24h token expiry:** The UX spec §4.12 references 24h session expiry. This is longer than the 60m currently used for impersonation tokens, which is correct — impersonation should expire faster than regular sessions.

**JwtModule consolidation:** Currently `JwtModule` is registered in `TenantsModule` for impersonation. This story moves it to `AuthModule` and exports it so `TenantsModule` can import `AuthModule` instead. Single source of JWT configuration.

**AdminApiKeyGuard backward compatibility:** The existing admin provisioning flow uses `x-admin-api-key` header. Rather than breaking this immediately, we make the guard accept EITHER a valid JWT (with admin role) OR a valid API key. This can be phased out once the login UI (Story 1.10) is complete.

**Dev seed user:** A `bubble_admin` test user is created on startup in dev mode. This is essential for testing login before Story 1.9 (User Management) adds the user creation UI. The seed is guarded by `NODE_ENV` check and logs credentials to console.

### NestJS Auth Patterns (CRITICAL)

**Passport Strategy Pattern:**
```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    return { userId: payload.sub, tenantId: payload.tenant_id, role: payload.role };
  }
}
```

**Guard stacking pattern:**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN)
```

**IMPORTANT:** `JwtAuthGuard` must run BEFORE `RolesGuard`. NestJS executes guards in declaration order.

### Existing JWT Config (from Story 1.4)

`TenantsModule` already registers `JwtModule` with:
- `secret: config.get('JWT_SECRET', 'dev_secret_key_change_in_prod')`
- `signOptions: { expiresIn: '60m' }` (impersonation-specific)

**Refactoring needed:** Move `JwtModule` registration to `AuthModule` with `expiresIn: '24h'`. The impersonation endpoint can override expiry per-token using `this.jwtService.sign(payload, { expiresIn: '60m' })`.

### TypeORM Column Mapping (Carry Forward)

```typescript
@Column({ name: 'password_hash' })
passwordHash!: string;

@Column({ name: 'tenant_id' })
tenantId!: string;
```

### Testing Patterns (from Story 1.5)

- Mock repositories with `jest.fn()` objects
- Use `DummyComponent` + catch-all route for Angular route tests
- `provideRouter([])` causes NG04002 — always use `DummyComponent` route
- ESLint accessibility: modals need `role="dialog"` `aria-modal="true"`

### Previous Story Intelligence (Story 1.5)

- **DTO types:** Use union literal types, not bare `string`, for enum fields
- **Code review caught:** Missing controller tests, timer leaks, NaN inputs
- **Toast service:** Shared `ToastService` at `apps/web/src/app/core/services/toast.service.ts`
- **Impersonation JWT:** `TenantsService.impersonate()` already creates JWTs with `{ sub: 'admin', tenant_id, role: 'impersonator', impersonating: true }`

### Angular Patterns (CRITICAL — Carry Forward)

- **Standalone Components ONLY.** No NgModules.
- **Signals for state management.** No Reactive Forms.
- **Import from `@project-bubble/shared`** for all types/DTOs.
- **`LUCIDE_ICONS` injection token** for icons (registered in `app.config.ts`).

### Git Intelligence

Recent commits:
- `49be830` feat(story-1.5): tenant configuration, credits & entitlements
- `6bf6d79` feat(story-1.4): impersonation action with company logo integration
- `504f78e` feat(story-1.3): Bubble Admin Dashboard "The Lobby" with code review fixes
- `96b946a` feat(story-1.2): tenant provisioning API with admin guard
- `358f299` feat(story-1.1): monorepo & infrastructure initialization

### Project Structure Notes

```
libs/db-layer/src/lib/entities/
├── tenant.entity.ts                 (EXISTING)
├── user.entity.ts                   (NEW)
└── index.ts                         (MODIFY: add UserEntity, UserRole)

libs/shared/src/lib/
├── dtos/auth/
│   ├── login.dto.ts                 (NEW)
│   ├── login-response.dto.ts        (NEW)
│   └── index.ts                     (NEW)
├── dtos/index.ts                    (MODIFY: add auth barrel)
├── types/
│   ├── user.types.ts                (NEW)
│   └── index.ts                     (MODIFY: add User export)
└── index.ts                         (MODIFY: add auth DTOs)

apps/api-gateway/src/app/
├── auth/
│   ├── auth.module.ts               (NEW)
│   ├── auth.service.ts              (NEW)
│   ├── auth.service.spec.ts         (NEW)
│   ├── auth.controller.ts           (NEW)
│   ├── auth.controller.spec.ts      (NEW)
│   ├── strategies/
│   │   └── jwt.strategy.ts          (NEW)
│   ├── guards/
│   │   ├── jwt-auth.guard.ts        (NEW)
│   │   ├── roles.guard.ts           (NEW)
│   │   └── roles.guard.spec.ts      (NEW)
│   └── decorators/
│       └── roles.decorator.ts       (NEW)
├── guards/
│   └── admin-api-key.guard.ts       (MODIFY: add JWT fallback)
├── tenants/
│   ├── tenants.module.ts            (MODIFY: import AuthModule instead of JwtModule)
│   └── tenants.controller.spec.ts   (MODIFY: update for new guard chain)
└── app.module.ts                    (MODIFY: import AuthModule)

apps/web/src/app/
├── core/
│   ├── services/
│   │   └── auth.service.ts          (NEW)
│   │   └── auth.service.spec.ts     (NEW)
│   └── interceptors/
│       ├── jwt.interceptor.ts       (NEW)
│       └── jwt.interceptor.spec.ts  (NEW)
└── app.config.ts                    (MODIFY: register JwtInterceptor)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Story 1.7 acceptance criteria]
- [Source: _bmad-output/planning-artifacts/architecture.md — Secure Transaction Pattern, Auth Provider Decision]
- [Source: _bmad-output/planning-artifacts/prd.md — RBAC Permission Matrix (§6), FR33, NFR-Sec-1/2]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Zone A routes, §4.12 session expiry]
- [Source: project-context.md — Shared Brain Rule, Security by Consumption Rule]
- [Source: stories/1-5-tenant-configuration-credits-entitlements.md — Dev Agent Record, test patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

No blocking issues encountered during implementation.

### Completion Notes List

- Installed bcrypt + @types/bcrypt for password hashing
- Created UserEntity with UUID PK, email (unique), passwordHash, role (enum), tenantId, timestamps
- Created shared DTOs: LoginDto (class-validator), LoginResponseDto, User interface, UserRole type
- Built AuthModule with AuthService, AuthController (POST /auth/login), JwtStrategy (Passport)
- JwtModule moved from TenantsModule to AuthModule; expiry updated to 24h (impersonation overrides to 60m)
- Created JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard, @Roles() decorator
- Updated AdminApiKeyGuard to OR-guard: JWT bubble_admin role OR API key (backward compatible)
- TenantsController now uses OptionalJwtAuthGuard + AdminApiKeyGuard chain
- Created frontend AuthService (login, logout, getToken, getCurrentUser, isAuthenticated) with localStorage
- Created jwtInterceptor (attaches Bearer token, skips if x-admin-api-key present)
- Registered jwtInterceptor in app.config.ts (before adminApiKeyInterceptor)
- Added dev seed user on startup (admin@bubble.io / Admin123!) guarded by NODE_ENV check
- All tests pass: 44 api-gateway (19 new), 70 web (12 new)
- All lint passes (0 errors, 0 warnings)
- All builds pass (api-gateway, web, shared, db-layer)

### Change Log

| Change | Date | Reason |
|:---|:---|:---|
| Created | 2026-01-31 | Story creation from create-story workflow |
| Implemented | 2026-01-31 | All 10 tasks completed — auth backend, guards, frontend foundation, tests |

### File List

**New files:**
- libs/db-layer/src/lib/entities/user.entity.ts
- libs/shared/src/lib/types/user.types.ts
- libs/shared/src/lib/dtos/auth/login.dto.ts
- libs/shared/src/lib/dtos/auth/login-response.dto.ts
- libs/shared/src/lib/dtos/auth/index.ts
- apps/api-gateway/src/app/auth/auth.module.ts
- apps/api-gateway/src/app/auth/auth.service.ts
- apps/api-gateway/src/app/auth/auth.service.spec.ts
- apps/api-gateway/src/app/auth/auth.controller.ts
- apps/api-gateway/src/app/auth/auth.controller.spec.ts
- apps/api-gateway/src/app/auth/strategies/jwt.strategy.ts
- apps/api-gateway/src/app/auth/guards/jwt-auth.guard.ts
- apps/api-gateway/src/app/auth/guards/optional-jwt-auth.guard.ts
- apps/api-gateway/src/app/auth/guards/roles.guard.ts
- apps/api-gateway/src/app/auth/guards/roles.guard.spec.ts
- apps/api-gateway/src/app/auth/decorators/roles.decorator.ts
- apps/web/src/app/core/services/auth.service.ts
- apps/web/src/app/core/services/auth.service.spec.ts
- apps/web/src/app/core/interceptors/jwt.interceptor.ts
- apps/web/src/app/core/interceptors/jwt.interceptor.spec.ts

**Modified files:**
- package.json (added bcrypt, @types/bcrypt)
- package-lock.json
- libs/db-layer/src/lib/entities/index.ts (added UserEntity, UserRole exports)
- libs/shared/src/lib/dtos/index.ts (added auth barrel)
- libs/shared/src/lib/types/index.ts (added User, UserRole exports)
- apps/api-gateway/src/app/app.module.ts (added AuthModule import)
- apps/api-gateway/src/app/tenants/tenants.module.ts (replaced JwtModule with AuthModule import)
- apps/api-gateway/src/app/tenants/tenants.service.ts (impersonate: added expiresIn: '60m' override)
- apps/api-gateway/src/app/tenants/tenants.service.spec.ts (updated impersonate test for new sign args)
- apps/api-gateway/src/app/tenants/tenants.controller.ts (added OptionalJwtAuthGuard)
- apps/api-gateway/src/app/guards/admin-api-key.guard.ts (OR-guard: JWT admin OR API key)
- apps/api-gateway/src/app/guards/admin-api-key.guard.spec.ts (added JWT path tests)
- apps/web/src/app/app.config.ts (registered jwtInterceptor)
