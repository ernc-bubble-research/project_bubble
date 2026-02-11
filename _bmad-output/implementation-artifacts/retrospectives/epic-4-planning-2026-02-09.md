# Epic 4 Planning — Party Mode Session

**Date:** 2026-02-09
**Scope:** Workflow Execution Engine (Stories 4-0 through 4-7 + 4E + 4EH)
**Participants:** Murat (TEA), Amelia (Dev), Winston (Architect), Bob (SM), Mary (Analyst), Charlie (Spectral Quality Enforcer)
**Rounds:** 5

---

## Architecture Pivot Reminder

LangGraph.js has been **deferred**. Epic 4 builds:
- **Atomic workflows** with single LLM call per file
- **YAML IS the prompt** — workflow definition consumed directly by execution engine
- **BullMQ** for async execution (fan-out/fan-in, chains)
- **Hexagonal LLM pattern** — abstract provider interface (mock, google-ai-studio, vertex, openai)

---

## 9 Topic Decisions

### Topic 1: Circuit Breaker for LLM Providers

**Decision:** Per-provider circuit breaker, in-memory state.

| Parameter | Value |
|-----------|-------|
| Failure threshold | 3-5 consecutive failures |
| State transitions | Closed → Open → Half-Open → Closed |
| Open duration | 30-60 seconds |
| Half-open probe | 1 request allowed |
| Error type | `CircuitOpenError` |

**Behavior when open:**
- Jobs requeued with backoff (not failed immediately)
- Clear user error: "Provider temporarily unavailable. Your run will retry automatically."
- No credits charged for CircuitOpenError
- Auto-retry when circuit closes

**Implementation:** Story 4-3 (execution engine core).

---

### Topic 2: Per-Tenant Safety Cap / Budget System

**Decision:** Two-column system on TenantEntity.

| Column | Set By | Default | Purpose |
|--------|--------|---------|---------|
| `max_credits_per_run_limit` | Bubble Admin | 1000 | Ceiling — cannot be exceeded |
| `max_credits_per_run` | Customer Admin | 1000 | Adjustable, must be ≤ limit |

**Behavior:**
- Checked at pre-flight (before execution starts)
- Error message to customer: **"This workflow requires X credits per run. Your organization's per-run limit is Y. Please contact your administrator."**
- Wording says "enforced by your organization" — not Bubble platform
- Both confirmation dialog AND hard cap
- Customer admin can lower their own cap within Bubble Admin's ceiling

**Implementation:** Story 4-4 (pre-flight validation + credit check).

---

### Topic 3: In-Process BullMQ Consumer

**Decision:** Workflow execution processor runs **inside api-gateway** (same process as ingestion pattern).

| Parameter | Value |
|-----------|-------|
| Lock duration | 300,000ms (5 minutes) — LLM calls can be slow |
| Concurrency | `WORKER_CONCURRENCY` env var, default 100 |
| Queue name | `workflow-execution` |

**Scaling path:**
1. Increase `WORKER_CONCURRENCY` env var (ops only, not admin UI)
2. Extract to separate worker process (Story 7P-5b) for horizontal scaling

**Implementation:** Story 4-0 (queue setup), Story 4-3 (processor).

---

### Topic 4: Credit / Billing System

**Decision:** Deduct upfront, refund on failure.

| Scenario | Credits |
|----------|---------|
| Normal run | Deduct `credits_per_run` at submission |
| Run fails | Refund credits |
| Test run (admin testing before publish) | `is_test_run = true` → bypass credit check entirely |
| Impersonation run | Also bypasses credit check |
| Circuit breaker open | No credits charged (requeue) |

**Key design:**
- `is_test_run` flag on WorkflowRunEntity — bypasses credit check entirely
- No numeric admin credit pool (avoids "time bomb" of depleted admin credits)
- No "magic number" like 999999 credits for admins
- Test runs = admin testing workflows before publishing them

**Implementation:** Story 4-4 (credit check), Story 4-7 (test run).

---

### Topic 5: Output Validation Strategies

**Decision:** Structural validation only (no semantic/content validation).

| Validation Type | Approach |
|----------------|----------|
| Markdown output | Check for expected headings (## sections) |
| JSON output | Validate against JSON schema |
| Plain text | Length check only |

**Retry settings — per-workflow, configured in wizard Execution step:**

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `max_retries` | number | 3 | Maximum retry attempts |
| `free_retries` | number | 1 | Retries included at no extra cost |
| `charge_for_extra_retries` | boolean | true | Whether retries beyond free count cost credits |
| `extra_retry_credit_cost` | number | 1 | Credits per extra retry |

**All retry settings are editable** in the wizard Execution step.

**Retry mechanism:** Correction prompt appended as new LLM call (not conversation history).

**Implementation:** Story 4-5 (output validation + storage).

---

### Topic 6: Fan-Out / Fan-In Patterns with BullMQ

**Decision:** Per-workflow-run concurrency with partial success support.

| Parameter | Value |
|-----------|-------|
| `max_concurrency` | Per workflow run (not system-wide) |
| System concurrency | `WORKER_CONCURRENCY` env var (default 100) |
| Partial success | `completed_with_errors` status |
| Retry failed | "Retry failed files" button in UI |

**Scaling approach:**
1. Default `WORKER_CONCURRENCY=100` (safe — rate limiter is the real governor)
2. Monitor queue health dashboard for saturation
3. Increase env var if needed
4. Extract to separate worker (7P-5b) for horizontal scaling

**Implementation:** Story 4-3 (execution engine core).

---

### Topic 7: Token Budget Management

**Decision:** Estimate first, precise count only when close to limit.

| Step | When | Method |
|------|------|--------|
| 1. Quick estimate | Always | `fileSize / 4` (rough token count) |
| 2. Precise count | If estimate > 80% of budget | `countTokens()` API call |
| 3. Over budget | If precise count exceeds budget | Interactive file deselection modal |

**Key decisions:**
- No "use another model" suggestion (admin picks model, not user)
- File deselection modal shows file sizes and estimated token counts
- User can deselect files to fit within budget

**Implementation:** Story 4-4 (pre-flight validation).

---

### Topic 8: Per-Workflow Credit Pricing

**Decision:** `credits_per_run` column on WorkflowTemplateEntity.

| Field | Location | Default | Editable By |
|-------|----------|---------|-------------|
| `credits_per_run` | WorkflowTemplateEntity | 1 | Bubble Admin (wizard Metadata step) |

**UI integration:**
- Shown on workflow cards in catalog
- Configurable in wizard Metadata step
- Deducted at run submission (see Topic 4)

**Implementation:** Story 4-1 (catalog + run initiation) + Story 4-4 (credit deduction).

---

### Topic 9: Rate Limiting Architecture

**Two separate rate limiting systems:**

| System | Scope | Config | Purpose |
|--------|-------|--------|---------|
| ThrottlerModule | External HTTP API | `THROTTLE_LIMIT` env var (default 100/min) | Prevent API abuse |
| BullMQ rate limiter | LLM provider calls | `rate_limit_rpm` on LlmProviderConfigEntity | Respect provider quotas |

**ThrottlerModule:**
- External HTTP requests only
- Internal service calls bypass entirely
- Configurable via `THROTTLE_LIMIT` env var (no UI needed)
- Currently 100 req/min (raised from 10 during E2E fixes)

**BullMQ LLM rate limiter:**
- Reads `rate_limit_rpm` from active LLM provider config
- Per-provider, editable in admin LLM Provider Settings UI
- Prevents exceeding Google AI Studio (15 rpm), Vertex, OpenAI quotas
- BullMQ `RateLimiter` on the execution queue

**Implementation:** Story 4-0 (queue setup) + Story 4-2 (LLM provider interface).

---

## Additional Decisions

### Mock LLM Provider Configuration

| Parameter | Value |
|-----------|-------|
| Rate limit | 15 rpm (matches Google AI Studio free tier) |
| Simulated latency | 500ms - 2s (random within range) |
| Responses | Deterministic (based on input hash) |
| Forced failures | Support forced validation failures for testing |

### Admin Role Separation (Clarified)

| Feature | Bubble Admin (`/admin/*`) | Customer Admin (`/app/*`) |
|---------|--------------------------|--------------------------|
| LLM provider config | ✅ Full CRUD | ❌ Not visible |
| LLM model management | ✅ Full CRUD | ❌ Not visible |
| Workflow builder/wizard | ✅ Full access | ❌ Not visible |
| Execution settings | ✅ Configure retry, credits | ❌ Not visible |
| Tenant `max_credits_per_run` | ✅ Sets ceiling (`_limit`) | ✅ Adjusts within ceiling |
| Run workflows | ✅ Test runs (no credits) | ✅ Normal runs (credits) |
| Queue health dashboard | ✅ Full visibility | ❌ Not visible |

**Customer admins see NO LLM settings.** Only Bubble Admin.

### Queue Health Dashboard

**For Bubble Admin** — add to Epic 7 or as part of Story 4-3/7-3.

| Metric | Description |
|--------|-------------|
| Waiting jobs | Jobs in queue not yet processed |
| Active jobs | Currently being processed |
| Completed jobs | Successfully finished |
| Failed jobs | Failed after all retries |
| Avg wait time | Average time from enqueue to processing |
| Saturation warning | Log warning at 80% of `WORKER_CONCURRENCY` |

### Worker Scaling Path

1. **Default:** `WORKER_CONCURRENCY=100` in-process (safe, rate limiter governs)
2. **Scale up:** Increase `WORKER_CONCURRENCY` env var
3. **Scale out:** Extract to separate worker process (Story 7P-5b)
4. **Not exposed** in admin UI — ops only

### Post-Story-4-3 Milestone

**Live LLM integration test** with erinc after Story 4-3 (execution engine core) is complete. First real LLM call through the full stack.

---

## Story Order (Validated)

| Order | Story | Description |
|-------|-------|-------------|
| 1 | 4-0 | BullMQ safety prerequisites (DLQ + idempotency + execution queue) |
| 2 | 4-1 | Workflow catalog + run initiation (customer-facing) |
| 3 | 4-2 | LLM provider interface + prompt assembly |
| 4 | 4-3 | Execution engine core (fan-out/fan-in) — **LIVE TEST MILESTONE** |
| 5 | 4-4 | Pre-flight validation + credit check |
| 6 | 4-5 | Output validation + storage |
| 7 | 4-6 | Workflow chain orchestration |
| 8 | 4-7 | Workflow test run + preview |
| 9 | 4E | E2E test coverage for Epic 4 |
| 10 | 4EH | E2E error-path hardening (all epics 1-4) |

---

## New Entity/Column Additions (Summary)

| Entity | New Columns | Story |
|--------|-------------|-------|
| WorkflowTemplateEntity | `credits_per_run` (default 1) | 4-1 |
| WorkflowTemplateEntity | `max_retries`, `free_retries`, `charge_for_extra_retries`, `extra_retry_credit_cost` | 4-5 |
| WorkflowRunEntity | `is_test_run` (boolean) | 4-7 |
| TenantEntity | `max_credits_per_run_limit`, `max_credits_per_run` | 4-4 |
| LlmProviderConfigEntity | `rate_limit_rpm` | 4-2 |

---

## Team Agreements

1. **Admin role separation is absolute** — Customer admins see NO LLM, workflow builder, or execution settings.
2. **`is_test_run` bypasses credits entirely** — no numeric pools, no magic numbers, no time bombs.
3. **Rate limiting has two layers** — ThrottlerModule for HTTP, BullMQ limiter for LLM providers.
4. **Circuit breaker per provider** — not per tenant, not system-wide.
5. **Retry settings are per-workflow** — configured in wizard Execution step.
6. **Safety cap uses two columns** — Bubble Admin ceiling + Customer Admin adjustable value.
7. **Worker concurrency is ops, not admin** — env var only, no UI.
8. **Charlie sees all. Charlie forgets nothing.** — Quality enforcement is non-negotiable.

---

## Deferred / Future Items

| Item | Deferred To | Reason |
|------|------------|--------|
| Separate BullMQ worker process | 7P-5b | Not needed until horizontal scaling required |
| Queue health dashboard | 7-3 or new story | Observability feature, not blocking execution |
| Semantic output validation | Phase 2 | Structural validation sufficient for MVP |
| LLM conversation history for retries | Phase 2 | Correction prompt as new call is simpler |
| Per-tenant rate limiting | Phase 2 | Per-provider rate limiting covers MVP |
