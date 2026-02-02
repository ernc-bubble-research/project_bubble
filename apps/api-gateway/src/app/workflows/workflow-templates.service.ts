import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  WorkflowTemplateEntity,
  WorkflowTemplateStatus,
  WorkflowVisibility,
  WorkflowVersionEntity,
  TransactionManager,
} from '@project-bubble/db-layer';
import {
  CreateWorkflowTemplateDto,
  UpdateWorkflowTemplateDto,
  WorkflowTemplateResponseDto,
  WorkflowVersionResponseDto,
} from '@project-bubble/shared';

export interface ListWorkflowTemplatesQuery {
  limit?: number;
  offset?: number;
  status?: string;
  visibility?: string;
}

@Injectable()
export class WorkflowTemplatesService {
  constructor(private readonly txManager: TransactionManager) {}

  private parseVisibility(value: string): WorkflowVisibility {
    const enumValues = Object.values(WorkflowVisibility) as string[];
    if (!enumValues.includes(value)) {
      throw new BadRequestException(
        `Invalid visibility "${value}". Must be one of: ${enumValues.join(', ')}`,
      );
    }
    return value as WorkflowVisibility;
  }

  private parseStatus(value: string): WorkflowTemplateStatus {
    const enumValues = Object.values(WorkflowTemplateStatus) as string[];
    if (!enumValues.includes(value)) {
      throw new BadRequestException(
        `Invalid status "${value}". Must be one of: ${enumValues.join(', ')}`,
      );
    }
    return value as WorkflowTemplateStatus;
  }

  private static readonly VALID_TRANSITIONS: Record<WorkflowTemplateStatus, WorkflowTemplateStatus[]> = {
    [WorkflowTemplateStatus.DRAFT]: [WorkflowTemplateStatus.PUBLISHED],
    [WorkflowTemplateStatus.PUBLISHED]: [WorkflowTemplateStatus.ARCHIVED],
    [WorkflowTemplateStatus.ARCHIVED]: [WorkflowTemplateStatus.DRAFT],
  };

  private validateStatusTransition(
    currentStatus: WorkflowTemplateStatus,
    newStatus: WorkflowTemplateStatus,
  ): void {
    const allowed = WorkflowTemplatesService.VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from "${currentStatus}" to "${newStatus}". Valid transitions from "${currentStatus}": ${allowed?.join(', ') ?? 'none'}`,
      );
    }
  }

  async create(
    dto: CreateWorkflowTemplateDto,
    tenantId: string,
    userId: string,
  ): Promise<WorkflowTemplateResponseDto> {
    return this.txManager.run(tenantId, async (manager) => {
      const template = manager.create(WorkflowTemplateEntity, {
        tenantId,
        name: dto.name,
        description: dto.description ?? null,
        visibility: dto.visibility
          ? this.parseVisibility(dto.visibility)
          : WorkflowVisibility.PUBLIC,
        status: WorkflowTemplateStatus.DRAFT,
        createdBy: userId,
      });

      const saved = await manager.save(WorkflowTemplateEntity, template);
      return this.toResponse(saved);
    });
  }

  async findAll(
    tenantId: string,
    query: ListWorkflowTemplatesQuery,
  ): Promise<WorkflowTemplateResponseDto[]> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    return this.txManager.run(tenantId, async (manager) => {
      const qb = manager
        .createQueryBuilder(WorkflowTemplateEntity, 'wt')
        .andWhere('wt.deleted_at IS NULL')
        .take(limit)
        .skip(offset)
        .orderBy('wt.created_at', 'DESC');

      if (query.status) {
        qb.andWhere('wt.status = :status', { status: query.status });
      }
      if (query.visibility) {
        qb.andWhere('wt.visibility = :visibility', {
          visibility: query.visibility,
        });
      }

      const templates = await qb.getMany();
      return templates.map((t) => this.toResponse(t));
    });
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<WorkflowTemplateResponseDto> {
    return this.txManager.run(tenantId, async (manager) => {
      const template = await manager.findOne(WorkflowTemplateEntity, {
        where: { id, tenantId },
      });
      if (!template) {
        throw new NotFoundException(
          `Workflow template with id "${id}" not found`,
        );
      }

      // Load current version if exists
      let currentVersion: WorkflowVersionEntity | null = null;
      if (template.currentVersionId) {
        currentVersion = await manager.findOne(WorkflowVersionEntity, {
          where: { id: template.currentVersionId },
        });
      }

      return this.toResponse(template, currentVersion ?? undefined);
    });
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateWorkflowTemplateDto,
  ): Promise<WorkflowTemplateResponseDto> {
    return this.txManager.run(tenantId, async (manager) => {
      const template = await manager.findOne(WorkflowTemplateEntity, {
        where: { id, tenantId },
      });
      if (!template) {
        throw new NotFoundException(
          `Workflow template with id "${id}" not found`,
        );
      }

      if (dto.name !== undefined) {
        template.name = dto.name;
      }
      if (dto.description !== undefined) {
        template.description = dto.description;
      }
      if (dto.status !== undefined) {
        const newStatus = this.parseStatus(dto.status);
        this.validateStatusTransition(template.status, newStatus);
        if (newStatus === WorkflowTemplateStatus.PUBLISHED && !template.currentVersionId) {
          throw new BadRequestException('Cannot publish template without a version.');
        }
        template.status = newStatus;
      }
      if (dto.visibility !== undefined) {
        template.visibility = this.parseVisibility(dto.visibility);
        // Auto-clear allowedTenants when setting visibility to public
        if (template.visibility === WorkflowVisibility.PUBLIC) {
          template.allowedTenants = null;
        }
      }
      if (dto.allowedTenants !== undefined && template.visibility !== WorkflowVisibility.PUBLIC) {
        template.allowedTenants = dto.allowedTenants ?? null;
      }

      const updated = await manager.save(WorkflowTemplateEntity, template);
      return this.toResponse(updated);
    });
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    return this.txManager.run(tenantId, async (manager) => {
      const template = await manager.findOne(WorkflowTemplateEntity, {
        where: { id, tenantId },
      });
      if (!template) {
        throw new NotFoundException(
          `Workflow template with id "${id}" not found`,
        );
      }

      await manager.softDelete(WorkflowTemplateEntity, { id, tenantId });
    });
  }

  async restore(
    id: string,
    tenantId: string,
  ): Promise<WorkflowTemplateResponseDto> {
    return this.txManager.run(tenantId, async (manager) => {
      const template = await manager.findOne(WorkflowTemplateEntity, {
        where: { id, tenantId },
        withDeleted: true,
      });
      if (!template) {
        throw new NotFoundException(
          `Workflow template with id "${id}" not found`,
        );
      }

      await manager.restore(WorkflowTemplateEntity, { id, tenantId });

      template.deletedAt = null;
      return this.toResponse(template);
    });
  }

  async publish(
    id: string,
    tenantId: string,
    versionId?: string,
  ): Promise<WorkflowTemplateResponseDto> {
    return this.txManager.run(tenantId, async (manager) => {
      const template = await manager.findOne(WorkflowTemplateEntity, {
        where: { id, tenantId },
      });
      if (!template) {
        throw new NotFoundException(
          `Workflow template with id "${id}" not found`,
        );
      }

      if (
        template.status !== WorkflowTemplateStatus.DRAFT &&
        template.status !== WorkflowTemplateStatus.PUBLISHED
      ) {
        throw new BadRequestException(
          'Only draft or published templates can be published.',
        );
      }

      if (versionId) {
        const version = await manager.findOne(WorkflowVersionEntity, {
          where: { id: versionId, templateId: id, tenantId },
        });
        if (!version) {
          throw new NotFoundException(
            'Version not found for this template.',
          );
        }
        template.currentVersionId = versionId;
      } else if (!template.currentVersionId) {
        throw new BadRequestException(
          'Cannot publish template without a version.',
        );
      }

      template.status = WorkflowTemplateStatus.PUBLISHED;
      const saved = await manager.save(WorkflowTemplateEntity, template);

      let currentVersion: WorkflowVersionEntity | null = null;
      if (saved.currentVersionId) {
        currentVersion = await manager.findOne(WorkflowVersionEntity, {
          where: { id: saved.currentVersionId },
        });
      }
      return this.toResponse(saved, currentVersion ?? undefined);
    });
  }

  async rollback(
    id: string,
    tenantId: string,
    versionId: string,
  ): Promise<WorkflowTemplateResponseDto> {
    return this.txManager.run(tenantId, async (manager) => {
      const template = await manager.findOne(WorkflowTemplateEntity, {
        where: { id, tenantId },
      });
      if (!template) {
        throw new NotFoundException(
          `Workflow template with id "${id}" not found`,
        );
      }

      if (template.status !== WorkflowTemplateStatus.PUBLISHED) {
        throw new BadRequestException(
          'Only published templates can be rolled back.',
        );
      }

      const version = await manager.findOne(WorkflowVersionEntity, {
        where: { id: versionId, templateId: id, tenantId },
      });
      if (!version) {
        throw new NotFoundException(
          'Version not found for this template.',
        );
      }

      // Skip no-op save if already pointing to this version
      if (template.currentVersionId === versionId) {
        return this.toResponse(template, version);
      }

      template.currentVersionId = versionId;
      const saved = await manager.save(WorkflowTemplateEntity, template);
      return this.toResponse(saved, version);
    });
  }

  async findPublished(
    tenantId: string,
    query: Pick<ListWorkflowTemplatesQuery, 'limit' | 'offset'>,
  ): Promise<WorkflowTemplateResponseDto[]> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    return this.txManager.run(tenantId, async (manager) => {
      const qb = manager
        .createQueryBuilder(WorkflowTemplateEntity, 'template')
        .andWhere('template.status = :status', {
          status: WorkflowTemplateStatus.PUBLISHED,
        })
        .andWhere('template.deleted_at IS NULL')
        .take(limit)
        .skip(offset)
        .orderBy('template.updated_at', 'DESC');

      const templates = await qb.getMany();
      return templates.map((t) => this.toResponse(t));
    });
  }

  async findAccessibleByTenant(
    tenantId: string,
  ): Promise<WorkflowTemplateResponseDto[]> {
    return this.txManager.run(tenantId, async (manager) => {
      const qb = manager
        .createQueryBuilder(WorkflowTemplateEntity, 'template')
        .andWhere('template.status = :status', {
          status: WorkflowTemplateStatus.PUBLISHED,
        })
        .andWhere('template.deleted_at IS NULL')
        .take(200)
        .orderBy('template.name', 'ASC');

      const templates = await qb.getMany();
      return templates.map((t) => this.toResponse(t));
    });
  }

  private toResponse(
    entity: WorkflowTemplateEntity,
    currentVersion?: WorkflowVersionEntity,
  ): WorkflowTemplateResponseDto {
    const dto = new WorkflowTemplateResponseDto();
    dto.id = entity.id;
    dto.tenantId = entity.tenantId;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.visibility = entity.visibility;
    dto.allowedTenants = entity.allowedTenants;
    dto.status = entity.status;
    dto.currentVersionId = entity.currentVersionId;
    dto.createdBy = entity.createdBy;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;

    if (currentVersion) {
      const versionDto = new WorkflowVersionResponseDto();
      versionDto.id = currentVersion.id;
      versionDto.tenantId = currentVersion.tenantId;
      versionDto.templateId = currentVersion.templateId;
      versionDto.versionNumber = currentVersion.versionNumber;
      versionDto.definition = currentVersion.definition;
      versionDto.createdBy = currentVersion.createdBy;
      versionDto.createdAt = currentVersion.createdAt;
      dto.currentVersion = versionDto;
    }

    return dto;
  }
}
