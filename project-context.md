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
*   **AI Engine:** LLM-Orchestrated Execution (YAML prompts sent directly to LLM via hexagonal `LLMProvider` interface)

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
    | `LlmModelService` (Epic 3+) | System-wide model registry — `llm_models` table has no `tenant_id` column and no RLS policy. All tenants read the same model list. |
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
*   **NEVER** import `openai` or `langchain` or provider SDKs directly in feature modules.
*   **ALWAYS** use the `LLMProvider` interface (mirrors existing `EmbeddingProvider` pattern).
*   **REASON:** We need to swap between Gemini, GPT-4, Claude, and Local Llama without rewriting business logic.

### 5. Workflow Execution Architecture (Party Mode Decision — 2026-02-01)

#### Core Principle: LLM-Orchestrated Execution
*   **LangGraph.js is DEFERRED** — not used for MVP. Reserved for potential future epic.
*   **Workflows are YAML prompts** sent directly to the LLM. The platform handles assembly (YAML + files + knowledge context), the LLM handles execution.
*   **YAML IS the prompt** — no transformation layer. YAML goes to LLM as-is.
*   **Prompt quality is Bubble's IP.** Platform = infrastructure + assembly. Prompt engineering = business value.

#### Atomic Workflows & Composition
*   **Every workflow is atomic** — one LLM call pattern, clear inputs, clear outputs.
*   **Workflow chains** link atomic workflows sequentially. Output of WorkflowA → input of WorkflowB.
*   **Chain definitions are metadata only** — they tell the platform "run A, then feed A's outputs into B." No file uploads in chain builder, just connections.
*   **Workflow outputs are first-class assets** — stored with `source_type: workflow_output` and `workflow_run_id` reference. Visible, downloadable, inspectable between chain steps.

#### Input Role Taxonomy
*   **`context` inputs:** Shared across all executions (codebook, research goal, knowledge base context). Go into every LLM call as background.
*   **`subject` inputs:** The items being processed (interview transcripts). Determine the execution pattern.
*   **Input sources:** `asset` (existing in data vault), `upload` (new file), `text` (free-form entry in UI).

#### Execution Patterns (Derived from Subject Input Config)
*   **Fan-out:** `subject.accept: single` + `processing: parallel` → N parallel BullMQ jobs (1 per file). Each job gets all context inputs + 1 subject file.
*   **Fan-in:** `subject.accept: multiple` + `processing: batch` → 1 BullMQ job with all files as context.
*   **Chain orchestrator:** Lightweight BullMQ `FlowProducer`. Watches step N completion → triggers step N+1 with collected outputs.

#### Context Window Management
*   **Pre-execution token count check** per job (context + subject files).
*   **Interactive file selection UI** if over limit — user deselects files until under budget. No silent rejection.
*   **Map-reduce deferred to post-MVP.**

#### Output Validation
*   **Structural validation only** — platform checks required sections are present (as defined in YAML output spec).
*   **No content quality judgment** — that's the prompt's responsibility.

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
*   **Test IDs:** Every `it()` must include a structured test ID: `[{story}-UNIT-{seq}]` (e.g., `[2.1-UNIT-001]`). Use sub-letters for related tests: `[2.1-UNIT-001a]`, `[2.1-UNIT-001b]`.
*   **Priority Markers:** Every top-level `describe()` must include a priority tag: `[P0]` (critical path), `[P1]` (high), `[P2]` (medium), `[P3]` (low).
*   **BDD Format (Epic 3+):** New test files should use Given/When/Then comments to structure test bodies. Existing tests do not need to be retrofitted.
    ```typescript
    it('[3.1-UNIT-001] should create a report when valid input provided', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(mockEntity);
      // When
      const result = await service.create(dto, tenantId);
      // Then
      expect(result.id).toBeDefined();
    });
    ```
*   **Controller Test Pattern:** For thin delegation controllers, prefer direct constructor instantiation over `Test.createTestingModule()`. Reserve TestingModule for controllers with complex DI (guards, interceptors, pipes).
    ```typescript
    // Preferred for thin controllers
    controller = new MyController(mockService as any);
    ```
*   **Data Factories:** Use shared factory functions with override pattern (e.g., `createMockAsset({ isIndexed: false })`). Factories live in `libs/db-layer/src/testing/`.
*   **DTO Validation Tests:** Test DTO constraints using `plainToInstance` + `validate` from `class-validator`/`class-transformer`. Place in separate `*.dto.spec.ts` files when >15 validation tests.
*   **File Size Limit:** Keep spec files under 300 lines. Split by concern (controller vs DTO, service vs integration) when approaching the limit.

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

### API Documentation Rules
*   **ALWAYS** add `@ApiResponse` decorators for ALL response codes on every controller endpoint: `200`/`201`/`202` (success), `400` (validation error), `401` (unauthorized), `403` (forbidden). Add `500` where external service failures are possible.
*   **ALWAYS** use `@ApiTags`, `@ApiBearerAuth()`, `@ApiOperation()` on every controller.
*   **REASON:** Swagger is the API contract for both frontend consumers and future integrations. Incomplete docs lead to incorrect client implementations and wasted debugging time.

### Deferred Items Tracking (NFR Assessment)
*   **Impersonation audit trail** → Epic 7 Story 7.2 (interim: `logger.warn` on impersonation)
*   **Health check endpoint** → Epic 7 Story 7.3 (prerequisite for service monitoring)
*   **Refresh token rotation** → Epic 7 Story 7.5 (interim: 7-day JWT expiry)
*   **Log sanitization** → Epic 2 Story 2.1 AC (first story with real document data)

## Process Discipline Rules (from Epic 2 Retrospective — 2026-02-01)

### Quality Standard
*   **NEVER** use language like "acceptable for MVP", "sufficient for prototype", "adequate for current phase", or "defer to later phase" in any quality gate, assessment, or review output.
*   **MVP defines feature scope, NOT quality bar.** The quality bar is always production-grade. No exceptions.
*   **Quality gates produce PASS or FAIL only.** No CONCERNS with deferral recommendations. If it doesn't pass, fix it now or get explicit user approval to defer.

### YOLO Mode Definition
*   **YOLO mode auto-confirms:** Routine prompts (e.g., "proceed to next task?", "confirm environment?").
*   **YOLO mode NEVER bypasses:** (1) Code review fix decisions — user always sees findings and chooses action, (2) Quality gate verdicts, (3) Any decision point where user input changes the outcome.

### Reporting Requirements
*   **Every test/lint run MUST report complete metrics** in this format:
    ```
    Tests:    api-gateway: X | web: X | db-layer: X | shared: X
    Errors:   api-gateway: X | web: X | db-layer: X | shared: X
    Warnings: api-gateway: X | web: X | db-layer: X | shared: X
    ```
*   **No metrics may be omitted.** Warnings are bugs — they must be reported and investigated.
*   **A bug that exists in 5 places is 5 bugs**, not a "consistent pattern." Flag it, fix it.

### Code Review Protocol
*   **ALWAYS present findings to user before fixing** — even in YOLO mode.
*   User chooses per finding: auto-fix, create action item, or show details.
*   **NEVER auto-fix without consent.** This is a mandatory decision point.

## Anti-Patterns (Do Not Do)

*   ❌ **No Schema per Tenant:** Do not create dynamic schemas. Use `tenant_id` column.
*   ❌ **No Active Record:** Do not use `user.save()`. Use `repository.save(user)`.
*   ❌ **No Direct Worker HTTP:** The API must not HTTP call the Worker. Use Redis.
*   ❌ **No "Acceptable for MVP" Language:** Never rationalize quality gaps by referencing MVP scope.
*   ❌ **No Silent Metric Omission:** Never report only errors while hiding warnings.
*   ❌ **No Auto-Fix Without Consent:** Never fix code review findings without presenting them to the user first.


