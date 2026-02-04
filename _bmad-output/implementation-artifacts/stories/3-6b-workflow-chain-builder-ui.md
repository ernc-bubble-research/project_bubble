# Story 3.6b: Workflow Chain Builder UI

Status: done

## Story

**As a** Bubble Admin,
**I want** a Chain Builder interface in Workflow Studio to compose multi-step workflow chains,
**So that** I can visually build analysis pipelines without writing JSON directly.

## Acceptance Criteria

1. **Create Chain Entry Point**: Clicking "Create Chain" in Workflow Studio opens the Chain Builder form
2. **Metadata Section**: Form includes name (required) and description fields with appropriate validation
3. **Steps Section**: Displays an ordered list of workflow steps with visual step indicators
4. **Add Steps**: Dropdown/picker allows selecting from published atomic workflow templates only
5. **Reorder Steps**: Steps can be reordered via up/down buttons (primary) or native drag-and-drop (optional)
6. **Remove Steps**: Each step has a remove button (except when only 2 steps remain)
7. **Input Mapping**: For each step (except Step 0), configure input mapping with source selection
8. **Data Flow Visualization**: Shows a visual summary of data flow between steps
9. **Visibility Controls**: Set visibility (public/private) and allowed tenants (reuses Story 3.5 pattern)
10. **Validation**: Validates minimum 2 steps and all required inputs mapped before save
11. **Save Chain**: Calls Story 3.6a API (POST /admin/workflow-chains) on save
12. **Edit Chain**: Loads existing chain from API and populates form for editing
13. **Info Tooltips**: Every non-obvious field has an info tooltip
14. **Test IDs**: All interactive elements have `data-testid` attributes

> **Note on Intermediate Outputs**: All workflow step outputs in a chain will be visible to users by default (users pay for each workflow, they see all outputs). This is handled in Epic 4 (Execution) and Epic 5 (Reporting) — no UI toggles needed in the Chain Builder.

## Pre-Implementation Context

### Already Implemented (Story 3.6a)

The following API endpoints already exist and should be called by this UI:

- **POST /admin/workflow-chains** - Create new chain
- **GET /admin/workflow-chains** - List chains
- **GET /admin/workflow-chains/:id** - Get chain by ID
- **PUT /admin/workflow-chains/:id** - Update chain (draft only)
- **DELETE /admin/workflow-chains/:id** - Soft-delete chain
- **PATCH /admin/workflow-chains/:id/publish** - Publish chain

### Already Implemented (Story 3.2)

Reference these for UI patterns:

- **WorkflowWizardComponent** (`apps/web/src/app/admin/workflows/wizard/workflow-wizard.component.ts`)
  - Multi-step wizard pattern with signals
  - Two-layer state pattern (parent signal + child FormGroups)
  - viewChild refs for step validation
  - Dirty tracking and unsaved changes handling

- **WizardMetadataStepComponent** - Form pattern with validation
- **ToastService** - Success/error notifications
- **WorkflowTemplateService** - HTTP service pattern (needs `getAll()` method added)

### Shared Types (Already Exist)

- **ChainDefinition** (`libs/shared/src/lib/types/workflow-chain.interface.ts`)
- **ChainInputSource** — actual interface fields:
  - `from_step?: string` + `from_output?: 'outputs'` — reference previous step output
  - `from_input?: string` — inherit from chain's initial inputs
  - `from_chain_config?: boolean` + `value?: string` — fixed value
- **CreateWorkflowChainDto** (`libs/shared/src/lib/dtos/workflow/create-workflow-chain.dto.ts`)
- **UpdateWorkflowChainDto** (`libs/shared/src/lib/dtos/workflow/update-workflow-chain.dto.ts`)
- **WorkflowChainResponseDto** (`libs/shared/src/lib/dtos/workflow/workflow-chain-response.dto.ts`)
- **validateChainSchema** (`libs/shared/src/lib/validators/chain-schema.validator.ts`)

### Patterns to Follow

From `project-context.md`:
- Rule 6: Standalone components with `inject()` for DI
- Rule 7: Custom design system (no Material/PrimeNG/CDK) — use CSS variables, native HTML5 APIs
- Rule 8: Two-layer state pattern for wizards
- Rule 9: Services return Observables
- Rule 10: `data-testid` on all interactive elements

## Tasks / Subtasks

### Task 1: Create WorkflowChainService (HTTP Client)
- [x] Create `workflow-chain.service.ts` in `apps/web/src/app/core/services/`
- [x] Implement methods matching API endpoints:
  - `create(dto: CreateWorkflowChainDto): Observable<WorkflowChainResponseDto>`
  - `getAll(params?: ListWorkflowChainsQueryDto): Observable<WorkflowChainResponseDto[]>`
  - `getById(id: string): Observable<WorkflowChainResponseDto>`
  - `update(id: string, dto: UpdateWorkflowChainDto): Observable<WorkflowChainResponseDto>`
  - `delete(id: string): Observable<void>`
  - `publish(id: string): Observable<WorkflowChainResponseDto>`
- [x] Base URL: `/api/admin/workflow-chains`
- [x] Import shared DTOs from `@project-bubble/shared`
- [x] Use `inject(HttpClient)` pattern

### Task 2: Extend WorkflowTemplateService (AC: 4)
- [x] Add `getAll(params?: { status?: string }): Observable<WorkflowTemplateResponseDto[]>` method
- [x] Endpoint: `GET /api/admin/workflow-templates`
- [x] This is required for the template picker (Task 5) to fetch published templates

### Task 3: Create Chain Builder Container Component (AC: 1, 11, 12)
- [x] Create `chain-builder/` directory in `apps/web/src/app/admin/workflows/`
- [x] Create `chain-builder.component.ts` as the main container
- [x] Implement canonical state signal: `chainState = signal<Partial<ChainDefinition>>({...})`
- [x] Support both create mode and edit mode (based on route param `:id`)
- [x] Load existing chain in edit mode and populate state
- [x] Wire up save/update to WorkflowChainService
- [x] Add dirty tracking (`isDirty` signal)
- [x] Implement `HasUnsavedChanges` interface for route guard
- [x] Add navigation back to workflow studio on save success

### Task 4: Create Chain Metadata Section Component (AC: 2, 13)
- [x] Create `chain-metadata-section.component.ts`
- [x] Reactive form with fields:
  - `name` (required, 1-255 chars)
  - `description` (optional, textarea)
- [x] Sync form values to parent signal on blur/change
- [x] Add info tooltip for description field: "Describe what this chain accomplishes"
- [x] Add `data-testid` attributes: `chain-name-input`, `chain-description-input`
- [x] Expose `isValid(): boolean` method for parent validation

### Task 5: Create Steps List Component (AC: 3, 5, 6)
- [x] Create `chain-steps-list.component.ts`
- [x] Display ordered list of steps with:
  - Step number indicator (1, 2, 3...)
  - Workflow template name (fetch from template service or cache)
  - Step alias (editable)
  - Remove button (disabled if only 2 steps remain)
- [x] Implement up/down arrow buttons for reordering (primary mechanism)
- [x] Optionally implement native HTML5 drag-and-drop (NO CDK — use native `draggable` attribute)
- [x] Visual arrow (↓) between steps to show flow direction
- [x] Add `data-testid` attributes: `chain-step-{index}`, `chain-step-remove-{index}`, `chain-step-up-{index}`, `chain-step-down-{index}`

### Task 6: Create Add Step Component (AC: 4)
- [x] Create `chain-add-step.component.ts`
- [x] Fetch published workflow templates using `WorkflowTemplateService.getAll({ status: 'published' })`
- [x] Display as searchable dropdown with template name + description preview
- [x] On selection, add step to chain with auto-generated alias (`step_{index}`)
- [x] Add `data-testid`: `chain-add-step-button`, `chain-template-picker`
- [x] Add info tooltip: "Select a published workflow to add as a step"

### Task 7: Create Input Mapping Component (AC: 7)
- [x] Create `chain-input-mapping.component.ts`
- [x] For each step (except Step 0), show input mapping configuration
- [x] Input source options (matching `ChainInputSource` interface):
  - **from_step** — From previous step's outputs (select step alias + sets `from_output: "outputs"`)
  - **from_input** — Inherit from chain's initial inputs (enter input name)
  - **from_chain_config** — Fixed value (enter string value)
- [x] Show required inputs based on selected workflow's input schema (from template definition)
- [x] Validate that all required inputs have a mapping configured
- [x] Add `data-testid` attributes: `chain-step-{index}-input-{inputName}-source`, `chain-step-{index}-input-{inputName}-value`
- [x] Add info tooltips explaining each source type

### Task 8: Create Data Flow Visualization (AC: 8)
- [x] Create `chain-data-flow.component.ts`
- [x] Visual summary showing:
  - Each step as a node/box
  - Arrows between steps indicating data flow
  - Input/output labels on connections
- [x] Simple inline SVG or CSS-based visualization (no external libraries)
- [x] Update dynamically as steps/mappings change
- [x] Add `data-testid`: `chain-data-flow-diagram`

### Task 9: Create Visibility Settings Component (AC: 9)
- [x] Create `chain-visibility-settings.component.ts` (or reuse from Story 3.5 if exists)
- [x] Toggle between public and private visibility
- [x] When private, show tenant picker for allowed tenants
- [x] Fetch tenant list via existing `GET /api/admin/tenants` endpoint (TenantsService)
- [x] Add `data-testid` attributes: `chain-visibility-toggle`, `chain-allowed-tenants-picker`
- [x] Add info tooltips: "Public chains are visible to all tenants"

### Task 10: Implement Validation (AC: 10)
- [x] Integrate `validateChainSchema` from `@project-bubble/shared/web` for client-side validation
- [x] Validate before save:
  - Minimum 2 steps
  - All step aliases unique
  - All required inputs mapped (except Step 0)
  - Step 0 has no input mapping
  - from_step references point to previous steps only
- [x] Display validation errors inline and/or in error summary
- [x] Disable save button when validation fails
- [x] Add `data-testid`: `chain-save-button`, `chain-validation-errors`

### Task 11: Route Configuration
- [x] Add route `/admin/workflows/chains/new` for create mode
- [x] Add route `/admin/workflows/chains/:id/edit` for edit mode
- [x] Add `canDeactivate: [unsavedChangesGuard]` for both routes
- [x] Add "Create Chain" button to `workflow-studio.component.ts` (simple addition — full Template Library is Story 3.7)

### Task 12: Unit Tests
- [x] Create `workflow-chain.service.spec.ts`
  - [3.6b-UNIT-001] Test create calls correct endpoint
  - [3.6b-UNIT-002] Test getById returns chain
  - [3.6b-UNIT-003] Test update calls PUT endpoint
  - [3.6b-UNIT-004] Test publish calls PATCH endpoint
- [x] Create `chain-builder.component.spec.ts`
  - [3.6b-UNIT-005] Test initializes empty state in create mode
  - [3.6b-UNIT-006] Test loads existing chain in edit mode
  - [3.6b-UNIT-007] Test save creates chain via service
  - [3.6b-UNIT-008] Test dirty tracking works
- [x] Create `chain-metadata-section.component.spec.ts`
  - [3.6b-UNIT-009] Test form validation for name required
  - [3.6b-UNIT-010] Test syncs values to parent signal
- [x] Create `chain-steps-list.component.spec.ts`
  - [3.6b-UNIT-011] Test displays steps in order
  - [3.6b-UNIT-012] Test remove button disabled when 2 steps
  - [3.6b-UNIT-013] Test reorder moves step up/down
- [x] Create `chain-add-step.component.spec.ts`
  - [3.6b-UNIT-014] Test only shows published templates
  - [3.6b-UNIT-015] Test adds step with auto-generated alias
- [x] Create `chain-input-mapping.component.spec.ts`
  - [3.6b-UNIT-016] Test shows mapping options for non-first steps
  - [3.6b-UNIT-017] Test validates required inputs mapped

## Dev Notes

### Architecture Patterns

- **Standalone Components**: All components `standalone: true` with `inject()` for DI
- **Two-Layer State**: Parent `chainState` signal + child FormGroups
- **Client-Side Validation**: Use shared `validateChainSchema` for immediate feedback
- **Observable HTTP**: Services return `Observable<T>`, not Promises
- **Custom Styling**: Use CSS variables from `styles.scss` (NO third-party UI libraries, NO Angular CDK)
- **Native Drag-Drop**: If implementing drag-drop, use HTML5 `draggable` attribute + native events

### Chain Definition Structure (from actual interface)

```typescript
// libs/shared/src/lib/types/workflow-chain.interface.ts
interface ChainDefinition {
  metadata: ChainMetadata;
  steps: ChainStep[];
}

interface ChainMetadata {
  name: string;
  description: string;
}

interface ChainStep {
  workflow_id: string;
  alias: string;
  input_mapping?: Record<string, ChainInputSource>;
}

interface ChainInputSource {
  from_step?: string;          // alias of previous step
  from_output?: 'outputs';     // must be "outputs" if from_step is set
  from_input?: string;         // inherit from chain initial inputs
  from_chain_config?: boolean; // true if fixed value
  value?: string;              // required when from_chain_config is true
}
```

### Input Mapping Logic

1. **Step 0** (first step): No input mapping allowed — inputs come from user at runtime
2. **Step 1+**: Each input must specify exactly one source type:
   - `{ from_step: "step_0", from_output: "outputs" }` — takes output from named step
   - `{ from_input: "user_file" }` — inherits from chain's initial inputs
   - `{ from_chain_config: true, value: "summary" }` — fixed value set at chain definition time

### Component Tree

```
ChainBuilderComponent (container)
├── ChainMetadataSectionComponent
├── ChainStepsListComponent
│   └── ChainAddStepComponent
├── ChainInputMappingComponent
├── ChainDataFlowComponent
└── ChainVisibilitySettingsComponent
```

### Error Handling

- Show toast on save success/error
- Show inline validation errors for form fields
- Show validation summary at bottom/top of form for structural errors
- Disable save button when form invalid

### Dependencies

| Dependency | Source | Notes |
|------------|--------|-------|
| WorkflowTemplateService.getAll() | Task 2 | Must add this method before Task 6 |
| TenantsService or direct HTTP | Existing | For tenant picker in visibility settings |
| validateChainSchema | `@project-bubble/shared/web` | Already exported |
| unsavedChangesGuard | Existing | Already used by workflow wizard |

### References

- [WorkflowWizardComponent](../../apps/web/src/app/admin/workflows/wizard/workflow-wizard.component.ts) - Wizard pattern reference
- [WorkflowTemplateService](../../apps/web/src/app/core/services/workflow-template.service.ts) - HTTP service pattern
- [chain-schema.validator.ts](../../libs/shared/src/lib/validators/chain-schema.validator.ts) - Validation logic
- [workflow-chain.interface.ts](../../libs/shared/src/lib/types/workflow-chain.interface.ts) - Type definitions
- [Project Context](../../project-context.md) - Rules 6, 7, 8, 9, 10
- [Story 3.6a](./3-6a-workflow-chain-crud-api.md) - API endpoints
- [app.routes.ts](../../apps/web/src/app/app.routes.ts) - Existing route patterns

## Test IDs

Use these test ID prefixes for unit tests:
- `[3.6b-UNIT-001]` through `[3.6b-UNIT-017]` for unit tests

## Definition of Done

- [x] All acceptance criteria met
- [x] All tasks completed
- [x] Unit tests passing (target: 17+ tests)
- [x] No lint errors (`nx lint web`)
- [x] Build succeeds (`nx build web`)
- [x] All interactive elements have `data-testid` attributes
- [x] Code review passed

---

## File List

### Files to Create
| File | Purpose |
|------|---------|
| `apps/web/src/app/core/services/workflow-chain.service.ts` | HTTP service for chain API |
| `apps/web/src/app/core/services/workflow-chain.service.spec.ts` | Service unit tests |
| `apps/web/src/app/admin/workflows/chain-builder/chain-builder.component.ts` | Container component |
| `apps/web/src/app/admin/workflows/chain-builder/chain-builder.component.html` | Container template |
| `apps/web/src/app/admin/workflows/chain-builder/chain-builder.component.scss` | Container styles |
| `apps/web/src/app/admin/workflows/chain-builder/chain-builder.component.spec.ts` | Container tests |
| `apps/web/src/app/admin/workflows/chain-builder/chain-metadata-section.component.ts` | Metadata form |
| `apps/web/src/app/admin/workflows/chain-builder/chain-metadata-section.component.spec.ts` | Metadata tests |
| `apps/web/src/app/admin/workflows/chain-builder/chain-steps-list.component.ts` | Steps list |
| `apps/web/src/app/admin/workflows/chain-builder/chain-steps-list.component.spec.ts` | Steps list tests |
| `apps/web/src/app/admin/workflows/chain-builder/chain-add-step.component.ts` | Add step picker |
| `apps/web/src/app/admin/workflows/chain-builder/chain-add-step.component.spec.ts` | Add step tests |
| `apps/web/src/app/admin/workflows/chain-builder/chain-input-mapping.component.ts` | Input mapping config |
| `apps/web/src/app/admin/workflows/chain-builder/chain-input-mapping.component.spec.ts` | Input mapping tests |
| `apps/web/src/app/admin/workflows/chain-builder/chain-data-flow.component.ts` | Data flow viz |
| `apps/web/src/app/admin/workflows/chain-builder/chain-visibility-settings.component.ts` | Visibility controls |

### Files to Modify
| File | Changes |
|------|---------|
| `apps/web/src/app/core/services/workflow-template.service.ts` | Add `getAll()` method |
| `apps/web/src/app/app.routes.ts` | Add chain builder routes under `/admin/workflows/chains/` |
| `apps/web/src/app/admin/workflows/workflow-studio.component.ts` | Add "Create Chain" button |

---

## Review Fixes Applied

| Issue ID | Severity | Fix Applied |
|----------|----------|-------------|
| H1 | HIGH | Routes changed from `/admin/workflow-studio/chains/` to `/admin/workflows/chains/` (matches existing pattern) |
| H2 | HIGH | AC 14 removed — outputs always visible by default (Epic 4/5 handles storage/display) |
| H3 | HIGH | Task 2 added to extend WorkflowTemplateService with `getAll()` method |
| M1 | MEDIUM | Task 7 input sources corrected to match `ChainInputSource` interface (`from_step`, `from_input`, `from_chain_config`) |
| M2 | MEDIUM | Task 5 updated: up/down buttons primary, native HTML5 drag-drop optional, NO CDK |
| M3 | MEDIUM | Task 9 updated: use existing `GET /api/admin/tenants` for tenant picker |
| M4 | MEDIUM | File List updated with all spec files |
| L1 | LOW | Task 11 clarified: "Create Chain" button is simple addition, full Template Library is Story 3.7 |
| L2 | LOW | Component tree simplified (removed ChainIntermediateOutputsComponent) |

---

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Story Creation | Initial story creation from Epic 3.6b requirements |
| 2026-02-04 | Story Review | Applied 9 fixes (H1-H3, M1-M4, L1-L2) based on codebase verification |
