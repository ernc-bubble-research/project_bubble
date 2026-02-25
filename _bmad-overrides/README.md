# BMAD Overrides — Project Bubble Customizations

This folder contains **intent-based instructions** describing all customizations Project Bubble has made to the standard BMAD framework. These are NOT file copies — they describe WHAT to achieve and WHY, so a new BMAD installation can apply them to its own file structure even if it has changed.

## Written Against BMAD Version

As of **2026-02-25**. If applying to a newer BMAD version, the agent should read each override's intent and adapt to the new file structure. File names, paths, and XML/YAML structure may differ — the INTENT is what matters.

## Why This Exists

The `_bmad/` folder is overwritten on BMAD reinstalls. Our customizations (dedicated reviewer agent, 3-pass code review system, structural enforcement gates, agent personality changes, etc.) would be lost. This folder lives **outside** `_bmad/` and survives reinstalls.

## How to Apply After BMAD Reinstall

1. Open a new agent session (any BMAD agent)
2. Say: "Read all files in `_bmad-overrides/` and apply each override to the current BMAD installation. Each file describes what to change and where. Adapt to the current file structure if it differs from the version the overrides were written against. Apply operations idempotently — skip if already applied. When done, generate a **Customization Report** listing: which file you modified, what you added/changed, and which overrides were already applied (skipped)."
3. The agent reads each override file, understands the INTENT, finds the equivalent location in the current BMAD structure, and applies the change
4. Review the Customization Report to verify all overrides were applied correctly

## Override Files

| File | Target | Operation | Description |
|------|--------|-----------|-------------|
| `01-reviewer-agent.md` | `_bmad/bmm/agents/reviewer.md` | CREATE | Naz — dedicated adversarial code reviewer agent (new file, does not exist in standard BMAD) |
| `02-manifest-addition.md` | `_bmad/_config/agent-manifest.csv` | APPEND | Add Naz's row to the agent manifest |
| `03-dev-agent-patch.md` | `_bmad/bmm/agents/dev.md` | REPLACE + APPEND | Pass 1 menu label + 5 new principles (reviewee role, verifiable checklist, per-task verification, tracked item enforcement, UX trade-off surface) |
| `04-code-review-instructions-patch.md` | `_bmad/bmm/workflows/.../code-review/instructions.xml` | INSERT | 8 critical blocks: 3-pass constraint, severity ban, violation patterns, folder exclusions, verifiable checklist, dev silence, tracked item enforcement, mandatory finding format |
| `05-tea-agent-patch.md` | `_bmad/bmm/agents/tea.md` | ADD | Code review menu item (Pass 3) for Murat + Rule 40 WebSocket testing principle |
| `06-context-checkpoint.md` | Reference doc | N/A | Context compaction checkpoint process documentation |
| `07-dev-story-workflow-gates.md` | `_bmad/bmm/workflows/.../dev-story/instructions.xml` | INSERT/REPLACE | 4 structural gates: per-task verification, tracked item enforcement, 3-pass launch sequence, Winston architectural review |
| `08-analyst-activation-patch.md` | `_bmad/bmm/agents/analyst.md` | INSERT STEP | Mary reads PRD + project-context before participating in any planning session or party mode |
| `09-create-story-sizing-gate.md` | `_bmad/bmm/workflows/.../create-story/instructions.xml` | INSERT | Story sizing gate in step 5: blocks oversized stories (>7 tasks OR >10 ACs) from being marked ready-for-dev |
| `10-dev-story-workflow-rules.md` | `_bmad/bmm/workflows/.../dev-story/instructions.xml` | INSERT (3 blocks) | Pre-flight check (Rule 18), mandatory test reporting format, enhanced DoD (Rules 12, 12b, 17, 24, 26) |
| `11-epic-story-planning-rules.md` | `step-03-create-stories.md`, `step-04-final-validation.md`, `sprint-status/instructions.md` | INSERT (4 blocks) | Missing journey analysis (Rule 20), pre-epic completeness gate (Rule 15), epic dependency check (Rule 19), mid-epic check-in (Rule 14) |

## 3-Pass Code Review System

All stories require 3 mandatory code review passes:
- **Pass 1 — Amelia (Dev Agent)**: Self-review in same session. Must produce verifiable checklist (not prose claims).
- **Pass 2 — Naz (Reviewer Agent)**: Fresh context + different LLM. Adversarial. Launched VIA PARTY MODE only.
- **Pass 3 — Murat (Test Architect)**: Fresh context + different LLM. Test quality + architecture. Launched VIA PARTY MODE only.

Story is NOT done until all 3 passes complete. Dev agent is SILENT during Pass 2 and Pass 3 presentations.

## Structural Enforcement Gates (Epic 4 Retro)

These gates were added after the Epic 4 retrospective to prevent recurring violations:
1. **Per-task verification**: Each task checkbox requires individual file:line citations for implementation AND test. No batch `replace_all` on checkboxes.
2. **Tracked item enforcement**: Every "tracked" finding must be written to sprint-status.yaml with a specific story ID in the same turn. No "noted for future" without file write.
3. **3-pass launch sequence**: Dev-story completion step explicitly states what the dev agent will NOT do (present findings, launch Task agents, attach verdicts).
4. **Pass 1 verifiable checklist**: Self-review must list every query call with tenantId status. Pass 2 verifies this list against actual code.
5. **Dev agent silence**: During Pass 2/3 party mode, dev agent cannot comment, defend, or contextualize findings.
6. **Winston architectural review gate**: Dev-story blocks new implementation until Winston (Architect) has reviewed the story design via party mode.
7. **UX trade-off surface**: Dev agent must surface UX vs implementation cost decisions to the user — never auto-decide the cheaper path.
8. **Rule 40 in Murat**: WebSocket/real-time features require integration tests first — embedded in the test architect's principles.
9. **Mary reads PRD first**: Analyst agent reads PRD + project-context before any planning contribution.
10. **Story pre-flight check**: Dev-story blocks fresh implementation until 4 pre-flight gates verified (dependencies, user journey, documentation, test strategy).
11. **Mandatory test reporting format**: After every test/lint run, all 4 projects reported in exact format — warnings treated as bugs, no omissions.
12. **Enhanced DoD checklist**: E2E coverage (Rule 12), AC traceability (Rule 12b), UI documentation (Rule 17), wiring tests (Rule 24), browser smoke test (Rule 26) added as explicit DoD items.
13. **Story sizing gate**: create-story workflow blocks oversized stories at generation time (max 7 tasks, max 10 ACs).
14. **Missing journey analysis**: create-epics-and-stories step 3 forces 3-question adversarial analysis (before/after/stuck) for every story.
15. **Pre-epic completeness gate**: create-epics-and-stories final validation checks 5-gate completeness and infrastructure dependency for every epic.
16. **Mid-epic check-in trigger**: sprint-status surfaces check-in reminder when any in-progress epic has 2+ done stories.

## Rules

- Each override is **idempotent** — safe to apply multiple times
- Each override describes the **intent** (what and why), not just raw text
- Overrides use **append/insert/replace** operations, never full file replacement (except 01 which creates a new file)
- If BMAD's file structure has changed, the agent should **read the new file, understand its structure, and apply the intent to the appropriate location**
- If a target text cannot be found, the agent should report the conflict instead of silently skipping
- After applying all overrides, the agent generates a **Customization Report** listing all changes made

## Post-Application Verification Checklist

After applying all overrides, verify:
- [ ] `_bmad/bmm/agents/reviewer.md` exists (Naz agent)
- [ ] `_bmad/_config/agent-manifest.csv` has Naz's row
- [ ] `_bmad/bmm/agents/dev.md` has Pass 1 menu label + 5 new principles (including UX trade-off surface)
- [ ] `_bmad/bmm/agents/tea.md` has Pass 3 menu item + Rule 40 principle
- [ ] `_bmad/bmm/agents/analyst.md` has PRD-read activation step (step 4)
- [ ] Code-review `instructions.xml` has all 8 critical blocks (including mandatory finding format)
- [ ] Dev-story `instructions.xml` has all 4 structural gates (including Winston gate)
- [ ] Dev-story `instructions.xml` has pre-flight check (step 3), test reporting format (step 7), enhanced DoD (step 9)
- [ ] Create-story `instructions.xml` has story sizing gate in step 5
- [ ] `create-epics-and-stories/step-03-create-stories.md` has missing journey analysis + sizing limit
- [ ] `create-epics-and-stories/step-04-final-validation.md` has sections 4b (pre-epic gate) and 4c (dependency check)
- [ ] `sprint-status/instructions.md` has mid-epic check-in rule in risk detection
