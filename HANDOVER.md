# Handover Context

**Project:** `project_bubble`
**Session Date:** 2026-01-31
**Status:** Epic 1 — Story 1.12 created, planning session complete

## 1. Workflow Protocol
We follow a **Strict Story-Driven Workflow** using the BMAD methodology.
**The Rule:** No code is written unless a specific `stories/<story>.md` file exists and is approved.

**Last Completed Story:**
- `stories/1-10-login-password-pages-auth-ui.md` — **done** (implemented + code reviewed)

**Last Created Story:**
- `stories/1-12-user-invitations-email-flow.md` — **ready-for-dev** (created + validated)

## 2. Current State
- **Epic 1:** 10/12 stories done (1.6 skipped, 1.11 deferred to post-MVP, 1.12 ready-for-dev)
- **All backend + admin UI + auth UI complete**
- **Sprint tracking:** `_bmad-output/implementation-artifacts/sprint-status.yaml`

## 3. Next Actions
1. **Execute Story 1.12:** User Invitations & Email Flow (dev-story)
2. **Epic 2 + Epic 3 in parallel** (Asset Management + Workflow Definition)
3. **Before Epic 4:** Run quick-spec for LangGraph.js + build Mock LLM Provider
4. Continue through Epics 4 → 5 → 6 (with Epic 7 parallel to 4-6)
5. **After MVP delivery:** Husky pre-push hook, Story 1.11 CI/CD, Docker Compose, production deployment

## 4. Key Decisions (This Session)
- **Story 1.11 (CI/CD) deferred to post-MVP.** BMAD workflow runs full lint/test/build on every story — equivalent coverage for solo dev.
- **MVP runs on laptop.** Angular + NestJS + Postgres (Docker) + Redis (Docker) + Google Vertex AI API key. No cloud infra needed until post-MVP.
- **Mock LLM Provider required before Epic 4.** Hexagonal LLM pattern: MockProvider (free, deterministic, for dev) + GoogleAIStudioProvider (free tier, for smoke tests) + VertexProvider (paid, for production). Switched via `LLM_PROVIDER` env var (`mock | google-ai-studio | vertex`).
- **Husky pre-push hook after MVP.** Safety net for any non-BMAD pushes. Not needed now since all pushes go through BMAD workflow.
- **Story 1.12 created and validated.** 12 tasks, 8 ACs, validated against codebase with 8 review fixes applied.

## 5. Known Issues
- SCSS budget warning on tenant-detail.component.scss (5.46 kB vs 4 kB budget) — cosmetic, not blocking
- Set-password backend endpoint (`POST /api/auth/set-password`) doesn't exist yet — will be implemented in Story 1.12
