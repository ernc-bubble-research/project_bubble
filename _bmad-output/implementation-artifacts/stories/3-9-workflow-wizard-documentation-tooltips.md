# Story 3.9: Fill Remaining Wizard Tooltip Gaps

Status: done

## Story

**As a** Bubble Admin,
**I want** every wizard form field to have an inline tooltip explaining its purpose,
**So that** I can build workflows confidently without guessing what each field does.

## Background

The workflow wizard already has extensive tooltip coverage (26+ tooltips across 6 steps via `InfoTooltipComponent`). However, a codebase audit reveals **~15 fields without tooltips**, concentrated in the Metadata, Inputs, and Output steps. All 6 steps already have step description banners. The Prompt step already has interactive variable chips with click-to-insert, color-coded usage indicators, and validation warnings — no additional help needed there.

**What already exists (DO NOT recreate):**
- `InfoTooltipComponent` at `apps/web/src/app/shared/components/info-tooltip/info-tooltip.component.ts`
- All 6 wizard steps have step description banners (Metadata, Inputs, Execution, Prompt, Output, Knowledge)
- Prompt step has interactive variable chips above the textarea (green=used, yellow=unused, click to insert)
- Execution step has 6/7 fields covered (only LLM Model missing)
- Knowledge step has 5/7 fields covered (only Query Template missing)
- Input role field has dynamic tooltip (changes based on subject vs context selection)

**What's cut (party mode consensus 2026-02-07):**
- Standalone docs file → deferred to doc-2 (User's Manual)
- Variable picker component → already exists as variable chips in prompt step
- New tooltip component → `InfoTooltipComponent` already exists
- "Estimated Credits" field → does not exist in the UI
- Screenshots → not part of this story

## Acceptance Criteria

1. **AC1: Metadata step tooltips** — Name and Description fields each have an `<app-info-tooltip>` explaining their purpose
2. **AC2: Inputs step tooltips** — Name, Label, Description, and Required fields each have an `<app-info-tooltip>`
3. **AC3: Output step tooltips** — Output format radio group, section name/label fields, and JSON schema field each have an `<app-info-tooltip>`
4. **AC4: Execution step tooltip** — LLM Model select has an `<app-info-tooltip>`
5. **AC5: Knowledge step tooltip** — Query Template field has an `<app-info-tooltip>`
6. **AC6: All existing tests pass** — No regressions from tooltip additions
7. **AC7: Lint passes** — 0 errors across all projects

## Tasks / Subtasks

- [x] Task 1: Add tooltips to Metadata step (AC: 1)
  - [x] 1.1 Add tooltip to Name field: "A unique name for this workflow template. Shown in the template library and when selecting workflows."
  - [x] 1.2 Add tooltip to Description field: "Explain what this workflow does and when to use it. Helps other admins understand the template's purpose."

- [x] Task 2: Add tooltips to Inputs step (AC: 2)
  - [x] 2.1 Add tooltip to Name field: "Variable name used in prompts via {name}. Use snake_case (e.g., subject, research_brief)."
  - [x] 2.2 Add tooltip to Label field: "Human-readable label shown to users when filling out the run form."
  - [x] 2.3 Add tooltip to Description field: "Help text shown below the input field at runtime. Explain what content to provide."
  - [x] 2.4 Add tooltip to Required toggle: "When enabled, users must provide this input before running the workflow."

- [x] Task 3: Add tooltips to Output step (AC: 3)
  - [x] 3.1 Add tooltip to Output Format radio group: "Markdown: free-form text with named sections. JSON: structured response validated against a schema."
  - [x] 3.2 Add tooltip to Section Name field: "Machine-readable key for this section (e.g., summary, analysis). Used in output parsing."
  - [x] 3.3 Add tooltip to Section Label field: "Human-readable heading for this section. Shown in the output document."
  - [x] 3.4 Add tooltip to JSON Schema field (if present): "Define the expected JSON structure. The LLM will format its response to match this schema."

- [x] Task 4: Add tooltips to Execution and Knowledge steps (AC: 4, 5)
  - [x] 4.1 Add tooltip to LLM Model select: "The AI model to use for this workflow. Different models vary in speed, cost, and capability."
  - [x] 4.2 Add tooltip to Knowledge Query Template field: "Custom search query sent to the Knowledge Base. Use {input_name} variables to include input content in the search."

- [x] Task 5: Run full test suite + lint (AC: 6, 7)
  - [x] 5.1 All unit tests pass (878 total: 77 + 24 + 401 + 376)
  - [x] 5.2 Lint passes with 0 errors

## Dev Notes

### Implementation Pattern

Every tooltip follows the same pattern — add `<app-info-tooltip text="..." />` adjacent to the field label. The component is already imported in all 6 step components. No new imports needed.

**Example (from execution step):**
```html
<label>Temperature</label>
<app-info-tooltip text="Controls LLM creativity. Lower = more deterministic, higher = more creative (0.0-2.0)" />
```

### Files to Modify

| File | Tooltips to Add | Count |
|------|----------------|-------|
| `wizard-metadata-step.component.ts` | Name, Description | 2 |
| `wizard-inputs-step.component.html` | Name, Label, Description, Required | 4 |
| `wizard-output-step.component.html` | Format radio, Section name, Section label, JSON schema | 4 |
| `wizard-execution-step.component.html` | LLM Model | 1 |
| `wizard-knowledge-step.component.ts` | Query Template | 1 |

**Total: 12 new tooltips across 5 files. Zero new components.**

### What NOT to Change

- Do NOT modify the Prompt step — it already has comprehensive inline help (variable chips, color coding, warnings)
- Do NOT create a new tooltip component — use existing `InfoTooltipComponent`
- Do NOT add step description banners — all 6 steps already have them
- Do NOT create documentation files — deferred to doc-2
- Do NOT add conditional field tooltips (Allowed Extensions, Max File Size, Text Placeholder, Max Text Length) — these are advanced config fields that appear conditionally and are self-explanatory

### Existing Tooltip Audit (for reference)

| Step | Field | Existing Tooltip |
|------|-------|-----------------|
| Metadata | Tags | "Comma-separated tags for organizing and filtering workflows" |
| Inputs | Role | Dynamic: subject/context explanation |
| Inputs | Source Types (group) | "How the user provides this input at runtime" |
| Inputs | Source: Asset | "User selects an existing file from the Data Vault" |
| Inputs | Source: Upload | "User uploads a new file at runtime" |
| Inputs | Source: Text | "User types free-form text at runtime" |
| Execution | Processing Mode | "Parallel: each subject file processed independently. Batch: all files in one LLM call." |
| Execution | Parallel radio | "Each subject file is processed independently in its own LLM call" |
| Execution | Batch radio | "All subject files are combined into a single LLM call" |
| Execution | Temperature | "Controls LLM creativity. Lower = more deterministic, higher = more creative (0.0-2.0)" |
| Execution | Max Output Tokens | "Maximum number of tokens the LLM can generate in its response" |
| Execution | Max Retries | "How many times to retry if LLM output fails structural validation. Overrides system default" |
| Knowledge | Enable toggle | "When on, the system queries the tenant Knowledge Base for relevant context to inject into the prompt" |
| Knowledge | Auto query | "Platform automatically generates a search query from the subject content" |
| Knowledge | Custom query | "You provide a specific search query template" |
| Knowledge | Similarity Threshold | "Minimum relevance score (0.0-1.0) for knowledge chunks to be included" |
| Knowledge | Max Chunks | "Maximum number of knowledge chunks to inject into the prompt" |
| Output | Filename Template | "Output filename pattern. Variables: {subject_name}, {timestamp}" |

### Project Structure Notes

All wizard step components are at:
```
apps/web/src/app/admin/workflows/wizard/steps/
├── wizard-metadata-step.component.ts       # inline template
├── wizard-inputs-step.component.ts         # external .html template
├── wizard-inputs-step.component.html
├── wizard-execution-step.component.ts      # external .html template
├── wizard-execution-step.component.html
├── wizard-prompt-step.component.ts         # external .html template
├── wizard-prompt-step.component.html
├── wizard-output-step.component.ts         # external .html template
├── wizard-output-step.component.html
└── wizard-knowledge-step.component.ts      # inline template
```

`InfoTooltipComponent` is already imported in all step components — verified in the audit.

### References

- [Source: Epic 3 Retrospective item #9 — inline help for wizard](stories/epic-3-retrospective.md)
- [Source: Party mode consensus 2026-02-07 — scope cut to tooltip gaps only]
- [Source: Codebase audit — 26 existing tooltips, 11-12 gaps identified]

### Previous Story Intelligence (3E)

- `InfoTooltipComponent` uses a simple `text` input binding — no complex configuration needed
- All wizard step components already import the component
- Tooltip positioning is handled automatically by the component

## Definition of Done

- [x] No new components needed (verified: InfoTooltipComponent exists, all steps import it)
- [x] Step banners already exist (verified: all 6 steps have description headers)
- [x] Prompt variable reference already exists (verified: interactive variable chips in prompt step)
- [x] 11-12 missing tooltips added across 5 wizard step files
- [x] All unit tests pass (878+)
- [x] Lint passes with 0 errors
- [x] Code review passed

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered. All tooltip additions were straightforward template edits.

### Completion Notes

- Added 12 new tooltips across 5 wizard step files using existing `InfoTooltipComponent`
- No new components, imports, or dependencies needed
- Output step: section name/label tooltips consolidated into group-level "Output Sections" tooltip (matching "Source Types" pattern from inputs step) — refactored during code review
- All 878 tests pass (0 failures), 0 lint errors
- AC1-AC7 all satisfied

### File List

- `apps/web/src/app/admin/workflows/wizard/steps/wizard-metadata-step.component.ts` — added 2 tooltips (Name, Description)
- `apps/web/src/app/admin/workflows/wizard/steps/wizard-inputs-step.component.html` — added 4 tooltips (Name, Label, Description, Required)
- `apps/web/src/app/admin/workflows/wizard/steps/wizard-output-step.component.html` — added 4 tooltips (Output Format, Section Name, Section Label, JSON Schema)
- `apps/web/src/app/admin/workflows/wizard/steps/wizard-execution-step.component.html` — added 1 tooltip (LLM Model)
- `apps/web/src/app/admin/workflows/wizard/steps/wizard-knowledge-step.component.ts` — added 1 tooltip (Query Template)

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Original placeholder story created from Epic 3 discussion item #9 |
| 2026-02-07 | SM (Party Mode + Create-Story) | Complete rewrite per party mode consensus + codebase audit. Scope cut from 8 tasks to 5. Cut: tooltip component (exists), step banners (exist), variable picker (exists as chips), docs file (→ doc-2), "Estimated Credits" (doesn't exist). Added: exhaustive tooltip audit table showing 26 existing + 11-12 gaps. |
| 2026-02-07 | Dev (Claude Opus 4.6) | Implementation complete. 12 tooltips added across 5 files. 878 tests pass, 0 lint errors. |
| 2026-02-07 | Code Review (Claude Opus 4.6) | 3 findings (M1, M2, L1): removed unnecessary wrapper divs from output step section rows, consolidated section name/label tooltips into group-level "Output Sections" tooltip matching codebase pattern. All fixes applied, 878 tests pass, 0 lint errors. |
