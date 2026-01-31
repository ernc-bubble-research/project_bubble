import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { QueryFailedError, Repository } from 'typeorm';
import { TenantEntity, TenantStatus } from '@project-bubble/db-layer';
import {
  CreateTenantDto,
  ImpersonateResponseDto,
  UpdateTenantDto,
} from '@project-bubble/shared';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
    private readonly jwtService: JwtService,
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
}
