# PROJECT HANDOVER DOCUMENT

## Last Updated
2026-01-31 16:00
[Planning + Strategy Session | Claude Opus 4.5]

## Current Phase
**Phase 3: Execution — Epic 1 substantially complete, planning session done**

## Current Step
**Story 1.12 created and validated. Next: execute 1.12, then Epic 2 + Epic 3.**

## Status
**GREEN — Epic 1 core complete (10/12 done), strategic decisions made for MVP path**

## Work Just Completed (This Session)
1. **Story 1.12: User Invitations & Email Flow** — Story file created, validated, and committed.
   - 12 tasks, 8 acceptance criteria
   - Validated against codebase: 8 review fixes applied (entity registration, enum pattern, RLS setup, migration removal, frontend service gap, tenant-detail integration, AppModule import, UsersService.create() warning)
   - Covers: nodemailer email service, invitation entity + RLS, shared DTOs, backend invitation/accept flow, set-password backend endpoint, frontend invite dialog + Users tab
2. **Strategic Planning Decisions:**
   - Story 1.11 (CI/CD) deferred to post-MVP
   - MVP runs entirely on laptop (Postgres + Redis via Docker, Vertex AI API key)
   - Mock LLM Provider required before Epic 4 (Hexagonal pattern, `LLM_PROVIDER` env var)
   - Husky pre-push hook deferred to post-MVP
   - No CI needed — BMAD workflow provides equivalent lint/test/build on every story

## Epic 1 Progress
| Story | Status |
|:---|:---|
| 1.1 Monorepo Infrastructure | done |
| 1.2 Tenant Provisioning API | done |
| 1.3 Bubble Admin Dashboard (The Lobby) | done |
| 1.4 Impersonation Action | done |
| 1.5 Tenant Config, Credits & Entitlements | done |
| 1.6 Tenant Seeding Templates | skipped (obsoleted by Epic 3 design) |
| 1.7 User Authentication & RBAC | done |
| 1.8 RLS Enforcement Mechanism | done |
| 1.9 User Management & Admin Creation | done |
| 1.10 Login/Password Pages (Auth UI) | done |
| 1.11 CI/CD Pipeline Setup | deferred (post-MVP) |
| 1.12 User Invitations & Email Flow | ready-for-dev |

## Test Counts
- **Web:** 101 tests (15 suites)
- **API Gateway:** 78 tests
- **DB Layer:** 11 tests
- **Total:** 190 tests

## Key Decisions Made
- **Tier Management deferred**: Plan tiers are label-only for now. A full tier template system (Epic 11) is planned for the future.
- **Data Residency**: EU-only for Prototype/MVP. The field is stored but regional routing is deferred.
- **Admin role guard**: Added `adminGuard` during code review to enforce `bubble_admin` role on `/admin/*` routes.
- **Set-password backend deferred**: `POST /api/auth/set-password` doesn't exist yet — will be implemented in Story 1.12.
- **CI/CD deferred to post-MVP**: BMAD workflow runs full lint/test/build on every story. Solo dev, no PR workflow.
- **MVP on laptop**: No cloud infra until post-MVP. Postgres + Redis via Docker, Vertex AI via API key.
- **Mock LLM Provider**: Must be built before/during Epic 4. Hexagonal pattern with `LLM_PROVIDER=mock|google-ai-studio|vertex` env var. Mock for dev + unit tests, Google AI Studio free tier for smoke tests + validation, Vertex for production.
- **Husky pre-push hook**: Deferred to post-MVP. Safety net for non-BMAD pushes.

## Post-MVP Checklist (REMINDER)
After Epics 1-7 are complete:
1. [ ] Implement Husky git pre-push hook (`nx affected:test` + `nx affected:lint`)
2. [ ] Story 1.11: CI/CD Pipeline Setup (GitHub Actions)
3. [ ] Docker Compose for full-stack local orchestration
4. [ ] Switch from `synchronize: true` to TypeORM migrations
5. [ ] Production deployment (cloud hosting, secrets management, monitoring)

## Known Issues
- SCSS budget warning on tenant-detail.component.scss (5.46 kB vs 4 kB budget) — cosmetic, not blocking.

## MVP Execution Plan
1. **Execute Story 1.12** — User Invitations & Email Flow (dev-story + code-review)
2. **Epic 2 + Epic 3 in parallel** — Asset Management + Workflow Definition
3. **Before Epic 4** — Run quick-spec for LangGraph.js + build Mock LLM Provider
4. **Epic 4** — Workflow Execution Engine (with mock + real LLM testing)
5. **Epic 5** — Interactive Reporting & Feedback Loop
6. **Epic 6** — Guest Access & Sharing
7. **Epic 7** — Observability (parallel to Epics 4-6)
8. **Post-MVP** — CI/CD, Husky, Docker Compose, production deployment

## Files Modified (This Session)
### New Files
- `stories/1-12-user-invitations-email-flow.md` — Story file (12 tasks, 8 ACs, validated)

### Modified Files
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 1.11 → deferred, 1.12 → ready-for-dev, added gate requirements + deferred decisions
- `HANDOVER.md` — updated
- `docs/HANDOVER.md` — updated
