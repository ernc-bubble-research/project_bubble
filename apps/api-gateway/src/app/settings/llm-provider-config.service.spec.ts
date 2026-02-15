import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { LlmProviderConfigEntity } from '@project-bubble/db-layer';
import { LlmProviderConfigService } from './llm-provider-config.service';
import { ProviderRegistry } from '../workflow-execution/llm/provider-registry.service';
import { encrypt } from '../common/crypto.util';
import { randomBytes } from 'crypto';

const TEST_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const mockConfig: LlmProviderConfigEntity = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  providerKey: 'google-ai-studio',
  displayName: 'Google AI Studio',
  encryptedCredentials: null,
  rateLimitRpm: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function buildConfigWithCredentials(
  overrides?: Partial<LlmProviderConfigEntity>,
): LlmProviderConfigEntity {
  const credentials = JSON.stringify({ apiKey: 'AIzaSyTest123456' });
  return {
    ...mockConfig,
    encryptedCredentials: encrypt(credentials, TEST_ENCRYPTION_KEY),
    ...overrides,
  };
}

describe('LlmProviderConfigService [P0]', () => {
  let service: LlmProviderConfigService;
  let repo: jest.Mocked<Repository<LlmProviderConfigEntity>>;
  let configService: jest.Mocked<ConfigService>;
  let providerRegistry: ProviderRegistry;

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<LlmProviderConfigEntity>>;

    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    configService.get.mockImplementation((key: string) => {
      if (key === 'SETTINGS_ENCRYPTION_KEY') return TEST_ENCRYPTION_KEY;
      return undefined;
    });

    // Use real ProviderRegistry (has zero deps, populated via onModuleInit)
    providerRegistry = new ProviderRegistry();
    providerRegistry.onModuleInit();

    service = new LlmProviderConfigService(repo, configService, providerRegistry);
  });

  describe('findAll', () => {
    it('[3.1-4-UNIT-017] [P0] should return all provider configs sorted by displayName', async () => {
      // Given
      const configs = [mockConfig];
      repo.find.mockResolvedValue(configs);

      // When
      const result = await service.findAll();

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].providerKey).toBe('google-ai-studio');
      expect(result[0].displayName).toBe('Google AI Studio');
      expect(repo.find).toHaveBeenCalledWith({
        order: { displayName: 'ASC' },
      });
    });

    it('[3.1-4-UNIT-018] [P0] should return masked credentials when present', async () => {
      // Given
      const configWithCreds = buildConfigWithCredentials();
      repo.find.mockResolvedValue([configWithCreds]);

      // When
      const result = await service.findAll();

      // Then
      expect(result[0].maskedCredentials).toBeTruthy();
      expect(result[0].maskedCredentials!['apiKey']).toContain('***');
      expect(result[0].maskedCredentials!['apiKey']).not.toBe(
        'AIzaSyTest123456',
      );
    });

    it('[3.1-4-UNIT-019] [P1] should return null maskedCredentials when no credentials stored', async () => {
      // Given
      repo.find.mockResolvedValue([mockConfig]);

      // When
      const result = await service.findAll();

      // Then
      expect(result[0].maskedCredentials).toBeNull();
    });
  });

  describe('create', () => {
    it('[3.1-4-UNIT-020] [P0] should create a provider config without credentials', async () => {
      // Given
      const dto = {
        providerKey: 'google-ai-studio',
        displayName: 'Google AI Studio',
      };
      repo.create.mockReturnValue(mockConfig);
      repo.save.mockResolvedValue(mockConfig);

      // When
      const result = await service.create(dto);

      // Then
      expect(result.providerKey).toBe('google-ai-studio');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          providerKey: 'google-ai-studio',
          displayName: 'Google AI Studio',
          encryptedCredentials: null,
          isActive: true,
        }),
      );
    });

    it('[3.1-4-UNIT-021] [P0] should create a provider config with encrypted credentials', async () => {
      // Given
      const dto = {
        providerKey: 'google-ai-studio',
        displayName: 'Google AI Studio',
        credentials: { apiKey: 'AIzaSyTest123456' },
      };
      const savedConfig = buildConfigWithCredentials();
      repo.create.mockReturnValue(savedConfig);
      repo.save.mockResolvedValue(savedConfig);

      // When
      const result = await service.create(dto);

      // Then
      expect(result.providerKey).toBe('google-ai-studio');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          providerKey: 'google-ai-studio',
          encryptedCredentials: expect.any(String),
        }),
      );
      // Encrypted credentials should NOT be plaintext
      const createArg = repo.create.mock.calls[0][0] as LlmProviderConfigEntity;
      expect(createArg.encryptedCredentials).not.toContain('AIzaSyTest123456');
    });

    it('[3.1-4-UNIT-022] [P0] should throw ConflictException on duplicate providerKey', async () => {
      // Given
      const dto = {
        providerKey: 'google-ai-studio',
        displayName: 'Google AI Studio',
      };
      repo.create.mockReturnValue(mockConfig);
      repo.save.mockRejectedValue({ code: '23505' });

      // When / Then
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('[3.1-4-UNIT-023] [P0] should throw BadRequestException for unknown providerKey', async () => {
      // Given
      const dto = {
        providerKey: 'unknown-provider',
        displayName: 'Unknown',
      };

      // When / Then
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        /Unknown provider key/,
      );
    });

    it('[3.1-4-UNIT-024] [P0] should throw BadRequestException when required credential fields are missing', async () => {
      // Given
      const dto = {
        providerKey: 'google-ai-studio',
        displayName: 'Google AI Studio',
        credentials: { wrongField: 'value' },
      };

      // When / Then
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        /Missing required credential fields/,
      );
    });

    it('[3.1-4-UNIT-025] [P0] should throw BadRequestException when encryption key is missing and credentials provided', async () => {
      // Given — service without encryption key
      configService.get.mockReturnValue(undefined);
      const serviceNoKey = new LlmProviderConfigService(repo, configService, providerRegistry);
      const dto = {
        providerKey: 'google-ai-studio',
        displayName: 'Google AI Studio',
        credentials: { apiKey: 'AIzaSyTest123456' },
      };

      // When / Then
      await expect(serviceNoKey.create(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(serviceNoKey.create(dto)).rejects.toThrow(
        /SETTINGS_ENCRYPTION_KEY is not configured/,
      );
    });

    it('[3.1-4-UNIT-026] [P1] should allow creating mock provider without credentials', async () => {
      // Given
      const dto = {
        providerKey: 'mock',
        displayName: 'Mock Provider',
      };
      const mockProviderConfig = { ...mockConfig, providerKey: 'mock' };
      repo.create.mockReturnValue(mockProviderConfig);
      repo.save.mockResolvedValue(mockProviderConfig);

      // When
      const result = await service.create(dto);

      // Then
      expect(result.providerKey).toBe('mock');
    });

    it('[3.1-4-UNIT-070] [P1] should reject non-string credential values', async () => {
      // Given
      const dto = {
        providerKey: 'google-ai-studio',
        displayName: 'Google AI Studio',
        credentials: { apiKey: 123 as unknown as string },
      };

      // When / Then
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(/must be a string/);
    });

    it('[3.1-4-UNIT-027] [P1] should validate vertex provider requires projectId and location', async () => {
      // Given
      const dto = {
        providerKey: 'vertex',
        displayName: 'Vertex AI',
        credentials: { projectId: 'my-project' }, // missing location
      };

      // When / Then
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(/location/);
    });
  });

  describe('update', () => {
    it('[3.1-4-UNIT-028] [P0] should update displayName and isActive', async () => {
      // Given
      repo.findOne.mockResolvedValue({ ...mockConfig });
      repo.save.mockResolvedValue({
        ...mockConfig,
        displayName: 'Updated Name',
        isActive: false,
      });

      // When
      const result = await service.update(mockConfig.id, {
        displayName: 'Updated Name',
        isActive: false,
      });

      // Then
      expect(result.displayName).toBe('Updated Name');
      expect(result.isActive).toBe(false);
    });

    it('[3.1-4-UNIT-029] [P0] should update credentials with encryption', async () => {
      // Given
      repo.findOne.mockResolvedValue({ ...mockConfig });
      repo.save.mockImplementation(async (entity) => entity as LlmProviderConfigEntity);

      // When
      await service.update(mockConfig.id, {
        credentials: { apiKey: 'new-api-key' },
      });

      // Then
      const savedEntity = repo.save.mock.calls[0][0] as LlmProviderConfigEntity;
      expect(savedEntity.encryptedCredentials).toBeTruthy();
      expect(savedEntity.encryptedCredentials).not.toContain('new-api-key');
    });

    it('[3.1-4-UNIT-030] [P0] should throw NotFoundException for missing config', async () => {
      // Given
      repo.findOne.mockResolvedValue(null);

      // When / Then
      await expect(
        service.update('non-existent-id', { displayName: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('[3.1-4-UNIT-031] [P0] should throw BadRequestException when updating credentials without encryption key', async () => {
      // Given
      configService.get.mockReturnValue(undefined);
      const serviceNoKey = new LlmProviderConfigService(repo, configService, providerRegistry);
      repo.findOne.mockResolvedValue({ ...mockConfig });

      // When / Then
      await expect(
        serviceNoKey.update(mockConfig.id, {
          credentials: { apiKey: 'test' },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDecryptedCredentials', () => {
    it('[3.1-4-UNIT-032] [P0] should return decrypted credentials when encryption key is available', async () => {
      // Given
      const configWithCreds = buildConfigWithCredentials();
      repo.findOne.mockResolvedValue(configWithCreds);

      // When
      const result = await service.getDecryptedCredentials('google-ai-studio');

      // Then
      expect(result).toEqual({ apiKey: 'AIzaSyTest123456' });
    });

    it('[3.1-4-UNIT-033] [P1] should fall back to env vars when no DB credentials exist', async () => {
      // Given
      repo.findOne.mockResolvedValue(null);
      configService.get.mockImplementation((key: string) => {
        if (key === 'SETTINGS_ENCRYPTION_KEY') return TEST_ENCRYPTION_KEY;
        if (key === 'GEMINI_API_KEY') return 'env-api-key';
        return undefined;
      });
      const serviceWithEnv = new LlmProviderConfigService(
        repo,
        configService,
        providerRegistry,
      );

      // When
      const result =
        await serviceWithEnv.getDecryptedCredentials('google-ai-studio');

      // Then
      expect(result).toEqual({ apiKey: 'env-api-key' });
    });

    it('[3.1-4-UNIT-034] [P1] should fall back to env vars when encryption key is missing', async () => {
      // Given
      const configWithCreds = buildConfigWithCredentials();
      repo.findOne.mockResolvedValue(configWithCreds);
      configService.get.mockImplementation((key: string) => {
        if (key === 'SETTINGS_ENCRYPTION_KEY') return undefined;
        if (key === 'GEMINI_API_KEY') return 'env-fallback';
        return undefined;
      });
      const serviceNoKey = new LlmProviderConfigService(repo, configService, providerRegistry);

      // When
      const result =
        await serviceNoKey.getDecryptedCredentials('google-ai-studio');

      // Then
      expect(result).toEqual({ apiKey: 'env-fallback' });
    });

    it('[3.1-4-UNIT-035] [P1] should return empty object for provider with no fallback', async () => {
      // Given
      repo.findOne.mockResolvedValue(null);

      // When
      const result = await service.getDecryptedCredentials('openai');

      // Then
      expect(result).toEqual({});
    });
  });

  describe('rateLimitRpm', () => {
    it('[4.2-UNIT-001] [P1] should create provider config with rateLimitRpm', async () => {
      // Given
      const dto = {
        providerKey: 'mock',
        displayName: 'Mock Provider',
        rateLimitRpm: 15,
      };
      const savedConfig = { ...mockConfig, providerKey: 'mock', rateLimitRpm: 15 };
      repo.create.mockReturnValue(savedConfig);
      repo.save.mockResolvedValue(savedConfig);

      // When
      const result = await service.create(dto);

      // Then
      expect(result.rateLimitRpm).toBe(15);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ rateLimitRpm: 15 }),
      );
    });

    it('[4.2-UNIT-002] [P1] should default rateLimitRpm to null when not provided on create', async () => {
      // Given
      const dto = {
        providerKey: 'mock',
        displayName: 'Mock Provider',
      };
      const savedConfig = { ...mockConfig, providerKey: 'mock', rateLimitRpm: null };
      repo.create.mockReturnValue(savedConfig);
      repo.save.mockResolvedValue(savedConfig);

      // When
      const result = await service.create(dto);

      // Then
      expect(result.rateLimitRpm).toBeNull();
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ rateLimitRpm: null }),
      );
    });

    it('[4.2-UNIT-003] [P1] should update rateLimitRpm on existing config', async () => {
      // Given
      repo.findOne.mockResolvedValue({ ...mockConfig });
      repo.save.mockImplementation(async (entity) => entity as LlmProviderConfigEntity);

      // When
      const result = await service.update(mockConfig.id, { rateLimitRpm: 60 });

      // Then
      const savedEntity = repo.save.mock.calls[0][0] as LlmProviderConfigEntity;
      expect(savedEntity.rateLimitRpm).toBe(60);
    });

    it('[4.2-UNIT-004] [P1] should allow setting rateLimitRpm to null on update', async () => {
      // Given
      repo.findOne.mockResolvedValue({ ...mockConfig, rateLimitRpm: 60 });
      repo.save.mockImplementation(async (entity) => entity as LlmProviderConfigEntity);

      // When
      const result = await service.update(mockConfig.id, { rateLimitRpm: null });

      // Then
      const savedEntity = repo.save.mock.calls[0][0] as LlmProviderConfigEntity;
      expect(savedEntity.rateLimitRpm).toBeNull();
    });

    it('[4.2-UNIT-005] [P1] should include rateLimitRpm in response DTO', async () => {
      // Given
      const configWithRpm = { ...mockConfig, rateLimitRpm: 30 };
      repo.find.mockResolvedValue([configWithRpm]);

      // When
      const result = await service.findAll();

      // Then
      expect(result[0].rateLimitRpm).toBe(30);
    });
  });

  describe('toResponse masking', () => {
    it('[3.1-4-UNIT-036] [P1] should mask credential values in response (never expose full values)', async () => {
      // Given
      const configWithCreds = buildConfigWithCredentials();
      repo.find.mockResolvedValue([configWithCreds]);

      // When
      const result = await service.findAll();

      // Then
      const masked = result[0].maskedCredentials!;
      expect(masked['apiKey']).toMatch(/^\*+/);
      expect(masked['apiKey']).not.toBe('AIzaSyTest123456');
      // Last 4 chars should be visible
      expect(masked['apiKey'].slice(-4)).toBe('3456');
    });

    it('[3.1-4-UNIT-037] [P1] should show status when encryption key is unavailable for masking', async () => {
      // Given
      configService.get.mockReturnValue(undefined);
      const serviceNoKey = new LlmProviderConfigService(repo, configService, providerRegistry);
      const configWithCreds = buildConfigWithCredentials();
      repo.find.mockResolvedValue([configWithCreds]);

      // When
      const result = await serviceNoKey.findAll();

      // Then
      expect(result[0].maskedCredentials).toEqual({
        _status: 'encrypted (key not available)',
      });
    });
  });
});
