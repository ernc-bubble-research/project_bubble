# Operations Runbook

## Workflow Execution Queue Infrastructure

### Queue Names

| Queue | Purpose | Processor |
|-------|---------|-----------|
| `workflow-execution` | Main execution queue — processes workflow runs | `WorkflowExecutionProcessor` |
| `workflow-execution-dlq` | Dead letter queue — stores failed jobs for admin inspection | None (read-only) |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_CONCURRENCY` | `100` | Max concurrent workflow jobs processed. Requires app restart to change. |
| `REDIS_HOST` | `localhost` | Redis connection host (shared with BullMQ) |
| `REDIS_PORT` | `6379` | Redis connection port |

### Queue Configuration

- **Attempts**: 3 (exponential backoff starting at 5s)
- **Lock Duration**: 300,000ms (5 minutes — accommodates slow LLM calls)
- **removeOnComplete**: 100 (keep last 100 completed jobs)
- **removeOnFail**: false (DLQ handles failed jobs)

### Log Format

All workflow execution logs use structured JSON. Key fields:

```json
{
  "message": "Workflow run completed",
  "jobId": "uuid",
  "runId": "uuid",
  "tenantId": "uuid",
  "durationMs": 1234,
  "error": "error message (if failed)",
  "attemptsMade": 3
}
```

Log messages to monitor:
- `Processing workflow run` — job picked up by processor
- `Workflow run completed` — successful completion
- `Skipping already-completed run` — idempotency guard triggered
- `Recovering stale run` — stale lock recovery (previous worker crashed)
- `Workflow run attempt X/Y failed, will retry` — intermediate failure
- `Workflow run failed after all retries, routing to DLQ` — final failure
- `Failed to update entity status after DLQ routing` — DB error during DLQ handling (job still preserved in DLQ)

### DLQ Inspection

**Check DLQ depth via redis-cli:**

```bash
redis-cli LLEN bull:workflow-execution-dlq:wait
```

**List DLQ jobs via BullMQ API (Node.js):**

```typescript
import { Queue } from 'bullmq';
const dlq = new Queue('workflow-execution-dlq', { connection: { host: 'localhost', port: 6379 } });
const jobs = await dlq.getJobs(['waiting', 'completed'], 0, 100);
for (const job of jobs) {
  console.log(job.id, job.data.runId, job.data.errorMessage, job.data.failedAt);
}
```

**DLQ job data structure:**

```json
{
  "originalJobId": "uuid",
  "runId": "uuid",
  "tenantId": "uuid",
  "failedAt": "2026-02-11T12:00:00.000Z",
  "attemptsMade": 3,
  "errorMessage": "description of failure",
  "payload": { "...original WorkflowJobPayload..." }
}
```

### Failure Patterns

| Pattern | Cause | Diagnosis |
|---------|-------|-----------|
| Jobs in DLQ with "not found" errors | WorkflowRunEntity deleted before processing | Check if entity was cancelled/deleted before queue picked it up |
| Jobs in DLQ with timeout errors | LLM provider response exceeded lock duration | Check provider latency; consider increasing `lockDuration` |
| Jobs in DLQ with connection errors | LLM provider unreachable | Check provider endpoint, network, API keys |
| "Failed to update entity status" in logs | DB connection issue during DLQ handling | Job is preserved in DLQ; entity may be stuck in RUNNING state |
| "Recovering stale run" warnings | Worker crashed mid-processing | Normal recovery — BullMQ reassigned the job |
| "Skipping already-completed run" warnings | Duplicate retry after completion | Normal idempotency guard — no action needed |

### Health Checks

**Check if workers are active:**

```bash
redis-cli HGETALL bull:workflow-execution:meta
```

**Check queue backlog:**

```bash
redis-cli LLEN bull:workflow-execution:wait
redis-cli LLEN bull:workflow-execution:active
```

**Check for stuck RUNNING entities (stale runs):**

```sql
SELECT id, tenant_id, status, started_at, NOW() - started_at AS age
FROM workflow_runs
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '10 minutes'
ORDER BY started_at;
```

## Incident Runbooks

### Orphaned Runs from RETURNING Bug (Story 4-FIX-A1, 2026-02-12)

**Background:** A bug in `workflow-execution.processor.ts` caused the fan-in finalization check
to never trigger. The pg driver returns `[[rows], affectedCount]` for `UPDATE ... RETURNING` queries
via `EntityManager.query()`, but the code destructured as `rows[0]` (getting the inner array instead
of the row object). This made `completed_jobs`, `failed_jobs`, and `total_jobs` all `undefined`,
so the `completed + failed >= total` check never passed.

**Impact:** Workflow runs with fan-out (multiple subject files) got stuck in `running` status
despite all individual jobs completing successfully. Counter columns (`completed_jobs`, `failed_jobs`)
were never updated because the RETURNING result was not destructured correctly.

**Diagnosis query:**

```sql
SELECT id, tenant_id, status, completed_jobs, failed_jobs, total_jobs,
       started_at, completed_at
FROM workflow_runs
WHERE status = 'running'
  AND total_jobs IS NOT NULL
ORDER BY started_at;
```

**Cleanup SQL:**

```sql
-- Fix orphaned fan-out runs stuck in 'running' due to RETURNING destructuring bug.
-- COALESCE is a safety measure — the bug still allowed counters to increment (via the
-- UPDATE SQL), but the finalization check failed due to RETURNING result parsing.
-- Future bugs might leave counters NULL, so COALESCE is retained as defensive SQL.
UPDATE workflow_runs
SET status = 'completed', completed_at = NOW()
WHERE status = 'running'
  AND COALESCE(completed_jobs, 0) + COALESCE(failed_jobs, 0) >= total_jobs;
```

**Post-cleanup verification:**

```sql
-- Should return 0 rows after cleanup
SELECT COUNT(*) FROM workflow_runs
WHERE status = 'running'
  AND total_jobs IS NOT NULL
  AND COALESCE(completed_jobs, 0) + COALESCE(failed_jobs, 0) >= total_jobs;
```

**Root cause fix:** Story 4-FIX-A1 — `parseUpdateReturningRow()` helper with runtime assertion.
All `UPDATE ... RETURNING` calls now use `const [[row]] = result` destructuring pattern.

## Catalog RLS Policies (Story 4-FIX-A2, 2026-02-13)

Two RLS policies were added to `RlsSetupService` for tenant users to access published workflow templates via the catalog:

### Policies

1. **`catalog_read_published`** on `workflow_templates`:
   - SELECT only where `status = 'published'`, `deleted_at IS NULL`, and visibility check (public OR tenant in `allowed_tenants`)
   - Separate from the existing `template_access` policy (which uses `current_setting('app.current_tenant')`)

2. **`catalog_read_published_versions`** on `workflow_versions`:
   - SELECT only where the parent template (via `template_id`) is published and passes the same visibility check
   - Uses EXISTS subquery to check template status

### Important Notes

- **RLS is currently bypassed** because `bubble_user` is a superuser. These policies are forward-looking for Story 4-RLS (non-superuser `bubble_app` role).
- **WHERE clauses are the active security layer.** `findPublishedOne()` and `findPublished()` enforce visibility in application code.
- This is a **documented Rule 2c exception** — `findPublishedOne` queries by `{ id, status: PUBLISHED }` without `tenantId` because templates are admin-created and shared cross-tenant.
- `findPublished` list endpoint additionally filters by `(visibility = 'public' OR tenantId = ANY(allowed_tenants))`.

### Status Transition Update

The PUBLISHED → DRAFT transition was added (unpublish). Full state machine:
- DRAFT → PUBLISHED
- PUBLISHED → ARCHIVED
- PUBLISHED → DRAFT (unpublish — does not stop running workflows)
- ARCHIVED → DRAFT
