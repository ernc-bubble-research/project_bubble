# Override 10: Dev-Story Workflow — Pre-Flight, Reporting, and DoD Rules

## Operation: INSERT CRITICAL BLOCKS (3 insertions)
## Target: `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`
## Idempotency: Skip each insertion if its detection text already exists
## Written against BMAD version: as of 2026-02-25

## Why

Process rules 12, 12b, 17, 18, 24, and 26 were passive text in project-context.md. The Epic 4 retrospective finding: rules don't work. Structural enforcement in workflows does. Three insertions cover the full lifecycle: pre-flight (before coding), test reporting (during validation), and DoD (before completing the story).

---

## Insertion 1: Story Pre-Flight Check (Rule 18)

**Detection**: Search for "STORY PRE-FLIGHT CHECK"
**Location**: Inside `<step n="3">`, inside the `<check if="Senior Developer Review section does NOT exist">` block, after the Winston Architectural Review Gate check and before the closing `</check></step>`.

```xml
<!-- STORY PRE-FLIGHT CHECK (Rule 18 — fresh starts only) -->
<critical>STORY PRE-FLIGHT CHECK: Before writing any code, verify ALL 4 gates:
    1. Dependencies met? List every infrastructure piece this story requires. Does it exist and work today?
    2. User journey complete? What does the user do BEFORE this story? AFTER? What if they get stuck or hit an error?
    3. Documentation needed? If this story has user-facing UI, documentation subtasks (tooltips, empty states, error states) MUST already be in the task list before implementation begins.
    4. Test strategy clear? Identify: (a) what needs unit tests, (b) what needs integration/wiring tests, (c) which E2E flows to cover.
    If ANY gate fails or is "unclear" — surface to user BEFORE proceeding with implementation.</critical>
<action>Verify all 4 pre-flight gates above. Surface any gaps to user before writing any code.</action>
```

---

## Insertion 2: Mandatory Test Reporting Format

**Detection**: Search for "MANDATORY TEST REPORTING FORMAT"
**Location**: At the END of `<step n="7">`, after the last `<action if="new tests fail">` line and before `</step>`.

```xml
<critical>MANDATORY TEST REPORTING FORMAT: After every test/lint run, report metrics in this exact format — every project, no omissions:
    Tests:    api-gateway: X | web: X | db-layer: X | shared: X
    Errors:   api-gateway: X | web: X | db-layer: X | shared: X
    Warnings: api-gateway: X | web: X | db-layer: X | shared: X
    Warnings are bugs — report and investigate every one. A warning in 5 places = 5 bugs, not "a consistent pattern." NEVER omit any project's metrics from the report.</critical>
```

---

## Insertion 3: Enhanced Definition of Done Checklist (Rules 12, 12b, 17, 24, 26)

**Detection**: Search for "E2E test coverage included for ALL story features"
**Location**: Inside `<step n="9">`, replace the `<action>Validate definition-of-done checklist with essential requirements:` block.

**New DoD checklist** (replace the existing one):

```xml
<action>Validate definition-of-done checklist with essential requirements:
  - All tasks/subtasks marked complete with [x]
  - Implementation satisfies every Acceptance Criterion
  - Unit tests for core functionality added/updated
  - Integration tests for component interactions added when required
  - E2E test coverage included for ALL story features — mandatory, not optional (Rule 12)
  - AC-to-test traceability table present and complete in story file (Rule 12b)
  - For UI stories: documentation subtasks complete — tooltips, empty states, error states (Rule 17)
  - Module wiring tests present for any service/module wiring changes (Rule 24)
  - Browser smoke test passed: page loads, happy path works, icons render — UI stories only (Rule 26)
  - All tests pass (no regressions, new tests successful)
  - Code quality checks pass (linting, static analysis if configured)
  - File List includes every new/modified/deleted file (relative paths)
  - Dev Agent Record contains implementation notes
  - Change Log includes summary of changes
  - Only permitted story sections were modified
</action>
```

## Verification

After applying, `dev-story/instructions.xml` should have:
1. "STORY PRE-FLIGHT CHECK" block in step 3 (fresh starts only, after Winston gate)
2. "MANDATORY TEST REPORTING FORMAT" block at end of step 7
3. "E2E test coverage included for ALL story features" in step 9 DoD checklist
4. "AC-to-test traceability table" in step 9 DoD checklist
5. "documentation subtasks" (Rule 17) in step 9 DoD checklist
6. "Module wiring tests" (Rule 24) in step 9 DoD checklist
7. "Browser smoke test" (Rule 26) in step 9 DoD checklist
