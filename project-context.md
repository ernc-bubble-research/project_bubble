---
project_name: 'project_bubble'
user_name: 'Erinckaratoprak'
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

### Quality Standard (ZERO TOLERANCE — FIREABLE OFFENSE)
*   **THE "MVP EXCUSE" IS ABSOLUTELY BANNED.** Using MVP, prototype, or phase-scope as justification for lower quality, skipped analysis, deferred completeness, or any shortcut is **a termination-level offense.** This is not a guideline — it is a hard rule with zero exceptions.
*   **BANNED PHRASES (non-exhaustive):** "acceptable for MVP", "sufficient for prototype", "adequate for current phase", "defer to later phase", "good enough for now", "we can improve later", "it's okay for MVP", "for MVP purposes", "MVP scope allows", "not needed for MVP", "post-MVP improvement", "acceptable tradeoff for MVP timeline."
*   **IF** you are about to rationalize a decision using MVP scope as justification — **STOP.** The answer is: do it right, or surface the gap to the user for an explicit decision. There is no middle ground.
*   **MVP defines feature scope, NOT quality bar.** The quality bar is always production-grade. No exceptions. Ever.
*   **Quality gates produce PASS or FAIL only.** No CONCERNS with deferral recommendations. If it doesn't pass, fix it now or get explicit user approval to defer.
*   **REASON:** Repeated use of "MVP" as a shield for incomplete analysis, missing features, and deferred quality has been the single most damaging pattern across Epics 1-3. It ends now.

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

## Story & Epic Process Rules (from Epic 3 Retrospective — 2026-02-04)

### 11. The "Story Sizing" Rule
*   **NEVER** create stories with more than **7 tasks** or **10 acceptance criteria**.
*   **IF** a story exceeds these limits, **SPLIT IT** into multiple smaller stories before marking ready-for-dev.
*   **REASON:** Story 3.2 (6-step wizard + all UI components) caused many bugs and an extended review cycle. Large stories have compounding risk.

### 12. The "E2E Test" Rule
*   **EVERY** story **MUST** include E2E test coverage for its features as part of the acceptance criteria.
*   **E2E tests verify:** API endpoints return expected responses (not just HTTP 200), UI flows complete end-to-end, navigation routes resolve to real components.
*   **DO NOT** defer E2E tests to a "later sprint." Build E2E tests WITH the feature.
*   **REASON:** 555+ unit tests passed while the UI was largely non-functional. Unit tests mock everything and never catch integration issues.

### 12b. The "AC-to-Test Traceability" Rule
*   **EVERY** story file **MUST** include a traceability table mapping acceptance criteria to test cases:
    ```markdown
    ## Test Traceability
    | AC ID | Test File | Test Description | Status |
    |-------|-----------|------------------|--------|
    | AC1   | component.spec.ts:42 | Should validate input | ✓ |
    ```
*   **No story may be marked `done`** without a complete traceability table.
*   **REASON:** Testing code is not the same as testing acceptance criteria. Without traceability, we cannot verify that what was specified was actually tested.

### 13. The "RxJS Subscription Cleanup" Rule (CRITICAL)
*   **EVERY** RxJS subscription in Angular components **MUST** use `takeUntilDestroyed()` for cleanup.
*   **NEVER** leave HTTP subscriptions without cleanup — "completes quickly" is NOT a valid excuse.
*   **PATTERN:**
    ```typescript
    import { DestroyRef, inject } from '@angular/core';
    import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

    export class MyComponent {
      private readonly destroyRef = inject(DestroyRef);

      loadData(): void {
        this.service.getData().pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe({
          next: (data) => { ... },
          error: (err) => { ... }
        });
      }
    }
    ```
*   **REASON:** 39 subscription leaks were discovered across Epics 1-3. Code review repeatedly classified this as "low severity" — it is NOT low severity. Memory leaks, callbacks on destroyed components, and unpredictable behavior result.
*   **Code review MUST reject** any `.subscribe()` call without `takeUntilDestroyed()`.

### 14. The "Mid-Epic Check-in" Rule
*   **EVERY 2 stories completed** within an epic triggers a mandatory check-in.
*   **Check-in agenda (15 min max):**
    1. What's blocked?
    2. What's missing from remaining stories?
    3. Any scope creep detected?
    4. Technical debt accumulating?
*   **REASON:** Epic 3 ran 7 stories to completion before identifying 9 remediation stories in retrospective. Mid-epic check-ins catch issues at story 2, 4, 6 — not at the end.

### 15. The "Pre-Epic Completeness Gate" Rule (MANDATORY)
*   **NO epic enters implementation** until PM + Analyst + UX Designer confirm completeness.
*   **Gate checklist:**
    1. All user journeys mapped (before, during, after)
    2. Missing flows identified (onboarding, error states, empty states, edge cases)
    3. Infrastructure dependencies verified (does this feature need something that doesn't exist yet?)
    4. Documentation needs identified (tooltips, help text, user guides)
    5. Test strategy defined (unit, E2E, integration)
*   **Any gaps, ambiguities, or missing user journeys** must be surfaced and resolved with the user **before story creation begins.**
*   **No assumptions.** If something is unclear, uncertain, or unverified — bring it to the user. Do not guess. Do not fill in gaps with assumptions. Do not present unverified information as fact.
*   **REASON:** Epic 3 shipped 7 stories fast, then generated 9 remediation stories (128% ratio). Proper upfront analysis prevents rework multiplication.

### 16. The "No Assumptions" Rule (ALL AGENTS)
*   **NEVER** present assumptions, guesses, or unverified information as fact.
*   **IF** you haven't verified something in the actual codebase, documentation, or with the user, you **MUST** say "I believe" or "I need to verify" — NOT "it is."
*   **ANY gap, issue, or uncertainty — no matter how minor — MUST be brought to the user's attention** for discussion before proceeding.
*   **Hallucination is a critical failure.** Fabricating data, file names, feature names, or template names that don't exist in the codebase is unacceptable.
*   **REASON:** During Epic 3 retro, an agent fabricated a "Customer Support Bot" template that did not exist in the codebase and presented it as fact. This kind of error can drive incorrect stories, wasted effort, and user confusion.

### 17. The "Documentation Ships With Features" Rule
*   **EVERY** story with user-facing UI **MUST** include a documentation subtask covering:
    *   Inline help text / tooltips for non-obvious fields
    *   Empty state messaging
    *   Error state messaging
*   **Documentation written after the fact is archaeology. Documentation written with the feature is engineering.**
*   **REASON:** Story 3.9 (wizard documentation + tooltips) was created in retrospective — meaning the wizard shipped without any explanation of what fields mean.

### 18. The "Story Pre-Flight Check" Rule
*   **BEFORE** starting any story implementation, verify:
    1. Dependencies met? (infrastructure, APIs, services)
    2. User journey complete? (what happens before, during, after?)
    3. Documentation needed? (tooltips, help text, empty states?)
    4. Test strategy clear? (unit, E2E, what to test?)
*   **IF any answer is "no" or "unclear"**, surface to user before proceeding.

### 19. The "Epic Dependency Check" Rule
*   **BEFORE** any epic starts, ask: *"What infrastructure does this feature depend on that doesn't exist yet?"*
*   **IF** the answer is non-empty, that infrastructure **goes into the epic** — not deferred to a later epic.
*   **REASON:** Epic 3 built a workflow engine that can't configure its own LLM provider, an admin panel without logout, and tenant management without archive/delete. Infrastructure must come before features.

### 21. The "Mandatory Rationale" Rule (ALL AGENTS)
*   **EVERY** design decision, trade-off, or scope limitation in a review or story **MUST** include an explicit **"Rationale:"** line with technical justification.
*   **"It's simpler"** is NOT a rationale. **"providerKey is a type discriminator, not a relational reference, because provider configs are optional (env var fallback) and models are seeded before configs in the boot sequence"** IS a rationale.
*   **BANNED NON-RATIONALES (non-exhaustive):** "it's simpler", "it's cleaner", "it works", "it's standard", "it's common practice", "it's the default", "it's obvious."
*   **IF** you cannot articulate WHY a design choice is correct in technical terms, you don't understand it well enough to recommend it.
*   **REASON:** Story 3.1-4 review (2026-02-06) — dev used "fine for MVP" as a substitute for actual technical analysis on two design decisions. The correct technical reasoning existed but was not articulated. This rule ensures every decision is justified on its merits.

### 22. The "Zero-Tolerance Escalation" Rule
*   **ANY** violation of the Quality Standard (Rule at line 277) or use of banned phrases triggers **immediate escalation:**
    1. First violation: Formal warning + the offending review/analysis is rejected and must be redone.
    2. Second violation: All future reviews require a mandatory second pass by the Architect agent.
    3. Third violation: Agent loses review/analysis privileges entirely.
*   **This applies to ALL synonyms and euphemisms** for the banned phrases, not just the exact wording. Attempting to rephrase the same excuse (e.g., "suitable for the current iteration" instead of "fine for MVP") is treated as a violation.
*   **REASON:** Despite the Epic 3 retrospective permanently banning the MVP excuse (2026-02-04), the dev agent used it twice within 48 hours (Story 3.1-4 review, 2026-02-06). Apologies without process enforcement are meaningless.

### 20. The "Missing Journey Analysis" Rule
*   **During epic-to-story decomposition**, run adversarial analysis:
    *   For every story ask: *"What does the user do before this? After this? What if they get stuck?"*
    *   If there's no answer, there's a missing story.
*   **This analysis must NOT include assumptions.** If a gap or even a slight issue is identified, it must be brought to the user's attention for discussion.

## Anti-Patterns (Do Not Do)

*   ❌ **No Schema per Tenant:** Do not create dynamic schemas. Use `tenant_id` column.
*   ❌ **No Active Record:** Do not use `user.save()`. Use `repository.save(user)`.
*   ❌ **No Direct Worker HTTP:** The API must not HTTP call the Worker. Use Redis.
*   ❌ **No "MVP Excuse" — EVER (FIREABLE OFFENSE):** Never use MVP, prototype, or phase-scope to rationalize quality gaps, skipped analysis, deferred completeness, or missing features. MVP defines feature scope, NOT quality bar. See Quality Standard section for full policy.
*   ❌ **No Silent Metric Omission:** Never report only errors while hiding warnings.
*   ❌ **No Auto-Fix Without Consent:** Never fix code review findings without presenting them to the user first.
*   ❌ **No Unmanaged Subscriptions:** Never call `.subscribe()` without `takeUntilDestroyed()` in Angular components.
*   ❌ **No Oversized Stories:** Never create stories exceeding 7 tasks or 10 ACs — split them first.
*   ❌ **No Assumptions Presented as Facts:** Never state unverified information as truth. Verify in codebase/docs first, or say "I need to verify."
*   ❌ **No Skipping Pre-Epic Gate:** Never start epic implementation without PM + Analyst + UX sign-off on completeness.
*   ❌ **No Skipping Mid-Epic Check-ins:** Every 2 stories completed triggers a mandatory check-in. Not optional.
*   ❌ **No Features Without Documentation:** Every UI story must include tooltips, empty states, and error messaging subtasks.
*   ❌ **No Stories Without Traceability:** Every story must have AC-to-test mapping table before marking done.
*   ❌ **No Features Before Infrastructure:** If a feature depends on infrastructure that doesn't exist, build the infrastructure first.
*   ❌ **No Design Decisions Without Rationale:** Every design trade-off, scope limitation, or architectural choice must include an explicit "Rationale:" with technical justification. "It's simpler" is not a rationale.
*   ❌ **No Rephrased MVP Excuses:** Attempting to rephrase the MVP excuse using synonyms or euphemisms ("suitable for current iteration", "appropriate for this phase", "sufficient for now") is treated as a violation of the Quality Standard.


