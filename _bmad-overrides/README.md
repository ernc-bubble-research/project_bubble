# BMAD Overrides — Project Bubble Customizations

This folder contains **delta descriptions** of all customizations Project Bubble has made to the standard BMAD framework installation. These are NOT file copies — they are intent-based instructions that an agent can read and apply after a BMAD reinstall.

## Why This Exists

The `_bmad/` folder is overwritten on BMAD reinstalls. Our customizations (dedicated reviewer agent, 3-pass code review system, process constraints, etc.) would be lost. This folder lives **outside** `_bmad/` and survives reinstalls.

## How to Apply After BMAD Reinstall

1. Open a new agent session (any BMAD agent)
2. Say: "Read all files in `_bmad-overrides/` and apply each override to the current BMAD installation. Each file describes what to change and where. Apply operations idempotently — skip if already applied."
3. The agent reads each override file and executes the described operations
4. Verify: Check that `_bmad/_config/agent-manifest.csv` has the Naz row, `_bmad/bmm/agents/reviewer.md` exists, all 3 agents have CR menu items, etc.

## Override Files

| File | Target | Operation |
|------|--------|-----------|
| `01-reviewer-agent.md` | `_bmad/bmm/agents/reviewer.md` | CREATE new file (full agent definition) |
| `02-manifest-addition.md` | `_bmad/_config/agent-manifest.csv` | APPEND row for Naz reviewer agent |
| `03-dev-agent-patch.md` | `_bmad/bmm/agents/dev.md` | REPLACE code-review menu item with Pass 1 label |
| `04-code-review-instructions-patch.md` | `_bmad/bmm/workflows/4-implementation/code-review/instructions.xml` | INSERT 3-pass constraint + other critical lines |
| `05-tea-agent-patch.md` | `_bmad/bmm/agents/tea.md` | ADD code-review menu item (Pass 3) to Murat |

## 3-Pass Code Review System

All stories require 3 mandatory code review passes:
- **Pass 1 — Amelia (Dev Agent)**: Self-review in same session
- **Pass 2 — Naz (Reviewer Agent)**: Fresh context + different LLM. Adversarial.
- **Pass 3 — Murat (Test Architect)**: Fresh context + different LLM. Test quality + architecture.

Story is NOT done until all 3 passes complete.

## Rules

- Each override is **idempotent** — safe to apply multiple times
- Each override describes the **intent** (what and why), not just the text
- Overrides use **append/insert/replace** operations, never full file replacement (except 01 which creates a new file)
- If BMAD's file structure has changed, the agent should adapt the operation to the new structure
