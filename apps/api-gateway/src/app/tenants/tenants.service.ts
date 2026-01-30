import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { TenantEntity } from '@project-bubble/db-layer';
import { CreateTenantDto } from '@project-bubble/shared';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
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
}
