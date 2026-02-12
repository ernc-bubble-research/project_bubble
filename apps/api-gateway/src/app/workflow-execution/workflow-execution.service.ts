import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  WorkflowJobPayload,
  WorkflowJobSubjectFile,
  WorkflowProcessingMode,
} from '@project-bubble/shared';

export interface EnqueueOptions {
  subjectFiles: WorkflowJobSubjectFile[];
  processingMode: WorkflowProcessingMode;
  maxConcurrency: number;
}

@Injectable()
export class WorkflowExecutionService {
  private readonly logger = new Logger(WorkflowExecutionService.name);

  constructor(
    @InjectQueue('workflow-execution')
    private readonly executionQueue: Queue,
  ) {}

  async enqueueRun(
    runId: string,
    payload: WorkflowJobPayload,
    options?: EnqueueOptions,
  ): Promise<{ jobIds: string[] }> {
    // No subject files → context-only workflow: single job, backward-compat
    if (!options || options.subjectFiles.length === 0) {
      await this.executionQueue.add('execute-workflow', payload, {
        jobId: runId,
      });

      this.logger.log({
        message: 'Workflow run enqueued (context-only)',
        jobId: runId,
        runId,
        tenantId: payload.tenantId,
      });

      return { jobIds: [runId] };
    }

    const { subjectFiles, processingMode, maxConcurrency } = options;

    if (processingMode === 'batch') {
      // Fan-in: 1 job with ALL subject files concatenated
      const batchPayload: WorkflowJobPayload = {
        ...payload,
        subjectFiles,
      };

      await this.executionQueue.add('execute-workflow', batchPayload, {
        jobId: runId,
      });

      this.logger.log({
        message: 'Workflow run enqueued (batch)',
        jobId: runId,
        runId,
        tenantId: payload.tenantId,
        fileCount: subjectFiles.length,
      });

      return { jobIds: [runId] };
    }

    // Fan-out: N jobs, 1 per subject file
    // NOTE: Per-run max_concurrency enforcement requires BullMQ Pro (group concurrency).
    // For MVP, all jobs enqueue immediately and system-wide WORKER_CONCURRENCY governs throughput.
    // The max_concurrency value is preserved in the definition for future Pro upgrade.
    const jobIds: string[] = [];

    for (let i = 0; i < subjectFiles.length; i++) {
      const jobId = `${runId}:file:${i}`;
      const filePayload: WorkflowJobPayload = {
        ...payload,
        subjectFile: subjectFiles[i],
      };

      await this.executionQueue.add('execute-workflow', filePayload, {
        jobId,
      });

      jobIds.push(jobId);
    }

    this.logger.log({
      message: 'Workflow run enqueued (parallel fan-out)',
      runId,
      tenantId: payload.tenantId,
      jobCount: jobIds.length,
      maxConcurrency,
    });

    return { jobIds };
  }
}
