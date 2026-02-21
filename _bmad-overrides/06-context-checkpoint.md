# Override 06: Context Compaction Checkpoint (Rule 41)

**Status:** Active
**Origin:** Story 4-7b Pass 3 findings + Story 4-RLS-B context loss incident
**Date Added:** 2026-02-21
**Rule Reference:** Rule 41 in project-context.md

## Problem

Context compaction DURING multi-step workflows (party mode, code review, planning) loses critical context:
- Story 4-RLS-B: Party mode decisions lost mid-review, agent applied "decisions" user never saw
- Story 4-7b: Review process context loss required 3 passes to catch issues

Rule 41 as passive documentation gets compacted away when context is full - the exact moment it's needed most.

## Solution

Add **Step 0: Pre-flight Context Check** to all major multi-step workflows:
1. Check token usage BEFORE starting workflow
2. If >150k tokens, trigger compaction NOW (before workflow starts)
3. If still >180k after compaction, warn user to start fresh session
4. Prevents mid-workflow compaction that loses critical data

## Files Modified

### 1. Code Review Workflow
**File:** `_bmad/bmm/workflows/4-implementation/code-review/instructions.xml`

**Location:** After `<critical>` blocks, before Step 1

**Addition:**
```xml
  <!-- Context Management Checkpoint (Rule 41) -->
  <step n="0" goal="Pre-flight context check">
    <critical>NEVER allow context compaction DURING review. Compact BEFORE starting if needed.</critical>
    <action>Check current token usage in this session</action>
    <check if="token_usage > 150000">
      <warning>Context usage high ({token_usage} tokens). Compacting now BEFORE starting review to prevent mid-process data loss.</warning>
      <action>Trigger context compaction</action>
      <action>Wait for compaction to complete</action>
      <check if="token_usage > 180000 after compaction">
        <error>Still high after compaction ({token_usage} tokens). User should start fresh session for this review to avoid mid-review compaction that loses critical findings.</error>
        <action>Ask user: "Context is very full even after compaction. Recommend starting fresh session for clean review. Proceed anyway or start fresh?"</action>
      </check>
    </check>
    <action>Proceed to story loading</action>
  </step>
```

### 2. Party Mode Workflow
**File:** `_bmad/core/workflows/party-mode/workflow.md`

**Location:** New section after "## AGENT MANIFEST PROCESSING" and before "## EXECUTION"

**Addition:**
```markdown
---

## PRE-FLIGHT CHECKS

**Context Management Checkpoint (Rule 41):**

Before starting party mode, verify context is healthy to prevent mid-discussion compaction:

1. **Check Token Usage:** Measure current session token usage
2. **Threshold Check:** If usage > 150,000 tokens:
   - **CRITICAL:** Party mode discussions generate significant context - compacting now BEFORE starting
   - Trigger context compaction immediately
   - Wait for compaction to complete
3. **Post-Compaction Verification:** If usage still > 180,000 tokens after compaction:
   - **ERROR:** Context too full even after compaction
   - Present user choice: "Context is very full ({token_usage} tokens). Party mode may trigger mid-discussion compaction that loses critical decisions. Recommend: (A) Start fresh session, or (B) Proceed with risk. Which do you prefer?"
   - If user chooses (A), gracefully exit and suggest restarting
   - If user chooses (B), document risk and proceed
4. **Proceed:** If usage < 150,000 tokens OR user accepts risk, continue to party mode activation

**Rationale:** Context compaction DURING party mode loses team decisions user never saw (Story 4-RLS-B). Compacting BEFORE ensures clean slate for multi-agent discussion.

---
```

### 3. Create Story Workflow
**File:** `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`

**Location:** After `<critical>` blocks, before Step 1

**Addition:**
```xml
  <!-- Context Management Checkpoint (Rule 41) -->
  <step n="0" goal="Pre-flight context check">
    <critical>NEVER allow context compaction DURING story creation. Compact BEFORE starting if needed.</critical>
    <action>Check current token usage in this session</action>
    <check if="token_usage > 150000">
      <warning>Context usage high ({token_usage} tokens). Compacting now BEFORE starting story creation to prevent mid-process data loss.</warning>
      <action>Trigger context compaction</action>
      <action>Wait for compaction to complete</action>
      <check if="token_usage > 180000 after compaction">
        <error>Still high after compaction ({token_usage} tokens). User should start fresh session for story creation to avoid mid-creation compaction that loses requirements.</error>
        <action>Ask user: "Context is very full even after compaction. Recommend starting fresh session for clean story creation. Proceed anyway or start fresh?"</action>
      </check>
    </check>
    <action>Proceed to story determination</action>
  </step>
```

### 4. Dev Story Workflow
**File:** `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`

**Location:** After `<critical>` blocks, before Step 1

**Addition:**
```xml
  <!-- Context Management Checkpoint (Rule 41) -->
  <step n="0" goal="Pre-flight context check">
    <critical>NEVER allow context compaction DURING story implementation. Compact BEFORE starting if needed.</critical>
    <action>Check current token usage in this session</action>
    <check if="token_usage > 150000">
      <warning>Context usage high ({token_usage} tokens). Compacting now BEFORE starting story implementation to prevent mid-process data loss.</warning>
      <action>Trigger context compaction</action>
      <action>Wait for compaction to complete</action>
      <check if="token_usage > 180000 after compaction">
        <error>Still high after compaction ({token_usage} tokens). User should start fresh session for story implementation to avoid mid-implementation compaction that loses task state.</error>
        <action>Ask user: "Context is very full even after compaction. Recommend starting fresh session for clean story implementation. Proceed anyway or start fresh?"</action>
      </check>
    </check>
    <action>Proceed to story loading</action>
  </step>
```

## How to Reapply After BMAD Update

1. **Backup current versions:**
   ```bash
   cp _bmad/bmm/workflows/4-implementation/code-review/instructions.xml _bmad-overrides/backup/
   cp _bmad/core/workflows/party-mode/workflow.md _bmad-overrides/backup/
   cp _bmad/bmm/workflows/4-implementation/create-story/instructions.xml _bmad-overrides/backup/
   cp _bmad/bmm/workflows/4-implementation/dev-story/instructions.xml _bmad-overrides/backup/
   ```

2. **Update BMAD:**
   ```bash
   # Your BMAD update process here
   ```

3. **Reapply patches:**
   - For XML workflows (code-review, create-story, dev-story):
     - Find the last `<critical>` block before Step 1
     - Insert the Step 0 XML block from this document

   - For party-mode (Markdown):
     - Find the "## AGENT MANIFEST PROCESSING" section
     - Insert the "## PRE-FLIGHT CHECKS" section after it (before "## EXECUTION")

4. **Verify:**
   ```bash
   diff _bmad-overrides/backup/instructions.xml _bmad/bmm/workflows/4-implementation/code-review/instructions.xml
   ```

## Testing

After reapplying, test with a workflow invocation and verify:
1. Step 0 executes before main workflow
2. Token usage is checked
3. If >150k, compaction triggers automatically
4. If >180k after compaction, user is prompted

## Related Documentation

- Rule 41 in `project-context.md` (passive documentation)
- Epic 4 Retrospective Agenda Item 15 in `sprint-status.yaml`
- Memory file: Rule 41 reference

## Notes

- This is a **structural enforcement** of Rule 41 (not just passive documentation)
- Prevents the rule from being compacted away when it's most needed
- Makes context management proactive, not reactive
- Critical for multi-agent workflows where context loss = lost decisions
