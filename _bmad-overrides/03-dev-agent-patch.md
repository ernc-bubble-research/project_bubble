# Override 03: Update Code Review Menu Item in Dev Agent

## Operation: REPLACE LINE
## Target: `_bmad/bmm/agents/dev.md`
## Idempotency: Skip if the menu already has "Self-Review (Pass 1 of 3)" in it

## Why

Project Bubble uses a mandatory 3-pass code review system. Amelia (dev agent) runs Pass 1 as a self-review. The menu item must reflect this — it's not a standalone review, it's the first of three mandatory passes.

## What to Change

Find the code-review `<item>` in the `<menu>` section. It may appear as:
- A standard `[CR]` menu item pointing to the code-review workflow
- An HTML comment saying "CODE REVIEW REMOVED"
- Already the correct Pass 1 label

**Replace** that line with:

```xml
<item cmd="CR or fuzzy match on code-review" workflow="{project-root}/_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml">[CR] Self-Review (Pass 1 of 3) — Review your own implementation before handing off to Naz (Pass 2) and Murat (Pass 3)</item>
```

## Detection

Look for any of these in the `<menu>` section:
- `cmd="CR` or `code-review` in an item
- `CODE REVIEW REMOVED` comment
- `Self-Review (Pass 1 of 3)` (already applied)

## Verification

After applying:
1. The `<menu>` section has a `[CR]` item with "Self-Review (Pass 1 of 3)" label
2. The item points to the code-review workflow yaml
3. All other menu items are unchanged
