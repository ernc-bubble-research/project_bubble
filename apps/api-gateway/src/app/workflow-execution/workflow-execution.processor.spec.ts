import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { WorkflowExecutionProcessor } from './workflow-execution.processor';
import {
  TransactionManager,
  WorkflowRunEntity,
  WorkflowRunStatus,
} from '@project-bubble/db-layer';
import { WorkflowJobPayload } from '@project-bubble/shared';
import { EntityManager } from 'typeorm';

describe('WorkflowExecutionProcessor', () => {
  let processor: WorkflowExecutionProcessor;
  let txManager: jest.Mocked<TransactionManager>;
  let dlqQueue: jest.Mocked<Queue>;
  let mockManager: jest.Mocked<Pick<EntityManager, 'findOne' | 'update'>>;

  const tenantId = 'aaaaaaaa-0000-0000-0000-000000000001';
  const runId = 'bbbbbbbb-0000-0000-0000-000000000001';

  const basePayload: WorkflowJobPayload = {
    runId,
    tenantId,
    versionId: 'cccccccc-0000-0000-0000-000000000001',
    definition: {} as WorkflowJobPayload['definition'],
    contextInputs: {},
  };

  function makeJob(overrides: Partial<Job<WorkflowJobPayload>> = {}): Job<WorkflowJobPayload> {
    return {
      id: runId,
      data: basePayload,
      attemptsMade: 3,
      opts: { attempts: 3 },
      ...overrides,
    } as unknown as Job<WorkflowJobPayload>;
  }

  function makeRun(overrides: Partial<WorkflowRunEntity> = {}): WorkflowRunEntity {
    return {
      id: runId,
      tenantId,
      status: WorkflowRunStatus.QUEUED,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      errorMessage: null,
      ...overrides,
    } as WorkflowRunEntity;
  }

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    txManager = {
      run: jest.fn().mockImplementation(
        (_tenantId: string, cb: (manager: EntityManager) => Promise<unknown>) =>
          cb(mockManager as unknown as EntityManager),
      ),
    } as unknown as jest.Mocked<TransactionManager>;

    dlqQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Queue>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowExecutionProcessor,
        { provide: TransactionManager, useValue: txManager },
        { provide: getQueueToken('workflow-execution-dlq'), useValue: dlqQueue },
      ],
    }).compile();

    processor = module.get(WorkflowExecutionProcessor);
  });

  describe('process()', () => {
    it('4.1 — updates run status QUEUED -> RUNNING -> COMPLETED', async () => {
      mockManager.findOne.mockResolvedValue(makeRun());

      await processor.process(makeJob());

      expect(mockManager.update).toHaveBeenCalledTimes(2);

      const firstUpdate = mockManager.update.mock.calls[0];
      expect(firstUpdate[0]).toBe(WorkflowRunEntity);
      expect(firstUpdate[1]).toEqual({ id: runId });
      expect(firstUpdate[2]).toMatchObject({ status: WorkflowRunStatus.RUNNING });

      const secondUpdate = mockManager.update.mock.calls[1];
      expect(secondUpdate[2]).toMatchObject({ status: WorkflowRunStatus.COMPLETED });
    });

    it('4.2 — sets startedAt, completedAt, durationMs', async () => {
      mockManager.findOne.mockResolvedValue(makeRun());

      await processor.process(makeJob());

      const firstUpdate = mockManager.update.mock.calls[0][2] as Partial<WorkflowRunEntity>;
      expect(firstUpdate.startedAt).toBeInstanceOf(Date);

      const secondUpdate = mockManager.update.mock.calls[1][2] as Partial<WorkflowRunEntity>;
      expect(secondUpdate.completedAt).toBeInstanceOf(Date);
      expect(typeof secondUpdate.durationMs).toBe('number');
      expect(secondUpdate.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('4.3 — skips already-COMPLETED runs (returns early, logs warning)', async () => {
      mockManager.findOne.mockResolvedValue(
        makeRun({ status: WorkflowRunStatus.COMPLETED }),
      );

      await processor.process(makeJob());

      // findOne is called but update to RUNNING is NOT (returned null from atomic tx)
      expect(mockManager.findOne).toHaveBeenCalledTimes(1);
      // Only the atomic tx call — no second tx for COMPLETED update
      expect(txManager.run).toHaveBeenCalledTimes(1);
    });

    it('4.3b — skips FAILED runs (terminal state guard)', async () => {
      mockManager.findOne.mockResolvedValue(
        makeRun({ status: WorkflowRunStatus.FAILED }),
      );

      await processor.process(makeJob());

      expect(txManager.run).toHaveBeenCalledTimes(1);
    });

    it('4.3c — skips CANCELLED runs (terminal state guard)', async () => {
      mockManager.findOne.mockResolvedValue(
        makeRun({ status: WorkflowRunStatus.CANCELLED }),
      );

      await processor.process(makeJob());

      expect(txManager.run).toHaveBeenCalledTimes(1);
    });

    it('4.4 — recovers stale RUNNING runs (resets startedAt, proceeds)', async () => {
      const staleStartedAt = new Date('2025-01-01T00:00:00Z');
      mockManager.findOne.mockResolvedValue(
        makeRun({ status: WorkflowRunStatus.RUNNING, startedAt: staleStartedAt }),
      );

      await processor.process(makeJob());

      // 2 txManager calls: atomic (findOne + update RUNNING) + update COMPLETED
      expect(txManager.run).toHaveBeenCalledTimes(2);
      // 2 updates: RUNNING (in atomic tx) + COMPLETED
      expect(mockManager.update).toHaveBeenCalledTimes(2);

      const firstUpdate = mockManager.update.mock.calls[0][2] as Partial<WorkflowRunEntity>;
      expect(firstUpdate.startedAt).toBeInstanceOf(Date);
      expect(firstUpdate.startedAt!.getTime()).toBeGreaterThan(staleStartedAt.getTime());
    });

    it('4.5 — throws if WorkflowRunEntity not found', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(processor.process(makeJob())).rejects.toThrow(
        `WorkflowRunEntity not found: ${runId}`,
      );
    });

    it('4.6 — uses TransactionManager.run(tenantId, ...) for all entity operations', async () => {
      mockManager.findOne.mockResolvedValue(makeRun());

      await processor.process(makeJob());

      // 2 calls: atomic (findOne + update RUNNING) + update COMPLETED
      expect(txManager.run).toHaveBeenCalledTimes(2);
      for (const call of txManager.run.mock.calls) {
        expect(call[0]).toBe(tenantId);
        expect(typeof call[1]).toBe('function');
      }
    });
  });

  describe('onFailed() — DLQ handler', () => {
    it('4.7 — moves job to DLQ queue after all retries exhausted', async () => {
      const error = new Error('LLM provider timeout');
      const job = makeJob({ attemptsMade: 3 });

      await processor.onFailed(job, error);

      expect(dlqQueue.add).toHaveBeenCalledTimes(1);
      const [jobName, jobData] = dlqQueue.add.mock.calls[0];
      expect(jobName).toBe('failed-workflow-run');
      expect(jobData).toMatchObject({
        originalJobId: runId,
        runId,
        tenantId,
        attemptsMade: 3,
        errorMessage: 'LLM provider timeout',
      });
      expect(jobData.failedAt).toBeDefined();
    });

    it('4.8 — updates WorkflowRunEntity status to FAILED', async () => {
      const error = new Error('LLM provider timeout');
      const job = makeJob({ attemptsMade: 3 });

      await processor.onFailed(job, error);

      const updateCall = mockManager.update.mock.calls[0];
      expect(updateCall[0]).toBe(WorkflowRunEntity);
      expect(updateCall[1]).toEqual({ id: runId });
      expect(updateCall[2]).toMatchObject({
        status: WorkflowRunStatus.FAILED,
      });
    });

    it('4.9 — sets human-readable errorMessage (not raw stack trace)', async () => {
      const error = new Error('Connection refused to provider endpoint');
      const job = makeJob({ attemptsMade: 3 });

      await processor.onFailed(job, error);

      const updateCall = mockManager.update.mock.calls[0];
      const update = updateCall[2] as Partial<WorkflowRunEntity>;
      expect(update.errorMessage).toBe(
        'Workflow execution failed after 3 attempts: Connection refused to provider endpoint',
      );
      // Should NOT contain stack trace patterns
      expect(update.errorMessage).not.toMatch(/\s+at\s+/);
    });

    it('4.10 — includes metadata in DLQ job (originalJobId, attemptsMade, failedAt)', async () => {
      const error = new Error('fail');
      const job = makeJob({ attemptsMade: 3 });

      await processor.onFailed(job, error);

      const jobData = dlqQueue.add.mock.calls[0][1];
      expect(jobData).toHaveProperty('originalJobId');
      expect(jobData).toHaveProperty('attemptsMade', 3);
      expect(jobData).toHaveProperty('failedAt');
      expect(jobData).toHaveProperty('payload');
    });

    it('4.11 — does NOT trigger DLQ for intermediate failures (attemptsMade < attempts)', async () => {
      const error = new Error('transient error');
      const job = makeJob({ attemptsMade: 1, opts: { attempts: 3 } });

      await processor.onFailed(job, error);

      expect(dlqQueue.add).not.toHaveBeenCalled();
      expect(mockManager.update).not.toHaveBeenCalled();
    });

    it('4.12 — logs error but does NOT throw if entity update fails (resilience)', async () => {
      const error = new Error('LLM timeout');
      const job = makeJob({ attemptsMade: 3 });

      mockManager.update.mockRejectedValue(new Error('DB connection lost'));

      // Should NOT throw even though update failed
      await expect(processor.onFailed(job, error)).resolves.toBeUndefined();

      // DLQ add should still have been attempted
      expect(dlqQueue.add).toHaveBeenCalledTimes(1);
    });

    it('4.13 — gracefully handles entity-not-found scenario (logs error, still adds to DLQ)', async () => {
      const error = new Error('entity gone');
      const job = makeJob({ attemptsMade: 3 });

      // Entity update fails because entity doesn't exist
      mockManager.update.mockRejectedValue(
        new Error('Could not find entity with id'),
      );

      await expect(processor.onFailed(job, error)).resolves.toBeUndefined();

      // DLQ queue should still have the job
      expect(dlqQueue.add).toHaveBeenCalledTimes(1);
      expect(dlqQueue.add.mock.calls[0][1]).toMatchObject({ runId });
    });
  });
});
