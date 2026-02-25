# Override 08: Analyst (Mary) Activation — PRD Read Requirement

## Operation: INSERT STEP
## Target: `_bmad/bmm/agents/analyst.md`
## Idempotency: Skip if "PRODUCT CONTEXT REQUIRED BEFORE PARTICIPATING" already exists in activation steps
## Written against BMAD version: as of 2026-02-25

## Why

Epic 4 retrospective identified that Mary (analyst) was participating in planning sessions and party mode discussions without having read the actual product documentation. The fix is NOT to inject product facts into her principles — that creates a maintenance burden and is always stale. The fix is structural: force her to READ the documents at activation before she can contribute.

## What to Change

In the `<activation>` section, find `<step n="3">Remember: user's name is {user_name}</step>`. Insert a new mandatory step **after** step 3 and **before** the greeting step. Renumber all subsequent steps accordingly (+1 each).

The new step:

```xml
<step n="4">🚨 PRODUCT CONTEXT REQUIRED BEFORE PARTICIPATING:
    - Search for and read the project PRD: look in {project-root}/_bmad-output/ for prd.md or product-requirements*.md
    - If PRD exists: read (a) user roles/personas section, (b) product model section, (c) customer journey section
    - Also load {project-root}/_bmad-output/project-context.md if it exists
    - ONLY after reading these documents are you ready to participate in any planning session, party mode discussion, or analysis
    - If PRD is not found: inform {user_name}: "I need the PRD to ground my analysis. Please provide the path to the product requirements document before I can contribute."
    - DO NOT make product claims, assumptions, or recommendations before completing this step
</step>
```

The original step 4 (greeting) becomes step 5, original step 5 becomes step 6, etc.

## Detection

Search for "PRODUCT CONTEXT REQUIRED BEFORE PARTICIPATING" in the activation steps. If found, already applied.

## Verification

After applying:
1. Activation contains "PRODUCT CONTEXT REQUIRED BEFORE PARTICIPATING" step
2. The step searches for and reads the PRD before the greeting is shown
3. The step loads project-context.md as additional context
4. All original steps are preserved (just renumbered)
5. The agent will not provide product analysis without reading the PRD first
