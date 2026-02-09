# E2E Testing Retrospective — Party Mode Session

**Date:** 2026-02-09
**Scope:** E2E testing across all epics (1E, 2E, 3E + Step 8 full suite fix)
**Participants:** Murat (TEA), Amelia (Dev), Winston (Architect), Bob (SM), Mary (Analyst)
**Test Totals:** 1028 unit + 40 wiring + 46 E2E = 1114 total tests

---

## Findings

### F1: E2E Caught 5 Real Production Bugs Invisible to Unit Tests
- **ThrottlerModule rate limit** (10 req/min) — caused HTTP 429, Angular showed empty lists
- **@IsUUID variant bit validation** — rejected valid-looking seed/test UUIDs
- **Angular bootstrap crash** — providers wired incorrectly, only caught at full app boot
- **Login signal timing** — authentication state not propagating correctly
- **Missing route guards** — pages accessible without proper authorization

### F2: ThrottlerModule Was Critically Misconfigured
- `limit: 10` (10 requests per 60 seconds per IP) — far too low for any real usage
- Fixed to `limit: 100` during Step 8
- Angular swallowed the 429 silently — no user-visible error, just empty data

### F3: 100 req/min May Still Be Too Low for Epic 4
- Workflow execution chains will make multiple internal API calls per run
- A single chain execution could trigger 10+ API calls
- Need per-route or per-tenant limits, or exempt internal service calls

### F4: Confidence Level is 3/6 Categories
| Category | Status | Coverage |
|----------|--------|----------|
| Logic (unit tests) | Covered | 1028 tests |
| Integration (wiring) | Covered | 40 tests |
| Happy-path E2E | Covered | 46 tests |
| Error-path E2E | NOT covered | Deferred to 4EH |
| Performance | NOT covered | Deferred to 7P-7 |
| Security E2E | NOT covered | Deferred to 7P |

### F5: Missing Error-Path E2E Tests
- Duplicate name 409 responses
- Invalid status transitions 400
- File upload size limits
- Network error handling
- Validation error displays

### F6: Step 8 Took 3 Debugging Sessions — Too Slow
- 11 failures across 46 tests
- Root causes were subtle (rate limiting, UUID validation, state mutation)
- Batching E2E to the end of an epic amplifies debugging difficulty
- Running after every 2-3 stories would catch issues when context is fresh

### F7: @IsUUID Should Never Be Used
- `@IsUUID('4')` requires RFC 4122 variant bits (8/9/a/b in position 17)
- Even `@IsUUID(undefined)` and `@IsUUID('all')` check variant bits
- Seed data UUIDs like `11111111-0000-0000-0000-000000000000` have `0` in variant position
- `@Matches` regex is the only safe alternative

### F8: Cross-Test State Mutation Will Worsen
- Test 004c archive/unarchive cycle changes template status
- Test 005b had to be rewritten for resilience
- As test count grows, state coupling will cause more cascading failures
- Need cleanup convention or per-test isolation

### F9: Rate Limiting Was Never Specified in PRD/Architecture
- ThrottlerModule was added as "good practice" without requirements
- No defined thresholds, no per-tenant differentiation
- Must be an explicit requirement for Epic 4

---

## Action Items

| ID | Action | Priority | Timeline | Status |
|----|--------|----------|----------|--------|
| A1 | Add project-context rule: use `@Matches` regex, never `@IsUUID` with version | HIGH | Before Epic 4 | DONE (Rule 27) |
| A2 | Add project-context rule: E2E regression gate every 2-3 stories | HIGH | Before Epic 4 | DONE (Rule 28) |
| A3 | Revisit ThrottlerModule config — per-route/per-tenant limits | HIGH | Story 4-0 | Backlog |
| A4 | 4EH story: error-path E2E hardening with party mode planning | MEDIUM | After 4E | Backlog |
| A5 | Add "E2E suite still passes" to story DoD | MEDIUM | Before Epic 4 | DONE (Rule 29) |
| A6 | Document binary search + page.on('response') debugging methodology | LOW | MEMORY.md | DONE |
| A7 | Convention for tests that mutate shared seed data | MEDIUM | Before 4E | DONE (Rule 30) |
| A8 | Define rate limiting as explicit requirement for Epic 4 PRD | HIGH | Epic 4 planning | Backlog |

---

## Team Agreements

1. **E2E is non-negotiable infrastructure** — not a nice-to-have. It caught 5 bugs that 1028 unit tests missed.
2. **Run E2E early and often** — every 2-3 stories, not batched to end of epic.
3. **Rate limiting must be an explicit architectural requirement** — never "good practice" defaults.

---

## Deferred to Epic 4 Planning

- A3: ThrottlerModule architecture (per-route, per-tenant, internal exemptions)
- A8: Rate limiting requirements in Epic 4 PRD
- Epic 4 planning agenda already includes: circuit breaker, safety cap, in-process BullMQ, billing, output validation, fan-out, token budget, per-workflow credit pricing
- Add: rate limiting architecture as 9th topic
