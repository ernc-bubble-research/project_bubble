# Story: 4-tier3-api-coverage — Remaining API Contract Tests (Story B)

**Epic**: 4 — Workflow Execution Engine
**Status**: done
**Priority**: Medium (extends Tier 3 coverage beyond P0 templates)
**Estimate**: M (4-6 hours)

## Problem

Story 4-tier3-api-infra established the Tier 3 API contract test infrastructure and covered P0 template endpoints (17 tests). The remaining controller groups — auth, tenant management, LLM settings/models, users, and workflow chains — have no contract-level coverage. These endpoints enforce critical security boundaries (role checks, tenant isolation, credential masking) that unit tests can't verify end-to-end.

## Architecture Decisions (from party mode 2026-02-16)

- **Reuse infrastructure**: Extend existing `contract-test-helpers.ts` with new seed data. Same `createContractApp()`, same DB, same dual DataSource.
- **New spec file**: `api-contract-b.spec.ts` — separate file to keep test groups manageable. Shares the same beforeAll/afterAll pattern (creates DB once, seeds once).
- **Seed extension**: Add LLM provider config, LLM models (active + inactive), workflow chain (draft) to `seedContractData()`. No new tenants needed.
- **Credential masking**: LLM provider list response MUST NOT contain raw credentials — critical security test.
- **Auth login**: Needs a user with a real bcrypt password hash in the seed (not `$2b$10$placeholder`). Seed one user with a known password.
- **Deferred**: Workflow runs (needs BullMQ/Redis), assets/folders (multipart upload complexity), ingestion/knowledge (needs Redis). These can be a follow-up story if needed.
- **No shared infra changes**: Only touches `contract-test-helpers.ts` (test file, not shared infra) and creates `api-contract-b.spec.ts`.

## Tasks

- [x] 1. Extend seed data in `contract-test-helpers.ts`
  - [x] 1.1 Add 1 LLM provider config (mock provider, encrypted credentials via `encrypt()`)
  - [x] 1.2 Add 2 LLM models (1 active, 1 inactive) linked to mock provider
  - [x] 1.3 Add 1 workflow chain (draft, owned by admin/system tenant) with valid definition
  - [x] 1.4 Seed one user (USER_A) with real bcrypt password hash for login testing
  - [x] 1.5 Export new fixture UUIDs (PROVIDER_CONFIG_ID, MODEL_ACTIVE_ID, MODEL_INACTIVE_ID, CHAIN_DRAFT_ID)
- [x] 2. Auth endpoint tests
  - [x] 2.1 CT-101: Login with valid credentials → 201, returns JWT + user data
  - [x] 2.2 CT-102: Login with wrong password → 401
  - [x] 2.3 CT-103: GET /auth/me with valid token → 200, returns user profile
  - [x] 2.4 CT-104: GET /auth/me without token → 401
- [x] 3. Tenant management tests (admin only)
  - [x] 3.1 CT-201: Admin creates tenant → 201
  - [x] 3.2 CT-202: Admin lists tenants → 200, includes all seeded tenants
  - [x] 3.3 CT-203: Customer admin cannot access admin tenants → 401 (AdminApiKeyGuard rejects non-admin before RolesGuard runs)
  - [x] 3.4 CT-204: Admin impersonate tenant → 201, JWT contains impersonated tenant_id
- [x] 4. LLM provider settings tests (admin only)
  - [x] 4.1 CT-301: Admin lists providers → 200, credentials masked (no raw keys)
  - [x] 4.2 CT-302: Admin creates provider with unknown key → 400 (registry validation). All 4 known providers already seeded by RlsSetupService — happy path create not testable without DELETE first.
  - [x] 4.3 CT-303: Customer admin cannot access settings → 403
  - [x] 4.4 CT-304: Admin GET provider types → 200, returns known provider type list (field: `providerKey`)
- [x] 5. LLM model tests (admin CRUD + app read)
  - [x] 5.1 CT-401: Admin lists all models (includes inactive) → 200
  - [x] 5.2 CT-402: App lists models (active only) → 200, excludes inactive
  - [x] 5.3 CT-403: Admin creates model → 201
  - [x] 5.4 CT-404: Admin bulk status toggle → 200
- [x] 6. Workflow chain tests (admin)
  - [x] 6.1 CT-501: Admin creates chain → 201 (steps reference TEMPLATE_PUBLIC_PUBLISHED_ID, not chain IDs)
  - [x] 6.2 CT-502: Admin lists chains → 200
  - [x] 6.3 CT-503: Admin publishes draft chain → 200
  - [x] 6.4 CT-504: Customer admin cannot access admin chains → 403
- [x] 7. Run full test suite — all 4 projects pass (1,512 tests: 820 api-gateway + 40 db-layer + 97 shared + 555 web)

## Acceptance Criteria

- [x] AC1: Auth login returns valid JWT that can be used for subsequent requests
- [x] AC2: LLM provider list response has credentials masked (not raw encrypted blob)
- [x] AC3: Admin impersonation returns JWT with correct `tenant_id` and works for subsequent requests
- [x] AC4: App LLM models endpoint returns only active models
- [x] AC5: All role enforcement checks pass (customer_admin blocked on admin endpoints: 401 on tenants via AdminApiKeyGuard, 403 on settings/chains via RolesGuard)
- [x] AC6: Workflow chain CRUD + publish works through full HTTP stack
- [x] AC7: All existing tests still pass (1,512 tests across 4 projects)

## Out-of-Scope

- Workflow runs endpoint (needs BullMQ/Redis) → defer to `4-tier3-api-runs` if needed
- Assets/folders (multipart upload) → covered by E2E
- Ingestion/knowledge (needs Redis) → covered by E2E
- Users endpoint CRUD → deferred (follows same patterns as tenants, lower risk). Can add later if needed.
- Invitations → deferred (same reason as users)

## Test Data Strategy

**New fixtures (added to existing seedContractData):**
- 1 LLM provider config: mock provider with encrypted credentials (UPDATE existing auto-seeded mock provider to known ID)
- 2 LLM models: 1 active (mock-model-active), 1 inactive (mock-model-inactive)
- 1 workflow chain: draft, system tenant, valid definition referencing TEMPLATE_PUBLIC_PUBLISHED_ID
- USER_A gets real bcrypt hash for password 'TestPassword123!'

**Reused from 4-tier3-api-infra:**
- System tenant + admin user (BUBBLE_ADMIN)
- Tenant A (ACTIVE) + USER_A (customer_admin)
- Tenant B (ACTIVE) + USER_B (customer_admin)
- Tenant C (SUSPENDED) + USER_C (customer_admin)
- All template fixtures (unchanged)

## Implementation Notes

1. **RlsSetupService auto-seeds providers**: `onModuleInit()` creates 4 providers (google-ai-studio, vertex, openai, mock) with `gen_random_uuid()` and no credentials. Seed data must UPDATE the existing mock provider (not INSERT) to avoid `provider_key` unique constraint violation.
2. **AdminApiKeyGuard vs RolesGuard**: Tenant controller uses `@UseGuards(OptionalJwtAuthGuard, AdminApiKeyGuard, RolesGuard)`. The `AdminApiKeyGuard` rejects non-admin users with 401 (not 403) because it combines auth+authz: if `req.user.role !== 'bubble_admin'` AND no valid API key, it throws `UnauthorizedException`. Settings/Chains controllers use `@UseGuards(JwtAuthGuard, RolesGuard)` (no AdminApiKeyGuard), so non-admin gets 403 from RolesGuard.
3. **Provider create validation**: `validateProviderKey()` checks against `providerRegistry.getKnownKeys()`. Unknown keys → 400. Since all 4 known providers are auto-seeded, creating a new provider requires knowing a valid key AND deleting the existing one first. Test covers the validation boundary (unknown key → 400) instead.
4. **Chain definition requires published templates**: `validateReferencedWorkflows()` verifies each `workflow_id` references an existing PUBLISHED template. Chain steps must reference template IDs, not chain IDs.

## Code Review

### Pass 1 — Amelia (self-review, same session)
| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| A1-1 | MEDIUM | CT-301 credential masking assertion was conditional (inside `if (mockProvider)`) — should be unconditional | FIX: Made unconditional, test fails if mock provider missing |
| A1-2 | LOW | `tenantBToken` declared but never used | FIX: Removed dead variable |

### Pass 2 — Naz (adversarial, party mode, fresh context)
| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| N2-1 | MEDIUM | `createdTenantId` and `createdChainId` dead variables (captured but never asserted) | FIX: Removed dead variables |
| N2-2 | MEDIUM | CT-301 credential masking lacked structural verification (no type/property/regex check) | FIX: Added `typeof === 'object'`, `toHaveProperty('api_key')`, regex `/^\*+/` |
| N2-3 | MEDIUM | CT-404 bulk toggle permanently mutates shared DB state (all mock models set inactive, no cleanup) | FIX: Added cleanup `UPDATE` to restore MODEL_ACTIVE_ID to active after bulk toggle |
| N2-4 | LOW | Missing negative chain validation test (draft template → 400) | FIX: Added CT-505 (chain with draft template → 400 validation boundary) |

### Pass 3 — Murat (test/arch, party mode, fresh context)
| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| M3-1 | MEDIUM | CT-101 login returns JWT but never uses it for a follow-up request — doesn't prove the token works | FIX: Added follow-up `/auth/me` using login-returned `accessToken`, asserts `meRes.body.id === USER_A_ID` |
| M3-2 | MEDIUM | CT-402 fragile against RlsSetupService model seeding — auto-seeded active models could mask test intent | FIX: Added documentation comment explaining why `contains/not-contains` (not exact equality) is correct |
| M3-3 | LOW | CT-204 impersonation doesn't verify tenantId in follow-up `/auth/me` | WITHDRAWN: `/auth/me` returns user's DB record (`tenant_id = SYSTEM_TENANT_ID` for admin), not JWT's impersonated `tenant_id`. Assertion would be incorrect. |

All 3 passes conducted in party mode. USER decided on all findings. 8 fixed, 1 withdrawn.

## Traceability

| Test ID | Change | File | Line(s) |
|---------|--------|------|---------|
| CT-101 | Login with valid credentials → 201 | api-contract-b.spec.ts | 104-116 |
| CT-102 | Login with wrong password → 401 | api-contract-b.spec.ts | 118-123 |
| CT-103 | GET /auth/me → 200 | api-contract-b.spec.ts | 125-134 |
| CT-104 | GET /auth/me no token → 401 | api-contract-b.spec.ts | 136-140 |
| CT-201 | Admin creates tenant → 201 | api-contract-b.spec.ts | 148-159 |
| CT-202 | Admin lists tenants → 200 | api-contract-b.spec.ts | 161-170 |
| CT-203 | Customer admin → admin tenants → 401 | api-contract-b.spec.ts | 172-177 |
| CT-204 | Admin impersonate → 201, token works | api-contract-b.spec.ts | 179-197 |
| CT-301 | Admin lists providers, creds masked | api-contract-b.spec.ts | 203-222 |
| CT-302 | Unknown provider key → 400 | api-contract-b.spec.ts | 224-236 |
| CT-303 | Customer admin → settings → 403 | api-contract-b.spec.ts | 238-243 |
| CT-304 | Provider types → known keys | api-contract-b.spec.ts | 245-254 |
| CT-401 | Admin lists all models | api-contract-b.spec.ts | 260-269 |
| CT-402 | App lists active-only models | api-contract-b.spec.ts | 271-280 |
| CT-403 | Admin creates model → 201 | api-contract-b.spec.ts | 282-298 |
| CT-404 | Admin bulk status toggle | api-contract-b.spec.ts | 300-319 |
| CT-501 | Admin creates chain → 201 | api-contract-b.spec.ts | 327-351 |
| CT-502 | Admin lists chains → 200 | api-contract-b.spec.ts | 353-361 |
| CT-503 | Admin publishes chain → 200 | api-contract-b.spec.ts | 363-370 |
| CT-505 | Chain with draft template → 400 | api-contract-b.spec.ts | 376-397 |
| CT-504 | Customer admin → chains → 403 | api-contract-b.spec.ts | 399-404 |
| seed | Extended seed data (providers, models, chain, bcrypt) | contract-test-helpers.ts | 106-467 |

## Dev Agent Record

- **Agent**: Amelia (dev agent, Claude Opus 4.6)
- **Session**: 2026-02-16
- **Files created**: `apps/api-gateway/src/app/api-contract-b.spec.ts` (21 tests)
- **Files modified**: `apps/api-gateway/src/app/contract-test-helpers.ts` (extended seed data)
- **Dependencies added**: None (reuses existing supertest + bcrypt)
- **Key findings during implementation**:
  1. RlsSetupService auto-seeds all 4 known providers — must UPDATE existing mock, not INSERT. Original INSERT caused `UQ_8640fa8f78a55af8615209cdb14` unique constraint violation.
  2. Provider types endpoint returns `providerKey` field (not `key`) — matches `ProviderTypeDto`.
  3. Chain `workflow_id` must reference published templates, not chain IDs — `validateReferencedWorkflows()` checks template table.
  4. AdminApiKeyGuard on tenant controller returns 401 (not 403) for non-admin users — combines auth+authz in a single guard.
