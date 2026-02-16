import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ProviderRegistry } from './provider-registry.service';
import { KNOWN_PROVIDER_KEYS } from '../../common/provider-keys';

describe('ProviderRegistry [P1]', () => {
  let registry: ProviderRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProviderRegistry],
    }).compile();

    registry = module.get<ProviderRegistry>(ProviderRegistry);
    // Trigger onModuleInit to populate the registry
    registry.onModuleInit();
  });

  describe('initialization', () => {
    it('[4-PR-UNIT-001] should register all known providers on init', () => {
      const keys = registry.getKnownKeys();
      expect(keys).toContain('google-ai-studio');
      expect(keys).toContain('mock');
      expect(keys).toContain('vertex');
      expect(keys).toContain('openai');
      expect(keys).toHaveLength(4);
    });

    it('[4-PR-UNIT-002] should match KNOWN_PROVIDER_KEYS exactly (registry completeness)', () => {
      const registryKeys = registry.getKnownKeys().sort();
      const staticKeys = [...KNOWN_PROVIDER_KEYS].sort();
      expect(registryKeys).toEqual(staticKeys);
    });

    it('[4-PR-UNIT-019] should be idempotent on double onModuleInit call', () => {
      const keysBefore = registry.getKnownKeys();
      registry.onModuleInit(); // second call — should be no-op
      const keysAfter = registry.getKnownKeys();
      expect(keysAfter).toEqual(keysBefore);
    });
  });

  describe('get()', () => {
    it('[4-PR-UNIT-003] should return entry for google-ai-studio', () => {
      const entry = registry.get('google-ai-studio');
      expect(entry).toBeDefined();
      expect(entry!.providerKey).toBe('google-ai-studio');
      expect(entry!.displayName).toBe('Google AI Studio');
      expect(entry!.isDevelopmentOnly).toBe(false);
    });

    it('[4-PR-UNIT-004] should return entry for mock', () => {
      const entry = registry.get('mock');
      expect(entry).toBeDefined();
      expect(entry!.providerKey).toBe('mock');
      expect(entry!.displayName).toBe('Mock Provider');
      expect(entry!.isDevelopmentOnly).toBe(true);
      expect(entry!.credentialSchema).toEqual([]);
    });

    it('[4-PR-UNIT-005] should return undefined for unknown key', () => {
      const entry = registry.get('nonexistent-provider');
      expect(entry).toBeUndefined();
    });
  });

  describe('getAll()', () => {
    it('[4-PR-UNIT-006] should return all registered entries', () => {
      const all = registry.getAll();
      expect(all).toHaveLength(4);
      const keys = all.map((e) => e.providerKey);
      expect(keys).toContain('google-ai-studio');
      expect(keys).toContain('mock');
      expect(keys).toContain('vertex');
      expect(keys).toContain('openai');
    });
  });

  describe('getCredentialSchema()', () => {
    it('[4-PR-UNIT-007] should return credential schema for google-ai-studio', () => {
      const schema = registry.getCredentialSchema('google-ai-studio');
      expect(schema).toHaveLength(1);
      expect(schema[0]).toEqual({
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
      });
    });

    it('[4-PR-UNIT-008] should return empty array for mock provider', () => {
      const schema = registry.getCredentialSchema('mock');
      expect(schema).toEqual([]);
    });

    it('[4-PR-UNIT-009] should return empty array for unknown provider', () => {
      const schema = registry.getCredentialSchema('unknown');
      expect(schema).toEqual([]);
    });

    it('[4-PR-UNIT-010] should return credential schema for vertex', () => {
      const schema = registry.getCredentialSchema('vertex');
      expect(schema).toHaveLength(2);
      expect(schema[0].key).toBe('projectId');
      expect(schema[1].key).toBe('location');
    });
  });

  describe('getEnvVarFallbacks()', () => {
    it('[4-PR-UNIT-011] should return env var fallbacks for google-ai-studio', () => {
      const fallbacks = registry.getEnvVarFallbacks('google-ai-studio');
      expect(fallbacks).toEqual({ apiKey: 'GEMINI_API_KEY' });
    });

    it('[4-PR-UNIT-012] should return empty object for mock provider', () => {
      const fallbacks = registry.getEnvVarFallbacks('mock');
      expect(fallbacks).toEqual({});
    });

    it('[4-PR-UNIT-013] should return empty object for unknown provider', () => {
      const fallbacks = registry.getEnvVarFallbacks('unknown');
      expect(fallbacks).toEqual({});
    });
  });

  describe('supportedGenerationParams', () => {
    it('[4-GP-UNIT-001] should populate generation params for google-ai-studio', () => {
      const entry = registry.get('google-ai-studio')!;
      const params = entry.supportedGenerationParams!;
      expect(params).toBeDefined();
      expect(params.length).toBe(5);
      const keys = params.map((p) => p.key);
      expect(keys).toEqual(['temperature', 'topP', 'topK', 'maxOutputTokens', 'stopSequences']);
    });

    it('[4-GP-UNIT-002] should populate generation params for openai (no topK)', () => {
      const entry = registry.get('openai')!;
      const params = entry.supportedGenerationParams!;
      expect(params).toBeDefined();
      expect(params.length).toBe(4);
      const keys = params.map((p) => p.key);
      expect(keys).toEqual(['temperature', 'topP', 'maxOutputTokens', 'stopSequences']);
      expect(keys).not.toContain('topK');
    });

    it('[4-GP-UNIT-003] should populate generation params for vertex (same as google-ai-studio)', () => {
      const entry = registry.get('vertex')!;
      const params = entry.supportedGenerationParams!;
      expect(params).toBeDefined();
      expect(params.length).toBe(5);
      const googleParams = registry.get('google-ai-studio')!.supportedGenerationParams!;
      expect(params).toEqual(googleParams);
    });

    it('[4-GP-UNIT-004] should populate generation params for mock (minimal set)', () => {
      const entry = registry.get('mock')!;
      const params = entry.supportedGenerationParams!;
      expect(params).toBeDefined();
      expect(params.length).toBe(3);
      const keys = params.map((p) => p.key);
      expect(keys).toEqual(['temperature', 'topP', 'maxOutputTokens']);
      expect(keys).not.toContain('topK');
      expect(keys).not.toContain('stopSequences');
    });

    it('[4-GP-UNIT-005] should have correct ranges for google-ai-studio temperature', () => {
      const entry = registry.get('google-ai-studio')!;
      const temp = entry.supportedGenerationParams!.find((p) => p.key === 'temperature')!;
      expect(temp.min).toBe(0);
      expect(temp.max).toBe(2);
      expect(temp.default).toBe(1.0);
      expect(temp.type).toBe('number');
    });

    it('[4-GP-UNIT-006] should have correct ranges for openai maxOutputTokens', () => {
      const entry = registry.get('openai')!;
      const param = entry.supportedGenerationParams!.find((p) => p.key === 'maxOutputTokens')!;
      expect(param.min).toBe(1);
      expect(param.max).toBe(16384);
      expect(param.default).toBe(4096);
    });

    it('[4-GP-UNIT-007] should have stopSequences with maxItems for google-ai-studio', () => {
      const entry = registry.get('google-ai-studio')!;
      const param = entry.supportedGenerationParams!.find((p) => p.key === 'stopSequences')!;
      expect(param.type).toBe('string[]');
      expect(param.maxItems).toBe(5);
      expect(param.default).toBeUndefined();
    });
  });

  describe('createProvider()', () => {
    it('[4-PR-UNIT-014] should create MockLlmProvider via registry', () => {
      const entry = registry.get('mock')!;
      const provider = entry.createProvider('any-model', {});
      expect(provider).toBeDefined();
      expect(provider.generate).toBeDefined();
    });

    it('[4-PR-UNIT-015] should create GoogleAIStudioLlmProvider via registry', () => {
      const entry = registry.get('google-ai-studio')!;
      const provider = entry.createProvider('gemini-1.5-pro', {
        apiKey: 'test-key',
      });
      expect(provider).toBeDefined();
      expect(provider.generate).toBeDefined();
    });

    it('[4-PR-UNIT-016] should throw if google-ai-studio missing apiKey', () => {
      const entry = registry.get('google-ai-studio')!;
      expect(() => entry.createProvider('gemini-1.5-pro', {})).toThrow(
        BadRequestException,
      );
    });

    it('[4-PR-UNIT-017] should throw for vertex (not yet implemented)', () => {
      const entry = registry.get('vertex')!;
      expect(() =>
        entry.createProvider('some-model', {
          projectId: 'p',
          location: 'us-central1',
        }),
      ).toThrow(BadRequestException);
      expect(() =>
        entry.createProvider('some-model', {
          projectId: 'p',
          location: 'us-central1',
        }),
      ).toThrow('Vertex provider is not yet implemented');
    });

    it('[4-PR-UNIT-018] should throw for openai (not yet implemented)', () => {
      const entry = registry.get('openai')!;
      expect(() =>
        entry.createProvider('gpt-4', { apiKey: 'test-key' }),
      ).toThrow(BadRequestException);
      expect(() =>
        entry.createProvider('gpt-4', { apiKey: 'test-key' }),
      ).toThrow('OpenAI provider is not yet implemented');
    });
  });
});
