# Story 3.11: Prompt-to-Output Section Auto-Population — CANCELLED

Status: cancelled

## Cancellation Decision

**Date:** 2026-02-08
**Decision Method:** Party mode planning session (Rule 23)
**Participants:** Winston (Architect), Amelia (Dev), Murat (TEA), Sally (UX), John (PM), Bob (SM), erinc (PO)

## Rationale

The prompt already defines output structure via its own markdown instructions (e.g., `#### Final Report: Executive Summary`, `#### 3.1 Key Strategic Insights`). The LLM returns a formatted markdown report. The report UI (Epic 5) renders it directly.

Pre-defined output sections in the wizard are unnecessary overhead — they collect data that the execution engine never uses. The feedback loop is full-document regeneration: input file + previous report + user feedback → LLM → updated report. Per-section regeneration is deferred to the LangGraph phase.

## Changes Made

1. **Wizard UI:** Output step (step 5) removed from the wizard stepper, template, validation, and error routing. Component files preserved but not wired in.
2. **Validator:** `output` made entirely optional in `workflow-schema.validator.ts`. Sections and filename_template no longer required. Format still validated if provided.
3. **Tests:** Validator tests updated (23 pass). Wizard tests updated (451 pass).

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### File List
- `apps/web/src/app/admin/workflows/wizard/workflow-wizard.component.ts` — removed Output step references
- `apps/web/src/app/admin/workflows/wizard/workflow-wizard.component.html` — removed @case(4) output step block
- `apps/web/src/app/admin/workflows/wizard/workflow-wizard.component.spec.ts` — updated step index in test
- `libs/shared/src/lib/validators/workflow-schema.validator.ts` — made output optional
- `libs/shared/src/lib/validators/workflow-schema.validator.spec.ts` — updated/added tests for optional output
