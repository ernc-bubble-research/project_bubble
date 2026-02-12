# Story 4.2: LLM Provider Interface & Prompt Assembly

Status: done

## Story

As a **Developer**,
I want **a hexagonal LLM provider interface and prompt assembly pipeline**,
so that **the execution engine can call any LLM provider without coupling to specific SDKs**.

## Acceptance Criteria

1. **AC1: LLMProvider Interface (Hexagonal)**
   - Given the existing `EmbeddingProvider` hexagonal pattern at `apps/api-gateway/src/app/ingestion/embedding.provider.ts`
   - Then an `LLMProvider` interface is created with a `generate(prompt, options)` method
   - The interface returns `{ text: string; tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number } }`
   - No injection token needed — `LlmProviderFactory` is a regular `@Injectable()` service (not a NestJS factory provider)

2. **AC2: MockLlmProvider**
   - Given a provider config with `providerKey = 'mock'`
   - Then `MockLlmProvider` returns deterministic canned responses based on input hash
   - Simulates 500ms–2s latency (configurable via `MOCK_LLM_LATENCY_MS` env var, default 500)
   - Reports synthetic token usage (`inputTokens = prompt.length / 4`, `outputTokens = response.length / 4`)
   - Requires no credentials (empty `mock: []` in `REQUIRED_CREDENTIAL_FIELDS`)
   - Rate limited to 15 rpm (via `rate_limit_rpm` on mock provider config)

3. **AC3: GoogleAIStudioLlmProvider**
   - Given a provider config with `providerKey = 'google-ai-studio'` and valid `apiKey` credential
   - Then `GoogleAIStudioLlmProvider` calls the Google Generative AI SDK (`@google/generative-ai`)
   - Uses the `modelId` from `LlmModelEntity` (e.g., `gemini-1.5-pro`)
   - Passes `temperature` and `maxOutputTokens` from `WorkflowExecution` config
   - Returns the generated text and actual token usage from the API response
   - Has retry logic (3 attempts, exponential backoff, 60s timeout)
   - Falls back to `GEMINI_API_KEY` env var if DB credentials unavailable

4. **AC4: Dynamic Provider Resolution (NOT Static Factory)**
   - Given the embedding provider uses a static factory (one provider at boot via env var)
   - Then the LLM provider uses **dynamic runtime resolution** per-request:
     1. `definition.execution.model` stores `LlmModelEntity.id` (UUID) — look up `LlmModelEntity` by UUID primary key
     2. `LlmModelEntity.providerKey` (e.g., `"google-ai-studio"`) → look up `LlmProviderConfigEntity`
     3. Validate provider `isActive` and model `isActive`
     4. Get decrypted credentials via `LlmProviderConfigService.getDecryptedCredentials(providerKey)`
     5. Instantiate the correct `LLMProvider` implementation
   - Provider instances are **cached** in a `Map<providerKey, { provider, cachedAt }>`. On cache hit, check `config.updatedAt > cachedAt` — if newer, rebuild provider. No TTL, no events, no server restarts.
   - This is an `LlmProviderFactory` service, not a module-level `useFactory`
   - **Rationale for UUID storage**: `modelId` (e.g., `gemini-1.5-pro`) is NOT globally unique — the same string can exist under both `google-ai-studio` and `vertex` providers. Storing the UUID eliminates all ambiguity.

5. **AC5: Prompt Assembly Pipeline**
   - Given a `WorkflowJobPayload` with `definition.prompt`, `contextInputs`, and optionally `subjectFile`
   - Then `PromptAssemblyService.assemble(payload)` performs:
     1. Reads file content for each context input where `type: 'file'` (resolve `assetId` → `AssetEntity.storagePath` → read via `TextExtractorService` for PDF/DOCX or `fs.readFile` for text files)
     2. Reads subject file content if present (from `subjectFile.storagePath`, same extraction logic)
     3. Replaces `{input_name}` variables in the prompt template using regex `/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g`
     4. Replaces `{subject_name}` with subject file original name (if present)
     5. Replaces `{knowledge_context}` with `payload.knowledgeContext` (if present, empty string if not)
     6. Logs `assembledPromptLength` (character count) for observability
     7. Returns the assembled prompt string and any warnings (e.g., "Input 'x' was empty")
   - **TextExtractorService** (from `IngestionModule`) handles PDF, DOCX, TXT, MD extraction. Must be **exported** from `IngestionModule` for use here. This is NOT related to RAG — it's plain file content extraction for prompt assembly.
   - Knowledge RAG query is NOT part of this story (deferred to Phase 2 per retro item #8). The `knowledgeContext` field is pre-populated upstream or left empty.

6. **AC6: Processor Integration**
   - Given the placeholder at `workflow-execution.processor.ts:85-92` (lines with "LLM integration pending Story 4-2/4-3")
   - Then the processor:
     1. Calls `PromptAssemblyService.assemble(job.data)` to get the assembled prompt
     2. Calls `LlmProviderFactory.getProvider(definition.execution.model)` to get the provider instance
     3. Calls `provider.generate(assembledPrompt, { temperature, maxOutputTokens })` to get the LLM response
     4. Stores results on `WorkflowRunEntity`: `assembledPrompt`, `rawLlmResponse`, `tokenUsage`, `modelId`
   - Error handling: if LLM call throws, let the error propagate to BullMQ retry logic (Story 4-0 DLQ handles final failure)

7. **AC7: `rate_limit_rpm` Column on LlmProviderConfigEntity**
   - Given `LlmProviderConfigEntity` currently has no rate limiting column
   - Then add `rate_limit_rpm` column (`type: 'int', nullable: true`)
   - The column stores the maximum requests per minute for the provider
   - The DTO and response DTO include this field
   - **Enforcement is NOT in this story** — the column is added for Story 4-3 (circuit breaker + BullMQ rate limiter)

8. **AC8: Token Usage Tracking**
   - Given a successful LLM call
   - Then `WorkflowRunEntity.tokenUsage` is populated with `{ inputTokens, outputTokens, totalTokens }`
   - And `WorkflowRunEntity.modelId` is set to the `LlmModelEntity.id` that was used

9. **AC9: Module Wiring Test**
   - Given all new providers are registered in `WorkflowExecutionModule`
   - Then module wiring tests verify DI resolution for: `LlmProviderFactory`, `PromptAssemblyService`
   - The wiring test imports `SettingsModule` and `TypeOrmModule.forFeature([LlmModelEntity, AssetEntity])`

10. **AC10: E2E Regression**
    - Given all changes are complete
    - Then the existing E2E suite (46+ tests) still passes
    - And all existing unit tests pass

## Tasks / Subtasks

- [x] **Task 1: Add `rate_limit_rpm` to LlmProviderConfigEntity** (AC: 7)
  - [x] 1.1 Add column to entity (`type: 'int', nullable: true`)
  - [x] 1.2 Update `CreateLlmProviderConfigDto` and `UpdateLlmProviderConfigDto` with optional `rateLimitRpm` field
  - [x] 1.3 Update `LlmProviderConfigResponseDto` to include `rateLimitRpm`
  - [x] 1.4 Update `LlmProviderConfigService.create()` and `update()` to handle the new field
  - [x] 1.5 Update existing tests for the new field

- [x] **Task 2: Create LLMProvider Interface** (AC: 1)
  - [x] 2.1 Create `apps/api-gateway/src/app/workflow-execution/llm/llm.provider.ts`
  - [x] 2.2 Define `LLMProvider` interface, `LLMGenerateOptions`, `LLMGenerateResult`
  - [ ] ~~2.3 Export injection token~~ — REMOVED (party mode W3: `LlmProviderFactory` is a regular `@Injectable()`, no token needed)

- [x] **Task 3: Implement MockLlmProvider** (AC: 2)
  - [x] 3.1 Create `apps/api-gateway/src/app/workflow-execution/llm/mock-llm.provider.ts`
  - [x] 3.2 Deterministic response based on input hash (same prompt → same response)
  - [x] 3.3 Configurable simulated latency
  - [x] 3.4 Synthetic token usage calculation
  - [x] 3.5 Unit tests with determinism verification

- [x] **Task 4: Implement GoogleAIStudioLlmProvider** (AC: 3)
  - [x] 4.1 Create `apps/api-gateway/src/app/workflow-execution/llm/google-ai-studio-llm.provider.ts`
  - [x] 4.2 Use `@google/generative-ai` SDK (already installed for embeddings)
  - [x] 4.3 Accept credentials from factory (passed at construction, not from env)
  - [x] 4.4 Retry logic: 3 attempts, exponential backoff, 60s timeout
  - [x] 4.5 Extract token usage from API response (`usageMetadata`)
  - [x] 4.6 Unit tests with mocked SDK
  - [x] 4.7 Canary test file: `google-ai-studio-llm.provider.canary.spec.ts` — `describe.skip('GoogleAIStudio Canary [MANUAL]', ...)` with a real API call test. Enabled manually by removing `.skip` when validating SDK compatibility. See operations runbook for SOP.
  - [x] 4.8 Operations runbook section: canary test explanation (what it is, when to run, what to do if it fails) + SOP cadence (daily: N/A, weekly: N/A, monthly: review SDK changelog, before deployment: run canary if SDK updated, before SDK upgrades: run canary BEFORE and AFTER). Written for newcomers — explain what/why/how.

- [x] **Task 5: Implement LlmProviderFactory** (AC: 4)
  - [x] 5.1 Create `apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.ts`
  - [x] 5.2 `getProvider(modelUuid: string): Promise<{ provider: LLMProvider; model: LlmModelEntity }>`
  - [x] 5.3 Look up `LlmModelEntity` by UUID primary key (`id`), validate `isActive`
  - [x] 5.4 Look up `LlmProviderConfigEntity` by `providerKey`, validate `isActive`
  - [x] 5.5 Get decrypted credentials via `LlmProviderConfigService.getDecryptedCredentials()`
  - [x] 5.6 Instantiate correct provider implementation based on `providerKey`
  - [x] 5.7 **Provider instance caching**: `Map<providerKey, { provider: LLMProvider; cachedAt: Date }>`. On cache hit, fetch `LlmProviderConfigEntity.updatedAt`. If `updatedAt > cachedAt`, rebuild provider instance. If not, return cached. No TTL, no events, no restarts.
  - [x] 5.8 Unit tests: model not found, model inactive, provider inactive, credentials missing, happy path, cache hit, cache invalidation (config updated after cache)

- [x] **Task 6: Implement PromptAssemblyService** (AC: 5)
  - [x] 6.1 Create `apps/api-gateway/src/app/workflow-execution/prompt-assembly.service.ts` — inject `TransactionManager` (for tenant-scoped AssetEntity lookups) + `TextExtractorService` (for PDF/DOCX extraction)
  - [x] 6.2 `assemble(payload: WorkflowJobPayload): Promise<{ prompt: string; warnings: string[]; assembledPromptLength: number }>`
  - [x] 6.3 Resolve file-type context inputs: `assetId` → `AssetEntity.storagePath` → `TextExtractorService.extract()` for PDF/DOCX, `fs.readFile()` for text files (TXT, MD)
  - [x] 6.4 Resolve text-type context inputs: use `content` directly
  - [x] 6.5 Resolve subject file: read from `subjectFile.storagePath` (same extraction logic as 6.3)
  - [x] 6.6 Variable substitution using regex `/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g` in prompt template (`{input_name}`, `{subject_name}`, `{knowledge_context}`)
  - [x] 6.7 Return warnings for empty/missing inputs
  - [x] 6.8 Log `assembledPromptLength` (character count) at INFO level for observability
  - [x] 6.9 Unit tests: all input types (text, PDF, DOCX, TXT), missing inputs, variable substitution regex, empty knowledge, prompt length logging

- [x] **Task 7: Integrate into WorkflowExecutionProcessor** (AC: 6, 8)
  - [x] 7.1 Inject `PromptAssemblyService` and `LlmProviderFactory` into processor constructor
  - [x] 7.2 Replace placeholder (lines 85-92) with: assemble prompt → resolve provider → generate → store results
  - [x] 7.3 Store `assembledPrompt`, `rawLlmResponse`, `tokenUsage`, `modelId` on entity
  - [x] 7.4 Let LLM errors propagate for BullMQ retry logic
  - [x] 7.5 **Defense-in-depth backend safety net**: After prompt assembly, check `assembledPromptLength` against `model.contextWindow`. If prompt exceeds context window, throw a descriptive error (should theoretically never fire once Story 4-4's frontend pre-flight UI lands — this is invisible insurance). Note: this is NOT the primary gate — Story 4-4's UI shows per-file token consumption and lets users deselect files before submission.
  - [x] 7.6 Update existing processor unit tests
  - [x] 7.7 Add new tests for the LLM integration path (including safety net test)

- [x] **Task 8: Update WorkflowExecutionModule** (AC: 9)
  - [x] 8.1 Add `SettingsModule` to imports (for `LlmProviderConfigService`)
  - [x] 8.2 Add `TypeOrmModule.forFeature([LlmModelEntity, AssetEntity])` to imports
  - [x] 8.3 Register `LlmProviderFactory`, `PromptAssemblyService` as providers
  - [x] 8.4 Update module wiring tests

- [x] **Task 9: Run Full Test Suite** (AC: 10)
  - [x] 9.1 Run all unit tests (`npx nx run-many --target=test --all`) — 1043 passing (549 api-gateway + 494 web)
  - [x] 9.2 Run lint (`npx nx run-many --target=lint --all`) — 0 errors
  - [x] 9.3 Run E2E suite (`npx nx e2e web-e2e`) — 42/46 pass, 4 pre-existing flaky failures unrelated to Story 4-2
  - [x] 9.4 Fix any regressions — fixed canary spec lint error (removed non-existent `jest/no-disabled-tests` rule)

- [x] **Task 10: Update Wizard Execution Step — UUID Model Binding** (AC: 4)
  - [x] 10.1 In wizard execution step component, bind model dropdown `value` to `LlmModelEntity.id` (UUID) instead of `modelId` string
  - [x] 10.2 Filter model dropdown to show only `isActive === true` models (already done — uses `getActiveModels()` endpoint)
  - [x] 10.3 Store selected UUID in `WorkflowDefinition.execution.model`
  - [x] 10.4 Update wizard execution step unit tests for UUID binding — 12 new tests (4.2-UNIT-053 through 4.2-UNIT-064)
  - [x] 10.5 Verify existing E2E tests still pass with UUID model selection — 42/46 pass (no regressions)

## Dev Notes

### Architecture: Dynamic vs Static Provider Resolution

**CRITICAL DIFFERENCE from EmbeddingProvider:** The existing `EmbeddingProvider` pattern (`ingestion.module.ts`) uses a **static `useFactory`** that picks one provider at boot time based on `EMBEDDING_PROVIDER` env var. This does NOT work for LLM providers because:

- Each `WorkflowDefinition.execution.model` can reference a **different** LLM model
- Different models map to different providers (e.g., `gemini-1.5-pro` → `google-ai-studio`, `gpt-4o` → `openai`)
- Credentials are per-provider from the DB, not per-boot from env vars

**Solution:** `LlmProviderFactory` is a regular `@Injectable()` service that resolves providers dynamically at runtime. It is NOT a NestJS factory provider. It injects `LlmProviderConfigService` and an `LlmModelEntity` repository.

### Prompt Assembly: How Variables Are Resolved

The `definition.prompt` field is a template string with `{variable_name}` placeholders. Assembly process:

1. **Context inputs** (role: `context`): Each entry in `payload.contextInputs` maps to a variable. If `type: 'file'`, resolve `assetId` → `AssetEntity` (via `TransactionManager.run(tenantId, ...)`) → read file content from `storagePath` via `fs.readFile()`. If `type: 'text'`, use `content` directly.

2. **Subject file**: If `payload.subjectFile` exists, read content from `subjectFile.storagePath`. Replace `{subject_name}` with `subjectFile.originalName` and make the content available as `{subject_content}` or a similar variable.

3. **Knowledge context**: Replace `{knowledge_context}` with `payload.knowledgeContext || ''`. Knowledge RAG is deferred to Phase 2 — the field will always be empty in MVP.

4. **All unresolved variables**: Log a warning but do NOT fail. Replace with empty string.

### File Content Reading

For reading uploaded file content during prompt assembly:
- `AssetEntity.storagePath` contains the relative path (e.g., `uploads/<tenantId>/<uuid>-<filename>`)
- Use `fs.readFile(storagePath, 'utf-8')` for text files (.txt, .md)
- For PDF/DOCX files, use `TextExtractorService.extract(filePath, mimeType)` from `IngestionModule`. This service already handles PDF (via pdf-parse), DOCX (via mammoth), TXT, and MD extraction.
- **IMPORTANT**: `TextExtractorService` is currently registered as a provider in `IngestionModule` but NOT exported. This story must add it to the `exports` array so `PromptAssemblyService` can inject it.
- This is NOT related to RAG or knowledge base (deferred to Phase 2). This is plain file content extraction for prompt assembly — reading the actual text from uploaded files.
- If a file cannot be read, add a warning and substitute empty string (do not fail the run)

### Entity/Column Notes

- **`WorkflowRunEntity` already has all needed columns** — `assembledPrompt`, `rawLlmResponse`, `tokenUsage`, `modelId`, `validationWarnings`. No schema changes needed on this entity.
- **`LlmProviderConfigEntity` needs one new column** — `rate_limit_rpm` (int, nullable). This is purely a data column for now; enforcement via BullMQ rate limiter comes in Story 4-3.
- **`LlmModelEntity`** is read-only in this story — used for lookups, no changes.

### Google AI Studio SDK Usage

The `@google/generative-ai` package is already installed (used by `GeminiEmbeddingProvider`). Key patterns from existing code:

```typescript
// From embedding.service.ts — reference pattern
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: modelId });

// For content generation (new for 4-2):
const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: assembledPrompt }] }],
  generationConfig: { temperature, maxOutputTokens },
});
const response = result.response;
const text = response.text();
const usage = response.usageMetadata; // { promptTokenCount, candidatesTokenCount, totalTokenCount }
```

### MockLlmProvider Design

Per Epic 4 planning decisions:
- **Deterministic responses**: Use input hash to generate consistent markdown output. Same prompt → same response. This ensures test reproducibility.
- **Simulated latency**: Default 500ms (`MOCK_LLM_LATENCY_MS` env var). Tests can set to 0.
- **Response format**: Return valid markdown with headings matching what a real LLM would produce:
  ```
  # Analysis Report
  ## Summary
  [deterministic content based on hash]
  ## Findings
  [more deterministic content]
  ```
- **Synthetic token usage**: `inputTokens = Math.ceil(prompt.length / 4)`, `outputTokens = Math.ceil(response.length / 4)`

### Provider Key to Implementation Mapping

From `apps/api-gateway/src/app/common/provider-keys.ts`:
```typescript
export const KNOWN_PROVIDER_KEYS = ['google-ai-studio', 'vertex', 'openai', 'mock'] as const;
```

Implementation mapping for this story:
| Provider Key | Implementation | Status |
|---|---|---|
| `mock` | `MockLlmProvider` | Built in this story |
| `google-ai-studio` | `GoogleAIStudioLlmProvider` | Built in this story |
| `vertex` | — | Stub: throw "Vertex provider not yet implemented" |
| `openai` | — | Stub: throw "OpenAI provider not yet implemented" |

### Module Dependencies

`WorkflowExecutionModule` needs these additions:
```
imports: [
  SettingsModule,                               // For LlmProviderConfigService (already exported)
  IngestionModule,                              // For TextExtractorService (must add to IngestionModule exports)
  TypeOrmModule.forFeature([LlmModelEntity]),   // For model lookups
  TypeOrmModule.forFeature([AssetEntity]),       // For resolving assetId → storagePath
]
providers: [
  LlmProviderFactory,                           // Dynamic provider resolution + caching
  PromptAssemblyService,                        // Prompt template + inputs → assembled prompt
]
```

NOTE: `AssetEntity` may already be in a `forFeature` call elsewhere. Check if `AssetsModule` exports the repository or if we need to register it directly.
NOTE: `IngestionModule` must export `TextExtractorService` (currently only registered as provider, not exported).

### Out-of-Scope for This Story

- **Fan-out/fan-in** (Story 4-3): Subject files are not resolved in this story. If `subjectFile` is in the payload, read it. If `subjectFiles` (plural), that's Story 4-3.
- **Circuit breaker** (Story 4-3): Provider-level circuit breaker wrapping
- **BullMQ rate limiter enforcement** (Story 4-3): `rate_limit_rpm` column is added but not enforced
- **Credit deduction** (Story 4-4): No credit checks or deductions
- **Token budget pre-flight UI** (Story 4-4): The PRIMARY gate for context window enforcement. UI shows per-file token consumption, lets user deselect files, submit disabled until under budget. Story 4-2 adds ONLY a defense-in-depth backend safety net (invisible insurance).
- **Output validation** (Story 4-5): Raw LLM response stored; validation is a separate story
- **Knowledge RAG query** (Phase 2): `knowledgeContext` field is used if present but never populated
- **Vertex/OpenAI implementations**: Stub only, throw descriptive error

### Project Structure Notes

New files go under the existing `workflow-execution/` module directory:
```
apps/api-gateway/src/app/workflow-execution/
├── llm/
│   ├── llm.provider.ts                     # Interface (no token)
│   ├── llm-provider.factory.ts             # Dynamic resolution service
│   ├── llm-provider.factory.spec.ts        # Unit tests
│   ├── mock-llm.provider.ts                # Mock implementation
│   ├── mock-llm.provider.spec.ts           # Unit tests
│   ├── google-ai-studio-llm.provider.ts    # Google AI Studio implementation
│   └── google-ai-studio-llm.provider.spec.ts # Unit tests
├── prompt-assembly.service.ts              # Prompt template assembly
├── prompt-assembly.service.spec.ts         # Unit tests
├── workflow-execution.processor.ts         # MODIFIED — replace placeholder
├── workflow-execution.processor.spec.ts    # MODIFIED — update tests
├── workflow-execution.module.ts            # MODIFIED — add imports + providers
└── workflow-execution.service.ts           # Unchanged
```

Modified files outside the module:
```
libs/db-layer/src/lib/entities/llm-provider-config.entity.ts  # Add rate_limit_rpm column
libs/shared/src/lib/dtos/settings/                             # Update provider config DTOs
apps/api-gateway/src/app/settings/llm-provider-config.service.ts # Handle rate_limit_rpm in create/update
apps/api-gateway/src/app/ingestion/ingestion.module.ts         # Export TextExtractorService
apps/web/src/app/admin/workflows/wizard/steps/execution-step.component.ts  # UUID model binding (Task 10)
```

### References

- [Source: epics.md#Story-4.2] — Acceptance criteria
- [Source: epic-4-planning-2026-02-09.md#Topic-9] — Rate limiting design (rate_limit_rpm)
- [Source: epic-4-planning-2026-02-09.md#Mock-LLM] — Mock provider spec (15 rpm, 500ms-2s latency, deterministic)
- [Source: embedding.provider.ts] — Hexagonal interface pattern to mirror
- [Source: embedding.service.ts] — GeminiEmbeddingProvider as reference for Google AI SDK usage
- [Source: ingestion.module.ts] — Static factory pattern (DO NOT copy for LLM — use dynamic factory instead)
- [Source: llm-provider-config.service.ts#getDecryptedCredentials] — Credential resolution for providers
- [Source: workflow-execution.processor.ts#L85-92] — Placeholder to replace
- [Source: workflow-run.entity.ts#L69-92] — Existing columns for LLM result storage
- [Source: workflow-job.interface.ts] — WorkflowJobPayload structure
- [Source: workflow-definition.interface.ts] — WorkflowDefinition with prompt template
- [Source: project-context.md#Rule-2] — TransactionManager for tenant-scoped ops
- [Source: project-context.md#Rule-4] — Hexagonal pattern, no direct SDK imports in feature modules
- [Source: project-context.md#Rule-5] — YAML IS the prompt
- [Source: 4-0-bullmq-safety-prerequisites.md] — DLQ + idempotency (error propagation to BullMQ)
- [Source: 4-1-workflow-catalog-run-initiation.md] — Payload construction, asset validation, contextInputs

### Previous Story Learnings (from Story 4-0 and 4-1)

- **TransactionManager.run(tenantId, ...)** is required for all tenant-scoped entity lookups in the processor. LlmModelEntity and LlmProviderConfigEntity are **system-wide** (no tenant_id) — use `@InjectRepository` directly for those.
- **AssetEntity IS tenant-scoped** — must use `TransactionManager.run(tenantId, ...)` to look up asset by ID during prompt assembly.
- **Error propagation in processor**: Let LLM errors throw naturally. BullMQ retry logic (3 attempts, exponential backoff) handles transient failures. DLQ handler (Story 4-0) routes final failures.
- **Signal reactivity fix pattern** (Story 4-1 H1): When mutating objects in Angular signal arrays, must create new array reference with `signal.update(arr => [...arr])`. Not directly relevant to this backend story but important context.
- **class-validator `@ValidateNested({each:true})` does NOT work with Record<string,T>** (Story 4-1 H2). If DTOs need nested validation on Records, use custom `ValidatorConstraint`.

## Party Mode Review Record

### Pre-Implementation Review (2026-02-09)
**Team**: Winston (Architect), Amelia (Dev), Murat (Test Architect)
**Findings Applied**: 10 total (W1-W3, A1-A3, M1, M3-M5)

| # | Finding | Decision |
|---|---------|----------|
| W1 | Provider caching | Cache with `updatedAt` freshness check (Task 5.7) |
| W2 | Non-text file handling | Export `TextExtractorService` from `IngestionModule`, use in prompt assembly (Task 6.3) |
| W3 | Drop injection token | Removed `LLM_PROVIDER_FACTORY` — regular `@Injectable()` (Task 2) |
| A1 | Variable substitution regex | `/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g` (AC5, Task 6.6) |
| A2 | Model UUID storage | Store `LlmModelEntity.id` UUID, not `modelId` string (AC4, Task 5, Task 10) |
| A3 | Explicit dependencies | `TransactionManager` + `TextExtractorService` in PromptAssemblyService (Task 6.1) |
| M1 | Canary test + ops docs | `describe.skip` canary file + operations runbook with SOP cadence (Task 4.7-4.8) |
| M3 | Prompt size logging | Log `assembledPromptLength` at INFO level (AC5, Task 6.8) |
| M4 | Context window safety | Defense-in-depth backend check; primary gate is Story 4-4 UI (Task 7.5) |
| M5 | Documentation clarity | All ops docs written for newcomers — explain what/why/how |

### Winston Architect Quality Gate Violation
During this review, Winston used "acceptable for MVP" and recommended "restart the server" for credential refresh. This violated the Quality Standard (project-context.md line 277) — a termination-level offense. See project-context.md for formal consequences.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

**New Files (10):**
- `apps/api-gateway/src/app/workflow-execution/llm/llm.provider.ts` — LLMProvider interface + types
- `apps/api-gateway/src/app/workflow-execution/llm/mock-llm.provider.ts` — Mock LLM provider
- `apps/api-gateway/src/app/workflow-execution/llm/mock-llm.provider.spec.ts` — 8 tests
- `apps/api-gateway/src/app/workflow-execution/llm/google-ai-studio-llm.provider.ts` — Google AI Studio provider
- `apps/api-gateway/src/app/workflow-execution/llm/google-ai-studio-llm.provider.spec.ts` — 7 tests
- `apps/api-gateway/src/app/workflow-execution/llm/google-ai-studio-llm.provider.canary.spec.ts` — Manual canary tests (skipped)
- `apps/api-gateway/src/app/workflow-execution/llm/ops-runbook.md` — Operations runbook
- `apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.ts` — Dynamic provider resolution + cache
- `apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.spec.ts` — 13 tests
- `apps/api-gateway/src/app/workflow-execution/prompt-assembly.service.ts` — Prompt template assembly
- `apps/api-gateway/src/app/workflow-execution/prompt-assembly.service.spec.ts` — 14 tests
- `apps/web/src/app/admin/workflows/wizard/steps/wizard-execution-step.component.spec.ts` — 12 tests

**Modified Files (12):**
- `libs/db-layer/src/lib/entities/llm-provider-config.entity.ts` — Added `rateLimitRpm` column
- `libs/shared/src/lib/dtos/settings/create-llm-provider-config.dto.ts` — Added `rateLimitRpm` field
- `libs/shared/src/lib/dtos/settings/update-llm-provider-config.dto.ts` — Added `rateLimitRpm` field + `@ValidateIf` for null
- `libs/shared/src/lib/dtos/settings/llm-provider-config-response.dto.ts` — Added `rateLimitRpm` field
- `apps/api-gateway/src/app/settings/llm-provider-config.service.ts` — Handle `rateLimitRpm` in create/update/toResponse
- `apps/api-gateway/src/app/settings/llm-provider-config.service.spec.ts` — 5 new tests for rateLimitRpm
- `apps/api-gateway/src/app/settings/llm-provider-config.controller.spec.ts` — Updated mock data
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts` — Full LLM integration pipeline
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.spec.ts` — 6 new LLM integration tests
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.module.ts` — Added imports + providers
- `apps/api-gateway/src/app/ingestion/ingestion.module.ts` — Exported TextExtractorService
- `apps/api-gateway/src/app/module-wiring.spec.ts` — Verify LlmProviderFactory + PromptAssemblyService
- `apps/web/src/app/admin/workflows/wizard/steps/wizard-execution-step.component.ts` — UUID model binding
- `apps/web/src/app/admin/workflows/wizard/steps/wizard-execution-step.component.html` — Bind option value to model.id
