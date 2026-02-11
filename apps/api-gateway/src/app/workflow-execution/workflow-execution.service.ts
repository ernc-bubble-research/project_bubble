import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WorkflowJobPayload } from '@project-bubble/shared';

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
  ): Promise<{ jobId: string }> {
    await this.executionQueue.add('execute-workflow', payload, {
      jobId: runId,
    });

    this.logger.log({
      message: 'Workflow run enqueued',
      jobId: runId,
      runId,
      tenantId: payload.tenantId,
    });

    return { jobId: runId };
  }
}
