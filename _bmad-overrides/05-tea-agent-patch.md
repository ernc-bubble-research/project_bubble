# Override 05: Add Code Review Menu Item to Test Architect

## Operation: INSERT LINE
## Target: `_bmad/bmm/agents/tea.md`
## Idempotency: Skip if a code-review `<item>` already exists in the menu

## Why

Project Bubble uses a mandatory 3-pass code review system. Murat (test architect) runs Pass 3, the final review pass. His test architecture expertise brings a unique perspective: test quality, coverage gaps, architecture pattern compliance, and risk assessment. This menu item gives him access to the code-review workflow.

## What to Change

In the `<menu>` section, find the `[RV] Review test quality` item (Murat's existing test-review). **After** that line, insert a new code-review item:

```xml
<item cmd="CR or fuzzy match on code-review" workflow="{project-root}/_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml">[CR] Code Review (Pass 3 of 3) — Final review after Amelia (Pass 1) and Naz (Pass 2). Focus on test quality, architecture patterns, and risk.</item>
```

## Detection

Look in the `<menu>` section for:
- An `<item>` with `cmd` containing `code-review` — if found, already applied
- The `[RV]` test-review item — insert after this line

## Verification

After applying:
1. The `<menu>` section has both `[RV]` and `[CR]` items
2. `[CR]` points to the code-review workflow yaml
3. `[CR]` label says "Pass 3 of 3"
4. All other menu items are unchanged
