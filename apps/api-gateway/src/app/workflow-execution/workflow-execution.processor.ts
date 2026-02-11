import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import {
  TransactionManager,
  WorkflowRunEntity,
  WorkflowRunStatus,
} from '@project-bubble/db-layer';
import { WorkflowJobPayload } from '@project-bubble/shared';

@Processor('workflow-execution', {
  concurrency: parseInt(process.env['WORKER_CONCURRENCY'] || '100'),
  lockDuration: 300000,
})
export class WorkflowExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowExecutionProcessor.name);

  constructor(
    private readonly txManager: TransactionManager,
    @InjectQueue('workflow-execution-dlq')
    private readonly dlqQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<WorkflowJobPayload>): Promise<void> {
    const { runId, tenantId } = job.data;

    this.logger.log({
      message: 'Processing workflow run',
      jobId: job.id,
      runId,
      tenantId,
    });

    const startedAt = new Date();

    // Atomic: load entity, check status guards, update to RUNNING — single transaction
    const run = await this.txManager.run(tenantId, async (manager) => {
      const entity = await manager.findOne(WorkflowRunEntity, { where: { id: runId } });

      if (!entity) {
        throw new Error(`WorkflowRunEntity not found: ${runId}`);
      }

      // Idempotency: skip runs in terminal states
      if (
        entity.status === WorkflowRunStatus.COMPLETED ||
        entity.status === WorkflowRunStatus.FAILED ||
        entity.status === WorkflowRunStatus.CANCELLED
      ) {
        return null;
      }

      // Stale lock recovery: previous attempt crashed mid-processing
      if (entity.status === WorkflowRunStatus.RUNNING) {
        this.logger.warn({
          message:
            'Recovering stale run — previous attempt did not complete',
          jobId: job.id,
          runId,
          tenantId,
        });
      }

      await manager.update(WorkflowRunEntity, { id: runId }, {
        status: WorkflowRunStatus.RUNNING,
        startedAt,
      });

      return entity;
    });

    // Run was in a terminal state — skip processing
    if (!run) {
      this.logger.warn({
        message: 'Skipping run in terminal state',
        jobId: job.id,
        runId,
        tenantId,
      });
      return;
    }

    // Placeholder: actual LLM work comes in Story 4-2/4-3
    this.logger.log({
      message:
        'Processing workflow run — LLM integration pending Story 4-2/4-3',
      jobId: job.id,
      runId,
      tenantId,
    });

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await this.txManager.run(tenantId, async (manager) => {
      await manager.update(WorkflowRunEntity, { id: runId }, {
        status: WorkflowRunStatus.COMPLETED,
        completedAt,
        durationMs,
      });
    });

    this.logger.log({
      message: 'Workflow run completed',
      jobId: job.id,
      runId,
      tenantId,
      durationMs,
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<WorkflowJobPayload>, error: Error): Promise<void> {
    const { runId, tenantId } = job.data;
    const attemptsMade = job.attemptsMade;
    const maxAttempts = job.opts?.attempts ?? 3;

    // Intermediate failure — let BullMQ retry
    if (attemptsMade < maxAttempts) {
      this.logger.warn({
        message: `Workflow run attempt ${attemptsMade}/${maxAttempts} failed, will retry`,
        jobId: job.id,
        runId,
        tenantId,
        error: error.message,
        attemptsMade,
      });
      return;
    }

    // Final failure — route to DLQ
    this.logger.error({
      message: 'Workflow run failed after all retries, routing to DLQ',
      jobId: job.id,
      runId,
      tenantId,
      error: error.message,
      attemptsMade,
    });

    // Add to DLQ queue for admin inspection
    try {
      await this.dlqQueue.add('failed-workflow-run', {
        originalJobId: job.id,
        runId,
        tenantId,
        failedAt: new Date().toISOString(),
        attemptsMade,
        errorMessage: error.message,
        payload: job.data,
      });
    } catch (dlqError) {
      this.logger.error({
        message: 'Failed to add job to DLQ queue',
        jobId: job.id,
        runId,
        error: dlqError instanceof Error ? dlqError.message : String(dlqError),
      });
    }

    // Update entity status to FAILED — wrap in try/catch to prevent cascade failure
    try {
      const errorSummary = error.message.length > 200
        ? error.message.substring(0, 200) + '...'
        : error.message;

      await this.txManager.run(tenantId, async (manager) => {
        await manager.update(WorkflowRunEntity, { id: runId }, {
          status: WorkflowRunStatus.FAILED,
          errorMessage: `Workflow execution failed after ${attemptsMade} attempts: ${errorSummary}`,
        });
      });
    } catch (updateError) {
      this.logger.error({
        message: 'Failed to update entity status after DLQ routing',
        jobId: job.id,
        runId,
        tenantId,
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
    }
  }
}
