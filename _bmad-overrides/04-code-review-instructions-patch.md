# Override 04: Add Constraints to Code Review Instructions

## Operation: INSERT/REPLACE LINES
## Target: `_bmad/bmm/workflows/4-implementation/code-review/instructions.xml`
## Idempotency: Skip each insertion if the text already exists in the file

## Why

The code-review workflow instructions need explicit constraints for the mandatory 3-pass code review system, plus enforcement of severity rules and known violation pattern priority.

## Insertions

### Insertion 1: Mandatory 3-Pass Constraint
**Location**: Inside the `<workflow>` root element, after the existing `<critical>` tags near the top (before `<step n="1">`)

**Content to insert** (if not already present — search for "3-PASS CODE REVIEW"):
```xml
<critical>MANDATORY 3-PASS CODE REVIEW:
    Pass 1 — Amelia (Dev Agent): Self-review in the same session. Catches obvious gaps, updates story file, verifies her own work.
    Pass 2 — Naz (Reviewer Agent): MUST be a FRESH CONTEXT with a DIFFERENT LLM than Pass 1. Adversarial review. Trusts nothing from Pass 1.
    Pass 3 — Murat (Test Architect): MUST be a FRESH CONTEXT with a DIFFERENT LLM than Pass 1. Focuses on test quality, coverage, architecture patterns, and risk.
    ALL THREE PASSES ARE MANDATORY. A story is NOT done until all 3 passes complete and all HIGH/MEDIUM findings are fixed.
    If you are running Pass 2 or Pass 3 and you are the same agent/session that implemented the code, STOP IMMEDIATELY and inform the user.</critical>
```

**Detection**: Search for "3-PASS CODE REVIEW" or "MANDATORY CONSTRAINT" in the file. If the old single-pass constraint exists ("This workflow MUST be executed by the Reviewer Agent (Naz)"), replace it with the 3-pass version.

### Insertion 2: Severity Downgrading Ban
**Location**: Near the other `<critical>` tags at the top of the workflow

**Content to insert** (if not already present):
```xml
<critical>NEVER downgrade severity. A finding is what it is. NEVER use the word "MVP" to justify, excuse, or defer anything.</critical>
```

**Detection**: Search for "NEVER downgrade severity" in the file.

### Insertion 3: Known Violation Pattern Priority
**Location**: Near the other `<critical>` tags at the top of the workflow

**Content to insert** (if not already present):
```xml
<critical>Check KNOWN VIOLATION PATTERNS first: (1) tenantId missing in WHERE clauses (Rule 2c), (2) Story file not updated, (3) Undocumented deferrals, (4) N+1 query patterns. These have historically been missed — they are priority #1.</critical>
```

**Detection**: Search for "KNOWN VIOLATION PATTERNS" in the file.

### Insertion 4: Exclude Non-Source Folders
**Location**: Near the other `<critical>` tags at the top of the workflow

**Content to insert** (if not already present):
```xml
<critical>Do not review files that are not part of the application's source code. Always exclude the _bmad/ and _bmad-output/ folders from the review. Always exclude IDE and CLI configuration folders like .cursor/ and .windsurf/ and .claude/</critical>
```

**Detection**: Search for "exclude the _bmad/" in the file.

## Verification

After applying, the `instructions.xml` file should have all 4 `<critical>` blocks present near the top of the `<workflow>` element, before `<step n="1">`.
