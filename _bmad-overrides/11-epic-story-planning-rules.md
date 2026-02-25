# Override 11: Epic & Story Planning Workflow Rules

## Operation: INSERT BLOCKS (3 files, 4 insertions)
## Targets:
##   - `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-03-create-stories.md`
##   - `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md`
##   - `_bmad/bmm/workflows/4-implementation/sprint-status/instructions.md`
## Idempotency: Skip each insertion if its detection text already exists
## Written against BMAD version: as of 2026-02-25

## Why

Rules 14, 15, 19, and 20 were passive text in project-context.md. Epic 3 retrospective pattern: 7 stories shipped fast → 9 remediation stories in retro. These rules prevent exactly that. Structural embedding in the planning workflows forces the analysis at the right moment — before stories are written, before epics start, and between stories during execution.

---

## Target 1: step-03-create-stories.md

### Insertion A: Missing Journey Analysis + Story Sizing Limit (Rule 20 + Rule 11)

**Detection**: Search for "MISSING JOURNEY ANALYSIS"
**Location**: After the "AC Writing Guidelines" section (after the bullet list ending with "Reference specific requirements when applicable"), insert this block.

```markdown
**🔍 MISSING JOURNEY ANALYSIS — run adversarially for EVERY story (Rule 20):**

Before writing ACs, answer all three questions:

1. "What does the user do BEFORE this story?" → Is there a missing prerequisite story?
2. "What does the user do AFTER this story?" → Is there a missing follow-up story?
3. "What if the user gets stuck or encounters an error?" → Is there a missing error/recovery story?

If any question has no answer, there is likely a gap in the epic. Surface the gap to the user before writing ACs. Do NOT assume a gap is intentional. Do NOT fill gaps with assumptions — bring them to the user.

**🚫 STORY SIZING LIMIT (Rule 11):** Each story may have at most 7 tasks and 10 acceptance criteria. If a story would exceed this, split it into smaller stories before presenting to the user.
```

---

## Target 2: step-04-final-validation.md

### Insertion B: Pre-Epic Completeness Gate (Rule 15)

**Detection**: Search for "Pre-Epic Completeness Gate (Rule 15"
**Location**: After the "Epic Structure Validation" section (section 4), before the "Dependency Validation (CRITICAL)" section (section 5).

```markdown
### 4b. Pre-Epic Completeness Gate (Rule 15 — MANDATORY)

For each epic, confirm ALL 5 gates pass before marking it ready for story creation:

1. **All user journeys mapped?** (before, during, after the feature — not just the happy path)
2. **Missing flows identified?** (onboarding, error states, empty states, edge cases — list explicitly)
3. **Infrastructure dependencies verified?** (does this epic depend on something that doesn't exist yet?)
4. **Documentation needs identified?** (tooltips, help text, user guides — where are they needed?)
5. **Test strategy defined?** (unit, E2E, integration — what gets tested and how?)

Any gap, ambiguity, or missing user journey MUST be surfaced to the user and resolved BEFORE story creation is approved. Do NOT assume gaps are acceptable. Do NOT fill gaps with assumptions.

### 4c. Epic Infrastructure Dependency Check (Rule 19)

For every epic, explicitly ask: **"What infrastructure does this epic depend on that doesn't exist yet?"**

- If non-empty: that infrastructure MUST go INTO this epic's stories as early stories — not deferred to later.
- If infrastructure is already planned in an earlier epic: verify that epic will be complete before this one begins.
- Infrastructure MUST come BEFORE features that depend on it. No epic may build on infrastructure planned for a later epic.
```

---

## Target 3: sprint-status/instructions.md

### Insertion C: Mid-Epic Check-in Rule (Rule 14)

**Detection**: Search for "mid-epic check-in as due (Rule 14)"
**Location**: At the END of the risk detection list in step 2 (after the last "IF any epic has status in-progress but has no associated stories" bullet).

```
- IF any in-progress epic has 2 or more stories with status "done": flag mid-epic check-in as due (Rule 14). Display: "⏰ Mid-Epic Check-in Due for Epic [N] — [X] stories complete. Agenda: (1) What's blocked? (2) What's missing from remaining stories? (3) Any scope creep? (4) Technical debt accumulating? Run this check-in before starting the next story."
```

## Verification

After applying:
1. `step-03-create-stories.md` contains "MISSING JOURNEY ANALYSIS" block after AC Writing Guidelines
2. `step-03-create-stories.md` contains "STORY SIZING LIMIT (Rule 11)" note
3. `step-04-final-validation.md` has "Pre-Epic Completeness Gate (Rule 15)" section (4b)
4. `step-04-final-validation.md` has "Epic Infrastructure Dependency Check (Rule 19)" section (4c)
5. `sprint-status/instructions.md` risk list contains "mid-epic check-in as due (Rule 14)" entry
