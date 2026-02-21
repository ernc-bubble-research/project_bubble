import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import {
  TransactionManager,
  WorkflowRunEntity,
  WorkflowRunStatus,
} from '@project-bubble/db-layer';
import { WorkflowJobPayload, PerFileResult, WorkflowOutputFormat } from '@project-bubble/shared';
import { PromptAssemblyService } from './prompt-assembly.service';
import { LlmProviderFactory } from './llm/llm-provider.factory';
import { mergeGenerationParams } from './llm/generation-params.util';
import { validateLlmOutput } from './output-sanity-check.util';
import { generateOutputFilename } from './output-filename.util';
import { AssetsService } from '../assets/assets.service';
import { TestRunCacheService } from '../services/test-run-cache.service';
import { TestRunGateway } from '../gateways/test-run.gateway';
import { TestRunFileResultDto } from '@project-bubble/shared';

/** Detect fan-out job by `:file:` segment in jobId */
function isFanOutJob(jobId: string | undefined): boolean {
  return !!jobId && jobId.includes(':file:');
}

/** Extract file index from fan-out jobId format `{runId}:file:{index}` */
function extractFileIndex(jobId: string): number {
  const parts = jobId.split(':file:');
  return parseInt(parts[1], 10);
}

interface CompletionCounters {
  completed_jobs: number;
  failed_jobs: number;
  total_jobs: number;
}

const FORMAT_MIME_MAP: Record<WorkflowOutputFormat, string> = {
  markdown: 'text/markdown',
  json: 'application/json',
};

/**
 * Parse the result of an UPDATE ... RETURNING query executed via EntityManager.query().
 *
 * TypeORM/pg driver returns `[[rows], affectedCount]` for UPDATE RETURNING queries,
 * NOT `[row]`. This helper destructures the nested result and validates the row shape
 * at runtime. If the pg driver changes behavior in a future version, the assertion
 * produces a clear error instead of silent `undefined` propagation.
 *
 * Note: INSERT RETURNING returns flat `[row]` — this helper is ONLY for UPDATE RETURNING.
 *
 * **Throws** if zero rows match (i.e., the WHERE clause matched nothing). Callers must
 * ensure the target row exists, or catch the error to handle the no-match case.
 *
 * @see returning-wiring.spec.ts for empirical verification of these shapes
 */
export function parseUpdateReturningRow<T>(
  result: unknown,
  expectedFields: (keyof T)[],
): T {
  if (!Array.isArray(result) || result.length < 2) {
    throw new Error(
      `parseUpdateReturningRow: expected [[rows], affectedCount], got ${JSON.stringify(result)}`,
    );
  }

  const [rows] = result;
  if (!Array.isArray(rows)) {
    throw new Error(
      `parseUpdateReturningRow: expected rows to be an array, got ${JSON.stringify(rows)}`,
    );
  }
  if (rows.length === 0) {
    throw new Error(
      `parseUpdateReturningRow: UPDATE matched zero rows — the WHERE clause found no matching record. ` +
      `This typically means the row was deleted or does not exist.`,
    );
  }

  const row = rows[0] as T;

  // Runtime assertion: verify expected fields exist and are not undefined
  for (const field of expectedFields) {
    if ((row as Record<string, unknown>)[field as string] === undefined) {
      throw new Error(
        `parseUpdateReturningRow: expected field '${String(field)}' to be defined, got undefined. ` +
        `Full row: ${JSON.stringify(row)}`,
      );
    }
  }

  return row;
}

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
    private readonly promptAssembly: PromptAssemblyService,
    private readonly llmProviderFactory: LlmProviderFactory,
    private readonly assetsService: AssetsService,
    private readonly testRunCache: TestRunCacheService,
    private readonly testRunGateway: TestRunGateway,
  ) {
    super();
  }

  async process(job: Job<WorkflowJobPayload>): Promise<void> {
    const { runId, sessionId, isTestRun, tenantId } = job.data;

    // Defensive: fail fast on missing tenantId (N4 from party mode review)
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error(
        `Job ${job.id} has invalid tenantId (${JSON.stringify(tenantId)}) — ` +
        `cannot process workflow run ${runId || sessionId} without tenant context`,
      );
    }

    // Payload validation for test runs (AC2 - Defense-in-Depth)
    if (sessionId && !isTestRun) {
      throw new Error(
        `Corrupted test run payload: job ${job.id} has sessionId but isTestRun is false/missing`,
      );
    }

    if (sessionId && runId) {
      throw new Error(
        `Invalid job payload: job ${job.id} has both sessionId and runId — expected exactly one`,
      );
    }

    if (!sessionId && !runId) {
      throw new Error(
        `Invalid job payload: job ${job.id} has neither sessionId nor runId — expected exactly one`,
      );
    }

    // Fork execution path: test runs vs production runs (AC3, AC4)
    if (isTestRun && sessionId) {
      return this.processTestRun(job, sessionId, tenantId);
    }

    const fanOut = isFanOutJob(job.id);

    this.logger.log({
      message: 'Processing workflow job',
      jobId: job.id,
      runId,
      tenantId,
      fanOut,
    });

    const startedAt = new Date();

    // Atomic: load entity, check status guards, update to RUNNING — single transaction
    const run = await this.txManager.run(tenantId, async (manager) => {
      const entity = await manager.findOne(WorkflowRunEntity, { where: { id: runId, tenantId } });

      if (!entity) {
        throw new Error(`WorkflowRunEntity not found: ${runId}`);
      }

      // Idempotency: skip runs in terminal states
      if (
        entity.status === WorkflowRunStatus.COMPLETED ||
        entity.status === WorkflowRunStatus.COMPLETED_WITH_ERRORS ||
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

      // Only transition to RUNNING if currently QUEUED (not already RUNNING from another fan-out job)
      if (entity.status === WorkflowRunStatus.QUEUED) {
        await manager.update(WorkflowRunEntity, { id: runId, tenantId }, {
          status: WorkflowRunStatus.RUNNING,
          startedAt,
        });
      }

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

    // Write intermediate 'processing' status for fan-out jobs (granular per-file tracking)
    if (fanOut) {
      const fileIndex = extractFileIndex(job.id!);
      const fileName = job.data.subjectFile?.originalName ?? `file-${fileIndex}`;
      const maxRetries = job.opts?.attempts ?? 3;
      const attemptNumber = job.attemptsMade;

      await this.writePerFileStatus(tenantId, runId, fileIndex, fileName,
        attemptNumber > 0 ? 'retrying' : 'processing',
        { retryAttempt: attemptNumber, maxRetries },
      );
    }

    // Step 1: Assemble the prompt from template + inputs
    const assemblyResult = await this.promptAssembly.assemble(job.data);

    // Step 2: Resolve the LLM provider from model UUID
    const modelUuid = job.data.definition.execution.model;
    const { provider, model, supportedGenerationParams } = await this.llmProviderFactory.getProvider(modelUuid);

    // Defense-in-depth: check assembled prompt length vs model context window
    const estimatedTokens = Math.ceil(assemblyResult.assembledPromptLength / 4);
    if (estimatedTokens > model.contextWindow) {
      throw new Error(
        `Assembled prompt (~${estimatedTokens} tokens) exceeds model context window (${model.contextWindow} tokens). ` +
        `Reduce input size or select a model with a larger context window.`,
      );
    }

    // Step 3: Merge generation params (provider defaults < model defaults < workflow overrides)
    const generationOptions = mergeGenerationParams(
      supportedGenerationParams,
      model.generationDefaults,
      job.data.definition.execution,
    );

    // Step 4: Call the LLM provider
    const llmResult = await provider.generate(assemblyResult.prompt, generationOptions);

    this.logger.log({
      message: 'LLM generation completed',
      jobId: job.id,
      runId,
      modelId: model.modelId,
      inputTokens: llmResult.tokenUsage.inputTokens,
      outputTokens: llmResult.tokenUsage.outputTokens,
    });

    // Step 5: Store results — behavioral split based on fan-out vs single-job
    // Each path runs sanity check → persists output as AssetEntity → records result.
    if (fanOut) {
      await this.recordFanOutSuccess(job, assemblyResult, llmResult, model, run.startedBy);
    } else {
      // Sanity check for single-job
      const sanityResult = validateLlmOutput(
        llmResult.text,
        job.data.definition.execution.max_output_tokens,
      );
      if (!sanityResult.valid) {
        throw new Error(`Output sanity check failed: ${sanityResult.reason}`);
      }
      // Single-job run (batch or context-only): persist output + update entity
      const { definition } = job.data;
      const outputFormat = definition.output.format;
      const mimeType = FORMAT_MIME_MAP[outputFormat] ?? 'text/markdown';
      const outputFilename = generateOutputFilename(
        definition.output.filename_template,
        undefined, // no subject file in single-job
        0,
      );

      const asset = await this.assetsService.createFromBuffer(
        Buffer.from(llmResult.text, 'utf-8'),
        {
          tenantId,
          filename: outputFilename,
          mimeType,
          sourceType: 'workflow_output',
          workflowRunId: runId,
          uploadedBy: run.startedBy,
        },
      );

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      await this.txManager.run(tenantId, async (manager) => {
        await manager.update(WorkflowRunEntity, { id: runId, tenantId }, {
          status: WorkflowRunStatus.COMPLETED,
          assembledPrompt: assemblyResult.prompt,
          tokenUsage: llmResult.tokenUsage,
          modelId: model.id,
          validationWarnings: assemblyResult.warnings.length > 0 ? assemblyResult.warnings : null,
          outputAssetIds: [asset.id],
          completedAt,
          durationMs,
        });
      });

      this.logger.log({
        message: 'Workflow run completed (single-job)',
        jobId: job.id,
        runId,
        tenantId,
        durationMs,
        outputAssetId: asset.id,
      });
    }
  }

  /**
   * Record a successful fan-out job result and check run completion.
   * Runs sanity check → persists output as AssetEntity → records result.
   * Uses atomic RETURNING clause to prevent race conditions.
   */
  private async recordFanOutSuccess(
    job: Job<WorkflowJobPayload>,
    assemblyResult: { prompt: string; warnings: string[] },
    llmResult: { text: string; tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number } },
    model: { id: string; modelId: string },
    startedBy: string,
  ): Promise<void> {
    const { runId, tenantId, definition } = job.data;
    const fileIndex = extractFileIndex(job.id!);
    const fileName = job.data.subjectFile?.originalName ?? `file-${fileIndex}`;
    const maxRetries = job.opts?.attempts ?? 3;

    // Sanity check: did we get usable output?
    const sanityResult = validateLlmOutput(
      llmResult.text,
      definition.execution.max_output_tokens,
    );

    if (!sanityResult.valid) {
      // Sanity check failed — throw to trigger BullMQ retry
      throw new Error(`Output sanity check failed: ${sanityResult.reason}`);
    }

    // Persist output as AssetEntity
    const outputFormat = definition.output.format;
    const mimeType = FORMAT_MIME_MAP[outputFormat] ?? 'text/markdown';
    const outputFilename = generateOutputFilename(
      definition.output.filename_template,
      job.data.subjectFile?.originalName,
      fileIndex,
    );

    const asset = await this.assetsService.createFromBuffer(
      Buffer.from(llmResult.text, 'utf-8'),
      {
        tenantId,
        filename: outputFilename,
        mimeType,
        sourceType: 'workflow_output',
        workflowRunId: runId,
        uploadedBy: startedBy,
      },
    );

    const perFileResult: PerFileResult = {
      index: fileIndex,
      fileName,
      status: 'completed',
      assembledPrompt: assemblyResult.prompt,
      rawLlmResponse: llmResult.text,
      tokenUsage: llmResult.tokenUsage,
      outputAssetId: asset.id,
      retryAttempt: job.attemptsMade,
      maxRetries,
    };

    // Atomic: upsert per-file result (replace by index) + increment completed_jobs + append outputAssetId + RETURNING
    const counters = await this.txManager.run(tenantId, async (manager) => {
      // Remove existing entry for this index (from intermediate status writes) and append final result
      await manager.query(
        `UPDATE workflow_runs
         SET per_file_results = (
           SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
           FROM jsonb_array_elements(COALESCE(per_file_results, '[]'::jsonb)) AS elem
           WHERE (elem->>'index')::int != $1
         ) || $2::jsonb
         WHERE id = $3 AND tenant_id = $4`,
        [fileIndex, JSON.stringify(perFileResult), runId, tenantId],
      );

      // Append output asset ID to outputAssetIds array
      await manager.query(
        `UPDATE workflow_runs
         SET output_asset_ids = array_append(COALESCE(output_asset_ids, ARRAY[]::uuid[]), $1::uuid)
         WHERE id = $2 AND tenant_id = $3`,
        [asset.id, runId, tenantId],
      );

      // Atomic increment + read with RETURNING
      // UPDATE RETURNING via EntityManager.query() returns [[rows], affectedCount]
      const result = await manager.query(
        `UPDATE workflow_runs
         SET completed_jobs = COALESCE(completed_jobs, 0) + 1,
             model_id = $2
         WHERE id = $1 AND tenant_id = $3
         RETURNING completed_jobs, failed_jobs, total_jobs`,
        [runId, model.id, tenantId],
      );

      return parseUpdateReturningRow<CompletionCounters>(result, [
        'completed_jobs',
        'failed_jobs',
        'total_jobs',
      ]);
    });

    this.logger.log({
      message: 'Fan-out job completed',
      jobId: job.id,
      runId,
      fileIndex,
      fileName,
      completedJobs: counters.completed_jobs,
      failedJobs: counters.failed_jobs,
      totalJobs: counters.total_jobs,
    });

    // Check if this is the last job → trigger finalization
    // >= (not ==) handles edge case where duplicate BullMQ delivery increments beyond total
    if (counters.completed_jobs + counters.failed_jobs >= counters.total_jobs) {
      await this.finalizeRun(runId, tenantId, counters);
    }
  }

  /**
   * Finalize a fan-out run: compute final status, aggregate token usage, set duration.
   * Only the worker whose RETURNING values satisfy completion triggers this.
   */
  private async finalizeRun(
    runId: string,
    tenantId: string,
    counters: CompletionCounters,
  ): Promise<void> {
    await this.txManager.run(tenantId, async (manager) => {
      const entity = await manager.findOne(WorkflowRunEntity, {
        where: { id: runId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) return;

      // Determine final status
      let finalStatus: WorkflowRunStatus;
      if (counters.failed_jobs === 0) {
        finalStatus = WorkflowRunStatus.COMPLETED;
      } else if (counters.completed_jobs === 0) {
        finalStatus = WorkflowRunStatus.FAILED;
      } else {
        finalStatus = WorkflowRunStatus.COMPLETED_WITH_ERRORS;
      }

      // Aggregate token usage from perFileResults
      const perFileResults: PerFileResult[] = entity.perFileResults ?? [];
      const aggregatedTokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      for (const result of perFileResults) {
        if (result.tokenUsage) {
          aggregatedTokenUsage.inputTokens += result.tokenUsage.inputTokens;
          aggregatedTokenUsage.outputTokens += result.tokenUsage.outputTokens;
          aggregatedTokenUsage.totalTokens += result.tokenUsage.totalTokens;
        }
      }

      const completedAt = new Date();
      const durationMs = entity.startedAt
        ? completedAt.getTime() - new Date(entity.startedAt).getTime()
        : null;

      // Credit refund on FAILED (AC6) — all files failed, no work delivered
      // No refund on COMPLETED_WITH_ERRORS (AC6) — partial work was done
      const creditUpdate: Record<string, unknown> = {};
      if (finalStatus === WorkflowRunStatus.FAILED) {
        const purchasedToRefund = entity.creditsFromPurchased;
        creditUpdate.creditsConsumed = 0;
        creditUpdate.creditsFromMonthly = 0;
        creditUpdate.creditsFromPurchased = 0;

        if (purchasedToRefund > 0) {
          await manager.query(
            'SELECT id FROM tenants WHERE id = $1 FOR UPDATE',
            [tenantId],
          );
          await manager.query(
            'UPDATE tenants SET purchased_credits = purchased_credits + $1 WHERE id = $2',
            [purchasedToRefund, tenantId],
          );

          this.logger.log({
            message: 'Credits refunded on fan-out run failure',
            runId,
            tenantId,
            purchasedToRefund,
          });
        }
      }

      await manager.update(WorkflowRunEntity, { id: runId, tenantId }, {
        status: finalStatus,
        tokenUsage: aggregatedTokenUsage,
        completedAt,
        durationMs,
        ...creditUpdate,
      });

      this.logger.log({
        message: 'Fan-out run finalized',
        runId,
        tenantId,
        finalStatus,
        completedJobs: counters.completed_jobs,
        failedJobs: counters.failed_jobs,
        totalJobs: counters.total_jobs,
        durationMs,
      });
    });
  }

  /**
   * Write intermediate per-file status for granular progress tracking.
   * Uses JSONB array update to upsert by file index — if a PerFileResult for this index
   * already exists (from a previous attempt), it is replaced. Otherwise, a new entry is appended.
   */
  private async writePerFileStatus(
    tenantId: string,
    runId: string,
    fileIndex: number,
    fileName: string,
    status: 'pending' | 'processing' | 'retrying',
    extra?: { retryAttempt?: number; maxRetries?: number },
  ): Promise<void> {
    const partialResult: Partial<PerFileResult> = {
      index: fileIndex,
      fileName,
      status,
      retryAttempt: extra?.retryAttempt,
      maxRetries: extra?.maxRetries,
    };

    // Remove existing entry for this index (if retrying) and append updated status
    await this.txManager.run(tenantId, async (manager) => {
      await manager.query(
        `UPDATE workflow_runs
         SET per_file_results = (
           SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
           FROM jsonb_array_elements(COALESCE(per_file_results, '[]'::jsonb)) AS elem
           WHERE (elem->>'index')::int != $1
         ) || $2::jsonb
         WHERE id = $3 AND tenant_id = $4`,
        [fileIndex, JSON.stringify(partialResult), runId, tenantId],
      );
    });
  }

  /**
   * Process a test run (ephemeral, no DB persistence, WebSocket updates).
   * Executes full fan-out for all subject files (AC3).
   */
  private async processTestRun(
    job: Job<WorkflowJobPayload>,
    sessionId: string,
    tenantId: string,
  ): Promise<void> {
    this.logger.log({
      message: 'Processing test run',
      sessionId,
      tenantId,
      jobId: job.id,
    });

    const results: TestRunFileResultDto[] = [];
    const subjectFiles = job.data.subjectFiles || (job.data.subjectFile ? [job.data.subjectFile] : []);

    // Execute ALL subject files (AC3 - full fan-out)
    for (let i = 0; i < subjectFiles.length; i++) {
      const file = subjectFiles[i];
      const fileName = file.originalName;

      try {
        // Emit file start event (AC4)
        this.testRunGateway.emitFileStart({
          sessionId,
          fileIndex: i,
          fileName,
        });

        // Step 1: Assemble prompt for this file
        const fileJobData = {
          ...job.data,
          subjectFile: file,
          subjectFiles: undefined, // Use single file for assembly
        };
        const assemblyResult = await this.promptAssembly.assemble(fileJobData);

        // Step 2: Resolve LLM provider
        const modelUuid = job.data.definition.execution.model;
        const { provider, model, supportedGenerationParams } = await this.llmProviderFactory.getProvider(modelUuid);

        // Step 3: Merge generation params
        const generationOptions = mergeGenerationParams(
          supportedGenerationParams,
          model.generationDefaults,
          job.data.definition.execution,
        );

        // Step 4: Call LLM
        const llmResult = await provider.generate(assemblyResult.prompt, generationOptions);

        // Step 5: Validate output
        const sanityResult = validateLlmOutput(
          llmResult.text,
          job.data.definition.execution.max_output_tokens,
        );

        const result: TestRunFileResultDto = {
          fileIndex: i,
          fileName,
          assembledPrompt: assemblyResult.prompt,
          llmResponse: llmResult.text,
          status: sanityResult.valid ? 'success' : 'failed',
          errorMessage: sanityResult.valid ? undefined : `Output validation failed: ${sanityResult.reason}`,
        };

        results.push(result);

        // Emit file complete event (AC4)
        this.testRunGateway.emitFileComplete({
          sessionId,
          ...result,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const result: TestRunFileResultDto = {
          fileIndex: i,
          fileName,
          assembledPrompt: '',
          llmResponse: '',
          status: 'error',
          errorMessage,
        };

        results.push(result);

        // Emit file complete with error (AC4)
        this.testRunGateway.emitFileComplete({
          sessionId,
          ...result,
        });
      }
    }

    // Store results in cache (AC5)
    const templateName = (job.data.definition as { name?: string }).name || 'Unnamed Template';
    this.testRunCache.set(sessionId, {
      sessionId,
      templateId: job.data.versionId, // Using versionId as templateId for test runs
      templateName,
      inputs: job.data.contextInputs,
      results,
      createdAt: new Date(),
    });

    // Emit completion event (AC4)
    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.length - successCount;
    this.testRunGateway.emitComplete({
      sessionId,
      totalFiles: results.length,
      successCount,
      failedCount,
    });

    this.logger.log({
      message: 'Test run completed',
      sessionId,
      totalFiles: results.length,
      successCount,
      failedCount,
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<WorkflowJobPayload>, error: Error): Promise<void> {
    const { runId, sessionId, isTestRun, tenantId } = job.data;

    // Test run failure: emit WebSocket error and return (AC9)
    if (isTestRun && sessionId) {
      this.logger.error({
        message: 'Test run job failed',
        sessionId,
        error: error.message,
      });
      this.testRunGateway.emitError({
        sessionId,
        errorMessage: error.message,
      });
      return;
    }

    // Defensive: skip DB update on missing tenantId.
    // ASYMMETRY with process(): process() THROWS (BullMQ retries/DLQ the job),
    // but onFailed() must RETURN EARLY — throwing in a failed handler crashes the
    // entire worker process, taking down all concurrent jobs.
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      this.logger.error({
        message: 'Cannot record job failure — missing tenantId',
        jobId: job.id,
        runId,
        originalError: error.message,
      });
      return;
    }

    const attemptsMade = job.attemptsMade;
    const maxAttempts = job.opts?.attempts ?? 3;
    const fanOut = isFanOutJob(job.id);

    // Intermediate failure — let BullMQ retry
    if (attemptsMade < maxAttempts) {
      this.logger.warn({
        message: `Workflow job attempt ${attemptsMade}/${maxAttempts} failed, will retry`,
        jobId: job.id,
        runId,
        tenantId,
        error: error.message,
        attemptsMade,
        fanOut,
      });

      // Write 'retrying' status for fan-out jobs (granular per-file tracking)
      if (fanOut) {
        try {
          const fileIndex = extractFileIndex(job.id!);
          const fileName = job.data.subjectFile?.originalName ?? `file-${fileIndex}`;
          await this.writePerFileStatus(tenantId, runId, fileIndex, fileName, 'retrying', {
            retryAttempt: attemptsMade,
            maxRetries: maxAttempts,
          });
        } catch (statusError) {
          this.logger.error({
            message: 'Failed to write retrying status',
            jobId: job.id,
            runId,
            error: statusError instanceof Error ? statusError.message : String(statusError),
          });
        }
      }

      return;
    }

    // Final failure — route to DLQ
    this.logger.error({
      message: 'Workflow job failed after all retries, routing to DLQ',
      jobId: job.id,
      runId,
      tenantId,
      error: error.message,
      attemptsMade,
      fanOut,
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

    if (fanOut) {
      // Fan-out job failure: increment failedJobs, record per-file error, check completion
      await this.recordFanOutFailure(job, error);
    } else {
      // Single-job failure: mark entire run FAILED (backward-compat)
      await this.markRunFailed(job, error, attemptsMade);
    }
  }

  /**
   * Record a failed fan-out job and check run completion.
   */
  private async recordFanOutFailure(
    job: Job<WorkflowJobPayload>,
    error: Error,
  ): Promise<void> {
    const { runId, tenantId } = job.data;
    const fileIndex = extractFileIndex(job.id!);
    const fileName = job.data.subjectFile?.originalName ?? `file-${fileIndex}`;

    try {
      const errorSummary = error.message.length > 200
        ? error.message.substring(0, 200) + '...'
        : error.message;

      const maxRetries = job.opts?.attempts ?? 3;
      const perFileResult: PerFileResult = {
        index: fileIndex,
        fileName,
        status: 'failed',
        errorMessage: errorSummary,
        retryAttempt: job.attemptsMade,
        maxRetries,
      };

      // Atomic: upsert per-file result (replace by index) + increment failed_jobs + RETURNING
      const counters = await this.txManager.run(tenantId, async (manager) => {
        await manager.query(
          `UPDATE workflow_runs
           SET per_file_results = (
             SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
             FROM jsonb_array_elements(COALESCE(per_file_results, '[]'::jsonb)) AS elem
             WHERE (elem->>'index')::int != $1
           ) || $2::jsonb
           WHERE id = $3 AND tenant_id = $4`,
          [fileIndex, JSON.stringify(perFileResult), runId, tenantId],
        );

        // UPDATE RETURNING via EntityManager.query() returns [[rows], affectedCount]
        const result = await manager.query(
          `UPDATE workflow_runs
           SET failed_jobs = COALESCE(failed_jobs, 0) + 1
           WHERE id = $1 AND tenant_id = $2
           RETURNING completed_jobs, failed_jobs, total_jobs`,
          [runId, tenantId],
        );

        return parseUpdateReturningRow<CompletionCounters>(result, [
          'completed_jobs',
          'failed_jobs',
          'total_jobs',
        ]);
      });

      this.logger.log({
        message: 'Fan-out job failure recorded',
        jobId: job.id,
        runId,
        fileIndex,
        fileName,
        completedJobs: counters.completed_jobs,
        failedJobs: counters.failed_jobs,
        totalJobs: counters.total_jobs,
      });

      // Check if this is the last job → trigger finalization
      // >= (not ==) handles edge case where duplicate BullMQ delivery increments beyond total
      if (counters.completed_jobs + counters.failed_jobs >= counters.total_jobs) {
        await this.finalizeRun(runId, tenantId, counters);
      }
    } catch (updateError) {
      this.logger.error({
        message: 'Failed to record fan-out job failure',
        jobId: job.id,
        runId,
        tenantId,
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
    }
  }

  /**
   * Mark a single-job run as FAILED (backward-compat with pre-fan-out behavior).
   */
  private async markRunFailed(
    job: Job<WorkflowJobPayload>,
    error: Error,
    attemptsMade: number,
  ): Promise<void> {
    const { runId, tenantId } = job.data;

    try {
      const errorSummary = error.message.length > 200
        ? error.message.substring(0, 200) + '...'
        : error.message;

      await this.txManager.run(tenantId, async (manager) => {
        // Load run with pessimistic lock to prevent TOCTOU on credit fields (AC6)
        const run = await manager.findOne(WorkflowRunEntity, {
          where: { id: runId, tenantId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!run) return;

        // Idempotency: skip if already FAILED (prevents double-refund on BullMQ retry)
        if (run.status === WorkflowRunStatus.FAILED) {
          this.logger.warn({
            message: 'Skipping markRunFailed — run already in FAILED state',
            runId,
            tenantId,
          });
          return;
        }

        const purchasedToRefund = run.creditsFromPurchased;

        // Zero all credit fields on the run + set FAILED
        await manager.update(WorkflowRunEntity, { id: runId, tenantId }, {
          status: WorkflowRunStatus.FAILED,
          errorMessage: `Workflow execution failed after ${attemptsMade} attempts: ${errorSummary}`,
          creditsConsumed: 0,
          creditsFromMonthly: 0,
          creditsFromPurchased: 0,
        });

        // Refund purchased credits back to tenant (monthly auto-corrects via SUM)
        if (purchasedToRefund > 0) {
          await manager.query(
            'SELECT id FROM tenants WHERE id = $1 FOR UPDATE',
            [tenantId],
          );
          await manager.query(
            'UPDATE tenants SET purchased_credits = purchased_credits + $1 WHERE id = $2',
            [purchasedToRefund, tenantId],
          );

          this.logger.log({
            message: 'Credits refunded on run failure',
            runId,
            tenantId,
            purchasedToRefund,
          });
        }
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
