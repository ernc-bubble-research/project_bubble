---
project_name: 'project_bubble'
user_name: 'erinc'
date: '2026-02-02'
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

### 2c. Defense-in-Depth: tenantId in ALL WHERE Clauses
*   **EVERY** TypeORM `findOne`, `find`, `update`, `delete`, `softDelete`, `restore` call on a tenant-scoped entity **MUST** include `tenantId` in the WHERE clause alongside the primary key or other conditions.
*   **DO NOT** rely on RLS alone. RLS is the safety net; explicit `tenantId` in WHERE is the primary defense.
*   **PATTERN:**
    ```typescript
    // BAD — relies on RLS alone
    manager.findOne(WorkflowVersionEntity, { where: { id } });

    // GOOD — defense-in-depth
    manager.findOne(WorkflowVersionEntity, { where: { id, tenantId } });
    ```
*   **This applies to:** All entities with a `tenant_id` column. The only exemptions are entities in the "EXEMPTED SERVICES" table above (no `tenant_id` column).
*   **REASON:** This rule was added after the same defect was found in code review across Stories 2.4, 3.3, and 3.4. It is a recurring pattern that must stop.

#### Documented Rule 2c Exceptions
*   **`findPublishedOne` (Story 4-FIX-A2):** The `WorkflowTemplatesService.findPublishedOne(id, requestingTenantId)` method queries `{ where: { id, status: PUBLISHED } }` without `tenantId` in WHERE. This is intentional: workflow templates are created by bubble_admin and shared with tenants via catalog. The method enforces visibility in application code (PRIVATE templates check `allowedTenants` array). RLS policy `catalog_read_published` provides database-level enforcement. Approved during Live Test Round 1 party mode triage (2026-02-12).
*   **`findPublished` and `findAccessibleByTenant` (Story 4-FIX-A2):** These list methods also omit `tenantId` in WHERE for the same reason — catalog templates are admin-created. Visibility is enforced by SQL filter `(visibility = 'public' OR tenantId = ANY(allowed_tenants))`.
*   **`findPublishedOneEntity` (Story 4-LT4-3):** The `WorkflowTemplatesService.findPublishedOneEntity(id, requestingTenantId)` method returns raw `{ template: WorkflowTemplateEntity, version: WorkflowVersionEntity }` without `tenantId` in WHERE. Same visibility logic as `findPublishedOne` — queries `{ id, status: PUBLISHED }`, checks visibility + `allowedTenants` in application code. Used by `initiateRun()` for cross-tenant template access. RLS policies `catalog_read_published` + `template_access` provide database-level enforcement.

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

## Angular Frontend Rules (from Epic 3 — Story 3.2+)

### 6. The "Standalone Everything" Rule (Angular Components)
*   **NEVER** create NgModules. ALL components must be `standalone: true`.
*   **ALWAYS** use `inject()` function for dependency injection — NOT constructor injection.
*   **ALWAYS** use Angular Signals (`signal()`, `computed()`, `input()`, `output()`) for component state. Do NOT use `BehaviorSubject` for local state.
*   **ALWAYS** use Reactive Forms via `inject(FormBuilder)` for form-heavy components.
*   **ALWAYS** lazy-load new routes via `loadComponent` in `app.routes.ts`.
*   **PATTERN:**
    ```typescript
    @Component({ standalone: true, imports: [...] })
    export class MyComponent {
      private readonly http = inject(HttpClient);
      private readonly fb = inject(FormBuilder);
      myState = signal<string>('');
      derived = computed(() => this.myState().toUpperCase());
    }
    ```

### 7. The "Custom Design System" Rule (No UI Libraries)
*   **NEVER** import Angular Material, PrimeNG, or any third-party UI component library.
*   **ALWAYS** build UI with plain HTML/SCSS using the existing design system CSS variables from `styles.scss` (e.g., `--brand-blue`, `--primary-600`, `--slate-*`, `--radius-*`, `--shadow-*`).
*   **ALWAYS** use `lucide-angular` for icons (registered globally in `app.config.ts`).
*   **REASON:** This project uses a custom design system. Third-party UI libraries conflict with the visual identity and add unnecessary bundle size.

### 8. The "Two-Layer State" Rule (Complex Forms / Wizards)
*   For multi-step forms or wizards, use a **two-layer state pattern:**
    *   **Layer 1 (canonical):** A parent-level `signal<T>()` holds the persisted model.
    *   **Layer 2 (local):** Each child component has its own `FormGroup` for validation and user interaction.
*   **On "Next" / save:** the child syncs its `FormGroup` values into the parent signal.
*   **On step entry:** the child initializes its `FormGroup` from the parent signal.
*   **REASON:** This avoids confusion about which layer is the source of truth and prevents complex cross-component synchronization.

### 9. The "Services Return Observables" Rule (HTTP)
*   **ALWAYS** create HTTP services as `@Injectable({ providedIn: 'root' })` with `inject(HttpClient)`.
*   **ALWAYS** return `Observable<T>` from service methods — NOT Promises.
*   **ALWAYS** import shared types from `@project-bubble/shared`.
*   **PATTERN:**
    ```typescript
    @Injectable({ providedIn: 'root' })
    export class WorkflowTemplateService {
      private readonly http = inject(HttpClient);
      create(dto: CreateWorkflowTemplateDto): Observable<WorkflowTemplateResponseDto> {
        return this.http.post<WorkflowTemplateResponseDto>('/api/admin/workflow-templates', dto);
      }
    }
    ```

### 10. The "Test IDs Everywhere" Rule (Frontend Testing)
*   **ALWAYS** add `data-testid` attributes to all interactive elements (buttons, inputs, links, cards).
*   **REASON:** Enables reliable E2E test selectors without coupling to CSS classes or DOM structure.

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

### WebSocket & Real-Time Features Testing Rule (from Story 4-7b — 2026-02-21)
*   **CRITICAL:** WebSocket gateways, SSE endpoints, and real-time async features are **HARDER TO TEST** than typical UI/API code.
*   **INTEGRATION TESTS FIRST:** For any WebSocket gateway or real-time backend feature, write **Tier 2 integration tests FIRST** (test-driven), NOT after 3 code review passes.
*   **Unit tests are insufficient:** Mocking `socket.io-client` in unit tests will NEVER catch:
    *   Actual WebSocket handshake failures
    *   JWT authentication issues
    *   Room-based isolation bugs
    *   Event propagation errors
    *   Connection lifecycle edge cases
*   **Pattern:** Create a mock socket server in integration tests, instantiate the gateway directly, test event emission and room isolation.
*   **Applies to:** WebSocket gateways (socket.io), Server-Sent Events (SSE), long-polling endpoints, any async backend integration exposed to frontend.
*   **REASON:** Story 4-7b required 3 review passes to catch missing WebSocket integration test (C1 finding). Tests written after implementation miss critical flows. Frontend WebSocket features are backend-heavy — treat them as backend stories with frontend UI, not UI stories with backend support.

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

## Strategic Principles

_Rules that can be enforced structurally are embedded in BMAD workflows (dev-story, create-story, sprint-status, create-epics-and-stories, code-review). Only judgment-requiring principles live here._

### Quality Standard (ZERO TOLERANCE — FIREABLE OFFENSE)
*   **THE "MVP EXCUSE" IS ABSOLUTELY BANNED.** MVP defines feature scope, NOT quality bar. The quality bar is always production-grade. No exceptions, ever. Every decision is made for the production application serving paying enterprise customers.
*   **BANNED PHRASES:** "acceptable for MVP," "adequate for current phase," "good enough for now," "we can improve later," and all synonyms including "scope-appropriate," "suitable for current iteration," "adequate for our stage."
*   **Quality gates produce PASS or FAIL only.** No "concerns with deferral recommendations."

### YOLO Mode Definition
*   **YOLO mode auto-confirms:** Routine prompts (e.g., "proceed to next task?", "confirm environment?").
*   **YOLO mode NEVER bypasses:** (1) Code review fix decisions, (2) Quality gate verdicts, (3) Any decision point where user input changes the outcome.

### No Assumptions (ALL Agents)
*   NEVER present assumptions, guesses, or unverified information as fact. If you haven't verified something in the codebase or with the user, say "I believe" or "I need to verify."
*   ANY gap, issue, or uncertainty MUST be brought to the user's attention before proceeding.

### Mandatory Rationale (ALL Agents)
*   EVERY design decision, trade-off, or scope limitation MUST include an explicit "Rationale:" with technical justification. "It's simpler" is NOT a rationale.
*   Banned non-rationales: "it's simpler," "it's cleaner," "it works," "it's standard," "it's obvious."

### No "We Don't Have Customers Yet" (Rule 36)
*   BANNED: "we don't have customers yet," "adequate for our current stage," "fine for now." Every decision is made for the production application serving paying enterprise customers.

### No Unilateral Code Review Decisions (Rule 37)
*   The dev agent CANNOT reject, dismiss, or skip ANY reviewer finding. EVERY finding from EVERY review pass must be presented to the user with recommendation (fix/track/reject + reasoning). The USER decides. No exceptions.

### No Floating Deferrals (Rule 38)
*   Any deferred item MUST be assigned to a specific story reference at the moment of identification. "We'll track it later" is banned. Fix it now, or document it in the Out-of-Scope table with a specific story reference.

### No Unassigned Backlog Items (Rule 39)
*   Every backlog item, deferred task, tracked finding, or planned work MUST be assigned to a named story under a specific epic in sprint-status.yaml. Memory notes are NOT permanent homes.

### Fix Now (Rule 32)
*   If an issue is found, fix it now — unless it maps to a planned upcoming activity (epic, story, testing phase). No "investigate later" bucket. Fix it or document it with a specific story reference.

---

## Technical Patterns (NOT in Workflows)

_Specific code patterns agents must follow — not judgment-based, but correctness-based._

### Rule 13: RxJS Subscription Cleanup (CRITICAL)
*   EVERY RxJS subscription in Angular components MUST use `takeUntilDestroyed()`. "Completes quickly" is NOT a valid excuse. 39 subscription leaks found across Epics 1-3.
*   **Pattern:**
    ```typescript
    const destroyRef = inject(DestroyRef);
    this.service.getData().pipe(takeUntilDestroyed(destroyRef)).subscribe({...});
    ```

### Rule 25: Guard Ordering Documentation
*   ANY new guard registration MUST specify explicit execution order in a comment. Document prerequisites and what happens if they haven't run.

### Rule 27: No @IsUUID with Version Constraints
*   NEVER use `@IsUUID('4')`, `@IsUUID('all')`, or `@IsUUID(undefined)` on DTO fields — these require RFC-compliant variant bits and reject valid-looking UUIDs like seed data.
*   ALWAYS use `@Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)` instead.

### Rule 28: E2E Regression Gate
*   Run the full E2E suite (`npx nx e2e web-e2e`) every 2-3 stories during an epic. Do NOT batch E2E fixes to the end — catch regressions early.

### Rule 30: E2E State Isolation
*   E2E tests that mutate shared seed data (archive, delete, status changes) MUST restore original state in `afterEach`/`afterAll`, OR be written resilient to state left by prior tests. Document which seed entities each test modifies.

### Rule 31: Raw SQL RETURNING Wiring Test
*   Any `manager.query()` with a RETURNING clause MUST have a Tier 2 wiring integration test against real PostgreSQL. The pg driver returns `[[rows], affectedCount]` for UPDATE/INSERT RETURNING — not `[rows]`. Only a real DB test catches this.

### Shared Infrastructure Protection
*   Off-limits for drive-by changes: `global-setup.ts`, `global-teardown.ts`, `playwright.config.ts`, `fixtures.ts`, `test-db-helpers.ts`, `env.ts`. Bugs in these files require a separate tracked issue + party mode approval before modification. No hotfixes.

---

## Anti-Patterns

*   ❌ No Schema per Tenant: Use `tenant_id` column, not dynamic schemas.
*   ❌ No Active Record: Use `repository.save(user)`, not `user.save()`.
*   ❌ No Direct Worker HTTP: API must not HTTP-call the Worker. Use Redis.
*   ❌ No @IsUUID Validators: Use `@Matches` regex instead (Rule 27).
*   ❌ No Unmanaged RxJS Subscriptions: Always `takeUntilDestroyed()` in Angular components (Rule 13).
*   ❌ No MVP Excuses: Quality bar is always production-grade. See Quality Standard.
*   ❌ No "We Don't Have Customers Yet": Every decision is for paying enterprise customers (Rule 36).
*   ❌ No Unilateral Code Review Decisions: Every finding goes to the user (Rule 37).
*   ❌ No Floating Deferrals: Every deferral needs a story reference now (Rule 38).
*   ❌ No Unassigned Backlog Items: Every item must be in sprint-status.yaml under a story (Rule 39).
*   ❌ No Raw SQL RETURNING Without Wiring Test (Rule 31).
*   ❌ No Batched E2E Fixes: Run full suite every 2-3 stories (Rule 28).
*   ❌ No E2E State Pollution: Restore seed data in afterEach/afterAll (Rule 30).


