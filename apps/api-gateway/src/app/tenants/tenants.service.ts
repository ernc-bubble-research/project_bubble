import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import {
  TenantEntity,
  TenantStatus,
  UserEntity,
  FolderEntity,
  AssetEntity,
  WorkflowTemplateEntity,
  WorkflowVersionEntity,
  WorkflowChainEntity,
  WorkflowRunEntity,
  KnowledgeChunkEntity,
  InvitationEntity,
} from '@project-bubble/db-layer';
import {
  CreateTenantDto,
  ImpersonateResponseDto,
  UpdateTenantDto,
} from '@project-bubble/shared';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateTenantDto): Promise<TenantEntity> {
    const existing = await this.tenantRepo.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Tenant with name "${dto.name}" already exists`,
      );
    }
    const tenant = this.tenantRepo.create(dto);
    try {
      return await this.tenantRepo.save(tenant);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          `Tenant with name "${dto.name}" already exists`,
        );
      }
      throw error;
    }
  }

  async findAll(): Promise<TenantEntity[]> {
    return this.tenantRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<TenantEntity> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with id "${id}" not found`);
    }
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto): Promise<TenantEntity> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with id "${id}" not found`);
    }
    Object.assign(tenant, dto);
    return this.tenantRepo.save(tenant);
  }

  async impersonate(tenantId: string, adminId?: string): Promise<ImpersonateResponseDto> {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant with id "${tenantId}" not found`);
    }
    if (tenant.status === TenantStatus.SUSPENDED) {
      throw new BadRequestException(
        'Cannot impersonate a suspended tenant',
      );
    }
    if (tenant.status === TenantStatus.ARCHIVED) {
      throw new BadRequestException(
        'Cannot impersonate an archived tenant',
      );
    }

    this.logger.warn(
      `IMPERSONATION: Admin ${adminId || 'unknown'} impersonated tenant ${tenantId} at ${new Date().toISOString()}`,
    );

    const token = this.jwtService.sign(
      {
        sub: 'admin',
        tenant_id: tenantId,
        role: 'impersonator',
        impersonating: true,
      },
      { expiresIn: '60m' },
    );

    return { token, tenant: { id: tenant.id, name: tenant.name } };
  }

  async archive(id: string): Promise<TenantEntity> {
    const tenant = await this.findOne(id);
    if (tenant.status === TenantStatus.ARCHIVED) {
      throw new BadRequestException('Tenant is already archived');
    }
    if (tenant.status !== TenantStatus.ACTIVE && tenant.status !== TenantStatus.SUSPENDED) {
      throw new BadRequestException(
        `Cannot archive tenant with status "${tenant.status}". Must be active or suspended.`,
      );
    }
    tenant.status = TenantStatus.ARCHIVED;
    this.logger.warn(
      `ARCHIVE: Tenant ${id} ("${tenant.name}") archived at ${new Date().toISOString()}`,
    );
    return this.tenantRepo.save(tenant);
  }

  async unarchive(id: string): Promise<TenantEntity> {
    const tenant = await this.findOne(id);
    if (tenant.status !== TenantStatus.ARCHIVED) {
      throw new BadRequestException(
        `Cannot unarchive tenant with status "${tenant.status}". Must be archived.`,
      );
    }
    tenant.status = TenantStatus.ACTIVE;
    this.logger.warn(
      `UNARCHIVE: Tenant ${id} ("${tenant.name}") restored to active at ${new Date().toISOString()}`,
    );
    return this.tenantRepo.save(tenant);
  }

  async hardDelete(id: string): Promise<void> {
    const tenant = await this.findOne(id);
    if (tenant.status !== TenantStatus.ARCHIVED) {
      throw new BadRequestException(
        `Cannot delete tenant with status "${tenant.status}". Must be archived first.`,
      );
    }

    this.logger.warn(
      `HARD DELETE: Starting permanent deletion of tenant ${id} ("${tenant.name}") at ${new Date().toISOString()}`,
    );

    // Execute all DB deletions in a single transaction
    await this.dataSource.transaction(async (manager) => {
      // 1. Invitations (no FK dependencies)
      await manager.delete(InvitationEntity, { tenantId: id });

      // 2. Workflow runs (nullable FKs to version/chain)
      await manager.delete(WorkflowRunEntity, { tenantId: id });

      // 3. Workflow chains (include soft-deleted)
      await manager.createQueryBuilder()
        .delete()
        .from(WorkflowChainEntity)
        .where('tenant_id = :id', { id })
        .execute();

      // 4. Workflow versions (FK to template with CASCADE, but delete explicitly)
      await manager.delete(WorkflowVersionEntity, { tenantId: id });

      // 5. Workflow templates (include soft-deleted)
      await manager.createQueryBuilder()
        .delete()
        .from(WorkflowTemplateEntity)
        .where('tenant_id = :id', { id })
        .execute();

      // 6. Knowledge chunks (include soft-deleted via manual deleted_at)
      await manager.createQueryBuilder()
        .delete()
        .from(KnowledgeChunkEntity)
        .where('tenant_id = :id', { id })
        .execute();

      // 7. Assets
      await manager.delete(AssetEntity, { tenantId: id });

      // 8. Folders (self-referential parentId — delete all at once)
      await manager.delete(FolderEntity, { tenantId: id });

      // 9. Users (last — referenced by createdBy/uploadedBy but no enforced FKs)
      await manager.delete(UserEntity, { tenantId: id });

      // 10. Tenant itself
      await manager.delete(TenantEntity, { id });
    });

    // 11. Delete physical files AFTER successful DB transaction
    const uploadsDir = path.join(process.cwd(), 'uploads', id);
    try {
      await fs.rm(uploadsDir, { recursive: true, force: true });
    } catch (err) {
      // File deletion failure after DB commit is acceptable — data is already gone from DB
      this.logger.warn(
        `HARD DELETE: Failed to delete upload directory for tenant ${id}: ${err}`,
      );
    }

    this.logger.warn(
      `HARD DELETE: Tenant ${id} ("${tenant.name}") permanently deleted at ${new Date().toISOString()}`,
    );
  }
}
