# System-Level Test Design

**Date:** 2026-02-16
**Author:** TEA (Test Architect Agent)
**Project:** project_bubble
**Status:** Draft
**Mode:** System-Level Testability Review (Phase 3 — Retroactive)

---

## Executive Summary

This is a retroactive system-level testability review performed after 4 epics of implementation (1400+ tests, 138 test files, 46 E2E tests). The project skipped the test-design workflow during initial planning. This review evaluates the architecture and existing test strategy against TEA knowledge base criteria, identifies gaps, and recommends improvements.

**Key Finding:** The project has organically developed a strong, multi-tier test strategy. However, several NFR-critical areas have zero automated validation (performance, security, observability). The CI/CD pipeline is missing entirely.

---

## Testability Assessment

### Controllability: PASS

| Criterion | Status | Evidence |
|-----------|--------|----------|
| State control for testing | PASS | TransactionManager + `SET LOCAL app.current_tenant` on every query. 3 separate test DBs (Tier 1, Tier 2, E2E) with truncate-and-reseed pattern. |
| External dependency mocking | PASS | NestJS DI enables full service mocking. MockLlmProvider eliminates LLM API dependency. BullMQ in-process (no separate worker). |
| Error condition injection | PASS (partial) | Mock providers can simulate failures. No chaos engineering framework for network/DB faults. |
| Tenant isolation control | PASS | Dual DataSource (bubble_app non-superuser + bubble_user superuser). RLS policies enforced and testable. 3-tenant seed model (Admin, Alpha, Beta). |

**Notable Strengths:**
- Mock LLM provider with deterministic responses (15 rpm, 500ms-2s latency simulation)
- Idempotency keys on BullMQ jobs prevent duplicate processing
- 3 isolated test databases prevent cross-tier contamination

**Gap:** No test data factory library. Seed data is hand-coded in `global-setup.ts`. As test complexity grows, this will become a maintenance burden.

---

### Observability: CONCERNS

| Criterion | Status | Evidence |
|-----------|--------|----------|
| System state inspection | PASS | WorkflowRun records store input_snapshot, assembled_prompt, raw_llm_response, retry_history, token_usage, credits_consumed |
| Test result determinism | PASS | Jest + Playwright tests are deterministic. No randomized data without seeds. Zoneless CD testing pattern established. |
| Distributed tracing | FAIL | Architecture specifies OpenTelemetry but NOT implemented. No trace IDs, no cross-service correlation. |
| Health monitoring | FAIL | Architecture specifies `@nestjs/terminus` health checks but NOT implemented. No `/health` endpoint. |
| Error monitoring | FAIL | No Sentry, Datadog, or APM integration. Errors are logged to console only. |
| Metrics collection | FAIL | No Prometheus, no request latency histograms, no queue depth monitoring. |
| Structured logging | FAIL | No correlation IDs, no request-scoped trace IDs, no `Server-Timing` headers. |

**Impact:** Without observability, production debugging relies entirely on DB-stored run state. Transient failures (network issues, resource exhaustion) leave no trace. NFR-Perf validation is impossible without metrics.

**Recommendation:** This is the single largest gap. Story 7-3 (Service Status Monitor) partially addresses this, but a dedicated observability story is needed covering: health checks, structured logging, basic metrics.

---

### Reliability: PASS

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Test isolation | PASS | Separate test databases per tier. E2E uses truncate-and-reseed. Jest tests use mocked dependencies. |
| Failure reproducibility | PASS | Deterministic test data, no hard waits, Playwright traces on first retry. |
| Retry mechanisms | PASS | LLM calls retry with exponential backoff. BullMQ DLQ for failed jobs. |
| Circuit breaker | PASS | Per-provider, in-memory, 3-5 failures → open 30-60s. |
| Loose coupling | PASS | Hexagonal LLM provider interface. BullMQ decouples API from execution. TransactionManager decouples services from DB. |

**Minor Concerns:**
- No chaos engineering capability for fault injection testing
- Frontend does not handle network disconnection (no offline mode)

---

## Architecturally Significant Requirements (ASRs)

### High-Priority ASRs (Score >= 6)

| ASR ID | NFR | Requirement | Prob | Impact | Score | Testing Status | Mitigation |
|--------|-----|-------------|------|--------|-------|----------------|------------|
| ASR-001 | NFR-Sec-1 | 100% of DB queries via RLS-enabled context | 2 | 3 | **6** | TESTED | Dual DataSource + RLS policies + 7 wiring tests verifying enforcement |
| ASR-002 | NFR-Rel-1 | Persist run state at every node transition | 2 | 3 | **6** | TESTED | WorkflowRun entity stores all state. Unit + integration tests verify. |
| ASR-003 | NFR-Perf-2 | Workflow submission returns "Queued" within 2s | 3 | 2 | **6** | NOT TESTED | No performance/load tests exist. No k6 or similar framework. |
| ASR-004 | NFR-Scale-1 | Admin-configurable concurrent run limits | 2 | 3 | **6** | PARTIALLY TESTED | BullMQ concurrency + credit check tested in unit tests. No load test under real concurrency. |

### Medium-Priority ASRs (Score 3-4)

| ASR ID | NFR | Requirement | Prob | Impact | Score | Testing Status |
|--------|-----|-------------|------|--------|-------|----------------|
| ASR-005 | NFR-Perf-1 | UI interactions render < 200ms | 2 | 2 | **4** | NOT TESTED |
| ASR-006 | NFR-Perf-3 | Reports load within 3 seconds | 2 | 2 | **4** | NOT TESTED |
| ASR-007 | NFR-Sec-2 | AES-256 encryption at rest | 1 | 3 | **3** | TESTED (LLM provider credentials encrypted via AES-256-GCM) |
| ASR-008 | NFR-Sec-3 | Cryptographically secure magic links | 1 | 3 | **3** | NOT IMPLEMENTED (Epic 6) |
| ASR-009 | NFR-Rel-2 | Exponential backoff retry on LLM failures | 1 | 2 | **2** | TESTED (retry logic + DLQ) |
| ASR-010 | NFR-Comp-1 | EU data residency | 1 | 2 | **2** | DEFERRED (deployment-time) |

---

## Test Levels Strategy

### Current Distribution (Actual)

Based on 1400+ tests across 138 files:

| Level | Count (approx) | Percentage | Notes |
|-------|----------------|------------|-------|
| **Unit** | ~1100 | 79% | Jest: service mocks, DTO validation, component specs, validators |
| **Integration (Wiring)** | ~60 | 4% | Tier 1 module compilation + Tier 2 real-DB integration + RETURNING shape tests |
| **E2E** | ~46 | 3% | Playwright: browser automation across 15 spec files |
| **Component (Angular)** | ~194 | 14% | Angular TestBed component tests (counted under unit but functionally component-level) |

### Recommended Distribution

For a B2B SaaS agentic workflow platform with heavy backend logic:

| Level | Target % | Rationale |
|-------|----------|-----------|
| **Unit** | 65-70% | Business logic, validators, DTOs, services — strong existing coverage |
| **Integration** | 15-20% | API endpoint contracts, DB operations, RLS enforcement, BullMQ processing |
| **E2E** | 5-10% | Critical user journeys only (login, run workflow, view results) |
| **NFR** | 5% | Performance (k6), security scans, observability validation |

### Assessment

The current 79% unit / 4% integration / 3% E2E split is **unit-heavy**. This is appropriate for the current development phase (building features), but integration testing should increase as the system matures. The existing Tier 1/Tier 2 wiring test pattern is excellent — it should be expanded to cover more service-to-DB interactions.

**Key Gap:** Integration tests that exercise the **full API endpoint** (HTTP request → controller → service → TransactionManager → DB → response) are largely absent. The wiring tests verify module compilation and specific SQL patterns, but don't test API contracts end-to-end.

---

## NFR Testing Approach

### Security: CONCERNS

| Check | Status | Evidence |
|-------|--------|----------|
| Auth/authz E2E tests | PARTIAL | E2E tests verify login, RBAC redirects, tenant isolation. No dedicated security test suite. |
| RLS enforcement | TESTED | 7 wiring tests verify RLS policies. Dual DataSource ensures non-superuser in app context. |
| JWT token handling | TESTED | JWT interceptor tests, 30m expiry (backend), 2h token lifetime (frontend), graceful 401 handling. |
| OWASP Top 10 | NOT TESTED | No SQL injection tests, no XSS sanitization tests, no CSRF validation. |
| Secrets management | PARTIAL | AES-256-GCM encryption for LLM credentials. No automated secret leak detection. |
| Prompt injection prevention | NOT TESTED | FR45 requires input sanitization, but no automated tests verify it. |
| Dependency vulnerabilities | NOT TESTED | No `npm audit` in CI (no CI pipeline exists). |

**Recommendation:** Add OWASP-focused E2E tests (SQL injection, XSS, prompt injection). Add `npm audit` to CI pipeline.

### Performance: FAIL

| Check | Status | Evidence |
|-------|--------|----------|
| Load testing (k6) | NOT TESTED | No k6 or equivalent framework configured. |
| SLO/SLA thresholds | NOT DEFINED | NFR-Perf-1/2/3 have targets but no automated enforcement. |
| Response time profiling | NOT TESTED | No Server-Timing headers, no p95/p99 measurements. |
| Stress testing | NOT TESTED | Unknown breaking point. |
| Resource leak detection | NOT TESTED | No endurance/soak tests. |

**Recommendation:** This is a **release blocker** for production. Story 7P (Production Readiness) should include k6 load tests for critical paths: workflow submission, report loading, API auth.

### Reliability: PASS (with gaps)

| Check | Status | Evidence |
|-------|--------|----------|
| Error handling (backend) | TESTED | Retry logic, DLQ, circuit breaker, credit refund — all with unit tests. |
| Error handling (frontend) | PARTIAL | Graceful 401 handling, but no generic error boundary testing. |
| Health checks | NOT IMPLEMENTED | No `/health` endpoint (Story 7-3 scope). |
| Circuit breaker | TESTED | Per-provider, in-memory, verified in unit tests. |
| Rate limiting | TESTED | ThrottlerModule for HTTP, BullMQ limiter for LLM. Confirmed working (discovered rate limit bug in E2E). |

### Maintainability: CONCERNS

| Check | Status | Evidence |
|-------|--------|----------|
| Test coverage metric | UNKNOWN | No `--coverage` flag configured. No coverage thresholds enforced. |
| Code duplication | UNKNOWN | No jscpd or similar tool. |
| Vulnerability scanning | NOT TESTED | No `npm audit` in CI. |
| Observability validation | FAIL | No health checks, no metrics, no structured logging. |
| CI/CD pipeline | FAIL | **No GitHub Actions workflows exist.** All testing is manual (`npx nx test`, `npx nx e2e`). |

---

## Test Environment Requirements

| Environment | Purpose | Status |
|-------------|---------|--------|
| **Local (Docker Compose)** | Development + unit/integration testing | CONFIGURED (PostgreSQL + Redis via Docker) |
| **Tier 1 Test DB** | Module wiring compilation tests | CONFIGURED (`project_bubble_wiring_test`) |
| **Tier 2 Test DB** | Integration wiring tests (real queries) | CONFIGURED (`project_bubble_wiring_integ_test`) |
| **E2E Test DB** | Playwright browser tests | CONFIGURED (`project_bubble_test`) |
| **Staging** | Pre-production validation | NOT CONFIGURED |
| **CI Runner** | Automated testing on push/PR | NOT CONFIGURED |
| **Load Test Env** | k6 performance testing | NOT CONFIGURED |

---

## Testability Concerns

### CONCERN 1: No CI/CD Pipeline (CRITICAL)

**Impact:** All 1400+ tests run manually. No automated gate before merge. A broken test can persist undetected.
**Story:** 1.11 (CI/CD Pipeline Setup) — currently `todo` in sprint status.
**Recommendation:** This should be the NEXT infrastructure investment. Configure GitHub Actions with `nx affected:test` + `nx affected:lint` + `nx affected:build`.

### CONCERN 2: No Performance Testing Framework (HIGH)

**Impact:** NFR-Perf-1/2/3 have defined targets (200ms UI, 2s submission, 3s report load) but zero automated validation. Cannot detect performance regressions.
**Story:** 7P-7 (Load Testing) in Epic 7P.
**Recommendation:** Add k6 with baseline smoke tests for critical API endpoints before production.

### CONCERN 3: No Observability Infrastructure (HIGH)

**Impact:** Production debugging will rely entirely on DB-stored run state and console logs. Transient failures, resource exhaustion, and latency spikes leave no trace.
**Stories:** 7-3 (Service Status Monitor) partially covers health checks. Need additional story for OpenTelemetry + structured logging.
**Recommendation:** Add `/health` endpoint, structured logging with correlation IDs, and basic Prometheus metrics before production.

### CONCERN 4: No Security Test Suite (MEDIUM)

**Impact:** OWASP Top 10 vulnerabilities are not automatically validated. RLS is well-tested, but application-layer security (XSS, CSRF, prompt injection) is not.
**Recommendation:** Add dedicated security tests as part of Epic 7 or a separate hardening story. Include `npm audit` in CI.

### CONCERN 5: No Test Coverage Measurement (MEDIUM)

**Impact:** Unknown code coverage. Cannot identify untested code paths. Cannot enforce coverage thresholds.
**Recommendation:** Enable Jest `--coverage` with `coverageThreshold` in jest.config. Add coverage reporting to CI.

---

## Recommendations for Next Steps

### Immediate (Before Epic 5)

1. **CI/CD Pipeline** (Story 1.11) — Configure GitHub Actions with `nx affected:test/lint/build`. This is the foundation for everything else.
2. **Coverage Reporting** — Enable Jest coverage and establish baseline metrics.

### Before Production (Epic 7P)

3. **Health Check Endpoint** — Implement `/health` using `@nestjs/terminus` (DB, Redis, queue checks).
4. **k6 Load Tests** — Baseline performance tests for: auth login, workflow submission, API endpoints.
5. **`npm audit` in CI** — Automated vulnerability scanning.

### Future (Post-MVP)

6. **OpenTelemetry Integration** — Distributed tracing across API → BullMQ → LLM.
7. **Structured Logging** — Correlation IDs, request-scoped context, centralized log aggregation.
8. **Security Test Suite** — OWASP-focused E2E tests (SQL injection, XSS, prompt injection).
9. **Chaos Engineering** — Fault injection for resilience testing (network partition, DB slowdown).

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/bmm/testarch/test-design`
**Version**: 4.0 (BMad v6)
