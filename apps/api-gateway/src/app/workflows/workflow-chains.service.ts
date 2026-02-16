import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  WorkflowChainEntity,
  WorkflowChainStatus,
  WorkflowVisibility,
  WorkflowTemplateEntity,
  WorkflowTemplateStatus,
  TransactionManager,
} from '@project-bubble/db-layer';
import {
  CreateWorkflowChainDto,
  UpdateWorkflowChainDto,
  WorkflowChainResponseDto,
  validateChainSchema,
  ChainDefinition,
  ChainStep,
} from '@project-bubble/shared';

export interface ListWorkflowChainsQuery {
  limit?: number;
  offset?: number;
  status?: string;
  visibility?: string;
}

@Injectable()
export class WorkflowChainsService {
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

  async create(
    dto: CreateWorkflowChainDto,
    tenantId: string,
    userId: string,
  ): Promise<WorkflowChainResponseDto> {
    // Schema validation
    const definition = dto.definition as unknown as ChainDefinition;
    const schemaResult = validateChainSchema(definition);
    if (!schemaResult.valid) {
      throw new BadRequestException(
        `Invalid chain definition: ${schemaResult.errors.join('; ')}`,
      );
    }

    return this.txManager.run(tenantId, async (manager) => {
      // Semantic validation - verify all referenced workflows exist and are accessible
      await this.validateReferencedWorkflows(definition.steps, tenantId, manager);

      const chain = manager.create(WorkflowChainEntity, {
        tenantId,
        name: dto.name,
        description: dto.description ?? null,
        definition: dto.definition,
        visibility: dto.visibility
          ? this.parseVisibility(dto.visibility)
          : WorkflowVisibility.PUBLIC,
        allowedTenants: dto.allowedTenants ?? null,
        status: WorkflowChainStatus.DRAFT,
        createdBy: userId,
      });

      const saved = await manager.save(WorkflowChainEntity, chain);
      return this.toResponse(saved);
    });
  }

  async findAll(
    tenantId: string,
    query: ListWorkflowChainsQuery,
  ): Promise<WorkflowChainResponseDto[]> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    return this.txManager.run(tenantId, async (manager) => {
      const qb = manager
        .createQueryBuilder(WorkflowChainEntity, 'chain')
        .andWhere('chain.deleted_at IS NULL')
        .take(limit)
        .skip(offset)
        .orderBy('chain.created_at', 'DESC');

      if (query.status) {
        qb.andWhere('chain.status = :status', { status: query.status });
      }
      if (query.visibility) {
        qb.andWhere('chain.visibility = :visibility', {
          visibility: query.visibility,
        });
      }

      const chains = await qb.getMany();
      return chains.map((c) => this.toResponse(c));
    });
  }

  async findOne(
    id: string,
    tenantId: string,
  ): Promise<WorkflowChainResponseDto> {
    return this.txManager.run(tenantId, async (manager) => {
      // Defense-in-depth: include tenantId in WHERE clause
      const chain = await manager.findOne(WorkflowChainEntity, {
        where: { id, tenantId },
        withDeleted: false,
      });
      if (!chain) {
        throw new NotFoundException(
          `Workflow chain with id "${id}" not found`,
        );
      }

      return this.toResponse(chain);
    });
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateWorkflowChainDto,
  ): Promise<WorkflowChainResponseDto> {
    return this.txManager.run(tenantId, async (manager) => {
      // Defense-in-depth: include tenantId in WHERE clause
      const chain = await manager.findOne(WorkflowChainEntity, {
        where: { id, tenantId },
        withDeleted: false,
      });
      if (!chain) {
        throw new NotFoundException(
          `Workflow chain with id "${id}" not found`,
        );
      }

      // Enforce draft-only updates
      if (chain.status !== WorkflowChainStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot update chain with status "${chain.status}". Only draft chains can be updated.`,
        );
      }

      // If definition is being updated, validate it
      if (dto.definition !== undefined) {
        const definition = dto.definition as unknown as ChainDefinition;
        const schemaResult = validateChainSchema(definition);
        if (!schemaResult.valid) {
          throw new BadRequestException(
            `Invalid chain definition: ${schemaResult.errors.join('; ')}`,
          );
        }
        // Semantic validation
        await this.validateReferencedWorkflows(definition.steps, tenantId, manager);
        chain.definition = dto.definition;
      }

      if (dto.name !== undefined) {
        chain.name = dto.name;
      }
      if (dto.description !== undefined) {
        chain.description = dto.description;
      }
      if (dto.visibility !== undefined) {
        chain.visibility = this.parseVisibility(dto.visibility);
      }
      if (dto.allowedTenants !== undefined) {
        chain.allowedTenants = dto.allowedTenants;
      }

      const updated = await manager.save(WorkflowChainEntity, chain);
      return this.toResponse(updated);
    });
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    return this.txManager.run(tenantId, async (manager) => {
      // Defense-in-depth: include tenantId in WHERE clause
      const chain = await manager.findOne(WorkflowChainEntity, {
        where: { id, tenantId },
        withDeleted: false,
      });
      if (!chain) {
        throw new NotFoundException(
          `Workflow chain with id "${id}" not found`,
        );
      }

      await manager.softDelete(WorkflowChainEntity, { id, tenantId });
    });
  }

  async restore(
    id: string,
    tenantId: string,
  ): Promise<WorkflowChainResponseDto> {
    return this.txManager.run(tenantId, async (manager) => {
      // Defense-in-depth: include tenantId in WHERE clause
      const chain = await manager.findOne(WorkflowChainEntity, {
        where: { id, tenantId },
        withDeleted: true,
      });
      if (!chain) {
        throw new NotFoundException(
          `Workflow chain with id "${id}" not found`,
        );
      }

      // Verify chain is actually soft-deleted
      if (!chain.deletedAt) {
        throw new BadRequestException(
          `Workflow chain with id "${id}" is not deleted and cannot be restored`,
        );
      }

      await manager.restore(WorkflowChainEntity, { id, tenantId });

      chain.deletedAt = null;
      return this.toResponse(chain);
    });
  }

  async publish(
    id: string,
    tenantId: string,
  ): Promise<WorkflowChainResponseDto> {
    return this.txManager.run(tenantId, async (manager) => {
      // Defense-in-depth: include tenantId in WHERE clause
      const chain = await manager.findOne(WorkflowChainEntity, {
        where: { id, tenantId },
        withDeleted: false,
      });
      if (!chain) {
        throw new NotFoundException(
          `Workflow chain with id "${id}" not found`,
        );
      }

      if (chain.status !== WorkflowChainStatus.DRAFT) {
        throw new BadRequestException(
          `Only draft chains can be published. Current status: "${chain.status}"`,
        );
      }

      // Validate definition has at least 2 steps
      const definition = chain.definition as unknown as ChainDefinition;
      if (!definition.steps || definition.steps.length < 2) {
        throw new BadRequestException(
          `Cannot publish chain without at least 2 steps. Found: ${definition.steps?.length ?? 0}`,
        );
      }

      // Re-validate referenced workflows at publish time
      await this.validateReferencedWorkflows(definition.steps, tenantId, manager);

      chain.status = WorkflowChainStatus.PUBLISHED;
      const saved = await manager.save(WorkflowChainEntity, chain);
      return this.toResponse(saved);
    });
  }

  /**
   * Semantic validation: verify all referenced workflow templates exist,
   * are published, and are accessible to the tenant.
   *
   * Note: We query without tenantId to allow chains to reference public templates
   * from other tenants. RLS policy handles visibility at DB level.
   * For templates owned by current tenant, defense-in-depth is still provided
   * by the RLS policy's tenant_id check.
   */
  private async validateReferencedWorkflows(
    steps: ChainStep[],
    tenantId: string,
    manager: Parameters<Parameters<TransactionManager['run']>[1]>[0],
  ): Promise<void> {
    const workflowIds = steps.map((s) => s.workflow_id);

    for (const workflowId of workflowIds) {
      // RLS policy allows: tenant's own templates + public templates + templates where tenant is in allowedTenants
      // We rely on RLS for cross-tenant visibility of public templates
      const template = await manager.findOne(WorkflowTemplateEntity, {
        where: { id: workflowId },
        withDeleted: false,
      });

      if (!template) {
        throw new BadRequestException(
          `Referenced workflow template "${workflowId}" not found or not accessible`,
        );
      }

      if (template.status !== WorkflowTemplateStatus.PUBLISHED) {
        throw new BadRequestException(
          `Referenced workflow template "${workflowId}" is not published (status: ${template.status}). Only published templates can be used in chains.`,
        );
      }
    }
  }

  private toResponse(entity: WorkflowChainEntity): WorkflowChainResponseDto {
    const dto = new WorkflowChainResponseDto();
    dto.id = entity.id;
    dto.tenantId = entity.tenantId;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.visibility = entity.visibility;
    dto.allowedTenants = entity.allowedTenants;
    dto.definition = entity.definition;
    dto.status = entity.status;
    dto.createdBy = entity.createdBy;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
