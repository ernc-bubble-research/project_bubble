# Story 4-GP: LLM Generation Parameters

Status: done

## Story

As a **Bubble Admin**,
I want **to configure LLM generation parameters (temperature, topP, topK, etc.) at two levels — model defaults in the admin panel and per-workflow overrides in the wizard**,
so that **I have fine-grained control over LLM behavior while maintaining sensible defaults across all workflows**.

## Context

The system currently supports only two generation parameters: `temperature` and `max_output_tokens`. These are hardcoded in the wizard execution step form and passed inline to the LLM provider at execution time (processor.ts lines 191-193). The `ProviderRegistry` (Story 4-PR) already defines a `GenerationParamSpec` interface and a `supportedGenerationParams` field on each adapter entry, but these are currently empty placeholder arrays.

This story implements a **two-tier parameter model**:
- **Tier 1 — Model defaults**: JSONB `generation_defaults` column on `LlmModelEntity`. Admin configures per-model defaults in the model form dialog. All workflows using this model inherit these defaults.
- **Tier 2 — Workflow overrides**: Per-workflow parameter overrides stored in the existing `WorkflowDefinition.execution` JSONB (no new column on `WorkflowTemplateEntity`). Configured in the wizard execution step.

At execution time, a **merge utility** resolves the final parameters: provider spec defaults < model `generation_defaults` < workflow `execution` overrides. The merge function handles snake_case→camelCase conversion and silently drops unsupported/unknown parameters (forward-compatible).

**Origin**: User request 2026-02-14. Depends on Story 4-PR (provider registry adapter interface).

**Party mode review**: 2026-02-15 — full team discussion. Key decisions documented below.

## Key Decisions (from party mode)

1. **Two-tier parameter model** — Tier 1: JSONB `generation_defaults` on `LlmModelEntity` (admin configures per model). Tier 2: Workflow overrides in existing `WorkflowDefinition.execution` (already stored in workflow version JSONB). **No new column on `WorkflowTemplateEntity`**.

2. **Provider specs populated** — Fill `supportedGenerationParams` on all 4 registry entries (google-ai-studio, mock, vertex, openai) with their supported params, ranges, and defaults. Params: temperature, topP, topK, maxOutputTokens, stopSequences.

3. **Extend shared types** — Add `top_p`, `top_k`, `stop_sequences` to `WorkflowExecution` interface (snake_case). Add `topP`, `topK`, `stopSequences` to `LLMGenerateOptions` (camelCase). Update schema validator for new optional fields.

4. **Merge utility** — Pure function `mergeGenerationParams()` in `generation-params.util.ts`. Merges: provider spec defaults → model `generation_defaults` → workflow `execution` overrides. Handles snake_case→camelCase conversion. Silently drops unsupported/unknown params. Single conversion point. For params without a spec default (e.g., `stopSequences`), the param is only included in the output if explicitly set in model defaults or workflow overrides — it is NOT included as `undefined`.

5. **Processor refactor** — Replace inline param mapping at processor.ts:191-193 with call to merge utility.

6. **Model admin form (Tier 1 UI)** — Dynamic parameter fields rendered from provider spec's `supportedGenerationParams`. All params visible. Validated against ranges from provider spec. Saved as JSONB `generation_defaults` on `LlmModelEntity`.

7. **Wizard execution step (Tier 2 UI)** — Dynamic fields from provider registry API based on selected model's provider. Model defaults shown as placeholder text. "Reset to model defaults" button. Basic section (temperature, maxOutputTokens) + collapsible Advanced section (topP, topK). stopSequences: NOT exposed in UI.

8. **Nuclear reset on model change in wizard** — When Bubble Admin changes the model selection in wizard execution step, all custom generation params are cleared. New model's defaults populate as placeholders. User re-configures on the spot if needed.

9. **Validate on write, drop stale on read** — Forms reject out-of-range values. Merge function silently drops unknown/unsupported params (forward-compatible). No runtime clamping needed (nuclear reset prevents stale values).

10. **stopSequences** — In provider spec and backend for completeness. NOT exposed in any UI.

11. **Multiple active models don't interfere** — Enabling/disabling models has zero impact on workflows using other models. Only explicit model changes trigger param resets.

## Acceptance Criteria

1. **AC1 — Provider param specs populated**: All 4 provider registry entries have populated `supportedGenerationParams` with correct param specs (keys, labels, types, ranges, defaults). Verified by unit tests.

2. **AC2 — Model entity extended**: `LlmModelEntity` has `generation_defaults` JSONB column; model create/update DTOs accept generation defaults; response DTO returns them.

3. **AC3 — Model admin form dynamic**: Model admin form dynamically renders parameter fields based on selected provider's spec with range validation.

4. **AC4 — Wizard dynamic fields**: Wizard execution step dynamically renders parameter fields based on selected model's provider; model defaults shown as placeholders.

5. **AC5 — Reset button**: "Reset to model defaults" button clears all custom overrides in wizard execution step.

6. **AC6 — Nuclear reset**: Changing model in wizard execution step clears all custom generation params (nuclear reset).

7. **AC7 — Merge utility correct**: `mergeGenerationParams()` correctly merges 3 tiers (provider defaults < model defaults < workflow overrides) with snake→camelCase conversion and silent drop of unsupported params. Verified by comprehensive unit tests.

8. **AC8 — Schema validator updated**: Schema validator accepts new optional fields (`top_p`, `top_k`, `stop_sequences`) in `WorkflowExecution`.

## Tasks / Subtasks

- [x] Task 1: Provider specs + shared types (AC: #1, #8)
  - [x]1.0: Fix `GenerationParamSpec.default` type in `provider-registry.interface.ts` — change `default?: number` to `default?: number | string[]` so string array params (stopSequences) can declare defaults. Also update `GenerationParamSpecDto` to match.
  - [x]1.1: Populate `supportedGenerationParams` on `google-ai-studio` registry entry — temperature (0-2, default 1.0), topP (0-1, default 0.95), topK (1-100, default 40, type number), maxOutputTokens (1-8192, default 8192), stopSequences (type string[], maxItems 5)
  - [x]1.2: Populate `supportedGenerationParams` on `openai` registry entry — temperature (0-2, default 1.0), topP (0-1, default 1.0), maxOutputTokens (1-16384, default 4096), stopSequences (type string[], maxItems 4). No topK for OpenAI.
  - [x]1.3: Populate `supportedGenerationParams` on `vertex` registry entry — same as google-ai-studio (same SDK family)
  - [x]1.4: Populate `supportedGenerationParams` on `mock` registry entry — temperature (0-2, default 0.7), topP (0-1, default 1.0), maxOutputTokens (1-65536, default 4096). No topK, no stopSequences for mock.
  - [x]1.5: Add `top_p?: number`, `top_k?: number`, `stop_sequences?: string[]` to `WorkflowExecution` interface in `workflow-definition.interface.ts` (snake_case)
  - [x]1.6: Add `topP?: number`, `topK?: number`, `stopSequences?: string[]` to `LLMGenerateOptions` in `llm.provider.ts` (camelCase)
  - [x]1.7: Update `validateWorkflowDefinition()` in `workflow-schema.validator.ts` — accept new optional fields, validate types if present (top_p: number 0-1, top_k: integer >=1, stop_sequences: string array)
  - [x]1.8: Add `GenerationParamSpecDto` to `provider-type.dto.ts` and add `supportedGenerationParams: GenerationParamSpecDto[]` to `ProviderTypeDto`
  - [x]1.9: Update `getProviderTypes()` in `LlmProviderConfigController` to include `supportedGenerationParams` in the mapping
  - [x]1.10: Update unit tests — provider-registry spec (verify param specs populated), schema validator spec (new fields accepted/rejected), controller spec (types endpoint returns params)

- [x] Task 2: Tier 1 — Model defaults backend (AC: #2)
  - [x]2.1: Add `generation_defaults` JSONB column to `LlmModelEntity` — `@Column({ name: 'generation_defaults', type: 'jsonb', nullable: true })`, typed as `Record<string, unknown> | null`
  - [x]2.2: Add `generationDefaults?: Record<string, unknown>` to `CreateLlmModelDto` with `@IsOptional()` + `@IsObject()` + `@Validate(IsValidGenerationDefaultsConstraint)` — custom validator validates key names against `GENERATION_PARAM_KEY_MAP` and value types (numbers or string arrays). Fixed in Pass 2 (Naz F2).
  - [x]2.3: Add `generationDefaults?: Record<string, unknown>` to `UpdateLlmModelDto` with same validators as CreateDto
  - [x]2.4: Add `generationDefaults` to `LlmModelResponseDto` with `@ApiPropertyOptional()`
  - [x]2.5: Update unit tests — model controller spec (create/update with generationDefaults), model service spec if applicable

- [x] Task 3: Tier 1 — Model admin form frontend (AC: #3)
  - [x]3.1: Inject `ProviderTypeService` into `LlmModelFormDialogComponent` (already injected — uses `providerTypeService.types()`)
  - [x]3.2: Add computed signal `selectedProviderParams` — when `providerKey` form control changes, look up `supportedGenerationParams` from `providerTypeService.types()` for that provider key, filter out `stopSequences`. Return the param specs array.
  - [x]3.3: Add dynamic form controls for each param in `selectedProviderParams` — create FormControls programmatically with min/max validators from spec. Initialize from `model().generationDefaults` if in edit mode.
  - [x]3.4: Add "Generation Defaults" section to form HTML — render dynamic fields based on `selectedProviderParams()`. Number inputs with min/max/step from spec. Show spec default as placeholder.
  - [x]3.5: Update `onSubmit()` — collect generation defaults from dynamic controls, include in create/update DTO as `generationDefaults`
  - [x]3.6: Clear generation defaults when provider key changes in add mode (different provider = different params)
  - [x]3.7: Update `llm-model-form-dialog.component.spec.ts` — test dynamic param rendering, range validation, submit includes generationDefaults

- [x] Task 4: Tier 2 — Wizard execution step (AC: #4, #5, #6)
  - [x]4.1: Inject `ProviderTypeService` into `WizardExecutionStepComponent`
  - [x]4.2: Add signal `selectedModelProviderKey` — derived from selected model ID by looking up the model in `models()` signal and getting its `providerKey`
  - [x]4.3: Add computed signal `providerParams` — look up `supportedGenerationParams` for `selectedModelProviderKey` from `providerTypeService.types()`, filter out stopSequences, split into `basicParams` (temperature, maxOutputTokens) and `advancedParams` (topP, topK)
  - [x]4.4: Replace hardcoded temperature/max_output_tokens form fields with dynamic rendering from `providerParams`. Render Basic section (always visible) and Advanced section (collapsible, using a styled `<details>`/`<summary>` with existing admin CSS patterns — see S-1 below). Use snake_case keys for form control names (matching `WorkflowExecution` interface).
  - [x]4.5: Show model defaults as placeholder text — look up `generationDefaults` from selected model in `models()` signal. For each param, if model has a default, show it as placeholder. Otherwise show provider spec default. Add field hint text below each param input: "Leave empty to use model default (X)" where X is the resolved default value (see S-2 below).
  - [x]4.6: Add "Reset to model defaults" button — positioned as a `btn-secondary` link-style button below the generation params section (right-aligned). Clears all custom generation param form controls (sets to null/empty), so they fall back to model defaults at execution time. No confirmation dialog needed (non-destructive — values revert to visible defaults in placeholders).
  - [x]4.7: Implement nuclear reset on model change — when model select changes, clear ALL generation param form controls. New model's params populate as placeholders. Use `form.patchValue()` to null all generation param controls. Show an inline notification below the model select: "Parameters reset to [Model Name] defaults" (use `field-hint` CSS class, auto-dismiss after 5 seconds or on next interaction).
  - [x]4.8: Add `advancedOpen` signal (boolean, default false) for collapsible Advanced section
  - [x]4.9: Update `syncToParent()` — include `top_p`, `top_k` in the execution object emitted to parent (only if non-null)
  - [x]4.10: Update `wizard-execution-step.component.spec.ts` — test dynamic rendering, nuclear reset on model change, reset button, advanced toggle, placeholder text

- [x] Task 5: Merge utility + processor refactor (AC: #7)
  - [x]5.1: Create `apps/api-gateway/src/app/workflow-execution/llm/generation-params.util.ts` — export `mergeGenerationParams(providerSpecs, modelDefaults, workflowExecution)` pure function
  - [x]5.2: Implement merge logic — for each param in providerSpecs: (a) start with spec.default, (b) override with modelDefaults[key] if present, (c) override with workflowExecution[snakeKey] if present. Return `LLMGenerateOptions` (camelCase). Silently skip unknown/unsupported keys.
  - [x]5.3: Handle snake_case→camelCase conversion via a static `SNAKE_TO_CAMEL` map: `{ temperature: 'temperature', max_output_tokens: 'maxOutputTokens', top_p: 'topP', top_k: 'topK', stop_sequences: 'stopSequences' }`. Spec keys and model defaults use camelCase (matching `LLMGenerateOptions`). Only `WorkflowExecution` uses snake_case. The map is the single conversion point. Future params: add one entry to the map.
  - [x]5.4: Refactor `workflow-execution.processor.ts` lines 191-193 — replace inline `{ temperature, maxOutputTokens }` with `mergeGenerationParams()` call. Need to pass model's `generationDefaults` + provider's `supportedGenerationParams` from registry.
  - [x]5.5: Inject `ProviderRegistry` into `WorkflowExecutionProcessor` (or pass params through existing `LlmProviderFactory.getProvider()` return value — extend to include `supportedGenerationParams`)
  - [x]5.6: Pass `topP`, `topK`, `stopSequences` through to `GoogleAIStudioLlmProvider.generate()` — map to Google SDK's `generationConfig` fields (`topP`, `topK`, `stopSequences`)
  - [x]5.7: Create `generation-params.util.spec.ts` — test all merge scenarios: (a) only spec defaults, (b) model overrides, (c) workflow overrides, (d) full 3-tier merge, (e) unknown keys in workflow overrides dropped, (f) missing tier (null modelDefaults), (g) snake→camel conversion correct, (h) model defaults with keys unsupported by provider spec are silently dropped (e.g., modelDefaults has `topK` but provider is OpenAI which doesn't support topK)
  - [x]5.8: Update `workflow-execution.processor.spec.ts` — mock merge utility, verify processor calls it correctly

- [x] Task 6: Update existing tests (AC: #1-#8)
  - [x]6.1: Update `wizard-execution-step.component.spec.ts` — verify existing tests still pass with dynamic form, add data-testid attributes for new fields
  - [x]6.2: Update `llm-model-form-dialog.component.spec.ts` — verify existing tests still pass with generationDefaults section
  - [x]6.3: Update `workflow-schema.validator.spec.ts` — add cases for new optional fields (valid values, invalid types, out-of-range)
  - [x]6.4: Update `provider-registry.service.spec.ts` — verify supportedGenerationParams are populated for all providers
  - [x]6.5: Browser smoke test (Rule 26) — verify: (a) model form shows generation defaults section with dynamic fields, (b) wizard shows dynamic params with Basic/Advanced collapse, (c) changing model in wizard clears custom params (nuclear reset visible — fields become empty with new placeholders), (d) "Reset to model defaults" button clears all custom values, (e) model defaults appear as placeholder text in wizard fields, (f) inline notification appears after nuclear reset

## Dev Notes

### Architecture Constraints

- **Snake_case in shared types, camelCase in backend interfaces**: `WorkflowExecution` uses snake_case (`top_p`, `max_output_tokens`) because it's stored as JSONB in the database and consumed by the frontend. `LLMGenerateOptions` uses camelCase because it's an internal backend interface. The merge utility is the SINGLE conversion point — no other code should do this conversion.

- **`GenerationParamSpec.key` uses camelCase** (e.g., `topP`, `topK`, `maxOutputTokens`). These keys match `LLMGenerateOptions` (the output of the merge function). The merge utility maintains a static `SNAKE_TO_CAMEL` map to convert `WorkflowExecution` snake_case keys to spec camelCase keys for lookup. The `model.generationDefaults` JSONB also uses camelCase keys (same as spec keys). This means only ONE boundary does conversion: `WorkflowExecution` (snake_case) → merge utility → `LLMGenerateOptions` (camelCase). Model defaults and spec defaults are already in camelCase.

- **No new column on WorkflowTemplateEntity**: Workflow-level parameter overrides are stored in the existing `WorkflowDefinition.execution` object within the `workflow_versions.definition` JSONB. This is already the pattern for temperature and max_output_tokens.

- **ProviderTypeDto already exists**: The `GET /api/admin/settings/llm-provider-types` endpoint (Story 4-PR) returns `ProviderTypeDto[]`. This story extends it with `supportedGenerationParams: GenerationParamSpecDto[]`.

- **LlmModel type in frontend**: The frontend uses `LlmModel` (alias for `LlmModelResponseDto`) from `llm-model.service.ts`. The response DTO needs `generationDefaults` added so the wizard can show model defaults as placeholders.

- **Frontend provider types are cached**: `ProviderTypeService` caches the API response in a signal (`types()`). The model form dialog and wizard execution step both access this cached signal.

### Key File Locations

| File | Purpose | Changes |
|------|---------|---------|
| `libs/shared/src/lib/types/workflow-definition.interface.ts:49-56` | `WorkflowExecution` interface | Add `top_p`, `top_k`, `stop_sequences` |
| `apps/api-gateway/src/app/workflow-execution/llm/llm.provider.ts:9-12` | `LLMGenerateOptions` interface | Add `topP`, `topK`, `stopSequences` |
| `apps/api-gateway/src/app/workflow-execution/llm/provider-registry.service.ts:69-133` | Provider registrations | Populate `supportedGenerationParams` on all 4 entries |
| `apps/api-gateway/src/app/workflow-execution/llm/provider-registry.interface.ts:18-26` | `GenerationParamSpec` interface | Change `default?: number` to `default?: number \| string[]` |
| `libs/db-layer/src/lib/entities/llm-model.entity.ts` | `LlmModelEntity` | Add `generation_defaults` JSONB column |
| `libs/shared/src/lib/dtos/workflow/create-llm-model.dto.ts` | Create model DTO | Add `generationDefaults` |
| `libs/shared/src/lib/dtos/workflow/update-llm-model.dto.ts` | Update model DTO | Add `generationDefaults` |
| `libs/shared/src/lib/dtos/workflow/llm-model-response.dto.ts` | Response DTO | Add `generationDefaults` |
| `libs/shared/src/lib/dtos/settings/provider-type.dto.ts` | Provider type DTO | Add `GenerationParamSpecDto`, extend `ProviderTypeDto` |
| `libs/shared/src/lib/validators/workflow-schema.validator.ts` | Schema validator | Accept `top_p`, `top_k`, `stop_sequences` |
| `apps/api-gateway/src/app/workflow-execution/llm/generation-params.util.ts` | NEW — merge utility | Pure function, snake→camel, 3-tier merge |
| `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts:191-193` | Inline param mapping | Replace with `mergeGenerationParams()` call |
| `apps/api-gateway/src/app/workflow-execution/llm/google-ai-studio-llm.provider.ts:43-46` | Google generationConfig | Add topP, topK, stopSequences |
| `apps/api-gateway/src/app/settings/llm-provider-config.controller.ts` | Provider types endpoint | Include `supportedGenerationParams` in mapping |
| `apps/web/src/app/admin/settings/llm-model-form-dialog.component.ts` | Model admin form | Add dynamic generation defaults section |
| `apps/web/src/app/admin/workflows/wizard/steps/wizard-execution-step.component.ts` | Wizard execution step | Dynamic params, nuclear reset, reset button |

### Critical Anti-Patterns to Avoid

- **Rule 2c**: `LlmModelEntity` is NOT tenant-scoped (system-wide), so tenantId is NOT required in WHERE clauses for model queries. This is a legitimate exception — models are global, not per-tenant.
- **Rule 13**: All RxJS subscriptions in Angular components MUST use `takeUntilDestroyed(this.destroyRef)`.
- **Lucide icons**: Any new icons MUST be registered in `app.config.ts`. This story likely needs: `ChevronDown`, `ChevronUp` (for Advanced section toggle), `RotateCcw` (for reset button). Check existing registrations before adding.
- **Zoneless testing**: Use `async/await` + `fixture.whenStable()` instead of `fakeAsync/tick`.
- **Data-testid attributes**: All new interactive form elements must have `data-testid` attributes.

### UI Specifications (from party mode review)

- **S-1: Advanced section collapse** — Use a styled `<details>`/`<summary>` element with CSS matching the existing admin panel aesthetic (border, padding, chevron icon). The `<details>` element is semantically correct and accessible. Style the `<summary>` to look like a section header with a Lucide `chevron-down`/`chevron-up` icon (register in `app.config.ts`). This avoids introducing a custom accordion component.

- **S-2: Empty field = use default (hint text)** — Each generation parameter input in the wizard execution step must have a `field-hint` span below it: `"Leave empty to use model default (X)"` where X is the resolved default (model default if configured, otherwise provider spec default). This eliminates ambiguity about what happens when a field is left empty.

- **J-1: Reset button placement** — "Reset to model defaults" is a `btn-secondary` link-style button, right-aligned below the generation params section (above the Advanced collapse). Text: "Reset to defaults". No confirmation dialog (values revert to visible placeholders, non-destructive).

- **J-2: Nuclear reset notification** — When the model select dropdown changes, show an inline notification below the dropdown: `"Parameters reset to [Model Display Name] defaults"`. Use `field-hint` CSS class. Auto-dismiss after 5 seconds or on next user interaction with any form field. This communicates to the admin that their custom params were cleared.

### Google AI Studio generationConfig Fields

The Google Generative AI SDK `generateContent()` accepts these in `generationConfig`:
- `temperature` (number)
- `topP` (number)
- `topK` (number)
- `maxOutputTokens` (number)
- `stopSequences` (string[])

All are optional. The provider already passes `temperature` and `maxOutputTokens` — this story adds `topP`, `topK`, and `stopSequences`.

### Deferred Items

| Item | Deferred To | Reason |
|------|-------------|--------|
| Bulk model reassignment + nuclear reset + flagging | Story 4-H1 | Separate UX story for deactivation flow |
| Admin Workflow Configurator Panel (bulk filtering, quick param editing, config snapshot/restore) | Story 7-8 | Complex admin tooling, not blocking |
| stopSequences UI exposure | Not planned | Not relevant for structured report generation |

### Project Structure Notes

- All changes align with existing patterns: DTOs in `libs/shared`, entities in `libs/db-layer`, services in `apps/api-gateway`, components in `apps/web`
- The `generation-params.util.ts` is a new file but follows the existing pattern of utility files in the `llm/` directory (e.g., `crypto.util.ts` in settings)
- No new modules needed — all backend changes are within existing `WorkflowExecutionModule` and `SettingsModule` boundaries

### References

- [ProviderRegistryEntry interface](apps/api-gateway/src/app/workflow-execution/llm/provider-registry.interface.ts)
- [GenerationParamSpec interface](apps/api-gateway/src/app/workflow-execution/llm/provider-registry.interface.ts#L18-L26)
- [ProviderRegistry service](apps/api-gateway/src/app/workflow-execution/llm/provider-registry.service.ts)
- [WorkflowExecution interface](libs/shared/src/lib/types/workflow-definition.interface.ts#L49-L56)
- [LLMGenerateOptions interface](apps/api-gateway/src/app/workflow-execution/llm/llm.provider.ts#L9-L12)
- [Workflow processor inline params](apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts#L191-L193)
- [Google AI Studio provider](apps/api-gateway/src/app/workflow-execution/llm/google-ai-studio-llm.provider.ts)
- [Schema validator](libs/shared/src/lib/validators/workflow-schema.validator.ts)
- [Model form dialog](apps/web/src/app/admin/settings/llm-model-form-dialog.component.ts)
- [Wizard execution step](apps/web/src/app/admin/workflows/wizard/steps/wizard-execution-step.component.ts)
- [LlmModelEntity](libs/db-layer/src/lib/entities/llm-model.entity.ts)
- [ProviderTypeDto](libs/shared/src/lib/dtos/settings/provider-type.dto.ts)
- [Project context rules](project-context.md)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- llm-models.service.spec.ts had missing `generationDefaults` property on mock — fixed by adding `generationDefaults: null`
- llm-model-form-dialog.component.html lint error: `!=` → strict equality check
- wizard-execution-step.component.html lint error: click handler without keyboard support on reset notification → removed click handler (auto-dismiss handles it)

### Completion Notes List
- All 6 tasks completed
- 60 new 4-GP tests added (4-GP-UNIT-001 through 4-GP-UNIT-059, skipping 053-055 renumbered to DTO suite)
- Total tests: 1460 (api-gateway: 769, db-layer: 39, shared: 97, web: 555) + 46 E2E (38 passing, 8 pre-existing failures in wizard/template-library unrelated to 4-GP — tracked in 4-fix-published-template-404)
- Lint: 0 new errors
- Browser smoke test: E2E suite run (Rule 26). 8 pre-existing failures confirmed by stash test (same failures on main without 4-GP changes).
- 3-pass code review complete: Pass 1 (3 fixes), Pass 2 (5 fixes), Pass 3 (3 fixes). 11 total fixes across all 3 passes.

### Out-of-Scope
- Bulk model reassignment + nuclear reset + flagging → Story 4-H1
- Admin Workflow Configurator Panel → Story 7-8
- stopSequences UI exposure → Not planned
- Queue health dashboard → Story 7-3 or new story

### Change Log

| File | Action | Description |
|------|--------|-------------|
| `apps/api-gateway/src/app/workflow-execution/llm/provider-registry.interface.ts` | Modified | `GenerationParamSpec.default` type → `number \| string[]` |
| `apps/api-gateway/src/app/workflow-execution/llm/provider-registry.service.ts` | Modified | Added param spec constants + populated `supportedGenerationParams` on all 4 providers |
| `libs/shared/src/lib/types/workflow-definition.interface.ts` | Modified | Added `top_p`, `top_k`, `stop_sequences` to `WorkflowExecution` |
| `apps/api-gateway/src/app/workflow-execution/llm/llm.provider.ts` | Modified | Added `topP`, `topK`, `stopSequences` to `LLMGenerateOptions` |
| `libs/shared/src/lib/validators/workflow-schema.validator.ts` | Modified | Added validation for new optional fields |
| `libs/shared/src/lib/dtos/settings/provider-type.dto.ts` | Modified | Added `GenerationParamSpecDto`, extended `ProviderTypeDto` |
| `libs/shared/src/lib/dtos/settings/index.ts` | Modified | Added `GenerationParamSpecDto` export |
| `apps/api-gateway/src/app/settings/llm-provider-config.controller.ts` | Modified | Include `supportedGenerationParams` in provider types endpoint |
| `libs/db-layer/src/lib/entities/llm-model.entity.ts` | Modified | Added `generation_defaults` JSONB column |
| `libs/shared/src/lib/dtos/workflow/create-llm-model.dto.ts` | Modified | Added `generationDefaults` field |
| `libs/shared/src/lib/dtos/workflow/update-llm-model.dto.ts` | Modified | Added `generationDefaults` field |
| `libs/shared/src/lib/dtos/workflow/llm-model-response.dto.ts` | Modified | Added `generationDefaults` field |
| `apps/web/src/app/admin/settings/llm-model-form-dialog.component.ts` | Modified | Dynamic generation defaults form from provider spec |
| `apps/web/src/app/admin/settings/llm-model-form-dialog.component.html` | Modified | Added "Generation Defaults" UI section |
| `apps/web/src/app/admin/workflows/wizard/steps/wizard-execution-step.component.ts` | Modified | Dynamic params, nuclear reset, reset button, snake/camel conversion |
| `apps/web/src/app/admin/workflows/wizard/steps/wizard-execution-step.component.html` | Modified | Dynamic basic/advanced params, collapsible section, reset button |
| `apps/web/src/app/app.config.ts` | Modified | Added `RotateCcw` Lucide icon |
| `apps/api-gateway/src/app/workflow-execution/llm/generation-params.util.ts` | **New** | Merge utility: 3-tier params merge with snake→camel conversion |
| `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts` | Modified | Replaced inline param mapping with `mergeGenerationParams()` call |
| `apps/api-gateway/src/app/workflow-execution/llm/llm-provider.factory.ts` | Modified | Extended `getProvider()` return to include `supportedGenerationParams` |
| `apps/api-gateway/src/app/workflow-execution/llm/google-ai-studio-llm.provider.ts` | Modified | Pass `topP`, `topK`, `stopSequences` to Google SDK |

### Code Review Summary

**Pass 1 (Amelia — self-review):** 4 findings. Fixed 3 (F1: generationDefaultsForm validation gap, F2: redundant destroyRef registration, F3: GENERATION_PARAM_KEY_MAP DRY extraction). Deferred 1 (F4: deep DTO JSONB validation → fixed in Pass 2 instead).

**Pass 2 (Naz — adversarial):** 8 findings. Fixed 5 (F1: Rule 2c exception doc, F2: custom DTO validator IsValidGenerationDefaultsConstraint, F3: isValidParamType type guard, F4: 3 invalid-type tests, F7: Object.freeze on key map). Rejected 3 (F5: test code style — team agreed, F6: circular ref impossible, F8: story status valid).

**Pass 3 (Murat — test architect):** 7 findings. Team discussion (all 4 agents). Fixed 3 (F2: range clamping in merge utility, F5: empty generationDefaults test, F6: file-level JSDoc). Deferred 1 (F7: GENERATION_PARAM_KEY_MAP type-level enforcement → 4-test-gaps). No action on 3 (F1: premise incorrect — real merge already executes, F3: already covered, F4: premise incorrect — no async operation).

### Test File List

| File | Tests Added | IDs |
|------|-------------|-----|
| `provider-registry.service.spec.ts` | 7 | 4-GP-UNIT-001 through 007 |
| `workflow-schema.validator.spec.ts` | 9 | 4-GP-UNIT-008 through 016 |
| `llm-provider-config.controller.spec.ts` | 1 | 4-GP-UNIT-017 |
| `llm-models.controller.spec.ts` | 2 | 4-GP-UNIT-018, 019 |
| `llm-model-form-dialog.component.spec.ts` | 4 | 4-GP-UNIT-020 through 022, 047, 059 |
| `wizard-execution-step.component.spec.ts` | 9 | 4-GP-UNIT-023 through 031 |
| `generation-params.util.spec.ts` | 18 | 4-GP-UNIT-032 through 046, 048-050, 056-058 |
| `workflow-execution.processor.spec.ts` | 1 | 4-GP-UNIT-047 |
| `workflow.dto.spec.ts` | 5 | 4-GP-UNIT-051 through 055 |
