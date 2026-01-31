---
project_name: 'project_bubble'
user_name: 'Erinckaratoprak'
date: '2026-01-12'
sections_completed: ['technology_stack', 'implementation_rules', 'testing', 'quality', 'workflow', 'security']
existing_patterns_found: 4
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

## 🚨 CRITICAL: ANTI-HALLUCINATION & STORY LOCK PROTOCOL 🚨

**FAILURE TO FOLLOW THESE RULES LEADS TO IMMEDIATE FAILURE.**

### 1. The "Story Lock" Rule
*   **NEVER** start coding without identifying the specific `stories/story-XXX.md` file you are working on.
*   **NEVER** invent features, routes, or names that are not explicitly in the Story or PRD.
*   **IF** you cannot find a Story for your task, **STOP** and ask the user.
*   **YOU MUST** read the Story file using `view_file` before writing code.

### 2. The "Strict Naming" Rule
*   **DO NOT** use generic names like "Library" if the Story says "Storefront".
*   **DO NOT** create routes like `/ops` if the Story says `/admin`.
*   **CHECK** `epics.md` and `ux-design-specification.md` for exact terminology.

### 3. The "Verification First" Rule
*   **BEFORE** marking a task done, you must explicitly check off the **Acceptance Criteria** in the Story.
*   **IF** a criteria fails, you are NOT done.

---

## Technology Stack & Versions

*   **Monorepo:** Nx 22+ (Integrated Repo)
*   **Web Client:** Angular 21+ (Standalone Components, Signals)
*   **API Gateway:** NestJS 11+ (Express Adapter — Fastify migration deferred)
*   **Worker Engine:** NestJS 11+ (Standalone Application)
*   **Database:** PostgreSQL 16+ (with `pgvector` extension)
*   **Queue:** BullMQ (Redis-backed)
*   **ORM:** TypeORM (Active Record pattern NOT allowed; use Repository pattern)
*   **AI Engine:** LangGraph.js

## Critical Implementation Rules

### 1. The "Shared Brain" Rule (DTOs)
*   **NEVER** define DTOs/Interfaces inside `apps/`.
*   **ALWAYS** define them in `libs/shared/src/lib/dtos`.
*   **REASON:** The Frontend (Angular) and Backend (NestJS) must share the *exact same class* to prevent contract drift.
*   **PATTERN:**
    ```typescript
    // libs/shared/src/lib/dtos/create-workflow.dto.ts
    import { IsString } from 'class-validator';
    export class CreateWorkflowDto {
      @IsString()
      name: string;
    }
    ```

### 2. The "Security by Consumption" Rule (RLS)
*   **NEVER** inject `Repository<T>` directly into a Service (unless it's in the exemption list below).
*   **ALWAYS** inject `TransactionManager` from `@project-bubble/db-layer`.
*   **REASON:** We use Postgres Row Level Security (RLS). A raw connection bypasses RLS. The `TransactionManager` forces `SET LOCAL app.current_tenant` before every query.
*   **PATTERN:**
    ```typescript
    // BAD
    // constructor(private repo: Repository<User>) {}

    // GOOD — reads tenant from AsyncLocalStorage (set by TenantContextInterceptor)
    await this.txManager.run(async (manager) => {
        return manager.find(User);
    });

    // GOOD — explicit tenant override (for admin operations)
    await this.txManager.run(tenantId, async (manager) => {
        return manager.find(User);
    });
    ```
*   **EXEMPTED SERVICES** (documented exceptions to this rule):
    | Service | Reason |
    |:---|:---|
    | `AuthService` (login + seed) | Login is pre-authentication — no tenant context. Seed is dev-only startup. Both need cross-tenant user queries. |
    | `InvitationsService` (accept + create) | Accept is pre-authentication (user has no JWT yet). Create checks global email uniqueness cross-tenant. Same pattern as AuthService. |
    | `TenantsService` | Admin-scoped — `tenants` table has no `tenant_id` column and no RLS policy. |
*   **ALL future services** MUST use `TransactionManager` for any table that has a `tenant_id` column.

### 2b. RLS Architecture Details
*   **`SET LOCAL app.current_tenant`** is transaction-scoped. It reverts automatically when the transaction ends, preventing connection pool contamination.
*   **`current_setting('app.current_tenant', true)`** in RLS policies — the `true` (missing_ok) returns NULL if not set, meaning queries without tenant context match NO rows (fail-closed).
*   **`TenantContextInterceptor`** (global, registered via `APP_INTERCEPTOR`) extracts `tenant_id` from the JWT and stores it in `AsyncLocalStorage` for the request duration.
*   **`TransactionManager.run(callback)`** reads tenant context from `AsyncLocalStorage` automatically. Use `run(tenantId, callback)` for explicit override.
*   **`DbLayerModule`** is `@Global()` — `TransactionManager` is available everywhere without importing it per module.
*   **`RlsSetupService`** creates RLS policies on `onModuleInit` in development. In production, use proper migrations.

### 3. The "200ms" Rule (Async)
*   **NEVER** run long logic (>200ms) in the `api-gateway`.
*   **ALWAYS** offload to `worker-engine`.
*   **PATTERN:** API pushes `{ jobId }` to Redis -> Returns `202 Accepted` -> Worker processes data.

### 4. The "Hexagonal" Rule (AI)
*   **NEVER** import `openai` or `langchain` directly in feature modules.
*   **ALWAYS** use the `LLMProvider` interface.
*   **REASON:** We need to swap between GPT-4, Claude-3, and Local Llama without rewriting business logic.

## File Organization & Naming

*   **Directory Structure:**
    *   `apps/web`: Angular SPA
    *   `apps/api-gateway`: NestJS HTTP API
    *   `apps/worker-engine`: NestJS Background Processor
    *   `libs/shared`: DTOs, Types
    *   `libs/db-layer`: Entities, TransactionManager, RLS Setup, Tenant Context (AsyncLocalStorage)
*   **Naming:**
    *   Files: `kebab-case` (e.g., `user-profile.component.ts`)
    *   Classes: `PascalCase` (e.g., `UserProfileComponent`)
    *   Interfaces: `I` prefix is **BANNED**. Use `User` not `IUser`.

## Testing Rules

*   **Unit Tests:** Co-located with code (`*.spec.ts`).
*   **E2E Tests:** In `apps/*-e2e/`.
*   **Mocks:** Use `jest.mock` or `MockProvider` from `@golevelup/ts-jest`. NEVER connect to real DB in Unit Tests.

## NFR Hardening Rules (from Epic 1 NFR Assessment — 2026-01-31)

### Security Rules
*   **NEVER** hardcode credentials, API keys, or secrets in source code. All secrets must come from environment variables only.
*   **NEVER** expose secrets in frontend bundles (`environment.ts`). Admin API keys, JWT secrets, etc. must only exist server-side.
*   **ALWAYS** use `crypto.timingSafeEqual()` for secret/token comparisons (not `===`).
*   **ALWAYS** validate that critical environment variables (`JWT_SECRET`, `ADMIN_API_KEY`) are set and not default values on application startup. Refuse to start if missing.
*   **ALWAYS** use `helmet()` middleware and explicit CORS configuration in `main.ts`.
*   **ALWAYS** use `@nestjs/throttler` rate limiting on authentication endpoints (login, invitation accept, password set).
*   **ALWAYS** enforce strong password policy: min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character.

### Reliability Rules
*   **ALWAYS** wrap multi-step database operations in transactions (use `TransactionManager`). Especially: any flow that creates/updates multiple records or combines DB write + external service call.
*   **ALWAYS** handle email sending failures gracefully — never leave orphaned records if email delivery fails.
*   **ALWAYS** wrap `bootstrap()` in try-catch with `process.exit(1)` on failure.
*   **ALWAYS** add error handling to `onModuleInit` seed/setup logic.

### Deferred Items Tracking (NFR Assessment)
*   **Impersonation audit trail** → Epic 7 Story 7.2 (interim: `logger.warn` on impersonation)
*   **Health check endpoint** → Epic 7 Story 7.3 (prerequisite for service monitoring)
*   **Refresh token rotation** → Epic 7 Story 7.5 (interim: 7-day JWT expiry)
*   **Log sanitization** → Epic 2 Story 2.1 AC (first story with real document data)

## Anti-Patterns (Do Not Do)

*   ❌ **No Schema per Tenant:** Do not create dynamic schemas. Use `tenant_id` column.
*   ❌ **No Active Record:** Do not use `user.save()`. Use `repository.save(user)`.
*   ❌ **No Direct Worker HTTP:** The API must not HTTP call the Worker. Use Redis.


