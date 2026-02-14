import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmModelEntity } from '@project-bubble/db-layer';
import {
  CreateLlmModelDto,
  LlmModelResponseDto,
  BulkUpdateModelStatusDto,
} from '@project-bubble/shared';
import { UpdateLlmModelDto } from '@project-bubble/shared';
import { KNOWN_PROVIDER_KEYS } from '../common/provider-keys';

@Injectable()
export class LlmModelsService {
  constructor(
    @InjectRepository(LlmModelEntity)
    private readonly repo: Repository<LlmModelEntity>,
  ) {}

  async findAllActive(): Promise<LlmModelResponseDto[]> {
    const models = await this.repo.find({
      where: { isActive: true },
      order: { displayName: 'ASC' },
    });
    return models.map((m) => this.toResponse(m));
  }

  async findAll(): Promise<LlmModelResponseDto[]> {
    const models = await this.repo.find({
      order: { displayName: 'ASC' },
    });
    return models.map((m) => this.toResponse(m));
  }

  async create(dto: CreateLlmModelDto): Promise<LlmModelResponseDto> {
    this.validateProviderKey(dto.providerKey);

    try {
      const model = this.repo.create({
        providerKey: dto.providerKey,
        modelId: dto.modelId,
        displayName: dto.displayName,
        contextWindow: dto.contextWindow,
        maxOutputTokens: dto.maxOutputTokens,
        isActive: dto.isActive ?? false,
        costPer1kInput: dto.costPer1kInput ?? null,
        costPer1kOutput: dto.costPer1kOutput ?? null,
      });
      const saved = await this.repo.save(model);
      return this.toResponse(saved);
    } catch (error: unknown) {
      if (
        error instanceof Object &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        throw new ConflictException(
          `LLM model with provider "${dto.providerKey}" and model ID "${dto.modelId}" already exists`,
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateLlmModelDto,
  ): Promise<LlmModelResponseDto> {
    const model = await this.repo.findOne({ where: { id } });
    if (!model) {
      throw new NotFoundException(`LLM model with id "${id}" not found`);
    }

    if (dto.displayName !== undefined) {
      model.displayName = dto.displayName;
    }
    if (dto.contextWindow !== undefined) {
      model.contextWindow = dto.contextWindow;
    }
    if (dto.maxOutputTokens !== undefined) {
      model.maxOutputTokens = dto.maxOutputTokens;
    }
    if (dto.isActive !== undefined) {
      model.isActive = dto.isActive;
    }
    if (dto.costPer1kInput !== undefined) {
      model.costPer1kInput = dto.costPer1kInput ?? null;
    }
    if (dto.costPer1kOutput !== undefined) {
      model.costPer1kOutput = dto.costPer1kOutput ?? null;
    }

    const updated = await this.repo.save(model);
    return this.toResponse(updated);
  }

  async bulkUpdateStatus(dto: BulkUpdateModelStatusDto): Promise<{ affected: number }> {
    this.validateProviderKey(dto.providerKey);
    const result = await this.repo.update(
      { providerKey: dto.providerKey },
      { isActive: dto.isActive },
    );
    return { affected: result.affected ?? 0 };
  }

  private validateProviderKey(providerKey: string): void {
    if (
      !KNOWN_PROVIDER_KEYS.includes(
        providerKey as (typeof KNOWN_PROVIDER_KEYS)[number],
      )
    ) {
      throw new BadRequestException(
        `Unknown provider key "${providerKey}". Known providers: ${KNOWN_PROVIDER_KEYS.join(', ')}`,
      );
    }
  }

  private toResponse(entity: LlmModelEntity): LlmModelResponseDto {
    const dto = new LlmModelResponseDto();
    dto.id = entity.id;
    dto.providerKey = entity.providerKey;
    dto.modelId = entity.modelId;
    dto.displayName = entity.displayName;
    dto.contextWindow = entity.contextWindow;
    dto.maxOutputTokens = entity.maxOutputTokens;
    dto.isActive = entity.isActive;
    dto.costPer1kInput = entity.costPer1kInput;
    dto.costPer1kOutput = entity.costPer1kOutput;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
