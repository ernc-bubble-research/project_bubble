import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { LlmProviderConfigEntity } from '@project-bubble/db-layer';
import {
  CreateLlmProviderConfigDto,
  UpdateLlmProviderConfigDto,
  LlmProviderConfigResponseDto,
} from '@project-bubble/shared';
import { encrypt, decrypt, maskSecret } from '../common/crypto.util';
import { ProviderRegistry } from '../workflow-execution/llm/provider-registry.service';

@Injectable()
export class LlmProviderConfigService {
  private readonly logger = new Logger(LlmProviderConfigService.name);
  private readonly encryptionKey: string | undefined;

  constructor(
    @InjectRepository(LlmProviderConfigEntity)
    private readonly repo: Repository<LlmProviderConfigEntity>,
    private readonly configService: ConfigService,
    private readonly providerRegistry: ProviderRegistry,
  ) {
    this.encryptionKey = this.configService.get<string>(
      'SETTINGS_ENCRYPTION_KEY',
    );
  }

  private get hasEncryptionKey(): boolean {
    return !!this.encryptionKey;
  }

  async findById(id: string): Promise<LlmProviderConfigEntity> {
    const config = await this.repo.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`Provider config with id "${id}" not found`);
    }
    return config;
  }

  async findByProviderKey(providerKey: string): Promise<LlmProviderConfigEntity | null> {
    return this.repo.findOne({ where: { providerKey } });
  }

  async findAll(): Promise<LlmProviderConfigResponseDto[]> {
    const configs = await this.repo.find({
      order: { displayName: 'ASC' },
    });
    return configs.map((c) => this.toResponse(c));
  }

  async create(
    dto: CreateLlmProviderConfigDto,
  ): Promise<LlmProviderConfigResponseDto> {
    this.validateProviderKey(dto.providerKey);

    if (dto.credentials && Object.keys(dto.credentials).length > 0) {
      this.validateCredentialFields(dto.providerKey, dto.credentials);
      this.requireEncryptionKey();
    }

    try {
      const config = this.repo.create({
        providerKey: dto.providerKey,
        displayName: dto.displayName,
        encryptedCredentials: dto.credentials
          ? this.encryptCredentials(dto.credentials)
          : null,
        rateLimitRpm: dto.rateLimitRpm ?? null,
        isActive: true,
      });
      const saved = await this.repo.save(config);
      return this.toResponse(saved);
    } catch (error: unknown) {
      if (
        error instanceof Object &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        throw new ConflictException(
          `Provider config for "${dto.providerKey}" already exists`,
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateLlmProviderConfigDto,
  ): Promise<LlmProviderConfigResponseDto> {
    const config = await this.repo.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(
        `Provider config with id "${id}" not found`,
      );
    }

    if (dto.credentials && Object.keys(dto.credentials).length > 0) {
      this.validateCredentialFields(config.providerKey, dto.credentials);
      this.requireEncryptionKey();
      config.encryptedCredentials = this.encryptCredentials(dto.credentials);
    }

    if (dto.displayName !== undefined) {
      config.displayName = dto.displayName;
    }
    if (dto.isActive !== undefined) {
      config.isActive = dto.isActive;
    }
    if (dto.rateLimitRpm !== undefined) {
      config.rateLimitRpm = dto.rateLimitRpm;
    }

    const updated = await this.repo.save(config);
    return this.toResponse(updated);
  }

  /**
   * Internal method for execution engine (Epic 4).
   * Returns decrypted credentials for a given provider key.
   * Falls back to env vars if no DB config exists or encryption key is missing.
   */
  async getDecryptedCredentials(
    providerKey: string,
  ): Promise<Record<string, string>> {
    const config = await this.repo.findOne({ where: { providerKey } });

    if (config?.encryptedCredentials) {
      if (this.hasEncryptionKey) {
        try {
          const decrypted = decrypt(
            config.encryptedCredentials,
            this.encryptionKey!,
          );
          return JSON.parse(decrypted);
        } catch (error) {
          this.logger.warn(
            `Failed to decrypt credentials for provider "${providerKey}". Falling back to env vars.`,
          );
        }
      } else {
        this.logger.warn(
          `SETTINGS_ENCRYPTION_KEY not configured. Cannot decrypt credentials for "${providerKey}". Falling back to env vars.`,
        );
      }
    }

    // Fallback to env vars
    return this.getEnvVarFallback(providerKey);
  }

  private validateProviderKey(providerKey: string): void {
    const knownKeys = this.providerRegistry.getKnownKeys();
    if (!knownKeys.includes(providerKey)) {
      throw new BadRequestException(
        `Unknown provider key "${providerKey}". Known providers: ${knownKeys.join(', ')}`,
      );
    }
  }

  private validateCredentialFields(
    providerKey: string,
    credentials: Record<string, string>,
  ): void {
    // Validate all credential values are strings (defense-in-depth — DTO @IsObject
    // only checks top-level type, not individual value types)
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value !== 'string') {
        throw new BadRequestException(
          `Credential field "${key}" must be a string, received ${typeof value}`,
        );
      }
    }

    const schema = this.providerRegistry.getCredentialSchema(providerKey);
    const requiredFields = schema
      .filter((f) => f.required)
      .map((f) => f.key);
    const missingFields = requiredFields.filter(
      (field) => !credentials[field] || credentials[field].trim() === '',
    );
    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Missing required credential fields for "${providerKey}": ${missingFields.join(', ')}`,
      );
    }
  }

  private requireEncryptionKey(): void {
    if (!this.hasEncryptionKey) {
      throw new BadRequestException(
        'Cannot store credentials: SETTINGS_ENCRYPTION_KEY is not configured. Please contact your administrator.',
      );
    }
  }

  private encryptCredentials(credentials: Record<string, string>): string {
    return encrypt(JSON.stringify(credentials), this.encryptionKey!);
  }

  private getEnvVarFallback(providerKey: string): Record<string, string> {
    const fallbackMap = this.providerRegistry.getEnvVarFallbacks(providerKey);
    if (!fallbackMap || Object.keys(fallbackMap).length === 0) {
      return {};
    }

    const result: Record<string, string> = {};
    for (const [credKey, envVar] of Object.entries(fallbackMap)) {
      const value = this.configService.get<string>(envVar);
      if (value) {
        result[credKey] = value;
      }
    }
    return result;
  }

  private toResponse(
    entity: LlmProviderConfigEntity,
  ): LlmProviderConfigResponseDto {
    const dto = new LlmProviderConfigResponseDto();
    dto.id = entity.id;
    dto.providerKey = entity.providerKey;
    dto.displayName = entity.displayName;
    dto.maskedCredentials = this.getMaskedCredentials(entity);
    dto.rateLimitRpm = entity.rateLimitRpm;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  private getMaskedCredentials(
    entity: LlmProviderConfigEntity,
  ): Record<string, string> | null {
    if (!entity.encryptedCredentials) {
      return null;
    }

    if (!this.hasEncryptionKey) {
      return { _status: 'encrypted (key not available)' };
    }

    try {
      const decrypted = decrypt(
        entity.encryptedCredentials,
        this.encryptionKey!,
      );
      const credentials = JSON.parse(decrypted) as Record<string, string>;
      const masked: Record<string, string> = {};
      for (const [key, value] of Object.entries(credentials)) {
        masked[key] = maskSecret(value);
      }
      return masked;
    } catch {
      return { _status: 'decryption failed' };
    }
  }
}
