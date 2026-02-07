# Story 3E: Workflow Studio E2E Tests

Status: done

## Story

As a **Developer**,
I want **E2E tests covering Workflow Studio navigation, wizard create/edit flows, and chain builder composition**,
so that **the full Epic 3 write-and-read paths (UI → API → DB → API → UI) are verified end-to-end beyond unit test coverage**.

## Background

Story 1E established the Playwright E2E framework with test DB lifecycle, auth fixture, and 3 smoke tests. Story 2E added Data Vault E2E + Settings LLM Admin E2E (11 tests, 3 auth states). This story completes E2E coverage by testing the Workflow Studio — the core product feature from Epic 3.

**Party Mode Consensus (2026-02-07):**
- Scope: **Workflow Studio E2E** — navigation, wizard (create + edit), chain builder (create + edit)
- Framing: "Workflow Studio E2E" — the North Star test that proves Epic 3 works
- Auth: **Admin only** (default `admin.json` storageState, Zone C routes — no tenant auth needed)
- Component mods: **Zero** — all data-testid attributes already comprehensive from Stories 3.2-3.7
- Seed: Extend `global-setup.ts` with 1 published template + 1 version + 1 chain (2 steps)
- Test count: **8 tests** across 3 spec files
- **Cut from scope** (covered by unit tests): filters, search, duplicate, publish, validation edge cases, unsaved changes guard

**Key insight from 2E:** Use deterministic waits (`getByTestId` visible), scoped locators (within container), `page.once` for dialogs, `APIRequestContext` type for auth helpers.

## Acceptance Criteria

1. **AC1: Extended Seed Data** — `global-setup.ts` extended to seed 1 published `WorkflowTemplateEntity` ("E2E Seed Template") with 1 `WorkflowVersionEntity` (version 1, minimal valid definition) and 1 `WorkflowChainEntity` ("E2E Seed Chain") with 2 steps referencing the seeded template. All under system tenant (`00000000-...`) with `createdBy` = admin user ID.
2. **AC2: Navigation Tests** — E2E tests verify: navigate to Workflow Studio → Templates tab active with seeded template visible; switch to Chains tab → chains content visible with seeded chain.
3. **AC3: Wizard Create (North Star)** — E2E test creates a new workflow template through all 5 wizard steps (metadata → inputs → execution → prompt → output) → saves as draft → template appears in template list. This is the highest-value test.
4. **AC4: Wizard Edit** — E2E test navigates to the seeded template → edit wizard loads with pre-populated form → modifies display name → saves → change persists on reload. Validates the hydration path (API → form state population).
5. **AC5: Wizard Back Button** — E2E test fills step 0 (metadata) → advances to step 1 (inputs) → clicks back → step 0 form state preserved.
6. **AC6: Chain Builder Create** — E2E test creates a new chain → names it → adds 2 steps from template picker → configures input mapping → saves → chain appears in chain list.
7. **AC7: Chain Builder Edit** — E2E test navigates to seeded chain → edit form loads → modifies name → saves → change persists on reload.
8. **AC8: Chain Data Flow Diagram** — E2E test verifies data flow diagram renders when chain has 2+ steps.

## Tasks / Subtasks

- [x] Task 1: Extend global-setup seed data (AC: 1)
  - [x] 1.1 Add `WorkflowTemplateEntity` — name: "E2E Seed Template", tenantId: system tenant (nil UUID), visibility: 'public', status: 'published', createdBy: admin user ID
  - [x] 1.2 Add `WorkflowVersionEntity` — templateId: above, versionNumber: 1, tenantId: system tenant, definition: minimal valid WorkflowDefinition JSON, createdBy: admin user ID
  - [x] 1.3 Update template's `currentVersionId` to point to the created version
  - [x] 1.4 Add `WorkflowChainEntity` — name: "E2E Seed Chain", tenantId: system tenant, visibility: 'public', status: 'draft', definition: JSON with 2 steps referencing the seeded template, createdBy: admin user ID

- [x] Task 2: Navigation E2E tests (AC: 2)
  - [x] 2.1 Create `apps/web-e2e/src/workflow-studio/01-navigation.spec.ts`
  - [x] 2.2 `[3E-E2E-001a]` [P0] Navigate to Workflow Studio → Templates tab active, seeded "E2E Seed Template" visible
  - [x] 2.3 `[3E-E2E-001b]` [P0] Switch to Chains tab → Chains content visible, seeded "E2E Seed Chain" visible

- [x] Task 3: Wizard E2E tests (AC: 3, 4, 5)
  - [x] 3.1 Create `apps/web-e2e/src/workflow-studio/02-wizard.spec.ts`
  - [x] 3.2 `[3E-E2E-002a]` [P0] **North Star**: Click "Create Workflow" → complete all 5 steps → save draft → template appears in list
  - [x] 3.3 `[3E-E2E-002b]` [P1] Edit seeded template → modify name → save → change persists on reload
  - [x] 3.4 `[3E-E2E-002c]` [P1] Fill metadata step → advance to inputs → click back → metadata form state preserved

- [x] Task 4: Chain Builder E2E tests (AC: 6, 7, 8)
  - [x] 4.1 Create `apps/web-e2e/src/workflow-studio/03-chain-builder.spec.ts`
  - [x] 4.2 `[3E-E2E-003a]` [P0] Create chain → name it → add 2 steps → configure input mapping → save → chain appears in list
  - [x] 4.3 `[3E-E2E-003b]` [P1] Edit seeded chain → modify name → save → change persists on reload
  - [x] 4.4 `[3E-E2E-003c]` [P1] Chain with 2+ steps shows data flow diagram

- [x] Task 5: Run full test suite + lint (AC: all)
  - [x] 5.1 All 878+ unit tests still pass
  - [x] 5.2 Lint passes with 0 errors across all projects
  - [x] 5.3 Update story status and change log

## Dev Notes

### Architecture Constraints

- **Workflow Studio is Zone C** (`/admin/workflows`) — requires `bubble_admin` JWT. Uses existing `admin.json` storageState (default in playwright config). No storageState override needed.
- **Routes**:
  - `/admin/workflows` → `WorkflowStudioComponent` (tabs: Templates, Chains)
  - `/admin/workflows/create` → `WorkflowWizardComponent` (new template)
  - `/admin/workflows/edit/:id` → `WorkflowWizardComponent` (edit template)
  - `/admin/workflows/chains/new` → `ChainBuilderComponent` (new chain)
  - `/admin/workflows/chains/:id/edit` → `ChainBuilderComponent` (edit chain)
- **All routes use `unsavedChangesGuard`** — but we're NOT testing the guard (unit tested). Tests should save before navigating away to avoid guard interference.
- **Wizard has validation gates on Next button** — `nextStep()` calls `isCurrentStepValid()` and blocks if invalid. Cannot advance step 0→1 without filling required fields (`metadata-name-input` and `metadata-description-input` are required; `metadata-tags-input` is optional). Direct step indicator clicks only work for previously visited steps (`highestVisitedStep` tracking).
- **Wizard has 5 steps** (NOT 6 — knowledge step deferred to Phase 2):
  - Step 0: Metadata (name*, description*, tags) — `metadata-name-input`, `metadata-description-input`, `metadata-tags-input`
  - Step 1: Inputs (add input cards, role=subject required) — `add-input-btn`, `input-name-0`, `input-role-0`, `input-source-text-0`
  - Step 2: Execution (model dropdown, processing mode) — `exec-model-select`, `exec-processing-parallel`
  - Step 3: Prompt (textarea with variable chips) — `prompt-textarea`, `variable-chip-*`
  - Step 4: Output (format selection, sections/schema) — `output-format-markdown`, `add-section-btn`, `section-name-0`
- **Execution step loads LLM models async** — seeded by `RlsSetupService.onModuleInit()` at server start. `exec-model-select` is a **native HTML `<select>`** — use `page.getByTestId('exec-model-select').selectOption({ index: 0 })` (NOT Material dropdown patterns). Wait for `<option>` elements to populate before interacting: `await expect(page.getByTestId('exec-model-select').locator('option')).not.toHaveCount(0)`. **Auto-selection**: The execution step auto-selects the first model if none is set, so the North Star test may skip manual selection — just verify the select has a value after waiting.
- **Chain builder sections**:
  - Metadata: `chain-name-input`, `chain-description-input`
  - Steps list: `chain-steps-list`, `chain-step-0`, `chain-step-1`
  - Add step: `chain-template-select`, `chain-add-step-button`
  - Input mapping (visible with 2+ steps): `chain-step-1-mapping`, `chain-step-1-input-*-source` — **verify mapping section renders** (`await expect(page.getByTestId('chain-step-1-mapping')).toBeVisible()`) before interacting. If not visible, the seeded template may need output fields.
  - Data flow diagram (visible with 2+ steps): `chain-data-flow-diagram`
  - Save: `chain-save-button` — **after save, navigates to `/admin/workflows` (Templates tab default)**. Chain tests must click `workflow-studio-chains-tab` to verify chain appears in list.
- **All workflow entities have `tenantId`** — admin creates under system tenant (`00000000-0000-0000-0000-000000000000`). The `createdBy` field requires a valid user UUID (use seeded admin user ID).
- **Chain steps stored as JSON** inside `WorkflowChainEntity.definition` — no separate entity. The `definition` field contains `{ steps: [...], inputMappings: {...} }`.
- **WorkflowVersionEntity.definition** stores the full `WorkflowDefinition` as JSONB. Must be a valid definition matching what the wizard produces.

### data-testid Coverage — ALREADY COMPLETE

All Workflow Studio components have comprehensive `data-testid` from Stories 3.2-3.7. **Zero component modifications needed.**

| Component | Key data-testid attributes |
|-----------|---------------------------|
| WorkflowStudioComponent | `workflow-studio-container`, `workflow-studio-templates-tab`, `workflow-studio-chains-tab`, `templates-content`, `chains-content` |
| WorkflowWizardComponent | `wizard-stepper`, `step-indicator-0` through `step-indicator-4`, `wizard-prev-btn`, `wizard-next-btn`, `wizard-save-btn`, `wizard-cancel-btn` |
| WizardMetadataStep | `metadata-name-input`, `metadata-description-input`, `metadata-tags-input` |
| WizardInputsStep | `add-input-btn`, `input-card-0`, `input-name-0`, `input-role-0`, `input-source-text-0`, `input-text-placeholder-0` |
| WizardExecutionStep | `exec-model-select`, `exec-processing-parallel`, `exec-processing-batch`, `exec-temperature-input` |
| WizardPromptStep | `prompt-textarea`, `variable-chips` |
| WizardOutputStep | `output-format-markdown`, `output-format-json`, `add-section-btn`, `section-name-0`, `section-label-0` |
| TemplateListComponent | `template-list`, `create-workflow-button`, `template-list-empty` |
| ChainListComponent | `chain-list`, `create-chain-button`, `chain-list-empty` |
| ChainBuilderComponent | `chain-save-button`, `chain-cancel-btn`, `chain-validation-errors` |
| ChainMetadataSection | `chain-name-input`, `chain-description-input` |
| ChainStepsList | `chain-steps-list`, `chain-step-0`, `chain-step-alias-0` |
| ChainAddStep | `chain-template-select`, `chain-add-step-button` |
| ChainInputMapping | `chain-step-1-mapping`, `chain-step-1-input-{name}-source` |
| ChainDataFlow | `chain-data-flow-diagram` |

### Seed Data Strategy

**Extend `global-setup.ts`** with deterministic read-only baseline.

**Getting `adminUserId`**: The current global-setup saves the admin user without a fixed UUID (TypeORM auto-generates). For seed data that needs `createdBy`, either: (a) assign a fixed UUID to the admin user save (e.g., `id: '00000000-0000-0000-0000-000000000001'`), or (b) capture the returned entity's `id` after `userRepo.save()` and pass it down. Option (a) is simpler — just add a fixed `id` to the existing admin `userRepo.save()` call.

```typescript
// 1. Published workflow template
const templateRepo = testDs.getRepository(WorkflowTemplateEntity);
const seedTemplate = await templateRepo.save({
  id: '33333333-0000-0000-0000-000000000001',
  tenantId: SYSTEM_TENANT_ID,
  name: 'E2E Seed Template',
  description: 'Seeded template for E2E tests',
  visibility: 'public',
  status: 'published',
  createdBy: adminUserId,
});

// 2. Version with minimal valid definition
const versionRepo = testDs.getRepository(WorkflowVersionEntity);
const seedVersion = await versionRepo.save({
  id: '33333333-0000-0000-0000-000000000002',
  tenantId: SYSTEM_TENANT_ID,
  templateId: seedTemplate.id,
  versionNumber: 1,
  definition: { /* minimal valid WorkflowDefinition */ },
  createdBy: adminUserId,
});

// 3. Update template currentVersionId
await templateRepo.update(seedTemplate.id, { currentVersionId: seedVersion.id });

// 4. Chain with 2 steps (definition must match ChainDefinition interface)
const chainRepo = testDs.getRepository(WorkflowChainEntity);
await chainRepo.save({
  id: '33333333-0000-0000-0000-000000000003',
  tenantId: SYSTEM_TENANT_ID,
  name: 'E2E Seed Chain',
  description: 'Seeded chain for E2E tests',
  visibility: 'public',
  status: 'draft',
  definition: {
    metadata: { name: 'E2E Seed Chain', description: 'Seeded chain for E2E tests' },
    steps: [
      { workflow_id: seedTemplate.id, alias: 'Step 1' },
      { workflow_id: seedTemplate.id, alias: 'Step 2', input_mapping: {} },
    ],
  },
  createdBy: adminUserId,
});
```

**Minimal valid WorkflowDefinition** (for the seeded version):
```json
{
  "metadata": { "name": "E2E Seed Template", "description": "Seeded", "version": "1.0", "tags": [] },
  "inputs": [{ "name": "subject", "label": "Subject", "role": "subject", "required": true, "source": { "text": { "enabled": true } } }],
  "execution": { "processing": "parallel", "model": null, "temperature": 0.7, "max_output_tokens": 4096, "max_retries": 3 },
  "knowledge": { "enabled": false },
  "prompt": "Analyze {subject}",
  "output": { "format": "markdown", "filename_template": "output-{subject}", "sections": [{ "name": "analysis", "label": "Analysis", "required": true }] }
}
```

**IMPORTANT**: The exact definition schema should be verified against what the wizard produces. Check `WorkflowWizardComponent.buildDefinition()` or `WorkflowDefinition` interface in `libs/shared/src/lib/` for the actual structure.

### Wizard North Star Test — Minimum Viable Path

The wizard create test (002a) must fill ALL 5 steps. Shortest valid path:

1. **Metadata** (step 0): Fill `metadata-name-input` with unique name, `metadata-description-input` with description
2. **Inputs** (step 1): Click `add-input-btn` → fill `input-name-0` ("subject"), set `input-role-0` to "subject", enable `input-source-text-0`
3. **Execution** (step 2): Wait for `exec-model-select` options to populate (`await expect(page.getByTestId('exec-model-select').locator('option')).not.toHaveCount(0)`). Auto-selects first model — verify select has a value, or explicitly `selectOption({ index: 0 })`. Keep defaults for processing/temperature.
4. **Prompt** (step 3): Fill `prompt-textarea` with "Analyze {subject}" (must reference input variable)
5. **Output** (step 4): Click `output-format-markdown` → click `add-section-btn` → fill `section-name-0` ("analysis")

Then click `wizard-save-btn` → wait for navigation back to template list → verify new template appears.

### Test File Organization

```
apps/web-e2e/src/
├── smoke/                  # 1E smoke tests (existing)
├── data-vault/             # 2E Data Vault tests (existing)
├── settings/               # 2E Settings tests (existing)
├── workflow-studio/        # 3E Workflow Studio tests (NEW)
│   ├── 01-navigation.spec.ts     # [3E-E2E-001a/b] — runs first (pristine seed data)
│   ├── 02-wizard.spec.ts         # [3E-E2E-002a/b/c] — edit test mutates seed
│   └── 03-chain-builder.spec.ts  # [3E-E2E-003a/b/c] — edit test mutates seed
├── fixtures/               # Test fixture files (existing)
├── auth.setup.ts           # 3 auth states (existing)
├── fixtures.ts             # Extended fixtures (existing)
├── global-setup.ts         # Extended: + workflow seed (MODIFIED)
├── global-teardown.ts      # (existing)
└── env.ts                  # (existing)
```

### Project Structure Notes

**Files to create:**
- `apps/web-e2e/src/workflow-studio/01-navigation.spec.ts`
- `apps/web-e2e/src/workflow-studio/02-wizard.spec.ts`
- `apps/web-e2e/src/workflow-studio/03-chain-builder.spec.ts`

**Files to modify:**
- `apps/web-e2e/src/global-setup.ts` — extend seed with 1 template + 1 version + 1 chain + 1 LLM model

**Files NOT modified:**
- All Workflow Studio components (data-testid already comprehensive)
- `auth.setup.ts` (admin auth already exists)
- `fixtures.ts` (no new fixtures needed)
- `playwright.config.ts` (no changes needed)

### References

- [Source: Story 1E — E2E infrastructure foundation](stories/1e-e2e-test-coverage-epic-1.md)
- [Source: Story 2E — Data & Configuration E2E](stories/2e-e2e-test-coverage-epic-2.md)
- [Source: Story 3.2 — Workflow Builder Wizard (wizard component structure)](stories/3-2-workflow-builder-wizard-admin-ui.md)
- [Source: Story 3.6b — Workflow Chain Builder UI (chain builder structure)](stories/3-6b-workflow-chain-builder-ui.md)
- [Source: Story 3.7 — Workflow Studio Template Library](stories/3-7-workflow-studio-template-library.md)
- [Source: architecture.md — Zone C admin routes, unsavedChangesGuard]
- [Source: project-context.md — Rule 10 data-testid, Rule 12 E2E coverage, Priority markers]

### Previous Story Intelligence (1E/2E)

Key learnings from Stories 1E and 2E:
- Use `APIRequestContext` type (not fragile `Parameters<>` extraction) — H1 fix from 2E review
- Use deterministic waits (`getByTestId` visible) instead of `waitForTimeout` — H2 fix from 2E review
- Use `page.once('dialog', ...)` for one-time dialog handlers — H3 fix from 2E review
- Scope locators within container elements to avoid broad prefix matches — M2 fix from 2E review
- Custom `<button>` toggles use `aria-pressed` not `isChecked()` — M3 fix from 2E review
- `{}` destructuring in Playwright fixtures needs `// eslint-disable-next-line no-empty-pattern`
- Execution step loads models async — must wait for dropdown to populate before selecting

## Definition of Done

- [x] Extended seed creates 1 published template + 1 version + 1 chain (2 steps)
- [x] 3 spec files with 8 tests total pass
- [x] North Star wizard test (002a) completes full 5-step flow
- [x] Edit tests (002b, 003b) verify hydration and persistence
- [x] Chain builder test (003a) validates multi-step composition with input mapping
- [x] All 878+ unit tests still pass (878 total: web 376, api-gateway 401, shared 77, db-layer 24)
- [x] Lint passes with 0 errors
- [x] Code review passed

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Original placeholder story created from Epic 3 discussion item #5 |
| 2026-02-07 | SM (Party Mode + Create-Story) | Complete rewrite per party mode consensus: Workflow Studio E2E — navigation, wizard create/edit, chain builder. 8 tests across 3 spec files. Admin-only auth. Zero component modifications. Seed: 1 published template + 1 version + 1 chain. Cut filters/search/duplicate/publish (unit tested). |
| 2026-02-07 | SM (Party Mode Review) | 6 fixes applied from TEA/Dev/Architect review: (1) Fixed chain definition JSON — `workflow_id` not `templateId`, per-step `input_mapping`, added `metadata` wrapper. (2) Added `exec-model-select` is native `<select>` — use `selectOption()`, not Material patterns. (3) Added auto-selection note — first model auto-selected. (4) Added wait-for-options pattern for async model load. (5) Added chains tab click needed after chain save navigation. (6) Added `adminUserId` source guidance. (7) Added validation gate note for wizard step navigation. (8) Added mapping UI render verification note. |
| 2026-02-07 | Dev Agent (Opus 4.6) | Implementation complete: 4 files created/modified, 8 E2E tests across 3 spec files. Seed data with correct WorkflowDefinition schema (source: `['text']` not `{ text: { enabled: true } }`). Fixed admin user to use fixed UUID for `createdBy`. North Star wizard test fills all 5 steps including `output-filename-input` (required). Chain tests use `workflow-studio-chains-tab` click after save navigation. 878 unit tests pass, 0 lint errors. |
| 2026-02-07 | Code Review + Party Mode (Opus 4.6) | 7 findings reviewed (2 fix, 1 should-fix, 1 rescinded, 3 accept). Fixes applied: (1) Seeded mock-model LlmModelEntity in global-setup.ts — `RlsSetupService.seedLlmModels()` skips in NODE_ENV=test, wizard step 2 needs models. (2) Renamed spec files with numeric prefixes (01-, 02-, 03-) to enforce execution order — navigation tests run first on pristine seed data, edit tests that mutate seeds run last. (3) Changed `not.toHaveCount(0)` → `not.toHaveCount(1)` for option assertions — guards against false positive when only placeholder option exists. |

## Test Traceability

| AC ID | Test File | Test Description | Status |
|-------|-----------|------------------|--------|
| AC1 | global-setup.ts | Seed data: 1 template + 1 version + 1 chain (2 steps) + 1 LLM model | Done |
| AC2 | 01-navigation.spec.ts:8 | [3E-E2E-001a] Templates tab with seeded template | Done |
| AC2 | 01-navigation.spec.ts:22 | [3E-E2E-001b] Chains tab with seeded chain | Done |
| AC3 | 02-wizard.spec.ts:8 | [3E-E2E-002a] North Star: 5-step wizard create | Done |
| AC4 | 02-wizard.spec.ts:72 | [3E-E2E-002b] Edit seeded template, persist on reload | Done |
| AC5 | 02-wizard.spec.ts:103 | [3E-E2E-002c] Back button preserves metadata state | Done |
| AC6 | 03-chain-builder.spec.ts:7 | [3E-E2E-003a] Create chain with 2 steps | Done |
| AC7 | 03-chain-builder.spec.ts:55 | [3E-E2E-003b] Edit seeded chain, persist on reload | Done |
| AC8 | 03-chain-builder.spec.ts:86 | [3E-E2E-003c] Data flow diagram visible | Done |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes

- Extended `global-setup.ts` with workflow seed data: 1 published template (fixed UUID `33333333-...-001`), 1 version with valid `WorkflowDefinition` JSON, 1 chain with 2 steps using correct `ChainDefinition` interface
- Added fixed UUID (`00000000-...-001`) to admin user save for `createdBy` references
- Corrected `WorkflowDefinition.inputs[].source` from story's incorrect `{ text: { enabled: true } }` to correct `['text']` array format (verified against `WorkflowInput` interface)
- North Star wizard test (002a) fills all 5 steps: metadata (name + desc), inputs (name + label + role + text source), execution (wait for async model load + auto-select), prompt (with variable reference), output (markdown format + filename template + section name/label)
- Discovered `output-filename-input` is required for output step validation — added to test (not in original story minimum viable path)
- Discovered `input-label-{i}` is required for inputs step — added to test
- Chain builder tests click `workflow-studio-chains-tab` after save navigation (Templates tab is default)
- All 878 unit tests pass, 0 lint errors across all projects

### File List

- `apps/web-e2e/src/global-setup.ts` — MODIFIED (added fixed admin UUID, workflow seed data: template + version + chain + LLM model)
- `apps/web-e2e/src/workflow-studio/01-navigation.spec.ts` — CREATED (2 tests: templates tab, chains tab)
- `apps/web-e2e/src/workflow-studio/02-wizard.spec.ts` — CREATED (3 tests: North Star create, edit/persist, back button)
- `apps/web-e2e/src/workflow-studio/03-chain-builder.spec.ts` — CREATED (3 tests: create with mapping, edit/persist, data flow diagram)
