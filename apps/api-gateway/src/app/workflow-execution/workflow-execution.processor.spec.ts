import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { WorkflowExecutionProcessor, parseUpdateReturningRow } from './workflow-execution.processor';
import {
  TransactionManager,
  WorkflowRunEntity,
  WorkflowRunStatus,
} from '@project-bubble/db-layer';
import { WorkflowJobPayload, PerFileResult } from '@project-bubble/shared';
import { EntityManager } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PromptAssemblyService } from './prompt-assembly.service';
import { LlmProviderFactory } from './llm/llm-provider.factory';

describe('WorkflowExecutionProcessor', () => {
  let processor: WorkflowExecutionProcessor;
  let txManager: jest.Mocked<TransactionManager>;
  let dlqQueue: jest.Mocked<Queue>;
  let mockManager: jest.Mocked<Pick<EntityManager, 'findOne' | 'update' | 'query'>>;
  let promptAssembly: { assemble: jest.Mock };
  let llmProviderFactory: { getProvider: jest.Mock };
  let mockLlmProvider: { generate: jest.Mock };

  const tenantId = 'aaaaaaaa-0000-0000-0000-000000000001';
  const runId = 'bbbbbbbb-0000-0000-0000-000000000001';
  const modelUuid = 'dddddddd-0000-0000-0000-000000000001';

  const basePayload: WorkflowJobPayload = {
    runId,
    tenantId,
    versionId: 'cccccccc-0000-0000-0000-000000000001',
    definition: {
      metadata: { name: 'Test', description: 'Test', version: 1 },
      inputs: [],
      execution: {
        processing: 'parallel',
        model: modelUuid,
        temperature: 0.7,
        max_output_tokens: 4096,
      },
      knowledge: { enabled: false },
      prompt: 'Test prompt {input}',
      output: { format: 'markdown', filename_template: 'output.md' },
    },
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
      query: jest.fn(),
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

    promptAssembly = {
      assemble: jest.fn().mockResolvedValue({
        prompt: 'Assembled prompt text',
        warnings: [],
        assembledPromptLength: 21,
      }),
    };

    mockLlmProvider = {
      generate: jest.fn().mockResolvedValue({
        text: 'LLM response text',
        tokenUsage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
      }),
    };

    llmProviderFactory = {
      getProvider: jest.fn().mockResolvedValue({
        provider: mockLlmProvider,
        model: {
          id: modelUuid,
          modelId: 'gemini-1.5-pro',
          providerKey: 'mock',
          contextWindow: 1000000,
          maxOutputTokens: 8192,
          isActive: true,
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowExecutionProcessor,
        { provide: TransactionManager, useValue: txManager },
        { provide: getQueueToken('workflow-execution-dlq'), useValue: dlqQueue },
        { provide: PromptAssemblyService, useValue: promptAssembly },
        { provide: LlmProviderFactory, useValue: llmProviderFactory },
      ],
    }).compile();

    processor = module.get(WorkflowExecutionProcessor);
  });

  describe('process()', () => {
    it('[4.3-UNIT-001] updates run status QUEUED -> RUNNING -> COMPLETED', async () => {
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

    it('[4.3-UNIT-002] sets startedAt, completedAt, durationMs', async () => {
      mockManager.findOne.mockResolvedValue(makeRun());

      await processor.process(makeJob());

      const firstUpdate = mockManager.update.mock.calls[0][2] as Partial<WorkflowRunEntity>;
      expect(firstUpdate.startedAt).toBeInstanceOf(Date);

      const secondUpdate = mockManager.update.mock.calls[1][2] as Partial<WorkflowRunEntity>;
      expect(secondUpdate.completedAt).toBeInstanceOf(Date);
      expect(typeof secondUpdate.durationMs).toBe('number');
      expect(secondUpdate.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('[4.3-UNIT-003] skips already-COMPLETED runs (returns early, logs warning)', async () => {
      mockManager.findOne.mockResolvedValue(
        makeRun({ status: WorkflowRunStatus.COMPLETED }),
      );

      await processor.process(makeJob());

      // findOne is called but update to RUNNING is NOT (returned null from atomic tx)
      expect(mockManager.findOne).toHaveBeenCalledTimes(1);
      // Only the atomic tx call — no second tx for COMPLETED update
      expect(txManager.run).toHaveBeenCalledTimes(1);
    });

    it('[4.3-UNIT-004] skips FAILED runs (terminal state guard)', async () => {
      mockManager.findOne.mockResolvedValue(
        makeRun({ status: WorkflowRunStatus.FAILED }),
      );

      await processor.process(makeJob());

      expect(txManager.run).toHaveBeenCalledTimes(1);
    });

    it('[4.3-UNIT-005] skips CANCELLED runs (terminal state guard)', async () => {
      mockManager.findOne.mockResolvedValue(
        makeRun({ status: WorkflowRunStatus.CANCELLED }),
      );

      await processor.process(makeJob());

      expect(txManager.run).toHaveBeenCalledTimes(1);
    });

    it('[4.3-UNIT-006] recovers stale RUNNING runs (does not re-set RUNNING, proceeds to completion)', async () => {
      const staleStartedAt = new Date('2025-01-01T00:00:00Z');
      mockManager.findOne.mockResolvedValue(
        makeRun({ status: WorkflowRunStatus.RUNNING, startedAt: staleStartedAt }),
      );

      await processor.process(makeJob());

      // 2 txManager calls: atomic (findOne, skip update since already RUNNING) + update COMPLETED
      expect(txManager.run).toHaveBeenCalledTimes(2);
      // Only 1 update: COMPLETED (no re-set of RUNNING since status is already RUNNING)
      expect(mockManager.update).toHaveBeenCalledTimes(1);

      const completedUpdate = mockManager.update.mock.calls[0][2] as Partial<WorkflowRunEntity>;
      expect(completedUpdate.status).toBe(WorkflowRunStatus.COMPLETED);
    });

    it('[4.3-UNIT-007] throws if WorkflowRunEntity not found', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(processor.process(makeJob())).rejects.toThrow(
        `WorkflowRunEntity not found: ${runId}`,
      );
    });

    it('[4.3-UNIT-008] uses TransactionManager.run(tenantId, ...) for all entity operations', async () => {
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

  describe('process() — LLM integration', () => {
    // [4.2-UNIT-047] Calls prompt assembly, provider factory, and LLM generate
    it('should call prompt assembly then LLM provider generate', async () => {
      mockManager.findOne.mockResolvedValue(makeRun());

      await processor.process(makeJob());

      expect(promptAssembly.assemble).toHaveBeenCalledWith(basePayload);
      expect(llmProviderFactory.getProvider).toHaveBeenCalledWith(modelUuid);
      expect(mockLlmProvider.generate).toHaveBeenCalledWith(
        'Assembled prompt text',
        { temperature: 0.7, maxOutputTokens: 4096 },
      );
    });

    // [4.2-UNIT-048] Stores LLM results on entity
    it('should store assembledPrompt, rawLlmResponse, tokenUsage, modelId', async () => {
      mockManager.findOne.mockResolvedValue(makeRun());

      await processor.process(makeJob());

      const completedUpdate = mockManager.update.mock.calls[1][2] as Partial<WorkflowRunEntity>;
      expect(completedUpdate.assembledPrompt).toBe('Assembled prompt text');
      expect(completedUpdate.rawLlmResponse).toBe('LLM response text');
      expect(completedUpdate.tokenUsage).toEqual({
        inputTokens: 50,
        outputTokens: 100,
        totalTokens: 150,
      });
      expect(completedUpdate.modelId).toBe(modelUuid);
    });

    // [4.2-UNIT-049] Stores validation warnings when present
    it('should store validation warnings from prompt assembly', async () => {
      promptAssembly.assemble.mockResolvedValue({
        prompt: 'prompt',
        warnings: ['Input "x" was empty'],
        assembledPromptLength: 6,
      });
      mockManager.findOne.mockResolvedValue(makeRun());

      await processor.process(makeJob());

      const completedUpdate = mockManager.update.mock.calls[1][2] as Partial<WorkflowRunEntity>;
      expect(completedUpdate.validationWarnings).toEqual(['Input "x" was empty']);
    });

    // [4.2-UNIT-050] Null validation warnings when no warnings
    it('should set validationWarnings to null when no warnings', async () => {
      mockManager.findOne.mockResolvedValue(makeRun());

      await processor.process(makeJob());

      const completedUpdate = mockManager.update.mock.calls[1][2] as Partial<WorkflowRunEntity>;
      expect(completedUpdate.validationWarnings).toBeNull();
    });

    // [4.2-UNIT-051] Defense-in-depth: throws when prompt exceeds context window
    it('should throw if assembled prompt exceeds model context window', async () => {
      // Return a small context window model
      llmProviderFactory.getProvider.mockResolvedValue({
        provider: mockLlmProvider,
        model: {
          id: modelUuid,
          modelId: 'small-model',
          contextWindow: 10, // very small
          isActive: true,
        },
      });

      // Return a long prompt
      promptAssembly.assemble.mockResolvedValue({
        prompt: 'x'.repeat(100),
        warnings: [],
        assembledPromptLength: 100, // ~25 tokens, exceeds context window of 10
      });

      mockManager.findOne.mockResolvedValue(makeRun());

      await expect(processor.process(makeJob())).rejects.toThrow(
        /exceeds model context window/,
      );
    });

    // [4.2-UNIT-052] LLM error propagates to BullMQ retry
    it('should let LLM errors propagate for BullMQ retry logic', async () => {
      mockManager.findOne.mockResolvedValue(makeRun());
      mockLlmProvider.generate.mockRejectedValue(new Error('LLM API timeout'));

      await expect(processor.process(makeJob())).rejects.toThrow(
        'LLM API timeout',
      );
    });
  });

  describe('process() — H1 runtime guard: inactive model/provider', () => {
    // [4-FIX-B-UNIT-001] Model inactive → factory rejects, processor propagates error (active check lives in LlmProviderFactory — see 4.2-UNIT-024)
    it('should propagate BadRequestException from factory when model is inactive', async () => {
      mockManager.findOne.mockResolvedValue(makeRun());
      llmProviderFactory.getProvider.mockRejectedValue(
        new BadRequestException(
          "The configured model 'Test Model' is currently disabled by your administrator. Please contact your admin to re-enable it or select a different model.",
        ),
      );

      await expect(processor.process(makeJob())).rejects.toThrow(
        /currently disabled by your administrator/,
      );
      // LLM generate should NOT have been called
      expect(mockLlmProvider.generate).not.toHaveBeenCalled();
    });

    // [4-FIX-B-UNIT-002] Provider inactive → factory rejects, processor propagates error (active check lives in LlmProviderFactory — see 4.2-UNIT-026)
    it('should propagate BadRequestException from factory when provider is inactive', async () => {
      mockManager.findOne.mockResolvedValue(makeRun());
      llmProviderFactory.getProvider.mockRejectedValue(
        new BadRequestException(
          "The LLM provider for model 'Test Model' is currently disabled. Please contact your admin to re-enable the provider.",
        ),
      );

      await expect(processor.process(makeJob())).rejects.toThrow(
        /currently disabled/,
      );
      expect(mockLlmProvider.generate).not.toHaveBeenCalled();
    });

    // [4-FIX-B-UNIT-003] Both active → proceeds normally (covered by existing tests, explicit assertion)
    it('should proceed normally when both model and provider are active', async () => {
      mockManager.findOne.mockResolvedValue(makeRun());

      await processor.process(makeJob());

      expect(llmProviderFactory.getProvider).toHaveBeenCalledWith(modelUuid);
      expect(mockLlmProvider.generate).toHaveBeenCalled();
    });

    // [4-FIX-B-UNIT-004] Provider config not found → NotFoundException (distinct from disabled message)
    it('should throw NotFoundException when provider config does not exist', async () => {
      mockManager.findOne.mockResolvedValue(makeRun());
      llmProviderFactory.getProvider.mockRejectedValue(
        new NotFoundException('LLM provider config not found for key: nonexistent'),
      );

      await expect(processor.process(makeJob())).rejects.toThrow(NotFoundException);
      await expect(processor.process(makeJob())).rejects.toThrow(
        /not found/,
      );
      expect(mockLlmProvider.generate).not.toHaveBeenCalled();
    });
  });

  describe('process() — tenantId validation (N4 BullMQ defensive check)', () => {
    it('[4-RLS-B-UNIT-001] throws on null tenantId', async () => {
      const job = makeJob({ data: { ...basePayload, tenantId: null as unknown as string } });

      await expect(processor.process(job)).rejects.toThrow(/invalid tenantId/);
      expect(txManager.run).not.toHaveBeenCalled();
    });

    it('[4-RLS-B-UNIT-002] throws on undefined tenantId', async () => {
      const job = makeJob({ data: { ...basePayload, tenantId: undefined as unknown as string } });

      await expect(processor.process(job)).rejects.toThrow(/invalid tenantId/);
      expect(txManager.run).not.toHaveBeenCalled();
    });

    it('[4-RLS-B-UNIT-003] throws on empty string tenantId', async () => {
      const job = makeJob({ data: { ...basePayload, tenantId: '' } });

      await expect(processor.process(job)).rejects.toThrow(/invalid tenantId/);
      expect(txManager.run).not.toHaveBeenCalled();
    });

    it('[4-RLS-B-UNIT-004] throws on whitespace-only tenantId', async () => {
      const job = makeJob({ data: { ...basePayload, tenantId: '   ' } });

      await expect(processor.process(job)).rejects.toThrow(/invalid tenantId/);
      expect(txManager.run).not.toHaveBeenCalled();
    });

    it('[4-RLS-B-UNIT-005] error message includes jobId and runId for debugging', async () => {
      const job = makeJob({ id: 'test-job-123', data: { ...basePayload, tenantId: '' } });

      await expect(processor.process(job)).rejects.toThrow(/test-job-123/);
      await expect(processor.process(job)).rejects.toThrow(new RegExp(runId));
    });

    it('[4-RLS-B-UNIT-011] rejects numeric tenantId (type coercion through Redis)', async () => {
      const job = makeJob({ data: { ...basePayload, tenantId: 42 as unknown as string } });

      await expect(processor.process(job)).rejects.toThrow(/invalid tenantId/);
      expect(txManager.run).not.toHaveBeenCalled();
    });
  });

  describe('onFailed() — tenantId validation (N4 BullMQ defensive check)', () => {
    let loggerErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      loggerErrorSpy = jest.spyOn(processor['logger'], 'error').mockImplementation();
    });

    afterEach(() => {
      loggerErrorSpy.mockRestore();
    });

    it('[4-RLS-B-UNIT-006] returns early and logs error on null tenantId (no throw, no DB call)', async () => {
      const error = new Error('some failure');
      const job = makeJob({
        data: { ...basePayload, tenantId: null as unknown as string },
        attemptsMade: 3,
      });

      await expect(processor.onFailed(job, error)).resolves.toBeUndefined();
      expect(txManager.run).not.toHaveBeenCalled();
      expect(dlqQueue.add).not.toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('missing tenantId') }),
      );
    });

    it('[4-RLS-B-UNIT-007] returns early and logs error on undefined tenantId', async () => {
      const error = new Error('some failure');
      const job = makeJob({
        data: { ...basePayload, tenantId: undefined as unknown as string },
        attemptsMade: 3,
      });

      await expect(processor.onFailed(job, error)).resolves.toBeUndefined();
      expect(txManager.run).not.toHaveBeenCalled();
      expect(dlqQueue.add).not.toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('missing tenantId') }),
      );
    });

    it('[4-RLS-B-UNIT-008] returns early and logs error on empty string tenantId', async () => {
      const error = new Error('some failure');
      const job = makeJob({
        data: { ...basePayload, tenantId: '' },
        attemptsMade: 3,
      });

      await expect(processor.onFailed(job, error)).resolves.toBeUndefined();
      expect(txManager.run).not.toHaveBeenCalled();
      expect(dlqQueue.add).not.toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('missing tenantId') }),
      );
    });

    it('[4-RLS-B-UNIT-009] returns early and logs error on whitespace-only tenantId', async () => {
      const error = new Error('some failure');
      const job = makeJob({
        data: { ...basePayload, tenantId: '   ' },
        attemptsMade: 3,
      });

      await expect(processor.onFailed(job, error)).resolves.toBeUndefined();
      expect(txManager.run).not.toHaveBeenCalled();
      expect(dlqQueue.add).not.toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('missing tenantId') }),
      );
    });

    it('[4-RLS-B-UNIT-010] rejects numeric tenantId (type coercion through Redis)', async () => {
      const error = new Error('some failure');
      const job = makeJob({
        data: { ...basePayload, tenantId: 42 as unknown as string },
        attemptsMade: 3,
      });

      await expect(processor.onFailed(job, error)).resolves.toBeUndefined();
      expect(txManager.run).not.toHaveBeenCalled();
      expect(dlqQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('onFailed() — DLQ handler', () => {
    it('[4.3-UNIT-009] moves job to DLQ queue after all retries exhausted', async () => {
      const error = new Error('LLM provider timeout');
      const job = makeJob({ attemptsMade: 3 });
      mockManager.findOne.mockResolvedValue(makeRun({ creditsFromPurchased: 0, creditsFromMonthly: 0 }));

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

    it('[4.3-UNIT-010] updates WorkflowRunEntity status to FAILED with zeroed credit fields', async () => {
      const error = new Error('LLM provider timeout');
      const job = makeJob({ attemptsMade: 3 });
      mockManager.findOne.mockResolvedValue(makeRun({ creditsFromPurchased: 0, creditsFromMonthly: 0 }));

      await processor.onFailed(job, error);

      const updateCall = mockManager.update.mock.calls[0];
      expect(updateCall[0]).toBe(WorkflowRunEntity);
      expect(updateCall[1]).toEqual({ id: runId });
      expect(updateCall[2]).toMatchObject({
        status: WorkflowRunStatus.FAILED,
        creditsConsumed: 0,
        creditsFromMonthly: 0,
        creditsFromPurchased: 0,
      });
    });

    it('[4.3-UNIT-011] sets human-readable errorMessage (not raw stack trace)', async () => {
      const error = new Error('Connection refused to provider endpoint');
      const job = makeJob({ attemptsMade: 3 });
      mockManager.findOne.mockResolvedValue(makeRun({ creditsFromPurchased: 0 }));

      await processor.onFailed(job, error);

      const updateCall = mockManager.update.mock.calls[0];
      const update = updateCall[2] as Partial<WorkflowRunEntity>;
      expect(update.errorMessage).toBe(
        'Workflow execution failed after 3 attempts: Connection refused to provider endpoint',
      );
      // Should NOT contain stack trace patterns
      expect(update.errorMessage).not.toMatch(/\s+at\s+/);
    });

    it('[4.3-UNIT-012] includes metadata in DLQ job (originalJobId, attemptsMade, failedAt)', async () => {
      const error = new Error('fail');
      const job = makeJob({ attemptsMade: 3 });
      mockManager.findOne.mockResolvedValue(makeRun({ creditsFromPurchased: 0 }));

      await processor.onFailed(job, error);

      const jobData = dlqQueue.add.mock.calls[0][1];
      expect(jobData).toHaveProperty('originalJobId');
      expect(jobData).toHaveProperty('attemptsMade', 3);
      expect(jobData).toHaveProperty('failedAt');
      expect(jobData).toHaveProperty('payload');
    });

    it('[4.3-UNIT-013] does NOT trigger DLQ for intermediate failures (attemptsMade < attempts)', async () => {
      const error = new Error('transient error');
      const job = makeJob({ attemptsMade: 1, opts: { attempts: 3 } });

      await processor.onFailed(job, error);

      expect(dlqQueue.add).not.toHaveBeenCalled();
      expect(mockManager.update).not.toHaveBeenCalled();
    });

    it('[4.3-UNIT-014] logs error but does NOT throw if entity update fails (resilience)', async () => {
      const error = new Error('LLM timeout');
      const job = makeJob({ attemptsMade: 3 });
      mockManager.findOne.mockResolvedValue(makeRun({ creditsFromPurchased: 0 }));

      mockManager.update.mockRejectedValue(new Error('DB connection lost'));

      // Should NOT throw even though update failed
      await expect(processor.onFailed(job, error)).resolves.toBeUndefined();

      // DLQ add should still have been attempted
      expect(dlqQueue.add).toHaveBeenCalledTimes(1);
    });

    it('[4.3-UNIT-015] gracefully handles entity-not-found scenario (logs error, still adds to DLQ)', async () => {
      const error = new Error('entity gone');
      const job = makeJob({ attemptsMade: 3 });

      // findOne returns null — entity gone
      mockManager.findOne.mockResolvedValue(null);

      await expect(processor.onFailed(job, error)).resolves.toBeUndefined();

      // DLQ queue should still have the job
      expect(dlqQueue.add).toHaveBeenCalledTimes(1);
      expect(dlqQueue.add.mock.calls[0][1]).toMatchObject({ runId });
    });
  });

  describe('process() — fan-out behavioral split', () => {
    const fanOutJobId = `${runId}:file:0`;
    const fanOutPayload: WorkflowJobPayload = {
      ...basePayload,
      subjectFile: { originalName: 'report.pdf', storagePath: '/uploads/report.pdf', assetId: 'asset-1' },
    };

    it('[4.3-UNIT-016] fan-out job writes PerFileResult via JSONB append', async () => {
      mockManager.findOne.mockResolvedValue(makeRun({ status: WorkflowRunStatus.QUEUED }));
      mockManager.query.mockResolvedValue([[{ completed_jobs: 1, failed_jobs: 0, total_jobs: 3 }], 1]);

      await processor.process(makeJob({ id: fanOutJobId, data: fanOutPayload }));

      // First query = JSONB append for per-file result
      const appendCall = mockManager.query.mock.calls[0];
      expect(appendCall[0]).toContain('per_file_results');
      expect(appendCall[0]).toContain('COALESCE');
      const parsedResult: PerFileResult = JSON.parse(appendCall[1][0]);
      expect(parsedResult.index).toBe(0);
      expect(parsedResult.fileName).toBe('report.pdf');
      expect(parsedResult.status).toBe('completed');
      expect(parsedResult.assembledPrompt).toBe('Assembled prompt text');
      expect(parsedResult.rawLlmResponse).toBe('LLM response text');
    });

    it('[4.3-UNIT-017] fan-out job atomically increments completed_jobs with RETURNING', async () => {
      mockManager.findOne.mockResolvedValue(makeRun({ status: WorkflowRunStatus.QUEUED }));
      mockManager.query.mockResolvedValue([[{ completed_jobs: 1, failed_jobs: 0, total_jobs: 3 }], 1]);

      await processor.process(makeJob({ id: fanOutJobId, data: fanOutPayload }));

      // Second query = atomic increment with RETURNING
      const incrementCall = mockManager.query.mock.calls[1];
      expect(incrementCall[0]).toContain('completed_jobs = COALESCE(completed_jobs, 0) + 1');
      expect(incrementCall[0]).toContain('RETURNING');
    });

    it('[4.3-UNIT-018] fan-out job does NOT write to entity columns (assembledPrompt, rawLlmResponse)', async () => {
      mockManager.findOne.mockResolvedValue(makeRun({ status: WorkflowRunStatus.QUEUED }));
      mockManager.query.mockResolvedValue([[{ completed_jobs: 1, failed_jobs: 0, total_jobs: 3 }], 1]);

      await processor.process(makeJob({ id: fanOutJobId, data: fanOutPayload }));

      // Should NOT have called manager.update with COMPLETED status (that's for single-job only)
      const updateCalls = mockManager.update.mock.calls;
      const completedUpdates = updateCalls.filter(
        (c) => (c[2] as Partial<WorkflowRunEntity>).status === WorkflowRunStatus.COMPLETED,
      );
      expect(completedUpdates).toHaveLength(0);
    });

    it('[4.3-UNIT-019] single-job (non-fan-out) writes directly to entity columns', async () => {
      mockManager.findOne.mockResolvedValue(makeRun({ status: WorkflowRunStatus.QUEUED }));

      await processor.process(makeJob()); // default jobId = runId (no :file: segment)

      // Should have called manager.update with COMPLETED + assembledPrompt + rawLlmResponse
      const completedUpdate = mockManager.update.mock.calls[1][2] as Partial<WorkflowRunEntity>;
      expect(completedUpdate.status).toBe(WorkflowRunStatus.COMPLETED);
      expect(completedUpdate.assembledPrompt).toBe('Assembled prompt text');
      expect(completedUpdate.rawLlmResponse).toBe('LLM response text');
      // No raw query calls for single-job mode
      expect(mockManager.query).not.toHaveBeenCalled();
    });

    it('[4.3-UNIT-020] does not re-set RUNNING for fan-out job when run is already RUNNING', async () => {
      mockManager.findOne.mockResolvedValue(makeRun({ status: WorkflowRunStatus.RUNNING, startedAt: new Date() }));
      mockManager.query.mockResolvedValue([[{ completed_jobs: 2, failed_jobs: 0, total_jobs: 3 }], 1]);

      await processor.process(makeJob({ id: `${runId}:file:1`, data: fanOutPayload }));

      // Should NOT have called manager.update to set RUNNING (already in RUNNING state)
      const runningUpdates = mockManager.update.mock.calls.filter(
        (c) => (c[2] as Partial<WorkflowRunEntity>).status === WorkflowRunStatus.RUNNING,
      );
      expect(runningUpdates).toHaveLength(0);
    });

    it('[4.3-UNIT-021] skips COMPLETED_WITH_ERRORS runs (terminal state)', async () => {
      mockManager.findOne.mockResolvedValue(
        makeRun({ status: WorkflowRunStatus.COMPLETED_WITH_ERRORS }),
      );

      await processor.process(makeJob({ id: fanOutJobId, data: fanOutPayload }));

      expect(txManager.run).toHaveBeenCalledTimes(1); // only the status-check tx
    });
  });

  describe('process() — fan-out run finalization', () => {
    const fanOutJobId = `${runId}:file:2`;
    const fanOutPayload: WorkflowJobPayload = {
      ...basePayload,
      subjectFile: { originalName: 'file-c.pdf', storagePath: '/uploads/c.pdf', assetId: 'asset-c' },
    };

    it('[4.3-UNIT-022] triggers finalization when completed_jobs + failed_jobs >= total_jobs', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(makeRun({ status: WorkflowRunStatus.QUEUED }))
        .mockResolvedValueOnce(makeRun({
          status: WorkflowRunStatus.RUNNING,
          startedAt: new Date('2025-01-01'),
          perFileResults: [
            { index: 0, fileName: 'a.pdf', status: 'completed', tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
            { index: 1, fileName: 'b.pdf', status: 'completed', tokenUsage: { inputTokens: 15, outputTokens: 25, totalTokens: 40 } },
          ] as PerFileResult[],
        }));
      // Counter returns: this is the 3rd completed out of 3 total
      mockManager.query.mockResolvedValue([[{ completed_jobs: 3, failed_jobs: 0, total_jobs: 3 }], 1]);

      await processor.process(makeJob({ id: fanOutJobId, data: fanOutPayload }));

      // Finalization: update with final status + aggregated token usage
      const finalUpdate = mockManager.update.mock.calls.find(
        (c) => c[2] && (c[2] as Partial<WorkflowRunEntity>).status === WorkflowRunStatus.COMPLETED,
      );
      expect(finalUpdate).toBeDefined();
      expect((finalUpdate![2] as Partial<WorkflowRunEntity>).completedAt).toBeInstanceOf(Date);
    });

    it('[4.3-UNIT-023] does NOT finalize when completed + failed < total', async () => {
      mockManager.findOne.mockResolvedValue(makeRun({ status: WorkflowRunStatus.QUEUED }));
      // Only 1 of 3 done
      mockManager.query.mockResolvedValue([[{ completed_jobs: 1, failed_jobs: 0, total_jobs: 3 }], 1]);

      await processor.process(makeJob({ id: fanOutJobId, data: fanOutPayload }));

      // No finalization update (no COMPLETED/FAILED status set via manager.update)
      const statusUpdates = mockManager.update.mock.calls.filter(
        (c) =>
          c[2] &&
          [WorkflowRunStatus.COMPLETED, WorkflowRunStatus.FAILED, WorkflowRunStatus.COMPLETED_WITH_ERRORS].includes(
            (c[2] as Partial<WorkflowRunEntity>).status as WorkflowRunStatus,
          ),
      );
      expect(statusUpdates).toHaveLength(0);
    });

    it('[4.3-UNIT-024] sets COMPLETED_WITH_ERRORS when some jobs succeed and some fail', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(makeRun({ status: WorkflowRunStatus.QUEUED }))
        .mockResolvedValueOnce(makeRun({
          status: WorkflowRunStatus.RUNNING,
          startedAt: new Date('2025-01-01'),
          perFileResults: [
            { index: 0, fileName: 'a.pdf', status: 'completed', tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
            { index: 1, fileName: 'b.pdf', status: 'failed', errorMessage: 'LLM timeout' },
          ] as PerFileResult[],
        }));
      // 2 completed + 1 failed = 3 total
      mockManager.query.mockResolvedValue([[{ completed_jobs: 2, failed_jobs: 1, total_jobs: 3 }], 1]);

      await processor.process(makeJob({ id: fanOutJobId, data: fanOutPayload }));

      const finalUpdate = mockManager.update.mock.calls.find(
        (c) => c[2] && (c[2] as Partial<WorkflowRunEntity>).status === WorkflowRunStatus.COMPLETED_WITH_ERRORS,
      );
      expect(finalUpdate).toBeDefined();
    });

    it('[4.3-UNIT-025] sets FAILED when all jobs fail (completed_jobs === 0)', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(makeRun({ status: WorkflowRunStatus.QUEUED }))
        .mockResolvedValueOnce(makeRun({
          status: WorkflowRunStatus.RUNNING,
          startedAt: new Date('2025-01-01'),
          perFileResults: [
            { index: 0, fileName: 'a.pdf', status: 'failed', errorMessage: 'err' },
            { index: 1, fileName: 'b.pdf', status: 'failed', errorMessage: 'err' },
          ] as PerFileResult[],
        }));
      mockManager.query.mockResolvedValue([[{ completed_jobs: 0, failed_jobs: 3, total_jobs: 3 }], 1]);

      await processor.process(makeJob({ id: fanOutJobId, data: fanOutPayload }));

      const finalUpdate = mockManager.update.mock.calls.find(
        (c) => c[2] && (c[2] as Partial<WorkflowRunEntity>).status === WorkflowRunStatus.FAILED,
      );
      expect(finalUpdate).toBeDefined();
    });

    it('[4.3-UNIT-026] aggregates token usage from all perFileResults', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(makeRun({ status: WorkflowRunStatus.QUEUED }))
        .mockResolvedValueOnce(makeRun({
          status: WorkflowRunStatus.RUNNING,
          startedAt: new Date('2025-01-01'),
          perFileResults: [
            { index: 0, fileName: 'a.pdf', status: 'completed', tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 } },
            { index: 1, fileName: 'b.pdf', status: 'completed', tokenUsage: { inputTokens: 150, outputTokens: 250, totalTokens: 400 } },
          ] as PerFileResult[],
        }));
      mockManager.query.mockResolvedValue([[{ completed_jobs: 3, failed_jobs: 0, total_jobs: 3 }], 1]);

      await processor.process(makeJob({ id: fanOutJobId, data: fanOutPayload }));

      const finalUpdate = mockManager.update.mock.calls.find(
        (c) => c[2] && (c[2] as Partial<WorkflowRunEntity>).tokenUsage,
      );
      expect(finalUpdate).toBeDefined();
      expect((finalUpdate![2] as Partial<WorkflowRunEntity>).tokenUsage).toEqual({
        inputTokens: 250,
        outputTokens: 450,
        totalTokens: 700,
      });
    });
  });

  describe('onFailed() — fan-out behavioral split', () => {
    it('[4.3-UNIT-027] fan-out failure increments failed_jobs and writes error PerFileResult', async () => {
      const error = new Error('LLM API timeout');
      const fanOutJob = makeJob({
        id: `${runId}:file:1`,
        data: { ...basePayload, subjectFile: { originalName: 'doc.pdf', storagePath: '/uploads/doc.pdf' } },
        attemptsMade: 3,
      });

      // Counter: not last job
      mockManager.query.mockResolvedValue([{ completed_jobs: 1, failed_jobs: 1, total_jobs: 3 }]);

      await processor.onFailed(fanOutJob, error);

      // DLQ should still be called
      expect(dlqQueue.add).toHaveBeenCalledTimes(1);

      // JSONB append for error PerFileResult
      const appendCall = mockManager.query.mock.calls[0];
      expect(appendCall[0]).toContain('per_file_results');
      const parsedResult: PerFileResult = JSON.parse(appendCall[1][0]);
      expect(parsedResult.index).toBe(1);
      expect(parsedResult.status).toBe('failed');
      expect(parsedResult.errorMessage).toContain('LLM API timeout');

      // Atomic increment of failed_jobs
      const incrementCall = mockManager.query.mock.calls[1];
      expect(incrementCall[0]).toContain('failed_jobs = COALESCE(failed_jobs, 0) + 1');
    });

    it('[4.3-UNIT-028] fan-out failure triggers finalization when last job', async () => {
      const error = new Error('fail');
      const fanOutJob = makeJob({
        id: `${runId}:file:2`,
        data: { ...basePayload, subjectFile: { originalName: 'c.pdf', storagePath: '/uploads/c.pdf' } },
        attemptsMade: 3,
      });

      // Counter: this is the last job
      mockManager.query.mockResolvedValue([[{ completed_jobs: 2, failed_jobs: 1, total_jobs: 3 }], 1]);
      // Finalization findOne
      mockManager.findOne.mockResolvedValue(makeRun({
        status: WorkflowRunStatus.RUNNING,
        startedAt: new Date('2025-01-01'),
        perFileResults: [
          { index: 0, fileName: 'a.pdf', status: 'completed', tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ] as PerFileResult[],
      }));

      await processor.onFailed(fanOutJob, error);

      // Should have triggered finalization — update with COMPLETED_WITH_ERRORS
      const finalUpdate = mockManager.update.mock.calls.find(
        (c) => c[2] && (c[2] as Partial<WorkflowRunEntity>).status === WorkflowRunStatus.COMPLETED_WITH_ERRORS,
      );
      expect(finalUpdate).toBeDefined();
    });

    it('[4.3-UNIT-029] single-job failure marks run FAILED (not fan-out path)', async () => {
      const error = new Error('LLM provider timeout');
      const singleJob = makeJob({ attemptsMade: 3 }); // no :file: in jobId
      mockManager.findOne.mockResolvedValue(makeRun({ creditsFromPurchased: 0, creditsFromMonthly: 0 }));

      await processor.onFailed(singleJob, error);

      // DLQ + entity update to FAILED
      expect(dlqQueue.add).toHaveBeenCalledTimes(1);
      const updateCall = mockManager.update.mock.calls[0];
      expect(updateCall[2]).toMatchObject({ status: WorkflowRunStatus.FAILED });
    });

    it('[4.3-UNIT-030] fan-out failure does NOT call markRunFailed (no entity-level FAILED update)', async () => {
      const error = new Error('fail');
      const fanOutJob = makeJob({
        id: `${runId}:file:0`,
        data: { ...basePayload, subjectFile: { originalName: 'a.pdf', storagePath: '/uploads/a.pdf' } },
        attemptsMade: 3,
      });

      // Not last job
      mockManager.query.mockResolvedValue([[{ completed_jobs: 0, failed_jobs: 1, total_jobs: 3 }], 1]);

      await processor.onFailed(fanOutJob, error);

      // manager.update should NOT have been called with FAILED status
      const failedUpdates = mockManager.update.mock.calls.filter(
        (c) => c[2] && (c[2] as Partial<WorkflowRunEntity>).status === WorkflowRunStatus.FAILED,
      );
      expect(failedUpdates).toHaveLength(0);
    });

    it('[4.3-UNIT-031] fan-out failure truncates long error messages to 200 chars', async () => {
      const longError = new Error('x'.repeat(300));
      const fanOutJob = makeJob({
        id: `${runId}:file:0`,
        data: { ...basePayload, subjectFile: { originalName: 'a.pdf', storagePath: '/uploads/a.pdf' } },
        attemptsMade: 3,
      });

      mockManager.query.mockResolvedValue([[{ completed_jobs: 0, failed_jobs: 1, total_jobs: 3 }], 1]);

      await processor.onFailed(fanOutJob, longError);

      const appendCall = mockManager.query.mock.calls[0];
      const parsedResult: PerFileResult = JSON.parse(appendCall[1][0]);
      expect(parsedResult.errorMessage!.length).toBeLessThanOrEqual(203); // 200 + '...'
    });

    it('[4.3-UNIT-032] intermediate fan-out failure (attemptsMade < attempts) does NOT route to DLQ', async () => {
      const error = new Error('transient');
      const fanOutJob = makeJob({
        id: `${runId}:file:0`,
        data: { ...basePayload, subjectFile: { originalName: 'a.pdf', storagePath: '/uploads/a.pdf' } },
        attemptsMade: 1,
        opts: { attempts: 3 },
      });

      await processor.onFailed(fanOutJob, error);

      expect(dlqQueue.add).not.toHaveBeenCalled();
      expect(mockManager.query).not.toHaveBeenCalled();
    });
  });

  // ── Credit refund on failure (AC6, AC7) ────────────────────────
  describe('markRunFailed — credit refund (AC6)', () => {
    it('[4.4-UNIT-027] [AC6] should refund purchased credits and zero run credit fields on single-job failure', async () => {
      const error = new Error('LLM timeout');
      const job = makeJob({ attemptsMade: 3 });
      mockManager.findOne.mockResolvedValue(
        makeRun({ creditsFromPurchased: 3, creditsFromMonthly: 2, creditsConsumed: 5 }),
      );

      await processor.onFailed(job, error);

      // Run entity should have zeroed credit fields
      const updateCall = mockManager.update.mock.calls[0];
      expect(updateCall[2]).toMatchObject({
        creditsConsumed: 0,
        creditsFromMonthly: 0,
        creditsFromPurchased: 0,
      });

      // Should have FOR UPDATE lock on tenant and refund
      expect(mockManager.query).toHaveBeenCalledWith(
        'SELECT id FROM tenants WHERE id = $1 FOR UPDATE',
        [tenantId],
      );
      expect(mockManager.query).toHaveBeenCalledWith(
        'UPDATE tenants SET purchased_credits = purchased_credits + $1 WHERE id = $2',
        [3, tenantId],
      );
    });

    it('[4.4-UNIT-028] should NOT refund when creditsFromPurchased is 0 (monthly-only run)', async () => {
      const error = new Error('fail');
      const job = makeJob({ attemptsMade: 3 });
      mockManager.findOne.mockResolvedValue(
        makeRun({ creditsFromPurchased: 0, creditsFromMonthly: 5, creditsConsumed: 5 }),
      );

      await processor.onFailed(job, error);

      // Credit fields zeroed
      const updateCall = mockManager.update.mock.calls[0];
      expect(updateCall[2]).toMatchObject({
        creditsConsumed: 0,
        creditsFromMonthly: 0,
        creditsFromPurchased: 0,
      });

      // No FOR UPDATE / refund query (only debit fields zeroed, monthly auto-corrects via SUM)
      expect(mockManager.query).not.toHaveBeenCalled();
    });

    it('[4.4-UNIT-029] should skip refund when run entity not found (entity already deleted)', async () => {
      const error = new Error('fail');
      const job = makeJob({ attemptsMade: 3 });
      mockManager.findOne.mockResolvedValue(null);

      await processor.onFailed(job, error);

      // No update or query calls since entity wasn't found
      expect(mockManager.update).not.toHaveBeenCalled();
      expect(mockManager.query).not.toHaveBeenCalled();
    });

    it('[4.4-UNIT-039] should skip refund when run is already in FAILED state (idempotency guard)', async () => {
      const error = new Error('LLM timeout');
      const job = makeJob({ attemptsMade: 3 });
      mockManager.findOne.mockResolvedValue(
        makeRun({ status: WorkflowRunStatus.FAILED, creditsFromPurchased: 0, creditsFromMonthly: 0, creditsConsumed: 0 }),
      );

      await processor.onFailed(job, error);

      // Should NOT update entity or refund — already FAILED
      expect(mockManager.update).not.toHaveBeenCalled();
      expect(mockManager.query).not.toHaveBeenCalled();
    });
  });

  describe('finalizeRun — credit refund on FAILED (AC6, AC7)', () => {
    const fanOutJobId = `${runId}:file:2`;
    const fanOutPayload = {
      ...basePayload,
      subjectFile: { originalName: 'c.pdf', storagePath: '/uploads/c.pdf', assetId: 'asset-c' },
    };

    it('[4.4-UNIT-030] [AC6] should refund purchased credits when all fan-out jobs fail (FAILED)', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(makeRun({ status: WorkflowRunStatus.QUEUED })) // process() status check
        .mockResolvedValueOnce(makeRun({ // finalizeRun entity load
          status: WorkflowRunStatus.RUNNING,
          startedAt: new Date('2025-01-01'),
          creditsFromPurchased: 4,
          creditsFromMonthly: 1,
          creditsConsumed: 5,
          perFileResults: [] as PerFileResult[],
        }));
      // All failed, none completed
      mockManager.query.mockResolvedValue([[{ completed_jobs: 0, failed_jobs: 3, total_jobs: 3 }], 1]);

      await processor.process(makeJob({ id: fanOutJobId, data: fanOutPayload }));

      // Should have refunded: FOR UPDATE + purchased_credits increment
      const queryArgs = mockManager.query.mock.calls.map((c: unknown[]) => c[0]);
      expect(queryArgs).toContain('SELECT id FROM tenants WHERE id = $1 FOR UPDATE');
      expect(queryArgs).toContain(
        'UPDATE tenants SET purchased_credits = purchased_credits + $1 WHERE id = $2',
      );

      // Final update should zero credit fields
      const finalUpdate = mockManager.update.mock.calls.find(
        (c: unknown[]) => c[2] && (c[2] as Partial<WorkflowRunEntity>).status === WorkflowRunStatus.FAILED,
      );
      expect(finalUpdate).toBeDefined();
      expect((finalUpdate![2] as Record<string, unknown>).creditsConsumed).toBe(0);
      expect((finalUpdate![2] as Record<string, unknown>).creditsFromMonthly).toBe(0);
      expect((finalUpdate![2] as Record<string, unknown>).creditsFromPurchased).toBe(0);
    });

    it('[4.4-UNIT-031] [AC7] should NOT refund credits on COMPLETED_WITH_ERRORS', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(makeRun({ status: WorkflowRunStatus.QUEUED }))
        .mockResolvedValueOnce(makeRun({
          status: WorkflowRunStatus.RUNNING,
          startedAt: new Date('2025-01-01'),
          creditsFromPurchased: 4,
          creditsFromMonthly: 1,
          creditsConsumed: 5,
          perFileResults: [
            { index: 0, fileName: 'a.pdf', status: 'completed', tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ] as PerFileResult[],
        }));
      // 2 completed + 1 failed = COMPLETED_WITH_ERRORS
      mockManager.query.mockResolvedValue([[{ completed_jobs: 2, failed_jobs: 1, total_jobs: 3 }], 1]);

      await processor.process(makeJob({ id: fanOutJobId, data: fanOutPayload }));

      // Should NOT have FOR UPDATE or refund queries
      const queryTexts = mockManager.query.mock.calls.map((c: unknown[]) => (c[0] as string));
      const forUpdateCalls = queryTexts.filter((q: string) => q.includes('FOR UPDATE'));
      expect(forUpdateCalls).toHaveLength(0);

      // Final update should NOT zero credit fields
      const finalUpdate = mockManager.update.mock.calls.find(
        (c: unknown[]) => c[2] && (c[2] as Partial<WorkflowRunEntity>).status === WorkflowRunStatus.COMPLETED_WITH_ERRORS,
      );
      expect(finalUpdate).toBeDefined();
      expect((finalUpdate![2] as Record<string, unknown>)).not.toHaveProperty('creditsConsumed');
    });

    it('[4.4-UNIT-032] should NOT refund credits on COMPLETED', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(makeRun({ status: WorkflowRunStatus.QUEUED }))
        .mockResolvedValueOnce(makeRun({
          status: WorkflowRunStatus.RUNNING,
          startedAt: new Date('2025-01-01'),
          creditsFromPurchased: 2,
          perFileResults: [
            { index: 0, fileName: 'a.pdf', status: 'completed', tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ] as PerFileResult[],
        }));
      // All completed
      mockManager.query.mockResolvedValue([[{ completed_jobs: 3, failed_jobs: 0, total_jobs: 3 }], 1]);

      await processor.process(makeJob({ id: fanOutJobId, data: fanOutPayload }));

      // No refund queries
      const queryTexts = mockManager.query.mock.calls.map((c: unknown[]) => (c[0] as string));
      const refundCalls = queryTexts.filter((q: string) => q.includes('purchased_credits + $1'));
      expect(refundCalls).toHaveLength(0);
    });
  });

  // ── parseUpdateReturningRow direct unit tests ───────────────────
  describe('parseUpdateReturningRow', () => {
    it('[4-FIX-A1-UNIT-032] returns row from valid [[row], affectedCount] shape', () => {
      const result = [[{ completed_jobs: 1, failed_jobs: 0, total_jobs: 3 }], 1];
      const row = parseUpdateReturningRow<{ completed_jobs: number; failed_jobs: number; total_jobs: number }>(
        result,
        ['completed_jobs', 'failed_jobs', 'total_jobs'],
      );
      expect(row.completed_jobs).toBe(1);
      expect(row.failed_jobs).toBe(0);
      expect(row.total_jobs).toBe(3);
    });

    it('[4-FIX-A1-UNIT-033] throws with field name when expected field is undefined', () => {
      const result = [[{ completed_jobs: 1 }], 1];
      expect(() =>
        parseUpdateReturningRow(result, ['completed_jobs', 'missing_field']),
      ).toThrow(/missing_field/);
    });

    it('[4-FIX-A1-UNIT-034] throws with clear message when zero rows match', () => {
      const result = [[], 0];
      expect(() =>
        parseUpdateReturningRow(result, ['completed_jobs']),
      ).toThrow(/zero rows/i);
    });
  });
});
