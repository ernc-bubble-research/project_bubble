import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  WorkflowTemplateEntity,
  WorkflowTemplateStatus,
  WorkflowVersionEntity,
  WorkflowRunEntity,
  WorkflowRunStatus,
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
} from '@project-bubble/shared';
import { WorkflowDefinition, WorkflowInput, WorkflowProcessingMode } from '@project-bubble/shared';
import { In } from 'typeorm';
import { AssetsService } from '../assets/assets.service';
import { WorkflowExecutionService } from '../workflow-execution/workflow-execution.service';
import { PreFlightValidationService } from './pre-flight-validation.service';

@Injectable()
export class WorkflowRunsService {
  private readonly logger = new Logger(WorkflowRunsService.name);

  constructor(
    private readonly txManager: TransactionManager,
    private readonly assetsService: AssetsService,
    private readonly executionService: WorkflowExecutionService,
    private readonly preFlightService: PreFlightValidationService,
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

    // 1. Load template + current version (read-only transaction — no lock needed)
    const { template, version } = await this.txManager.run(
      tenantId,
      async (manager) => {
        const tmpl = await manager.findOne(WorkflowTemplateEntity, {
          where: { id: dto.templateId, tenantId },
          withDeleted: false,
        });
        if (!tmpl) {
          throw new NotFoundException(
            `Workflow template "${dto.templateId}" not found`,
          );
        }
        if (tmpl.status !== WorkflowTemplateStatus.PUBLISHED) {
          throw new BadRequestException(
            'Only published templates can be used to initiate runs',
          );
        }
        if (!tmpl.currentVersionId) {
          throw new BadRequestException(
            'Template does not have a published version',
          );
        }

        const ver = await manager.findOne(WorkflowVersionEntity, {
          where: { id: tmpl.currentVersionId, tenantId },
        });
        if (!ver || !ver.definition) {
          throw new BadRequestException(
            'Template version or definition not found',
          );
        }

        return { template: tmpl, version: ver };
      },
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
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
