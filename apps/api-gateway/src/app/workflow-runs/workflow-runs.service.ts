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
  TransactionManager,
} from '@project-bubble/db-layer';
import {
  InitiateWorkflowRunDto,
  WorkflowRunResponseDto,
  WorkflowJobPayload,
  WorkflowJobContextInput,
} from '@project-bubble/shared';
import { WorkflowDefinition, WorkflowInput } from '@project-bubble/shared';
import { AssetsService } from '../assets/assets.service';
import { WorkflowExecutionService } from '../workflow-execution/workflow-execution.service';

@Injectable()
export class WorkflowRunsService {
  private readonly logger = new Logger(WorkflowRunsService.name);

  constructor(
    private readonly txManager: TransactionManager,
    private readonly assetsService: AssetsService,
    private readonly executionService: WorkflowExecutionService,
  ) {}

  async initiateRun(
    dto: InitiateWorkflowRunDto,
    tenantId: string,
    userId: string,
  ): Promise<WorkflowRunResponseDto> {
    // 1. Load template + current version within transaction
    const { template, version } = await this.txManager.run(
      tenantId,
      async (manager) => {
        const tmpl = await manager.findOne(WorkflowTemplateEntity, {
          where: { id: dto.templateId, tenantId },
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

    // 2. Validate required inputs against definition
    const definition = version.definition as unknown as WorkflowDefinition;
    const definitionInputs: WorkflowInput[] = definition.inputs ?? [];
    this.validateRequiredInputs(definitionInputs, dto.inputs);
    this.validateInputTypes(definitionInputs, dto.inputs);

    // 3. Validate asset IDs exist in tenant vault
    await this.validateAssetIds(dto.inputs, tenantId);

    // 4. Build inputSnapshot
    const inputSnapshot = {
      templateId: template.id,
      templateName: template.name,
      versionId: version.id,
      versionNumber: version.versionNumber,
      definition: version.definition,
      userInputs: dto.inputs,
    };

    // 5. Create WorkflowRunEntity + enqueue within transaction
    return this.txManager.run(tenantId, async (manager) => {
      const runEntity = manager.create(WorkflowRunEntity, {
        tenantId,
        versionId: version.id,
        status: WorkflowRunStatus.QUEUED,
        startedBy: userId,
        inputSnapshot,
        creditsConsumed: 0,
      });

      const savedRun = await manager.save(WorkflowRunEntity, runEntity);

      // 6. Build WorkflowJobPayload
      const contextInputs: Record<string, WorkflowJobContextInput> = {};
      for (const defInput of definitionInputs) {
        if (defInput.role !== 'context') continue;
        const userInput = dto.inputs[defInput.name];
        if (!userInput) continue;

        if (userInput.type === 'asset' && userInput.assetIds?.length) {
          // Translate DTO 'asset' → payload 'file'
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
        // subjectFile/subjectFiles left undefined — resolved in Story 4-3 (fan-out)
      };

      // 7. Enqueue
      await this.executionService.enqueueRun(savedRun.id, payload);

      this.logger.log({
        message: 'Workflow run initiated',
        runId: savedRun.id,
        tenantId,
        templateId: template.id,
        versionId: version.id,
      });

      return this.toResponse(savedRun);
    });
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
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
