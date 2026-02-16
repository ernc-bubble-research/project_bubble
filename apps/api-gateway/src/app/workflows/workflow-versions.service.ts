import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  WorkflowTemplateEntity,
  WorkflowTemplateStatus,
  WorkflowVersionEntity,
  TransactionManager,
} from '@project-bubble/db-layer';
import {
  WorkflowVersionResponseDto,
  validateWorkflowDefinition,
} from '@project-bubble/shared';
import { WorkflowDefinition } from '@project-bubble/shared';

@Injectable()
export class WorkflowVersionsService {
  constructor(private readonly txManager: TransactionManager) {}

  async createVersion(
    templateId: string,
    definition: Record<string, unknown>,
    tenantId: string,
    userId: string,
  ): Promise<WorkflowVersionResponseDto> {
    return this.txManager.run(tenantId, async (manager) => {
      // (a) Validate definition via schema validator
      const validationResult = validateWorkflowDefinition(
        definition as unknown as WorkflowDefinition,
      );
      if (!validationResult.valid) {
        throw new BadRequestException(validationResult.errors);
      }

      // (b) Verify template exists (defense-in-depth: tenantId in WHERE)
      const template = await manager.findOne(WorkflowTemplateEntity, {
        where: { id: templateId, tenantId },
        withDeleted: false,
      });
      if (!template) {
        throw new NotFoundException(
          `Workflow template with id "${templateId}" not found`,
        );
      }

      // (c) Calculate next version number
      const result = await manager
        .createQueryBuilder(WorkflowVersionEntity, 'wv')
        .select('MAX(wv.version_number)', 'maxVersion')
        .where('wv.template_id = :templateId', { templateId })
        .getRawOne();

      const nextVersion = (result?.maxVersion ?? 0) + 1;

      // (d) Create version record — catch unique constraint on concurrent inserts
      let savedVersion: WorkflowVersionEntity;
      try {
        const version = manager.create(WorkflowVersionEntity, {
          tenantId,
          templateId,
          versionNumber: nextVersion,
          definition,
          createdBy: userId,
        });
        savedVersion = await manager.save(WorkflowVersionEntity, version);
      } catch (error: unknown) {
        if (
          error instanceof Object &&
          'code' in error &&
          (error as { code: string }).code === '23505'
        ) {
          throw new ConflictException(
            `Concurrent version creation conflict for template "${templateId}". Please retry.`,
          );
        }
        throw error;
      }

      // (e) Update template's currentVersionId — only for draft templates
      if (template.status === WorkflowTemplateStatus.DRAFT) {
        await manager.update(WorkflowTemplateEntity, { id: templateId }, {
          currentVersionId: savedVersion.id,
        });
      }

      return this.toResponse(savedVersion);
    });
  }

  async findAllByTemplate(
    templateId: string,
    tenantId: string,
  ): Promise<WorkflowVersionResponseDto[]> {
    return this.txManager.run(tenantId, async (manager) => {
      // Verify template exists before listing versions (defense-in-depth: tenantId in WHERE)
      const template = await manager.findOne(WorkflowTemplateEntity, {
        where: { id: templateId, tenantId },
        withDeleted: false,
      });
      if (!template) {
        throw new NotFoundException(
          `Workflow template with id "${templateId}" not found`,
        );
      }

      const versions = await manager.find(WorkflowVersionEntity, {
        where: { templateId },
        order: { versionNumber: 'DESC' },
      });
      return versions.map((v) => this.toResponse(v));
    });
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<WorkflowVersionResponseDto> {
    return this.txManager.run(tenantId, async (manager) => {
      const version = await manager.findOne(WorkflowVersionEntity, {
        where: { id, tenantId },
      });
      if (!version) {
        throw new NotFoundException(
          `Workflow version with id "${id}" not found`,
        );
      }
      return this.toResponse(version);
    });
  }

  private toResponse(
    entity: WorkflowVersionEntity,
  ): WorkflowVersionResponseDto {
    const dto = new WorkflowVersionResponseDto();
    dto.id = entity.id;
    dto.tenantId = entity.tenantId;
    dto.templateId = entity.templateId;
    dto.versionNumber = entity.versionNumber;
    dto.definition = entity.definition;
    dto.createdBy = entity.createdBy;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
