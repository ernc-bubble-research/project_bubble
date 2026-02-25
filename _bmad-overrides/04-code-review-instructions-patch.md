# Override 04: Code Review Instructions Customizations

## Operation: INSERT CRITICAL BLOCKS
## Target: `_bmad/bmm/workflows/4-implementation/code-review/instructions.xml`
## Idempotency: Skip each insertion if the detection text already exists in the file
## Written against BMAD version: as of 2026-02-25

## Why

The code-review workflow instructions need constraints for the mandatory 3-pass system, severity rules, known violation pattern priority, source folder exclusions, verifiable checklist requirement, dev agent silence enforcement, tracked item enforcement, and mandatory finding format.

## Insertions

All insertions go inside the `<workflow>` root element, after the existing `<critical>` tags near the top (before `<step n="0">` or `<step n="1">`).

### Insertion 1: Mandatory 3-Pass Constraint
**Detection**: Search for "3-PASS CODE REVIEW"

```xml
<critical>MANDATORY 3-PASS CODE REVIEW:
    Pass 1 — Amelia (Dev Agent): Self-review in the same session. Catches obvious gaps, updates story file, verifies her own work.
    Pass 2 — Naz (Reviewer Agent): MUST be launched VIA PARTY MODE (invoke party-mode skill). FRESH CONTEXT with a DIFFERENT LLM than Pass 1. Adversarial review. Trusts nothing from Pass 1. NEVER launch as a Task agent — ALWAYS party mode.
    Pass 3 — Murat (Test Architect): MUST be launched VIA PARTY MODE (invoke party-mode skill). FRESH CONTEXT with a DIFFERENT LLM than Pass 1. Focuses on test quality, coverage, architecture patterns, and risk. NEVER launch as a Task agent — ALWAYS party mode.
    ALL THREE PASSES ARE MANDATORY. A story is NOT done until all 3 passes complete and all HIGH/MEDIUM findings are fixed.
    Pass 2 and Pass 3 are ALWAYS executed via party mode — the reviewer presents findings directly to the team. The dev agent (Amelia) is the REVIEWEE, not the presenter. She has NO role in presenting findings.
    If you are running Pass 2 or Pass 3 and you are the same agent/session that implemented the code, STOP IMMEDIATELY and inform the user.</critical>
```

### Insertion 2: Severity Downgrading Ban
**Detection**: Search for "NEVER downgrade severity"

```xml
<critical>NEVER downgrade severity. A finding is what it is. NEVER use the word "MVP" to justify, excuse, or defer anything.</critical>
```

### Insertion 3: Known Violation Pattern Priority
**Detection**: Search for "KNOWN VIOLATION PATTERNS"

```xml
<critical>Check KNOWN VIOLATION PATTERNS first: (1) tenantId missing in WHERE clauses (Rule 2c), (2) Story file not updated, (3) Undocumented deferrals, (4) N+1 query patterns. These have historically been missed — they are priority #1.</critical>
```

### Insertion 4: Exclude Non-Source Folders
**Detection**: Search for "exclude the _bmad/"

```xml
<critical>Do not review files that are not part of the application's source code. Always exclude the _bmad/ and _bmad-output/ folders from the review. Always exclude IDE and CLI configuration folders like .cursor/ and .windsurf/ and .claude/</critical>
```

### Insertion 5: Pass 1 Verifiable Checklist Requirement
**Detection**: Search for "PASS 1 VERIFIABLE CHECKLIST"
**Intent**: Forces Pass 1 to produce a machine-verifiable list of all query calls instead of prose claims. Pass 2 can verify this list against actual code — if discrepancies exist, it's a CRITICAL finding.

```xml
<critical>PASS 1 VERIFIABLE CHECKLIST REQUIREMENT:
    Pass 1 (Amelia's self-review) must produce a VERIFIABLE CHECKLIST, not prose claims.
    For Rule 2c specifically: list EVERY findOne, find, update, delete, and manager.query() call in changed files.
    For each call, state: (a) file:line, (b) entity type, (c) whether tenantId is in WHERE, (d) if not, why (documented exception or bug).
    This list is what Pass 2 verifies against. If Pass 1 listed 3 calls and Pass 2 finds 8, the discrepancy is a CRITICAL finding.</critical>
```

### Insertion 6: Dev Agent Silence During Pass 2 and Pass 3
**Detection**: Search for "DEV AGENT SILENCE DURING PASS 2"
**Intent**: Prevents the dev agent from commenting on, defending, or pre-deciding verdicts on reviewer findings. The reviewer presents directly to the team. The user decides.

```xml
<critical>DEV AGENT SILENCE DURING PASS 2 AND PASS 3:
    During Pass 2 (Naz) and Pass 3 (Murat) party mode presentations, the dev agent (Amelia) is NOT ALLOWED TO:
    - Comment on, defend, explain, or contextualize any finding
    - Attach verdicts (FIX/TRACK/REJECT) to findings she did not generate
    - Summarize or re-present findings that were already presented by the reviewer
    The reviewer presents findings directly to the team. The user decides each finding's fate.
    Amelia may speak ONLY when directly addressed by the user, and ONLY to say "Understood. I will fix [list]."</critical>
```

### Insertion 7: Tracked Item Enforcement
**Detection**: Search for "TRACKED ITEM ENFORCEMENT"
**Intent**: Prevents "noted for future story" without actually writing to tracking files. Every tracked item must have an immediate file write with a specific story ID.

```xml
<critical>TRACKED ITEM ENFORCEMENT:
    Every finding marked TRACKED must include a specific story ID in sprint-status.yaml.
    "Track to future story" or "track to 4-test-gaps" without an immediate file write to sprint-status.yaml is NOT tracking.
    The write must happen in the SAME turn as the tracking decision. No exceptions.</critical>
```

### Insertion 8: Mandatory Finding Format
**Detection**: Search for "MANDATORY FINDING FORMAT"
**Intent**: Eliminates free-form prose verdicts. Every finding must use a structured format with `Resolution: FIX | DEFERRED_TO: [story-id]`. Bans "acceptable," "acknowledged," and all synonyms. Makes findings machine-verifiable and removes the lazy path entirely.

```xml
<critical>MANDATORY FINDING FORMAT: Every finding must use this exact structure. Free-form prose verdicts are NOT acceptable.

  Finding [N]: [one-line description]
    Severity: CRITICAL | HIGH | MEDIUM | LOW
    File:Line: [exact reference, e.g., src/foo/bar.service.ts:142]
    Description: [specific description of the problem and why it matters]
    Resolution: FIX | DEFERRED_TO: [specific-story-id]

  Rules:
  - Resolution must be exactly "FIX" or "DEFERRED_TO: [specific-story-id]"
  - "DEFERRED_TO" with no story-id = INVALID — assign a story-id or create a new backlog entry FIRST
  - ALL CRITICAL and HIGH findings: Resolution must be FIX. No exceptions. No deferrals.
  - MEDIUM findings: FIX by default. DEFERRED_TO only with explicit user approval in the same session.
  - LOW findings: FIX or DEFERRED_TO both valid.
  - BANNED resolutions: "acceptable," "livable," "acknowledged," "fine for now," "future cleanup," "out of scope," or any synonym.
    These do not exist. Every finding is FIX or DEFERRED_TO a named story. Period.</critical>
```

## Verification

After applying, the `instructions.xml` file should have all 8 `<critical>` blocks present near the top of the `<workflow>` element, before the first `<step>`. Each block is independently detectable via its unique detection string.
