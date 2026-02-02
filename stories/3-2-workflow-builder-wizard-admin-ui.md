# Story 3.2: Workflow Builder Wizard (Admin UI)

Status: ready-for-dev

## Story

As a **Bubble Admin**,
I want a 6-step wizard in Workflow Studio to create and edit atomic workflow templates,
so that I can build LLM-powered workflows without writing YAML directly.

## CRITICAL CONTEXT

> **Stories 3.1 (Data Foundation), 3.3 (CRUD API), 3.4 (Versioning & Publishing), and 3.5 (Visibility & Access Control) are DONE.** All backend entities, DTOs, validators, CRUD endpoints, versioning, and visibility are in place. This story builds the **Angular frontend** wizard that produces workflow definitions consumed by those APIs.

> **The tech spec** (`_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md`) is the authoritative reference for the YAML schema, wizard step mapping, and validation rules.

> **This is the first major Angular UI story in Epic 3.** All previous Epic 3 stories were backend-only. The existing Angular codebase (from Epics 1-2) establishes patterns for standalone components, signals, reactive forms, routing, and API services that MUST be followed.

> **The `WorkflowDefinition` TypeScript interface already exists** in `libs/shared/src/lib/types/workflow-definition.interface.ts` (created in Story 3.1). The wizard must produce an object conforming to this interface.

> **The `validateWorkflowDefinition()` schema validator already exists** in `libs/shared/src/lib/validators/workflow-schema.validator.ts` (created in Story 3.1). The wizard MUST run this validator before saving.

> **YAML is stored as JSONB, not as raw YAML text.** The wizard produces a JavaScript object matching `WorkflowDefinition`, which is stored in `workflow_versions.definition` as JSONB via the existing `POST /admin/workflow-templates` and version creation APIs.

## Acceptance Criteria

1. **Given** I navigate to `/admin/workflows` and click "Create Workflow", **then** a 6-step wizard opens with: (1) Metadata, (2) Inputs, (3) Execution, (4) Knowledge, (5) Prompt, (6) Output.

2. **Given** I am on Step 1 (Metadata), **then** I can set `name` (required), `description` (required), and `tags` (optional, comma-separated or chip input).

3. **Given** I am on Step 2 (Inputs), **then** I can add inputs with: `name`, `label`, `role` (context/subject dropdown), `source` types (asset/upload/text checkboxes), `required` toggle, file restrictions (`accept.extensions`, `accept.max_size_mb`), and text config (`text_config.placeholder`, `text_config.max_length`). **And** the wizard enforces exactly ONE subject input (validation error if zero or multiple).

4. **Given** I am on Step 3 (Execution), **then** I can select `processing` mode (parallel/batch), `model` (dropdown from `llm_models` table via `GET /app/llm-models`), `temperature`, `max_output_tokens`, and `max_retries`.

5. **Given** I am on Step 4 (Knowledge), **then** I can toggle RAG on/off (`knowledge.enabled`), configure `query_strategy` (auto/custom), `similarity_threshold`, and `max_chunks`. **And** if `query_strategy` is "custom", a `query_template` text field appears.

6. **Given** I am on Step 5 (Prompt), **then** I see a large text area for the prompt. **And** `{input_name}` variable placeholders are visually highlighted matching Step 2 input names.

7. **Given** I am on Step 6 (Output), **then** I can select `output.format` (markdown/json). **And** for markdown: I can define sections (name, label, required toggle). **And** for json: I can provide a JSON schema. **And** I can set `filename_template`.

8. **Given** every non-obvious field in the wizard, **then** it has an info tooltip (ℹ icon with hover explanation).

9. **Given** I complete all steps and click "Save", **then** the wizard produces a valid `WorkflowDefinition` object, runs `validateWorkflowDefinition()`, and calls `POST /admin/workflow-templates` (for new) or the version creation endpoint (for edit). **And** validation errors are shown inline.

10. **Given** I am on any step, **then** I can navigate back and forth between steps without losing data.

## Tasks / Subtasks

- [ ] Task 1: Create Workflow Studio route and landing page (AC: #1)
  - [ ] 1.1 Add `/admin/workflows` child routes to `app.routes.ts` — landing (``), create (`create`), edit (`edit/:id`). All lazy-loaded under existing `/admin` parent which already has `adminGuard`. **NOTE:** The existing route config has a placeholder `ComingSoonComponent` at `path: 'workflows'` under the `/app` zone — that is the tenant-facing route. The admin route goes under the existing `/admin` children.
  - [ ] 1.2 Create `WorkflowStudioComponent` — landing page placeholder (template library is Story 3.7); for now, show a "Create Workflow" button that navigates to the wizard
  - [ ] 1.3 Admin sidebar nav link **already exists** in `AdminLayoutComponent` pointing to `/admin/workflows`. No change needed — just verify it works.

- [ ] Task 2: Create Wizard Shell (stepper component) (AC: #1, #10)
  - [ ] 2.1 Create `WorkflowWizardComponent` — used for both `/admin/workflows/create` and `/admin/workflows/edit/:id` routes (detect mode from route params)
  - [ ] 2.2 Implement custom stepper: step indicator bar (numbered circles with labels). **Visual states:** completed steps show a checkmark icon with muted/success color; the active step uses `--brand-blue`/`--primary-600` and is visually prominent (larger or highlighted); future steps are grayed out but readable. Clickable navigation between completed steps. The admin must see at a glance: "I'm on step X of 6, steps 1 through X-1 are done."
  - [ ] 2.3 Maintain wizard state as a single `signal<WorkflowDefinition>()` that all steps read/write
  - [ ] 2.4 "Back" / "Next" buttons per step, "Save" button on final step
  - [ ] 2.5 Dirty tracking — warn on browser navigation away if form has unsaved changes

- [ ] Task 3: Step 1 — Metadata Form (AC: #2)
  - [ ] 3.1 Create `WizardMetadataStepComponent` — standalone component
  - [ ] 3.2 Reactive form fields: `name` (required, text), `description` (required, textarea), `tags` (optional, chip/tag input or comma-separated text). **NOTE:** `metadata.version` is NOT a user-editable field — auto-set to `1` for new templates. For edit mode, the version number comes from the API response (the backend manages version numbering).
  - [ ] 3.3 Sync form values to parent wizard signal on change
  - [ ] 3.4 Validation: name required, description required

- [ ] Task 4: Step 2 — Inputs Form (AC: #3)
  - [ ] 4.1 Create `WizardInputsStepComponent` — standalone component
  - [ ] 4.2 "Add Input" button — adds a new input **card** (visually grouped with subtle border using `--radius-*` and `--shadow-*` variables, collapsible when multiple inputs exist). Card fields: `name` (text), `label` (text), `description` (optional, textarea — help text shown to the user at runtime), `role` (dropdown: context/subject), `source` (checkboxes: asset/upload/text), `required` (toggle)
  - [ ] 4.3 Conditional fields: if source includes "asset" or "upload", show file restrictions (`accept.extensions` multi-select, `accept.max_size_mb` number). If source includes "text", show text config (`text_config.placeholder` text, `text_config.max_length` number)
  - [ ] 4.4 Remove input button per card
  - [ ] 4.5 **Subject input validation**: exactly 1 input with `role: "subject"`. Show inline error if 0 or >1 subject inputs
  - [ ] 4.6 Input name uniqueness validation
  - [ ] 4.7 Sync to parent wizard signal

- [ ] Task 5: Step 3 — Execution Config (AC: #4)
  - [ ] 5.1 Create `WizardExecutionStepComponent` — standalone component
  - [ ] 5.2 `processing` — radio buttons or dropdown: "parallel" / "batch" (with tooltip explaining each)
  - [ ] 5.3 `model` — dropdown fetched from `GET /app/llm-models` (active models only). Create `LlmModelService` in `apps/web/src/app/core/services/`
  - [ ] 5.4 `temperature` — number input (0.0-2.0, default 0.7)
  - [ ] 5.5 `max_output_tokens` — number input (default 4096)
  - [ ] 5.6 `max_retries` — number input (optional, tooltip: "Override system default validation retry count")
  - [ ] 5.7 Sync to parent wizard signal
  - **NOTE:** `max_concurrency` is in the `WorkflowExecution` interface but intentionally omitted from the wizard. It uses the system default (5). Can be exposed in a future "Advanced Settings" section if needed.

- [ ] Task 6: Step 4 — Knowledge Config (AC: #5)
  - [ ] 6.1 Create `WizardKnowledgeStepComponent` — standalone component
  - [ ] 6.2 `enabled` — toggle switch (default: false)
  - [ ] 6.3 Conditional section (shown when enabled=true): `query_strategy` (radio: auto/custom), `similarity_threshold` (number, default 0.7), `max_chunks` (number, default 10)
  - [ ] 6.4 If `query_strategy` = "custom", show `query_template` textarea
  - [ ] 6.5 Sync to parent wizard signal

- [ ] Task 7: Step 5 — Prompt Editor (AC: #6)
  - [ ] 7.1 Create `WizardPromptStepComponent` — standalone component
  - [ ] 7.2 Large textarea for `prompt` field (monospace font, sufficient height)
  - [ ] 7.3 Variable highlighting: detect `{input_name}` patterns in the prompt text. Display available variables from Step 2 inputs as **clickable** chips/badges above the editor — clicking a chip inserts `{input_name}` at the current cursor position in the textarea. Show visual distinction between used (green/success) vs unused (amber/warning) variables. Optionally highlight matching variables in the textarea via an overlay or a simple list.
  - [ ] 7.4 **Bidirectional variable validation:** (a) Show warning if prompt contains `{variable}` that doesn't match any input name. (b) Show warning if any defined input name is NOT referenced as `{input_name}` in the prompt — the backend validator **requires** every input to appear in the prompt (see `workflow-schema.validator.ts:96-103`). Both warnings should be live (on keystroke/blur), not just at save time.
  - [ ] 7.5 Sync to parent wizard signal

- [ ] Task 8: Step 6 — Output Config (AC: #7)
  - [ ] 8.1 Create `WizardOutputStepComponent` — standalone component
  - [ ] 8.2 `format` — radio buttons: "markdown" / "json"
  - [ ] 8.3 If markdown: "Add Section" button → section form: `name` (text), `label` (text), `required` (toggle). Removable sections. At least 1 required section needed.
  - [ ] 8.4 If json: `json_schema` textarea (JSON editor, validate JSON on blur)
  - [ ] 8.5 `filename_template` — text input with tooltip explaining variables (`{subject_name}`, `{timestamp}`)
  - [ ] 8.6 Sync to parent wizard signal
  - [ ] 8.7 **Definition Preview panel** — collapsible section at the bottom of Step 6 (before the Save button). Shows a read-only, formatted summary of the assembled `WorkflowDefinition`: metadata (name, description, tags), input count with roles, execution config, knowledge toggle state, prompt snippet (first 3 lines), and output format. This gives the admin a final review before saving — no need for a 7th step, just a collapsible preview on the last step.

- [ ] Task 9: Save & Validation Logic (AC: #9)
  - [ ] 9.1 On "Save" click: assemble `WorkflowDefinition` object from wizard state
  - [ ] 9.2 Run `validateWorkflowDefinition()` (imported from `@project-bubble/shared`) — display errors inline on relevant steps (navigate to first error step)
  - [ ] 9.3 Create `WorkflowTemplateService` in `apps/web/src/app/core/services/` — HTTP client for `POST /admin/workflow-templates`, `POST /admin/workflow-templates/:id/versions`, `GET /admin/workflow-templates/:id`
  - [ ] 9.4 For new workflow: call `POST /admin/workflow-templates` with `{ name, description, visibility: 'public' }`, then `POST /admin/workflow-templates/:id/versions` with `{ definition }`. **CRITICAL: Orphaned template handling** — if the template creation succeeds but the version creation fails, the wizard MUST either: (a) retry the version creation, or (b) delete the orphaned template via `DELETE /admin/workflow-templates/:id` and show an error. Do NOT leave a template with no versions in the database.
  - [ ] 9.5 For edit: call version creation endpoint with updated definition
  - [ ] 9.6 On success: navigate to workflow studio landing page with success toast
  - [ ] 9.7 On error: display error message, keep wizard state intact

- [ ] Task 10: Edit Mode — Load Existing Workflow (AC: #1, #10)
  - [ ] 10.1 Route `/admin/workflows/edit/:id` — fetch template + current version via `GET /admin/workflow-templates/:id`
  - [ ] 10.2 Populate wizard state from existing `WorkflowDefinition` object. **NOTE:** The API returns `currentVersion.definition` as `Record<string, unknown>` (from `CreateWorkflowVersionBodyDto`). The wizard must cast/validate this to `WorkflowDefinition` before populating the signal — run `validateWorkflowDefinition()` on load to confirm the stored definition is still valid against the current schema.
  - [ ] 10.3 All steps pre-filled, user can modify and save as new version

- [ ] Task 11: Info Tooltips (AC: #8)
  - [ ] 11.1 Create reusable `InfoTooltipComponent` — standalone, accepts `text` input, renders ℹ icon with hover/focus popover
  - [ ] 11.2 Add tooltips to all non-obvious fields across all 6 steps. Tooltip content:
    - **role (context):** "Shared reference material included in every LLM call (e.g., codebook, research brief)"
    - **role (subject):** "The primary items being analyzed. Each file becomes a separate job in parallel mode"
    - **source (asset):** "User selects an existing file from the Data Vault"
    - **source (upload):** "User uploads a new file at runtime"
    - **source (text):** "User types free-form text at runtime"
    - **processing (parallel):** "Each subject file is processed independently in its own LLM call"
    - **processing (batch):** "All subject files are combined into a single LLM call"
    - **temperature:** "Controls LLM creativity. Lower = more deterministic, higher = more creative (0.0-2.0)"
    - **max_output_tokens:** "Maximum number of tokens the LLM can generate in its response"
    - **max_retries:** "How many times to retry if LLM output fails structural validation. Overrides system default"
    - **knowledge enabled:** "When on, the system queries the tenant Knowledge Base for relevant context to inject into the prompt"
    - **query_strategy (auto):** "Platform automatically generates a search query from the subject content"
    - **query_strategy (custom):** "You provide a specific search query template"
    - **similarity_threshold:** "Minimum relevance score (0.0-1.0) for knowledge chunks to be included"
    - **max_chunks:** "Maximum number of knowledge chunks to inject into the prompt"
    - **filename_template:** "Output filename pattern. Variables: {subject_name}, {timestamp}"

- [ ] Task 12: Unit Tests (AC: all) — **PRODUCTION QUALITY: minimum 15 tests required**
  - [ ] 12.1 `WorkflowWizardComponent` (5-6 tests) — stepper forward/backward navigation, jump to completed step, save triggers validation, validation error maps to correct step, dirty tracking warns on navigation
  - [ ] 12.2 `WizardInputsStepComponent` (6-8 tests) — add input, remove input, subject count validation (0 subjects = error, 1 subject = valid, 2+ subjects = error), name uniqueness validation, conditional field show/hide (source toggles), sync to parent signal
  - [ ] 12.3 `WizardPromptStepComponent` (3-4 tests) — bidirectional variable validation (unknown variable warning, unreferenced input warning), clickable chip inserts variable at cursor, sync to parent signal
  - [ ] 12.4 `WizardOutputStepComponent` (4-5 tests) — format toggle (markdown/json), section add/remove for markdown, JSON schema validation on blur, filename_template required, preview panel renders summary
  - [ ] 12.5 `WorkflowTemplateService` (4 tests) — create template API call, create version API call, get template API call, orphaned template cleanup on version creation failure
  - [ ] 12.6 **Floor: minimum 15 unit tests.** This is a production-grade B2B SaaS — MVP defines scope, not quality bar.

- [ ] Task 13: Verify full test suite & lint (AC: all)
  - [ ] 13.1 Run all tests: `npx nx run-many -t test --all`
  - [ ] 13.2 Run lint: `npx nx run-many -t lint --all`
  - [ ] 13.3 Report complete metrics per project

## Dev Notes

### Architecture Patterns to Follow

- **Standalone Components** — ALL new components must be `standalone: true`. No NgModules.
- **Angular Signals** — Use `signal()` for component state, `computed()` for derived values, `input()` / `output()` for component I/O. Do NOT use BehaviorSubject for local state.
- **Reactive Forms** — Use `FormBuilder` with `FormGroup` / `FormArray` for all wizard steps. Inject via `inject(FormBuilder)`.
- **`inject()` function** — Use `inject()` for DI, not constructor injection.
- **Lazy Loading** — New routes must be lazy-loaded via `loadComponent` in `app.routes.ts`.
- **SCSS with CSS Variables** — Use the existing design system variables from `styles.scss` (e.g., `--brand-blue`, `--primary-600`, `--slate-*`, `--radius-*`, `--shadow-*`).
- **Lucide Icons** — Use `lucide-angular` for all icons. Icons are registered globally in `app.config.ts`.
- **HTTP Services** — Use `@Injectable({ providedIn: 'root' })` with `inject(HttpClient)`. Return `Observable<T>`.
- **DTOs from shared lib** — Import types from `@project-bubble/shared`.
- **No Angular Material / No PrimeNG** — This project uses a custom design system. Build wizard UI with plain HTML/SCSS + existing patterns.
- **Test IDs** — Add `data-testid` attributes to all interactive elements.

### Critical Implementation Details

1. **Wizard state model (two-layer pattern)**: The wizard maintains a single `signal<Partial<WorkflowDefinition>>()` as the **canonical** wizard-level state. Each step component has its own local `FormGroup` (via `FormBuilder`) for form validation and user interaction. **The boundary is clear:** the `FormGroup` is the local editing state within each step; the signal is the persisted wizard-level model. On each "Next" click (or on blur/change events), the step syncs its `FormGroup` values into the parent signal. On step entry (including "Back" navigation), the step initializes its `FormGroup` from the signal. This two-layer pattern avoids confusion about which is the source of truth at any given moment.

2. **Step navigation**: Steps should be navigable forward (with validation of current step) and backward (without validation). Clicking a completed step indicator should jump to that step.

3. **The `WorkflowDefinition` interface** is in `libs/shared/src/lib/types/workflow-definition.interface.ts`. Study it before implementing — the wizard form structure must match exactly.

4. **The validator** `validateWorkflowDefinition()` is in `libs/shared/src/lib/validators/workflow-schema.validator.ts`. It returns `{ valid: boolean, errors: string[] }`. Call this on save and map errors to the relevant step.

5. **LLM models dropdown**: The `GET /app/llm-models` endpoint returns active models. The `LlmModelService` should be a simple HTTP GET service.

6. **API flow for creating a new workflow template:**
   - Step 1: `POST /admin/workflow-templates` with `{ name, description }` → returns template with `id`. **Note:** `CreateWorkflowTemplateDto.description` is optional at the DTO level, but the wizard should always send it (from metadata.description). The template-level description is for catalog listing; the definition's `metadata.description` is stored inside the JSONB.
   - Step 2: `POST /admin/workflow-templates/:id/versions` with `{ definition }` → creates version v1
   - The wizard does both in sequence on save.

7. **API flow for editing an existing workflow:**
   - Load: `GET /admin/workflow-templates/:id` → returns template with `currentVersion.definition`
   - Save: `POST /admin/workflow-templates/:id/versions` with `{ definition }` → creates new version

8. **`req.user` in JWT**: `tenant_id` (snake_case), `userId` (camelCase) — admin users will have `role: 'bubble_admin'`.

9. **File extension options for accept.extensions**: Suggest common options: `.pdf`, `.docx`, `.txt`, `.md`, `.csv`. Allow free-text entry for custom extensions.

10. **Tags implementation**: A simple comma-separated text input is acceptable for MVP. Chip input can be added later if needed.

### What Already Exists (DO NOT recreate)

```
libs/shared/src/lib/types/
  workflow-definition.interface.ts  — WorkflowDefinition, InputDefinition, ExecutionConfig, etc.
  workflow-chain.interface.ts       — WorkflowChainDefinition

libs/shared/src/lib/validators/
  workflow-schema.validator.ts      — validateWorkflowDefinition() function

libs/shared/src/lib/dtos/workflow/
  create-workflow-template.dto.ts   — CreateWorkflowTemplateDto (name, description, visibility)
  update-workflow-template.dto.ts   — UpdateWorkflowTemplateDto
  create-workflow-version-body.dto.ts — CreateWorkflowVersionBodyDto (definition)
  workflow-template-response.dto.ts — WorkflowTemplateResponseDto (includes currentVersion)
  workflow-version-response.dto.ts  — WorkflowVersionResponseDto

apps/api-gateway/src/app/workflows/
  workflow-templates.controller.ts  — POST, GET, PATCH, DELETE /admin/workflow-templates
  workflow-versions.controller.ts   — POST, GET /admin/workflow-templates/:id/versions
  llm-models.controller.ts          — GET /app/llm-models (active models)

apps/web/src/app/
  app.routes.ts                     — Existing route config
  admin/admin-layout.component.ts   — Admin sidebar layout
  core/services/                    — Existing service patterns
  shared/components/                — Existing shared components
  styles.scss                       — Design system CSS variables
  app.config.ts                     — Icon registration, HTTP config
```

### Files to CREATE

```
apps/web/src/app/admin/workflows/
  workflow-studio.component.ts                     (NEW — landing page)
  workflow-studio.component.html                   (NEW)
  workflow-studio.component.scss                   (NEW)
  wizard/
    workflow-wizard.component.ts                   (NEW — wizard shell/stepper)
    workflow-wizard.component.html                 (NEW)
    workflow-wizard.component.scss                 (NEW)
    steps/
      wizard-metadata-step.component.ts            (NEW — Step 1)
      wizard-inputs-step.component.ts              (NEW — Step 2)
      wizard-execution-step.component.ts           (NEW — Step 3)
      wizard-knowledge-step.component.ts           (NEW — Step 4)
      wizard-prompt-step.component.ts              (NEW — Step 5)
      wizard-output-step.component.ts              (NEW — Step 6)

apps/web/src/app/shared/components/
  info-tooltip/
    info-tooltip.component.ts                      (NEW — reusable tooltip)

apps/web/src/app/core/services/
  workflow-template.service.ts                     (NEW — HTTP client for workflow CRUD)
  llm-model.service.ts                             (NEW — HTTP client for LLM models)

Test files (co-located):
  workflow-wizard.component.spec.ts                (NEW)
  wizard-inputs-step.component.spec.ts             (NEW)
  wizard-prompt-step.component.spec.ts             (NEW — bidirectional variable validation)
  wizard-output-step.component.spec.ts             (NEW)
  workflow-template.service.spec.ts                (NEW)
```

### Files to MODIFY

```
apps/web/src/app/app.routes.ts                     (ADD: /admin/workflows child routes — landing, create, edit/:id)
apps/web/src/app/admin/admin-layout.component.ts   (ALREADY HAS nav link pointing to /admin/workflows — NO CHANGE NEEDED)
```

### Previous Story Learnings (from Stories 3.1, 3.3, 3.4, 3.5)

- **Defense-in-depth tenantId:** Not directly applicable to frontend, but all API calls go through admin guards.
- **`WorkflowDefinition` interface is the single source of truth** for the wizard form structure.
- **`validateWorkflowDefinition()` catches:** missing subject input, invalid enum values, prompt variable mismatches, output format conflicts. The wizard should prevent most of these via UI constraints, but the validator is the final safety net.
- **Version creation is separate from template creation.** The wizard must call both endpoints (create template, then create version).
- **Two-controller pattern:** Admin wizard uses `/admin/workflow-templates` endpoints. The catalog endpoint (`/app/workflow-templates`) is for tenants.
- **QueryBuilder patterns from backend** — not relevant to frontend but good to know the API contract.

### Angular Codebase Patterns (from existing code analysis)

- **Route structure:** Lazy-loaded standalone components via `loadComponent` in `app.routes.ts`
- **Form pattern:** `inject(FormBuilder)`, `this.fb.group({...})`, `form.markAllAsTouched()` before submit
- **Signal pattern:** `signal<T>()` for state, `computed()` for derived, `input<T>()` / `output<T>()` for I/O
- **Service pattern:** `@Injectable({ providedIn: 'root' })`, `inject(HttpClient)`, return `Observable`
- **Modal pattern:** Custom CSS overlays (no Material Dialog). Use signal for open/close state.
- **Error handling:** Status code checks in subscribe error handler, signal-based error messages
- **Toast notifications:** `ToastService` for success/failure feedback
- **Icon usage:** `<lucide-icon name="icon-name" [size]="16"></lucide-icon>`
- **CSS class conventions:** BEM-like naming, use existing design system variables

### References

- [Tech Spec: Workflow Definition Schema](../../_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md)
- [WorkflowDefinition Interface](../../libs/shared/src/lib/types/workflow-definition.interface.ts)
- [Schema Validator](../../libs/shared/src/lib/validators/workflow-schema.validator.ts)
- [Workflow DTOs](../../libs/shared/src/lib/dtos/workflow/)
- [Admin Routes](../../apps/web/src/app/app.routes.ts)
- [Admin Layout](../../apps/web/src/app/admin/admin-layout.component.ts)
- [Design System](../../apps/web/src/styles.scss)
- [Epics §3.2: Workflow Builder Wizard](../../_bmad-output/planning-artifacts/epics.md)
- [project-context.md](../../project-context.md)
- [Story 3.1: Data Foundation](./3-1-workflow-definition-data-foundation.md)
- [Story 3.3: CRUD API](./3-3-workflow-template-crud-api.md)
- [Story 3.4: Versioning & Publishing](./3-4-workflow-versioning-publishing.md)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Change Log
