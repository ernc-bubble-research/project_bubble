# Override 07: Dev Story Workflow Structural Gates

## Operation: INSERT/REPLACE BLOCKS
## Target: `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`
## Idempotency: Skip each change if detection text already exists
## Written against BMAD version: as of 2026-02-25

## Why

Epic 4 retrospective identified three structural failures in the dev-story workflow:
1. Task checkboxes could be batch-checked without verifying implementation (task fraud)
2. Tracked/deferred items were "noted" in conversation but never written to tracking files
3. The completion step didn't enforce the 3-pass code review launch sequence

These gates make bad behavior physically impossible regardless of which agent runs the workflow.

## Change 1: Per-Task Verification Gate (Step 8)

**Location**: In step 8 (task completion), find the section that marks tasks complete.
**Detection**: Search for "PER-TASK VERIFICATION GATE" or "NEVER use replace_all or batch operations on task checkboxes"
**Intent**: Each task must be verified individually with file:line citations for both implementation AND test. No batch operations on checkboxes.

Find the block that says "ONLY THEN mark the task (and subtasks) checkbox with [x]" and replace/enhance it with:

```xml
<!-- PER-TASK VERIFICATION GATE (no batch operations — each task verified individually) -->
<critical>NEVER use replace_all or batch operations on task checkboxes. Each task is verified and checked INDIVIDUALLY via a separate Edit call.</critical>
<check if="ALL validation gates pass AND tests ACTUALLY exist and pass">
  <action>For THIS specific task, cite the implementation evidence: file path and line number(s) where the task's functionality is implemented</action>
  <action>For THIS specific task, cite the test evidence: file path and line number(s) where the test covering this task exists</action>
  <action>ONLY THEN mark THIS SINGLE task checkbox with [x] using an individual Edit tool call — NOT replace_all, NOT batch</action>
  <action>Update File List section with ALL new, modified, or deleted files (paths relative to repo root)</action>
  <action>Add completion notes to Dev Agent Record summarizing what was ACTUALLY implemented and tested</action>
</check>
```

## Change 2: Tracked Item Enforcement Gate (Step 8, after task completion)

**Location**: In step 8, after the task completion and before the "Save the story file" / loop-back actions.
**Detection**: Search for "TRACKED ITEM ENFORCEMENT GATE"
**Intent**: Any item deferred or tracked during implementation must be written to sprint-status.yaml with a specific story ID immediately. No "noted in conversation" without file write.

Insert before `<action>Save the story file</action>`:

```xml
<!-- TRACKED ITEM ENFORCEMENT GATE -->
<critical>Any item marked "TRACKED" or "deferred" during implementation MUST be written to sprint-status.yaml with a specific story ID in the SAME turn. Saying "tracked" in conversation text without a file write is NOT tracking — it is forgetting.</critical>
<action>Check if any findings or items were deferred/tracked during this task's implementation</action>
<check if="deferred or tracked items exist">
  <action>For EACH tracked item: write it to sprint-status.yaml under the target story ID immediately via Edit tool</action>
  <action>If no target story ID exists, create a new backlog entry in sprint-status.yaml with a descriptive key</action>
  <action>Verify the write succeeded — the tracked item must exist in the file, not just in conversation</action>
</check>
```

## Change 3: 3-Pass Code Review Launch Sequence (Step 10)

**Location**: In step 10 (completion communication), replace the tip about using a different LLM.
**Detection**: Search for "MANDATORY 3-PASS CODE REVIEW LAUNCH SEQUENCE"
**Intent**: After implementation, the dev agent must clearly state the 3-pass sequence AND explicitly declare what she will NOT do. This makes the expected behavior visible to the user.

Find the line with "Tip: For best results, run code-review using a different LLM" and replace that entire output block with:

```xml
<!-- MANDATORY 3-PASS CODE REVIEW LAUNCH SEQUENCE -->
<critical>Code review is a MANDATORY 3-pass process. The dev agent (Amelia) runs Pass 1 ONLY. Pass 2 and Pass 3 MUST be launched VIA PARTY MODE by the user. The dev agent has NO alternative path.</critical>
<output>**Pass 1 complete. Implementation ready for review.**

  **Next steps — MANDATORY 3-PASS CODE REVIEW:**
  1. Run Pass 1 (self-review): `[CR]` menu item or `code-review` workflow — I do this now.
  2. After Pass 1, launch Pass 2 (Naz) VIA PARTY MODE — I have NO role in Pass 2. Naz presents findings directly to the team.
  3. After Pass 3, launch Pass 3 (Murat) VIA PARTY MODE — I have NO role in Pass 3. Murat presents findings directly to the team.

  **I will NOT:**
  - Present, summarize, or filter Pass 2 or Pass 3 findings
  - Launch Pass 2 or Pass 3 as Task agents
  - Attach verdicts (FIX/TRACK/REJECT) to findings I did not generate
  - Speak during Pass 2 or Pass 3 presentations unless directly asked by the user

  Story is NOT done until all 3 passes complete.
</output>
```

## Change 4: Winston Architectural Review Gate (Step 3)

**Location**: In step 3 (review continuation detection), inside the "fresh start" check block (where `review_continuation == false`), after the `<output>🚀 **Starting Fresh Implementation**...` output block and before its closing `</check>`.
**Detection**: Search for "WINSTON ARCHITECTURAL REVIEW GATE"
**Intent**: Before implementation begins on a new story, verify Winston (Architect) has reviewed the story design via party mode. Review continuations (resuming after code review fixes) skip this gate since Winston already approved before first implementation.

Insert after the output block and before the `</check>` closing the fresh-start block:

```xml
<!-- WINSTON ARCHITECTURAL REVIEW GATE (fresh starts only — skipped on review continuation) -->
<critical>ARCHITECTURAL REVIEW GATE: Winston (Architect) must review this story's design BEFORE first implementation begins. This gate cannot be bypassed for new stories.</critical>
<action>Check if story file contains "Winston Architectural Review" section OR a "winston_reviewed" marker in story metadata OR a "Winston: ✅" line in Dev Notes</action>
<check if="architectural review marker NOT found in story">
  <ask>⚠️ No Winston architectural review marker found for this story.

    Has Winston (Architect) reviewed this story's design via party mode?
    - Yes → I'll record the confirmation and proceed
    - No → HALT. Launch Winston via party mode to review the story design before proceeding.</ask>
  <check if="user confirms yes (reviewed)">
    <action>Add to story Dev Agent Record: "Winston architectural review confirmed by {user_name} before implementation start — {{date}}"</action>
    <action>Continue to step 4</action>
  </check>
  <check if="user says no (not yet reviewed)">
    <action>HALT: "Winston's architectural review is required before implementation starts. Launch Winston (Architect) via party mode, get his review and approval, then resume implementation."</action>
  </check>
</check>
```

## Verification

After applying all 4 changes:
1. Step 8 contains "PER-TASK VERIFICATION GATE" critical block
2. Step 8 contains "TRACKED ITEM ENFORCEMENT GATE" critical block
3. Step 10 contains "MANDATORY 3-PASS CODE REVIEW LAUNCH SEQUENCE" critical block
4. Step 3 (fresh start block) contains "WINSTON ARCHITECTURAL REVIEW GATE" critical block
5. No "replace_all" or batch checkbox language exists in step 8
6. The old "Tip: For best results" line is replaced with the full launch sequence
