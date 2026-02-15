import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmModelEntity, LlmProviderConfigEntity } from '@project-bubble/db-layer';
import { LlmProviderConfigService } from '../../settings/llm-provider-config.service';
import { LLMProvider } from './llm.provider';
import { ProviderRegistry } from './provider-registry.service';

interface CachedProvider {
  provider: LLMProvider;
  cachedAt: Date;
}

/**
 * LlmProviderFactory — dynamically resolves LLM providers at runtime.
 *
 * Flow: modelUuid → LlmModelEntity → providerKey → credentials → LLMProvider instance.
 * Provider instances are cached per providerKey:modelId. Cache is invalidated when config.updatedAt > cachedAt.
 * Provider creation is delegated to ProviderRegistry (replaces switch statement).
 */
@Injectable()
export class LlmProviderFactory {
  private readonly logger = new Logger(LlmProviderFactory.name);
  private readonly cache = new Map<string, CachedProvider>();

  constructor(
    @InjectRepository(LlmModelEntity)
    private readonly modelRepo: Repository<LlmModelEntity>,
    @InjectRepository(LlmProviderConfigEntity)
    private readonly providerConfigRepo: Repository<LlmProviderConfigEntity>,
    private readonly providerConfigService: LlmProviderConfigService,
    private readonly providerRegistry: ProviderRegistry,
  ) {}

  /**
   * Resolve an LLM provider from a model UUID.
   * Returns the provider instance and the model entity (for modelId, contextWindow, etc.).
   */
  async getProvider(
    modelUuid: string,
  ): Promise<{ provider: LLMProvider; model: LlmModelEntity }> {
    // Step 1: Look up LlmModelEntity by UUID
    const model = await this.modelRepo.findOne({ where: { id: modelUuid } });
    if (!model) {
      throw new NotFoundException(
        `LLM model not found: ${modelUuid}`,
      );
    }
    if (!model.isActive) {
      throw new BadRequestException(
        `The configured model '${model.displayName}' is currently disabled by your administrator. Please contact your admin to re-enable it or select a different model.`,
      );
    }

    // Step 2: Look up provider config by providerKey
    const providerConfig = await this.providerConfigRepo.findOne({
      where: { providerKey: model.providerKey },
    });
    if (!providerConfig) {
      throw new NotFoundException(
        `LLM provider config not found for key: ${model.providerKey}`,
      );
    }
    if (!providerConfig.isActive) {
      throw new BadRequestException(
        `The configured model '${model.displayName}' is currently disabled by your administrator. Please contact your admin to re-enable it or select a different model.`,
      );
    }

    // Step 3: Check cache — keyed by providerKey:modelId to avoid cross-model collision
    // (e.g., gemini-1.5-pro and gemini-2.0-flash both under google-ai-studio)
    const cacheKey = `${model.providerKey}:${model.modelId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && providerConfig.updatedAt <= cached.cachedAt) {
      return { provider: cached.provider, model };
    }

    // Step 4: Get credentials and build provider via registry
    const credentials = await this.providerConfigService.getDecryptedCredentials(
      model.providerKey,
    );

    const registryEntry = this.providerRegistry.get(model.providerKey);
    if (!registryEntry) {
      throw new BadRequestException(
        `Unknown provider key: ${model.providerKey}`,
      );
    }
    const provider = registryEntry.createProvider(model.modelId, credentials);

    // Step 5: Cache the provider (keyed by providerKey:modelId)
    this.cache.set(cacheKey, {
      provider,
      cachedAt: new Date(),
    });

    this.logger.log({
      message: 'LLM provider resolved',
      providerKey: model.providerKey,
      modelId: model.modelId,
      modelUuid,
    });

    return { provider, model };
  }
}
