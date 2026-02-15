# Story 4-PR: Provider Registry — Backend-Driven Adapter Registry

Status: done

## Story

As a **platform operator (Bubble Admin)**,
I want **the LLM provider type registry to be backend-driven and self-describing**,
so that **adding a new LLM provider requires only a new adapter class — no frontend changes, no hardcoded constants, no manual sync between backend and frontend**.

## Context

The system currently has provider knowledge scattered across four hardcoded locations:

1. `apps/web/src/app/admin/settings/provider-constants.ts` — display names + dropdown options
2. `apps/api-gateway/src/app/common/provider-keys.ts` — `KNOWN_PROVIDER_KEYS` array
3. `apps/api-gateway/src/app/settings/llm-provider-config.service.ts` — `REQUIRED_CREDENTIAL_FIELDS` + `ENV_VAR_FALLBACKS` maps
4. `apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.ts` — `switch` statement in `buildProvider()`

Adding a new provider requires changes in all four files plus frontend awareness. This story collapses all provider metadata into **self-describing adapter classes** registered in a single `ProviderRegistry` service. The frontend fetches provider types from a new API endpoint.

**Origin**: Live Test Round 1 finding M3 (2026-02-12).

**Party mode review**: 2026-02-15 — 10 agents (Winston, Amelia, Murat, Mary, John, Sally, Bob, Naz, Paige, BMad Master). Unanimous on code-only registration (not DB-driven), mock as first-class adapter, scope separation from 4-GP, and `KNOWN_PROVIDER_KEYS` retained as static array validated by test.

## Key Decisions (from party mode)

- **Code-only registration** — providers are engineering work (SDK integration), not user-created. DB-driven registry adds complexity without value.
- **Mock is first-class** — registered in the same registry with `isDevelopmentOnly: true`. Same code path as real providers.
- **`KNOWN_PROVIDER_KEYS` retained** — static array validated by a registry completeness test (DTO validation pipeline runs before DI container). Source of truth = registry; static array = derived artifact.
- **4-GP separation** — `supportedGenerationParams` field included as optional in adapter interface (placeholder). NOT populated in 4-PR. Story 4-GP fills in actual param specs.
- **No DB migration** — no schema changes. Provider types are code, not data.
- **Dynamic credential form** — frontend renders credential fields from API response, not hardcoded. Password fields masked, text fields not. Form clears when provider type selection changes.
- **Ops documentation** — checklist for adding new providers as JSDoc on ProviderRegistry class. Pointer added to doc-4 story description.

## Acceptance Criteria

1. **AC1 — ProviderRegistry service**: `ProviderRegistry` injectable service exists, initialized at module startup (`onModuleInit`), contains a `Map<string, ProviderRegistryEntry>` of all known providers.

2. **AC2 — Self-describing adapters**: Each registered provider exposes: `providerKey`, `displayName`, `credentialSchema` (array of `{ key, label, type, required }`), `envVarFallbacks`, `isDevelopmentOnly`, and `createProvider(modelId, credentials)`.

3. **AC3 — Factory uses registry**: `LlmProviderFactory.buildProvider()` resolves providers via `registry.get(providerKey)` — the `switch` statement is removed. Same error behavior for unknown keys.

4. **AC4 — Service uses registry**: `LlmProviderConfigService` reads credential requirements from `registry.getCredentialSchema(providerKey)` and env var fallbacks from `registry.getEnvVarFallbacks(providerKey)`. The hardcoded `REQUIRED_CREDENTIAL_FIELDS` and `ENV_VAR_FALLBACKS` maps are deleted. Validation behavior is identical.

5. **AC5 — Provider types endpoint**: `GET /api/admin/settings/llm-provider-types` returns `ProviderTypeDto[]` with `providerKey`, `displayName`, `credentialFields`, `isDevelopmentOnly`. Guarded by `@Roles(BUBBLE_ADMIN)`.

6. **AC6 — Frontend dynamic**: `provider-constants.ts` is deleted. Provider dropdown and credential form fields in the admin settings UI are populated from the new API endpoint. Credential form dynamically renders fields per selected provider's `credentialSchema`. Password fields are masked. Form clears credential values when provider type selection changes.

7. **AC7 — Registry completeness test**: A unit test asserts that every entry in `KNOWN_PROVIDER_KEYS` has a matching registered adapter in the registry, and vice versa. Fails if they diverge.

## Tasks / Subtasks

- [x] Task 1: Define adapter interface + ProviderRegistry service + register adapters (AC: #1, #2)
  - [x] 1.1: Create `apps/api-gateway/src/app/workflow-execution/llm/provider-registry.interface.ts` — define `ProviderRegistryEntry`, `CredentialField`, and `GenerationParamSpec` (optional placeholder for 4-GP) interfaces
  - [x] 1.2: Create `apps/api-gateway/src/app/workflow-execution/llm/provider-registry.service.ts` — `@Injectable()` ProviderRegistry with `onModuleInit()` that builds `Map<string, ProviderRegistryEntry>`. Methods: `get(key)`, `getAll()`, `getKnownKeys()`, `getCredentialSchema(key)`, `getEnvVarFallbacks(key)`. JSDoc on class with ops checklist for adding new providers.
  - [x] 1.3: Create registry entries for `google-ai-studio` (credentialSchema: `[{ key: 'apiKey', label: 'API Key', type: 'password', required: true }]`, envVarFallbacks: `{ apiKey: 'GEMINI_API_KEY' }`, isDevelopmentOnly: false)
  - [x] 1.4: Create registry entry for `mock` (credentialSchema: `[]`, envVarFallbacks: `{}`, isDevelopmentOnly: true)
  - [x] 1.5: Create registry entries for `vertex` (placeholder — createProvider throws BadRequestException 'not yet implemented') and `openai` (same)
  - [x] 1.6: Register ProviderRegistry in `WorkflowExecutionModule` providers and exports
  - [x] 1.7: Unit tests: `provider-registry.service.spec.ts` — registry initializes with all providers, get() returns correct entries, get() returns undefined for unknown key, getKnownKeys() matches KNOWN_PROVIDER_KEYS

- [x] Task 2: Refactor LlmProviderFactory to use registry (AC: #3)
  - [x] 2.1: Inject `ProviderRegistry` into `LlmProviderFactory` constructor
  - [x] 2.2: Replace `buildProvider()` switch statement with `registry.get(providerKey).createProvider(modelId, credentials)`. Throw `BadRequestException` if registry returns undefined (same error message as current `default:` case).
  - [x] 2.3: Update `llm-provider.factory.spec.ts` — mock registry instead of testing switch cases. Verify same resolution behavior: google-ai-studio creates GoogleAIStudioLlmProvider, mock creates MockLlmProvider, vertex/openai throw, unknown throws. Verify cache still works.
  - [x] 2.4: Remove direct imports of `MockLlmProvider` and `GoogleAIStudioLlmProvider` from factory (they're now referenced only by their registry entries)

- [x] Task 3: Refactor LlmProviderConfigService to use registry (AC: #4)
  - [x] 3.1: Inject `ProviderRegistry` into `LlmProviderConfigService` constructor
  - [x] 3.2: Replace `REQUIRED_CREDENTIAL_FIELDS` map usage with `registry.getCredentialSchema(providerKey)`. Map `credentialSchema[].key` where `required === true` to get required field names. Same validation behavior.
  - [x] 3.3: Replace `ENV_VAR_FALLBACKS` map usage with `registry.getEnvVarFallbacks(providerKey)`. Same fallback behavior.
  - [x] 3.4: Delete the hardcoded `REQUIRED_CREDENTIAL_FIELDS` and `ENV_VAR_FALLBACKS` constants from the service
  - [x] 3.5: Update `LlmProviderConfigModule` (or wherever the service is provided) to import/inject `ProviderRegistry` from `WorkflowExecutionModule`
  - [x] 3.6: Update `llm-provider-config.service.spec.ts` — add mock `ProviderRegistry`, verify credential validation still works (required fields present → pass, missing → 400, extra fields → pass, empty string → 400). Verify env var fallback still works.

- [x] Task 4: New endpoint GET /api/admin/settings/llm-provider-types (AC: #5)
  - [x] 4.1: Create `ProviderTypeDto` in `libs/shared/src/lib/dtos/settings/provider-type.dto.ts` — `providerKey`, `displayName`, `credentialFields: CredentialFieldDto[]`, `isDevelopmentOnly`
  - [x] 4.2: Create `CredentialFieldDto` in same file — `key`, `label`, `type`, `required`
  - [x] 4.3: Add `getProviderTypes()` method to `LlmProviderConfigController` at `GET /api/admin/settings/llm-provider-types` — calls `registry.getAll()`, maps to `ProviderTypeDto[]`, returns sorted by displayName. `@Roles(BUBBLE_ADMIN)`.
  - [x] 4.4: Update controller spec — test endpoint returns correct shape, requires BUBBLE_ADMIN role
  - [x] 4.5: Registry completeness test — assert `KNOWN_PROVIDER_KEYS` matches `registry.getKnownKeys()` (bidirectional). Place in `provider-registry.service.spec.ts`.

- [x] Task 5: Frontend — delete constants, dynamic form, browser smoke test (AC: #6, #7)
  - [x] 5.1: Create `ProviderTypeService` in `apps/web/src/app/core/services/` — calls `GET /api/admin/settings/llm-provider-types`, caches result (shareReplay + signal). Method: `getProviderTypes(): Observable<ProviderTypeDto[]>`
  - [x] 5.2: Update provider config dialog component — replace hardcoded provider dropdown with API-driven list from `ProviderTypeService`. Replace hardcoded credential form fields with dynamic rendering from `credentialFields` array. Password-type fields use `type="password"` input. Text-type fields use `type="text"`. Required fields marked.
  - [x] 5.3: Add form reset behavior — when admin changes provider type selection in dropdown, clear all credential field values (prevent cross-provider credential carryover — Sally's feedback)
  - [x] 5.4: Delete `apps/web/src/app/admin/settings/provider-constants.ts`
  - [x] 5.5: Grep entire codebase for any remaining imports of `provider-constants` or `PROVIDER_DISPLAY_NAMES` or `PROVIDER_OPTIONS`. Remove all references.
  - [x] 5.6: Update existing component specs — mock `ProviderTypeService`, verify dropdown renders from API data, verify credential form renders dynamic fields
  - [x] 5.7: Browser smoke test — admin can navigate to LLM settings, see provider configs, open add dialog, select provider type, see correct credential fields, switch provider type and verify fields reset

## Dev Notes

### Architecture

- **Registry pattern**: `ProviderRegistry` is a plain `@Injectable()` service with `OnModuleInit`. Builds internal `Map<string, ProviderRegistryEntry>` from statically imported adapter entries. No decorator magic, no DI multi-providers — explicit and testable.
- **Adapter entries are NOT separate files**: Each entry is a plain object implementing `ProviderRegistryEntry` interface, created inline in `provider-registry.service.ts` (or a co-located `adapters/` subfolder if the file gets too long). The entry references the existing provider class (e.g., `GoogleAIStudioLlmProvider`).
- **No circular deps**: `ProviderRegistry` has ZERO deps on `LlmProviderConfigService` or `LlmProviderFactory`. Both depend on it (one-way).
- **Module dependency**: `LlmProviderConfigService` is in the settings module. It needs `ProviderRegistry` from the execution module. Export `ProviderRegistry` from `WorkflowExecutionModule`. The settings module imports it.

### Interface Shapes

```typescript
interface ProviderRegistryEntry {
  providerKey: string;
  displayName: string;
  credentialSchema: CredentialField[];
  envVarFallbacks: Record<string, string>;
  supportedGenerationParams?: GenerationParamSpec[]; // 4-GP placeholder
  isDevelopmentOnly: boolean;
  createProvider(modelId: string, credentials: Record<string, string>): LLMProvider;
}

interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password';
  required: boolean;
}

// Placeholder for Story 4-GP — do NOT populate in 4-PR
interface GenerationParamSpec {
  key: string;
  label: string;
  type: 'number' | 'string[]';
  min?: number;
  max?: number;
  default?: number;
  maxItems?: number;
}
```

### Files to Modify

| File | Action |
|:-----|:-------|
| `apps/api-gateway/src/app/workflow-execution/llm/provider-registry.interface.ts` | NEW — interfaces |
| `apps/api-gateway/src/app/workflow-execution/llm/provider-registry.service.ts` | NEW — registry service |
| `apps/api-gateway/src/app/workflow-execution/llm/provider-registry.service.spec.ts` | NEW — unit tests |
| `apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.ts` | MODIFY — replace switch with registry |
| `apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.spec.ts` | MODIFY — mock registry |
| `apps/api-gateway/src/app/workflow-execution/workflow-execution.module.ts` | MODIFY — register + export ProviderRegistry |
| `apps/api-gateway/src/app/settings/llm-provider-config.service.ts` | MODIFY — inject registry, delete hardcoded maps |
| `apps/api-gateway/src/app/settings/llm-provider-config.service.spec.ts` | MODIFY — mock registry |
| `apps/api-gateway/src/app/settings/llm-provider-config.controller.ts` | MODIFY — add getProviderTypes() endpoint |
| `apps/api-gateway/src/app/settings/llm-provider-config.controller.spec.ts` | MODIFY — test new endpoint |
| `libs/shared/src/lib/dtos/settings/provider-type.dto.ts` | NEW — ProviderTypeDto + CredentialFieldDto |
| `libs/shared/src/lib/dtos/settings/index.ts` | MODIFY — export new DTOs |
| `apps/web/src/app/admin/settings/provider-type.service.ts` | NEW — API service |
| `apps/web/src/app/admin/settings/llm/` (provider config dialog) | MODIFY — dynamic form |
| `apps/web/src/app/admin/settings/provider-constants.ts` | DELETE |

### Key Patterns to Follow

- **Rule 2 (RLS)**: Not applicable — no tenant-scoped entities touched. Provider registry is system-wide.
- **Rule 1 (Shared Brain)**: New DTOs (`ProviderTypeDto`, `CredentialFieldDto`) go in `libs/shared/`.
- **Zoneless Angular testing**: Use `async/await` + `fixture.whenStable()`, NOT `fakeAsync/tick`.
- **Lucide icons**: If any new icons needed, register in `app.config.ts`.
- **`KNOWN_PROVIDER_KEYS`** in `provider-keys.ts`: Keep as-is. Add registry completeness test to enforce sync.
- **Browser smoke test required** (Rule 26).

### Naz Pre-Flags (Pass 2 Awareness)

1. Dead code: After deleting `provider-constants.ts`, grep for residual imports/references
2. Completeness test: `KNOWN_PROVIDER_KEYS === registry.getKnownKeys()` test MUST exist
3. Validation behavior parity: Credential validation after refactor must produce identical error messages and edge case behavior
4. Placeholder tests: `vertex` and `openai` adapters throwing "not yet implemented" must be tested

### Out-of-Scope

| Item | Tracked In |
|:-----|:-----------|
| Generation parameter specs populated per provider | Story 4-GP |
| Vertex AI adapter implementation | Future epic (when customer requests) |
| OpenAI adapter implementation | Future epic (when customer requests) |
| Provider type visibility toggle (hide from dropdown) | Not planned — `isActive` on LlmProviderConfigEntity handles this |
| Ops runbook section for adding new providers | Story doc-4-operations-runbook |

### References

- [Source: provider-constants.ts](apps/web/src/app/admin/settings/provider-constants.ts) — to be deleted
- [Source: provider-keys.ts](apps/api-gateway/src/app/common/provider-keys.ts) — KNOWN_PROVIDER_KEYS
- [Source: llm-provider.factory.ts](apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.ts) — switch statement to replace
- [Source: llm-provider-config.service.ts](apps/api-gateway/src/app/settings/llm-provider-config.service.ts) — hardcoded maps to replace
- [Source: llm.provider.ts](apps/api-gateway/src/app/workflow-execution/llm/llm.provider.ts) — LLMProvider interface (unchanged)
- [Source: mock-llm.provider.ts](apps/api-gateway/src/app/workflow-execution/llm/mock-llm.provider.ts) — MockLlmProvider (unchanged)
- [Source: google-ai-studio-llm.provider.ts](apps/api-gateway/src/app/workflow-execution/llm/google-ai-studio-llm.provider.ts) — GoogleAIStudioLlmProvider (unchanged)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (Amelia)

### Debug Log References
- Smoke test 1: Provider group headers showed raw keys (e.g., `google-ai-studio`) instead of display names — list components called `getDisplayName()` before `ProviderTypeService` had fetched data. Fixed by adding eager `getProviderTypes()` subscription in both list component constructors.
- Circular dependency between `SettingsModule` and `WorkflowExecutionModule` — resolved with `forwardRef()` on both sides.
- `settings.component.spec.ts` failed after Task 5 — child components inject `ProviderTypeService` which makes real HTTP call in tests. Fixed by adding mock to TestBed providers.

### Completion Notes List
- All 5 tasks complete. 1400 total tests passing (28 new tests from this story).
- `provider-constants.ts` deleted. Zero remaining references.
- Browser smoke test verified: All 4 provider types render with correct display names, credential fields change dynamically per provider selection, mock provider shows "no credentials" info banner.
- `ProviderTypeService` placed in `apps/web/src/app/core/services/` (root-level service, not settings-scoped) since it's used by both settings list components and form dialogs.
- Pass 1 review fixes: (1) Route ordering, (2) Extracted `ProviderRegistryModule` — eliminates `forwardRef` circular dependency, (3) Centralized eager provider type loading in `SettingsComponent`, (4) Added error handling + retry to `ProviderTypeService`, (5) Replaced `KNOWN_PROVIDER_KEYS` runtime usage with registry in both services, (6) Added `[value]` binding to credential inputs, (7) Added wiring test `[4-PR-MW-001]`.
- Pass 2 review (Naz): 6 findings (H1 cache poisoning, M1 stale JSDoc, M2 double-init guard, M3 missing rateLimitRpm, L1 JSDoc clarity, L2 traceability table) — all fixed.
- Pass 3 review (Murat): 4 findings (M-P3-1 test ID collision, L-P3-1 missing rateLimitRpm in form dialog spec, L-P3-2 no dedicated ProviderTypeService spec, L-P3-3 dead loadError signal) — all fixed. +5 new tests in `provider-type.service.spec.ts`, +1 double-init guard test.

### Change Log

| # | Action | File |
|:--|:-------|:-----|
| 1 | NEW | `apps/api-gateway/src/app/workflow-execution/llm/provider-registry.interface.ts` |
| 2 | NEW | `apps/api-gateway/src/app/workflow-execution/llm/provider-registry.service.ts` |
| 3 | NEW | `apps/api-gateway/src/app/workflow-execution/llm/provider-registry.service.spec.ts` |
| 4 | NEW | `apps/api-gateway/src/app/workflow-execution/llm/provider-registry.module.ts` |
| 5 | MODIFY | `apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.ts` |
| 6 | MODIFY | `apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.spec.ts` |
| 7 | MODIFY | `apps/api-gateway/src/app/workflow-execution/workflow-execution.module.ts` |
| 8 | MODIFY | `apps/api-gateway/src/app/settings/llm-provider-config.service.ts` |
| 9 | MODIFY | `apps/api-gateway/src/app/settings/llm-provider-config.service.spec.ts` |
| 10 | MODIFY | `apps/api-gateway/src/app/settings/llm-provider-config.controller.ts` |
| 11 | MODIFY | `apps/api-gateway/src/app/settings/llm-provider-config.controller.spec.ts` |
| 12 | MODIFY | `apps/api-gateway/src/app/settings/settings.module.ts` |
| 13 | MODIFY | `apps/api-gateway/src/app/workflows/workflows.module.ts` |
| 14 | MODIFY | `apps/api-gateway/src/app/workflows/llm-models.service.ts` |
| 15 | MODIFY | `apps/api-gateway/src/app/workflows/llm-models.service.spec.ts` |
| 16 | MODIFY | `apps/api-gateway/src/app/module-wiring.spec.ts` |
| 17 | NEW | `libs/shared/src/lib/dtos/settings/provider-type.dto.ts` |
| 18 | MODIFY | `libs/shared/src/lib/dtos/settings/index.ts` |
| 19 | NEW | `apps/web/src/app/core/services/provider-type.service.ts` |
| 20 | MODIFY | `apps/web/src/app/admin/settings/settings.component.ts` |
| 21 | MODIFY | `apps/web/src/app/admin/settings/provider-config-form-dialog.component.ts` |
| 22 | MODIFY | `apps/web/src/app/admin/settings/provider-config-form-dialog.component.html` |
| 23 | MODIFY | `apps/web/src/app/admin/settings/provider-config-form-dialog.component.spec.ts` |
| 24 | MODIFY | `apps/web/src/app/admin/settings/provider-config-list.component.ts` |
| 25 | MODIFY | `apps/web/src/app/admin/settings/provider-config-list.component.spec.ts` |
| 26 | MODIFY | `apps/web/src/app/admin/settings/llm-models-list.component.ts` |
| 27 | MODIFY | `apps/web/src/app/admin/settings/llm-models-list.component.spec.ts` |
| 28 | MODIFY | `apps/web/src/app/admin/settings/llm-model-form-dialog.component.ts` |
| 29 | MODIFY | `apps/web/src/app/admin/settings/llm-model-form-dialog.component.html` |
| 30 | MODIFY | `apps/web/src/app/admin/settings/llm-model-form-dialog.component.spec.ts` |
| 31 | MODIFY | `apps/web/src/app/admin/settings/settings.component.spec.ts` |
| 32 | DELETE | `apps/web/src/app/admin/settings/provider-constants.ts` |
| 33 | NEW | `apps/web/src/app/core/services/provider-type.service.spec.ts` |

### AC-to-Test Traceability

| AC | Test ID | Description | File |
|:---|:--------|:------------|:-----|
| AC1 | 4-PR-UNIT-001 | Registry registers all known providers on init | `provider-registry.service.spec.ts` |
| AC1 | 4-PR-UNIT-019 | Double onModuleInit is idempotent | `provider-registry.service.spec.ts` |
| AC2 | 4-PR-UNIT-003 | google-ai-studio entry self-describes | `provider-registry.service.spec.ts` |
| AC2 | 4-PR-UNIT-004 | mock entry self-describes | `provider-registry.service.spec.ts` |
| AC2 | 4-PR-UNIT-007 | Credential schema returned for google-ai-studio | `provider-registry.service.spec.ts` |
| AC2 | 4-PR-UNIT-010 | Credential schema returned for vertex | `provider-registry.service.spec.ts` |
| AC2 | 4-PR-UNIT-011 | Env var fallbacks returned for google-ai-studio | `provider-registry.service.spec.ts` |
| AC2 | 4-PR-UNIT-014 | Mock provider created via registry | `provider-registry.service.spec.ts` |
| AC2 | 4-PR-UNIT-015 | Google AI Studio provider created via registry | `provider-registry.service.spec.ts` |
| AC3 | 4-PR-UNIT-F01–F12 | Factory resolves via registry, cache, errors | `llm-provider.factory.spec.ts` |
| AC4 | 4-PR-UNIT-C01–C10 | Config service uses registry for cred validation + env fallback | `llm-provider-config.service.spec.ts` |
| AC5 | 4-PR-UNIT-CT01–CT03 | Controller getProviderTypes endpoint returns correct shape | `llm-provider-config.controller.spec.ts` |
| AC6 | 3.1-4-UNIT-041–052 | Config list + form dialogs render from API data | `provider-config-list.component.spec.ts`, `provider-config-form-dialog.component.spec.ts` |
| AC6 | 3.1-4-UNIT-030–040 | Model form + list use ProviderTypeService | `llm-model-form-dialog.component.spec.ts`, `llm-models-list.component.spec.ts` |
| AC7 | 4-PR-UNIT-002 | KNOWN_PROVIDER_KEYS matches registry (bidirectional) | `provider-registry.service.spec.ts` |
| AC7 | 4-PR-MW-001 | ProviderRegistryModule wiring test | `module-wiring.spec.ts` |
| AC6 | 4-PR-UNIT-PTS01–PTS05 | ProviderTypeService: fetch, cache, error recovery, getDisplayName | `provider-type.service.spec.ts` |

### File List
33 files (7 new, 25 modified, 1 deleted)
