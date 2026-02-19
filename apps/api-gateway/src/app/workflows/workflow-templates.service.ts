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
    [WorkflowTemplateStatus.PUBLISHED]: [WorkflowTemplateStatus.ARCHIVED, WorkflowTemplateStatus.DRAFT],
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
        creditsPerRun: dto.creditsPerRun ?? 1,
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
        withDeleted: false,
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
        withDeleted: false,
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
      if (dto.creditsPerRun !== undefined) {
        template.creditsPerRun = dto.creditsPerRun;
      }

      const updated = await manager.save(WorkflowTemplateEntity, template);
      return this.toResponse(updated);
    });
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    return this.txManager.run(tenantId, async (manager) => {
      const template = await manager.findOne(WorkflowTemplateEntity, {
        where: { id, tenantId },
        withDeleted: false,
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
        withDeleted: false,
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
        withDeleted: false,
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

  /**
   * Catalog endpoint: find a single published template by ID, with visibility check.
   * This is a documented Rule 2c exception — no tenantId in WHERE because templates
   * are created by bubble_admin and shared with tenants via catalog.
   * Visibility is enforced in application code: PRIVATE templates check allowedTenants.
   *
   * KEEP IN SYNC with findPublishedOneEntity() below — same visibility logic,
   * different return type (DTO vs raw entities). If visibility rules change, update BOTH.
   */
  async findPublishedOne(
    id: string,
    requestingTenantId: string,
  ): Promise<WorkflowTemplateResponseDto> {
    return this.txManager.run(requestingTenantId, async (manager) => {
      // Rule 2c exception: no tenantId in WHERE — admin-created templates are cross-tenant.
      const template = await manager.findOne(WorkflowTemplateEntity, {
        where: { id, status: WorkflowTemplateStatus.PUBLISHED },
        withDeleted: false,
      });

      if (!template) {
        throw new NotFoundException(
          `Published workflow template with id "${id}" not found`,
        );
      }

      // Visibility check: PRIVATE templates restricted to allowedTenants
      if (
        template.visibility === WorkflowVisibility.PRIVATE &&
        (!template.allowedTenants || !template.allowedTenants.includes(requestingTenantId))
      ) {
        throw new NotFoundException(
          `Published workflow template with id "${id}" not found`,
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

  /**
   * Entity version of findPublishedOne — returns raw entities instead of DTOs.
   * Used by WorkflowRunsService.initiateRun() which needs the raw entities for
   * credit check, BullMQ payload, etc.
   *
   * Documented Rule 2c exception — same visibility logic as findPublishedOne().
   * KEEP IN SYNC with findPublishedOne() above — same visibility logic,
   * different return type (raw entities vs DTO). If visibility rules change, update BOTH.
   */
  async findPublishedOneEntity(
    id: string,
    requestingTenantId: string,
  ): Promise<{ template: WorkflowTemplateEntity; version: WorkflowVersionEntity }> {
    return this.txManager.run(requestingTenantId, async (manager) => {
      // Rule 2c exception: no tenantId in WHERE — admin-created templates are cross-tenant.
      const template = await manager.findOne(WorkflowTemplateEntity, {
        where: { id, status: WorkflowTemplateStatus.PUBLISHED },
        withDeleted: false,
      });

      if (!template) {
        throw new NotFoundException(
          `Published workflow template with id "${id}" not found`,
        );
      }

      // Visibility check: PRIVATE templates restricted to allowedTenants
      if (
        template.visibility === WorkflowVisibility.PRIVATE &&
        (!template.allowedTenants || !template.allowedTenants.includes(requestingTenantId))
      ) {
        throw new NotFoundException(
          `Published workflow template with id "${id}" not found`,
        );
      }

      if (!template.currentVersionId) {
        throw new BadRequestException(
          'Template does not have a published version',
        );
      }

      const version = await manager.findOne(WorkflowVersionEntity, {
        where: { id: template.currentVersionId },
      });
      if (!version) {
        throw new BadRequestException(
          'Template version not found',
        );
      }

      return { template, version };
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
        // Visibility filter: public templates visible to all,
        // private templates only visible if requesting tenant is in allowed_tenants.
        .andWhere(
          '(template.visibility = :publicVis OR :tenantId = ANY(template.allowed_tenants))',
          {
            publicVis: WorkflowVisibility.PUBLIC,
            tenantId,
          },
        )
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
        // Visibility filter: same as findPublished
        .andWhere(
          '(template.visibility = :publicVis OR :tenantId = ANY(template.allowed_tenants))',
          {
            publicVis: WorkflowVisibility.PUBLIC,
            tenantId,
          },
        )
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
    dto.creditsPerRun = entity.creditsPerRun;
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
      versionDto.previousGenerationConfig = currentVersion.previousGenerationConfig ?? null;
      versionDto.createdBy = currentVersion.createdBy;
      versionDto.createdAt = currentVersion.createdAt;
      dto.currentVersion = versionDto;
    }

    return dto;
  }
}
