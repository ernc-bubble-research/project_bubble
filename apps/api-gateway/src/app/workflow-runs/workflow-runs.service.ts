import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  WorkflowRunEntity,
  WorkflowRunStatus,
  WorkflowTemplateEntity,
  WorkflowTemplateStatus,
  AssetEntity,
  TransactionManager,
  UserRole,
  IMPERSONATOR_ROLE,
} from '@project-bubble/db-layer';
import {
  InitiateWorkflowRunDto,
  WorkflowRunResponseDto,
  WorkflowJobPayload,
  WorkflowJobContextInput,
  WorkflowJobSubjectFile,
  PerFileResult,
} from '@project-bubble/shared';
import { WorkflowDefinition, WorkflowInput, WorkflowProcessingMode } from '@project-bubble/shared';
import { In } from 'typeorm';
import { AssetsService } from '../assets/assets.service';
import { WorkflowExecutionService } from '../workflow-execution/workflow-execution.service';
import { WorkflowTemplatesService } from '../workflows/workflow-templates.service';
import { PreFlightValidationService } from './pre-flight-validation.service';

@Injectable()
export class WorkflowRunsService {
  private readonly logger = new Logger(WorkflowRunsService.name);

  constructor(
    private readonly txManager: TransactionManager,
    private readonly assetsService: AssetsService,
    private readonly executionService: WorkflowExecutionService,
    private readonly templatesService: WorkflowTemplatesService,
    private readonly preFlightService: PreFlightValidationService,
    @InjectQueue('workflow-execution')
    private readonly executionQueue: Queue,
  ) {}

  async initiateRun(
    dto: InitiateWorkflowRunDto,
    tenantId: string,
    userId: string,
    userRole: string,
  ): Promise<WorkflowRunResponseDto> {
    // Determine isTestRun from JWT role (AC7)
    const isTestRun =
      userRole === UserRole.BUBBLE_ADMIN || userRole === IMPERSONATOR_ROLE;

    // 1. Load template + current version via catalog visibility check (Story 4-LT4-3)
    // Uses findPublishedOneEntity which is a documented Rule 2c exception:
    // no tenantId in WHERE — templates are admin-created and shared via catalog.
    // Visibility enforced in application code (public pass, private check allowedTenants).
    const { template, version } = await this.templatesService.findPublishedOneEntity(
      dto.templateId,
      tenantId,
    );

    // 2. Parse definition and validate inputs (outside transaction — no lock)
    const definition = version.definition as unknown as WorkflowDefinition;
    const definitionInputs: WorkflowInput[] = definition.inputs ?? [];
    this.validateRequiredInputs(definitionInputs, dto.inputs);
    this.validateInputTypes(definitionInputs, dto.inputs);

    // 3. Validate asset IDs exist in tenant vault (outside transaction — no lock)
    await this.validateAssetIds(dto.inputs, tenantId);

    // 4. Pre-flight: validate model/provider availability (AC8)
    if (definition.execution.model) {
      await this.preFlightService.validateModelAvailability(
        definition.execution.model,
      );
    }

    // 5. Resolve subject-role inputs
    const subjectFiles = await this.resolveSubjectFiles(
      definitionInputs,
      dto.inputs,
      tenantId,
    );

    // 6. Compute processing mode and totalJobs
    const processingMode: WorkflowProcessingMode =
      definition.execution.processing || 'parallel';
    const maxConcurrency = definition.execution.max_concurrency ?? 5;
    const totalJobs =
      subjectFiles.length === 0
        ? 1
        : processingMode === 'parallel'
          ? subjectFiles.length
          : 1;

    // 7. Build inputSnapshot
    const inputSnapshot = {
      templateId: template.id,
      templateName: template.name,
      versionId: version.id,
      versionNumber: version.versionNumber,
      definition: version.definition,
      userInputs: dto.inputs,
    };

    // 8. Credit-check-and-create transaction (AC5 — FOR UPDATE lock on tenant row)
    const creditsPerRun = template.creditsPerRun ?? 1;
    const savedRun = await this.txManager.run(tenantId, async (manager) => {
      // Acquire FOR UPDATE lock on tenant row to prevent concurrent double-spend
      await manager.query(
        'SELECT id FROM tenants WHERE id = $1 FOR UPDATE',
        [tenantId],
      );

      // Check and deduct credits (AC1-5, AC7)
      const { creditsFromMonthly, creditsFromPurchased } =
        await this.preFlightService.checkAndDeductCredits(
          tenantId,
          creditsPerRun,
          isTestRun,
          manager,
        );

      const creditsConsumed = creditsFromMonthly + creditsFromPurchased;

      // Create run entity with credit fields set
      const runEntity = manager.create(WorkflowRunEntity, {
        tenantId,
        versionId: version.id,
        status: WorkflowRunStatus.QUEUED,
        startedBy: userId,
        inputSnapshot,
        creditsConsumed,
        isTestRun,
        creditsFromMonthly,
        creditsFromPurchased,
        totalJobs,
        completedJobs: 0,
        failedJobs: 0,
        maxRetryCount: dto.maxRetryCount ?? 3,
      });

      return manager.save(WorkflowRunEntity, runEntity);
    });

    // 9. Build context inputs and enqueue AFTER commit (AC5 — BullMQ enqueue outside transaction)
    const contextInputs: Record<string, WorkflowJobContextInput> = {};
    for (const defInput of definitionInputs) {
      if (defInput.role !== 'context') continue;
      const userInput = dto.inputs[defInput.name];
      if (!userInput) continue;

      if (userInput.type === 'asset' && userInput.assetIds?.length) {
        contextInputs[defInput.name] = {
          type: 'file',
          assetId: userInput.assetIds[0],
        };
      } else if (userInput.type === 'text' && userInput.text) {
        contextInputs[defInput.name] = {
          type: 'text',
          content: userInput.text,
        };
      }
    }

    const payload: WorkflowJobPayload = {
      runId: savedRun.id,
      tenantId,
      versionId: version.id,
      definition,
      contextInputs,
    };

    try {
      await this.executionService.enqueueRun(savedRun.id, payload, {
        subjectFiles,
        processingMode,
        maxConcurrency,
      });
    } catch (enqueueError) {
      // Compensating action: refund credits and mark run as FAILED (Finding 9)
      this.logger.error({
        message:
          'BullMQ enqueue failed after credit deduction — executing compensating refund',
        runId: savedRun.id,
        tenantId,
        error:
          enqueueError instanceof Error
            ? enqueueError.message
            : String(enqueueError),
      });

      try {
        await this.txManager.run(tenantId, async (manager) => {
          await manager.query(
            'SELECT id FROM tenants WHERE id = $1 FOR UPDATE',
            [tenantId],
          );
          await this.preFlightService.refundCredits(
            tenantId,
            savedRun.creditsFromPurchased,
            manager,
          );
          await manager.update(WorkflowRunEntity, savedRun.id, {
            status: WorkflowRunStatus.FAILED,
            errorMessage:
              'Failed to enqueue workflow for execution. Credits have been refunded.',
            creditsConsumed: 0,
            creditsFromMonthly: 0,
            creditsFromPurchased: 0,
          });
        });
      } catch (refundError) {
        this.logger.error({
          message:
            'Compensating refund ALSO failed — credits may be stuck. Manual intervention required.',
          runId: savedRun.id,
          tenantId,
          creditsFromPurchased: savedRun.creditsFromPurchased,
          error:
            refundError instanceof Error
              ? refundError.message
              : String(refundError),
        });
      }

      throw enqueueError;
    }

    this.logger.log({
      message: 'Workflow run initiated',
      runId: savedRun.id,
      tenantId,
      templateId: template.id,
      versionId: version.id,
      totalJobs,
      processingMode,
      isTestRun,
      creditsConsumed: savedRun.creditsConsumed,
    });

    return this.toResponse(savedRun);
  }

  private async resolveSubjectFiles(
    definitionInputs: WorkflowInput[],
    userInputs: Record<string, { type: string; assetIds?: string[]; text?: string }>,
    tenantId: string,
  ): Promise<WorkflowJobSubjectFile[]> {
    // Find the subject-role input in the definition
    const subjectDef = definitionInputs.find((d) => d.role === 'subject');
    if (!subjectDef) {
      return []; // No subject input → context-only workflow
    }

    const userInput = userInputs[subjectDef.name];
    if (!userInput || userInput.type !== 'asset' || !userInput.assetIds?.length) {
      return []; // No subject files provided
    }

    // Bulk-resolve all asset IDs in a single query (defense-in-depth: tenantId in WHERE)
    const assetIds = userInput.assetIds!;
    const subjectFiles: WorkflowJobSubjectFile[] = await this.txManager.run(
      tenantId,
      async (manager) => {
        const assets = await manager.find(AssetEntity, {
          where: { id: In(assetIds), tenantId },
        });

        // Validate all requested assets were found
        if (assets.length !== assetIds.length) {
          const foundIds = new Set(assets.map((a) => a.id));
          const missing = assetIds.filter((id) => !foundIds.has(id));
          throw new BadRequestException(
            `Subject file asset(s) not found in tenant data vault: ${missing.join(', ')}`,
          );
        }

        // Return in the same order as the input assetIds
        const assetMap = new Map(assets.map((a) => [a.id, a]));
        return assetIds.map((id) => {
          const asset = assetMap.get(id)!;
          return {
            assetId: asset.id,
            originalName: asset.originalName,
            storagePath: asset.storagePath,
          };
        });
      },
    );

    return subjectFiles;
  }

  private validateRequiredInputs(
    definitionInputs: WorkflowInput[],
    userInputs: Record<string, { type: string; assetIds?: string[]; text?: string }>,
  ): void {
    for (const defInput of definitionInputs) {
      if (!defInput.required) continue;
      const userInput = userInputs[defInput.name];
      if (!userInput) {
        throw new BadRequestException(
          `Required input "${defInput.name}" is missing`,
        );
      }
      if (userInput.type === 'asset' && (!userInput.assetIds || userInput.assetIds.length === 0)) {
        throw new BadRequestException(
          `Required input "${defInput.name}" must have at least one asset ID`,
        );
      }
      if (userInput.type === 'text' && (!userInput.text || userInput.text.trim().length === 0)) {
        throw new BadRequestException(
          `Required input "${defInput.name}" must have non-empty text`,
        );
      }
    }
  }

  private validateInputTypes(
    definitionInputs: WorkflowInput[],
    userInputs: Record<string, { type: string; assetIds?: string[]; text?: string }>,
  ): void {
    for (const [inputName, userInput] of Object.entries(userInputs)) {
      const defInput = definitionInputs.find((d) => d.name === inputName);
      if (!defInput) {
        throw new BadRequestException(
          `Unknown input "${inputName}" — not in workflow definition`,
        );
      }

      // Validate that user input type matches allowed sources
      if (userInput.type === 'asset' && !defInput.source.includes('asset') && !defInput.source.includes('upload')) {
        throw new BadRequestException(
          `Input "${inputName}" does not accept asset/upload source`,
        );
      }
      if (userInput.type === 'text' && !defInput.source.includes('text')) {
        throw new BadRequestException(
          `Input "${inputName}" does not accept text source`,
        );
      }
    }
  }

  private async validateAssetIds(
    userInputs: Record<string, { type: string; assetIds?: string[]; text?: string }>,
    tenantId: string,
  ): Promise<void> {
    const allAssetIds: string[] = [];
    for (const input of Object.values(userInputs)) {
      if (input.type === 'asset' && input.assetIds) {
        allAssetIds.push(...input.assetIds);
      }
    }

    // Validate each asset exists in tenant vault
    for (const assetId of allAssetIds) {
      try {
        await this.assetsService.findOne(assetId, tenantId);
      } catch {
        throw new BadRequestException(
          `Asset "${assetId}" not found in tenant data vault`,
        );
      }
    }
  }

  async findAllByTenant(
    tenantId: string,
    options: { page?: number; limit?: number; status?: string },
  ): Promise<{ data: WorkflowRunResponseDto[]; total: number; page: number; limit: number }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const offset = Math.max(0, (page - 1) * limit);

    return this.txManager.run(tenantId, async (manager) => {
      const qb = manager
        .createQueryBuilder(WorkflowRunEntity, 'run')
        .where('run.tenantId = :tenantId', { tenantId })
        .orderBy('run.createdAt', 'DESC')
        .take(limit)
        .skip(offset);

      if (options.status) {
        qb.andWhere('run.status = :status', { status: options.status });
      }

      const [entities, total] = await qb.getManyAndCount();

      return {
        data: entities.map((e) => this.toResponse(e)),
        total,
        page,
        limit,
      };
    });
  }

  async findOneByTenant(
    id: string,
    tenantId: string,
  ): Promise<WorkflowRunResponseDto> {
    const entity = await this.txManager.run(tenantId, async (manager) => {
      return manager.findOne(WorkflowRunEntity, {
        where: { id, tenantId },
      });
    });

    if (!entity) {
      throw new NotFoundException(`Workflow run "${id}" not found`);
    }

    return this.toResponse(entity);
  }

  async getOutputFile(
    runId: string,
    fileIndex: number,
    tenantId: string,
  ): Promise<{ asset: AssetEntity; perFileResult: PerFileResult }> {
    // Load run with tenant scoping (Rule 2c)
    const entity = await this.txManager.run(tenantId, async (manager) => {
      return manager.findOne(WorkflowRunEntity, {
        where: { id: runId, tenantId },
      });
    });

    if (!entity) {
      throw new NotFoundException(`Workflow run "${runId}" not found`);
    }

    // Find the per-file result for the requested index
    const perFileResults: PerFileResult[] = entity.perFileResults ?? [];
    const result = perFileResults.find((r) => r.index === fileIndex);
    if (!result) {
      throw new NotFoundException(
        `Output at file index ${fileIndex} not found in workflow run "${runId}"`,
      );
    }

    if (result.status !== 'completed' || !result.outputAssetId) {
      throw new BadRequestException(
        `Output at file index ${fileIndex} is not available (status: ${result.status})`,
      );
    }

    // Load the output asset (tenant-scoped via findEntityById)
    const asset = await this.assetsService.findEntityById(
      result.outputAssetId,
      tenantId,
    );

    return { asset, perFileResult: result };
  }

  async retryFailed(
    runId: string,
    tenantId: string,
    userId: string,
    userRole: string,
  ): Promise<WorkflowRunResponseDto> {
    // 1. Load run with FOR UPDATE lock (prevents concurrent retry attempts)
    // Lock the run row exclusively to prevent race conditions where two users
    // click "Continue" simultaneously and both proceed to credit deduction
    const run = await this.txManager.run(tenantId, async (manager) => {
      // Acquire FOR UPDATE lock on the run row (Rule 2c: include tenantId)
      const lockedRows = await manager.query(
        'SELECT id FROM workflow_runs WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
        [runId, tenantId],
      );

      if (!lockedRows || lockedRows.length === 0) {
        throw new NotFoundException(`Workflow run "${runId}" not found`);
      }

      // Now load the full entity (lock already acquired above)
      return manager.findOne(WorkflowRunEntity, {
        where: { id: runId, tenantId },
      });
    });

    if (!run) {
      throw new NotFoundException(`Workflow run "${runId}" not found`);
    }

    // 2. Idempotency check: reject if already RUNNING (AC5)
    if (run.status === WorkflowRunStatus.RUNNING) {
      throw new BadRequestException(
        'Workflow run is already in progress. Cannot retry while running.',
      );
    }

    // 3. Sanity check: if COMPLETED (no errors) → reject (AC6)
    if (run.status === WorkflowRunStatus.COMPLETED) {
      throw new BadRequestException(
        'Workflow run completed successfully with no errors to retry',
      );
    }

    // 4. Extract FAILED + PENDING files from perFileResults
    const perFileResults: PerFileResult[] = run.perFileResults ?? [];
    const failedFiles = perFileResults.filter((f) => f.status === 'failed');
    const pendingFiles = perFileResults.filter((f) => f.status === 'pending');
    const filesToRetry = [...failedFiles, ...pendingFiles];

    // 5. If no FAILED or PENDING files → reject (AC7)
    if (filesToRetry.length === 0) {
      throw new BadRequestException(
        'No failed or pending files to retry. All files completed successfully or are in error state.',
      );
    }

    // 6. Max retry count check: reject if any file exceeded limit (AC13)
    const anyMaxedOut = filesToRetry.some(
      (f) => (f.retryAttempt ?? 0) >= run.maxRetryCount,
    );
    if (anyMaxedOut) {
      throw new BadRequestException(
        `Max retry count (${run.maxRetryCount}) exceeded for one or more files. Cannot retry further.`,
      );
    }

    // 7. Count FAILED files (PENDING are free) (AC8)
    const failedCount = failedFiles.length;

    // 8-10. Fetch template + credit transaction (AC9, AC10, AC15)
    const templateId = run.inputSnapshot['templateId'] as string;
    let creditBreakdown: { creditsFromMonthly: number; creditsFromPurchased: number };
    let totalCreditsNeeded: number;

    const updatedRun = await this.txManager.run(tenantId, async (manager) => {
      // 8. Fetch template with withDeleted:true (soft-delete OK for retry) (AC15)
      // Query directly instead of using findPublishedOneEntity since we need withDeleted:true
      const template = (await manager.findOne(WorkflowTemplateEntity, {
        where: { id: templateId, status: WorkflowTemplateStatus.PUBLISHED },
        withDeleted: true,
      })) as WorkflowTemplateEntity | null;

      if (!template) {
        throw new NotFoundException(
          `Published workflow template with id "${templateId}" not found`,
        );
      }

      // 9. Calculate credits needed (only for FAILED files)
      const creditsPerRun = template.creditsPerRun ?? 1;
      totalCreditsNeeded = failedCount * creditsPerRun;

      // Acquire FOR UPDATE lock on tenant row
      await manager.query(
        'SELECT id FROM tenants WHERE id = $1 FOR UPDATE',
        [tenantId],
      );

      // Check and deduct credits only for FAILED files (AC8, AC9)
      creditBreakdown =
        totalCreditsNeeded > 0
          ? await this.preFlightService.checkAndDeductCredits(
              tenantId,
              totalCreditsNeeded,
              false, // isTestRun = false (retries are always charged)
              manager,
            )
          : { creditsFromMonthly: 0, creditsFromPurchased: 0 };

      const { creditsFromMonthly, creditsFromPurchased } = creditBreakdown;

      // Update perFileResults: set status 'pending', increment retryAttempt (AC14)
      const updatedResults = perFileResults.map((r) => {
        if (r.status === 'failed' || r.status === 'pending') {
          return {
            ...r,
            status: 'pending' as const,
            retryAttempt: (r.retryAttempt ?? 0) + 1,
            errorMessage: undefined, // Clear previous error
          };
        }
        return r;
      });

      // Update run: status RUNNING, re-open counters, increment credits (AC10, AC11)
      const updatePayload = {
        status: WorkflowRunStatus.RUNNING,
        completedJobs: 0,
        failedJobs: 0,
        creditsConsumed: run.creditsConsumed + creditsFromMonthly + creditsFromPurchased,
        creditsFromMonthly: run.creditsFromMonthly + creditsFromMonthly,
        creditsFromPurchased: run.creditsFromPurchased + creditsFromPurchased,
        perFileResults: updatedResults,
        lastRetriedAt: new Date(),
      };

      await manager.update(
        WorkflowRunEntity,
        { id: runId, tenantId },
        updatePayload,
      );

      // Return updated entity
      return manager.findOne(WorkflowRunEntity, {
        where: { id: runId, tenantId },
      });
    });

    if (!updatedRun) {
      throw new Error('Failed to load updated run after transaction');
    }

    // 11. Enqueue jobs AFTER transaction auto-commits (txManager.run returns) (AC10, AC12)
    // Build context inputs (same as initiateRun)
    const definition = run.inputSnapshot['definition'] as WorkflowDefinition;
    const userInputs = run.inputSnapshot['userInputs'] as Record<string, unknown>;
    const contextInputs: Record<string, WorkflowJobContextInput> = {};

    for (const defInput of definition.inputs ?? []) {
      if (defInput.role !== 'context') continue;
      const userInput = userInputs[defInput.name] as
        | { type: string; assetIds?: string[]; text?: string }
        | undefined;
      if (!userInput) continue;

      if (userInput.type === 'asset' && userInput.assetIds?.length) {
        contextInputs[defInput.name] = {
          type: 'file',
          assetId: userInput.assetIds[0],
        };
      } else if (userInput.type === 'text' && userInput.text) {
        contextInputs[defInput.name] = {
          type: 'text',
          content: userInput.text,
        };
      }
    }

    // Build payload
    const payload: WorkflowJobPayload = {
      runId: run.id,
      tenantId,
      versionId: run.versionId!,
      definition,
      contextInputs,
    };

    // Resolve subject files for retrying
    const subjectFiles: WorkflowJobSubjectFile[] = [];
    for (const fileResult of filesToRetry) {
      // Reconstruct subject file from perFileResult metadata
      // Note: We need to get the actual storagePath from the original inputSnapshot
      const defInputs = definition.inputs ?? [];
      const subjectDef = defInputs.find((d) => d.role === 'subject');
      if (subjectDef) {
        const userInput = userInputs[subjectDef.name] as
          | { type: string; assetIds?: string[] }
          | undefined;
        if (userInput?.assetIds && userInput.assetIds[fileResult.index]) {
          const assetId = userInput.assetIds[fileResult.index];
          const asset = await this.assetsService.findEntityById(assetId, tenantId);
          subjectFiles.push({
            assetId: asset.id,
            originalName: asset.originalName,
            storagePath: asset.storagePath,
          });
        }
      }
    }

    // Enqueue jobs with explicit job IDs (AC12)
    const processingMode = definition.execution.processing || 'parallel';
    const JOB_RETRY_OPTIONS = {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 1000 },
    };

    try {
      if (processingMode === 'batch') {
        // Fan-in: 1 job with all subject files
        const batchPayload: WorkflowJobPayload = {
          ...payload,
          subjectFiles,
        };
        await this.executionQueue.add('execute-workflow', batchPayload, {
          jobId: run.id,
          ...JOB_RETRY_OPTIONS,
        });

        this.logger.log({
          message: 'Workflow retry enqueued (batch)',
          jobId: run.id,
          runId: run.id,
          tenantId,
          fileCount: subjectFiles.length,
        });
      } else {
        // Fan-out: N jobs, 1 per subject file with explicit job ID using ORIGINAL index
        const jobIds: string[] = [];
        for (let i = 0; i < filesToRetry.length; i++) {
          const originalIndex = filesToRetry[i].index;
          const jobId = `${run.id}:file:${originalIndex}`;
          const filePayload: WorkflowJobPayload = {
            ...payload,
            subjectFile: subjectFiles[i],
          };

          await this.executionQueue.add('execute-workflow', filePayload, {
            jobId,
            ...JOB_RETRY_OPTIONS,
          });

          jobIds.push(jobId);
        }

        this.logger.log({
          message: 'Workflow retry enqueued (parallel fan-out)',
          runId: run.id,
          tenantId,
          jobCount: jobIds.length,
          retriedIndices: filesToRetry.map((f) => f.index),
        });
      }
    } catch (enqueueError) {
      // Compensating action: refund credits and mark run as FAILED
      this.logger.error({
        message: 'BullMQ enqueue failed after credit deduction (retry) — executing compensating refund',
        runId: run.id,
        tenantId,
        error:
          enqueueError instanceof Error
            ? enqueueError.message
            : String(enqueueError),
      });

      try {
        await this.txManager.run(tenantId, async (manager) => {
          await manager.query(
            'SELECT id FROM tenants WHERE id = $1 FOR UPDATE',
            [tenantId],
          );
          // Refund purchased credits (updates tenant balance)
          await this.preFlightService.refundCredits(
            tenantId,
            creditBreakdown.creditsFromPurchased,
            manager,
          );
          // Reset credit fields on the run entity (refunds monthly by removing from SUM query)
          await manager.update(WorkflowRunEntity, { id: runId, tenantId }, {
            status: WorkflowRunStatus.FAILED,
            errorMessage: 'Failed to enqueue retry jobs. Credits have been refunded.',
            creditsConsumed: run.creditsConsumed - creditBreakdown.creditsFromMonthly - creditBreakdown.creditsFromPurchased,
            creditsFromMonthly: run.creditsFromMonthly - creditBreakdown.creditsFromMonthly,
            creditsFromPurchased: run.creditsFromPurchased - creditBreakdown.creditsFromPurchased,
          });
        });
      } catch (refundError) {
        this.logger.error({
          message: 'Compensating refund ALSO failed (retry) — credits may be stuck',
          runId: run.id,
          tenantId,
          creditsFromMonthly: creditBreakdown.creditsFromMonthly,
          creditsFromPurchased: creditBreakdown.creditsFromPurchased,
          error:
            refundError instanceof Error
              ? refundError.message
              : String(refundError),
        });
      }

      throw enqueueError;
    }

    this.logger.log({
      message: 'Workflow run retry initiated',
      runId: run.id,
      tenantId,
      retriedFiles: filesToRetry.length,
      failedFiles: failedCount,
      pendingFiles: pendingFiles.length,
      creditsCharged: totalCreditsNeeded,
    });

    // 12. Return updated run response
    return this.toResponse(updatedRun);
  }

  private toResponse(entity: WorkflowRunEntity): WorkflowRunResponseDto {
    const dto = new WorkflowRunResponseDto();
    dto.id = entity.id;
    dto.tenantId = entity.tenantId;
    dto.versionId = entity.versionId!;
    dto.status = entity.status;
    dto.startedBy = entity.startedBy;
    dto.creditsConsumed = entity.creditsConsumed;
    dto.isTestRun = entity.isTestRun;
    dto.creditsFromMonthly = entity.creditsFromMonthly;
    dto.creditsFromPurchased = entity.creditsFromPurchased;
    dto.totalJobs = entity.totalJobs;
    dto.completedJobs = entity.completedJobs;
    dto.failedJobs = entity.failedJobs;
    dto.perFileResults = entity.perFileResults;
    dto.outputAssetIds = entity.outputAssetIds;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
