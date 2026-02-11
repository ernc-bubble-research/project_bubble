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
