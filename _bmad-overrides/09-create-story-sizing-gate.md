# Override 09: Story Sizing Gate in Create-Story Workflow

## Operation: INSERT CRITICAL BLOCK
## Target: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
## Idempotency: Skip if "STORY SIZING GATE" already exists in step 5
## Written against BMAD version: as of 2026-02-25

## Why

Rule 11 (Story Sizing) was a passive text rule in project-context.md that agents knew but didn't follow — the 4-RLS story was created with 8 tasks/29 subtasks/10 ACs despite the rule existing. The fix is structural: block oversized stories at the workflow level, at the moment they are finalized, before they reach a developer.

## What to Change

In `instructions.xml`, inside `<step n="5">` (the story creation step), find the `<!-- CRITICAL: Set status to ready-for-dev -->` comment. **Before** that comment, insert the sizing gate.

### Insertion: Story Sizing Gate

**Detection**: Search for "STORY SIZING GATE"

```xml
<!-- STORY SIZING GATE (Rule 11) — check BEFORE setting ready-for-dev -->
<critical>STORY SIZING GATE: Count tasks and ACs in the generated story BEFORE marking it ready-for-dev.
    Maximum allowed: 7 tasks (top-level) | 10 acceptance criteria
    If EITHER limit is exceeded: STOP. Split the story into multiple smaller stories first.
    Do NOT mark an oversized story as ready-for-dev. Split → mark each part ready-for-dev separately.
    An oversized story that reaches dev is a process violation — catch it here.</critical>
<action>Count tasks and ACs in the generated story. If tasks &gt; 7 OR ACs &gt; 10, restructure as multiple smaller stories before proceeding.</action>
```

Insert this block just before `<!-- Final status update -->` and `<template-output file="{default_output_file}">story_completion_status</template-output>`.

## Verification

After applying, step 5 of create-story/instructions.xml should:
1. Generate the story content
2. Run the sizing gate check (detect "STORY SIZING GATE")
3. Only set status to "ready-for-dev" after the sizing gate passes
