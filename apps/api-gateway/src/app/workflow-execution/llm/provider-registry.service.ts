import { Injectable, OnModuleInit, Logger, BadRequestException } from '@nestjs/common';
import {
  ProviderRegistryEntry,
  CredentialField,
  GenerationParamSpec,
} from './provider-registry.interface';
import { MockLlmProvider } from './mock-llm.provider';
import { GoogleAIStudioLlmProvider } from './google-ai-studio-llm.provider';

/** Google AI Studio / Vertex AI generation params (same SDK family) */
const GOOGLE_AI_STUDIO_PARAMS: GenerationParamSpec[] = [
  { key: 'temperature', label: 'Temperature', type: 'number', min: 0, max: 2, default: 1.0 },
  { key: 'topP', label: 'Top P', type: 'number', min: 0, max: 1, default: 0.95 },
  { key: 'topK', label: 'Top K', type: 'number', min: 1, max: 100, default: 40 },
  { key: 'maxOutputTokens', label: 'Max Output Tokens', type: 'number', min: 1, max: 8192, default: 8192 },
  { key: 'stopSequences', label: 'Stop Sequences', type: 'string[]', maxItems: 5 },
];

/** OpenAI generation params (no topK) */
const OPENAI_PARAMS: GenerationParamSpec[] = [
  { key: 'temperature', label: 'Temperature', type: 'number', min: 0, max: 2, default: 1.0 },
  { key: 'topP', label: 'Top P', type: 'number', min: 0, max: 1, default: 1.0 },
  { key: 'maxOutputTokens', label: 'Max Output Tokens', type: 'number', min: 1, max: 16384, default: 4096 },
  { key: 'stopSequences', label: 'Stop Sequences', type: 'string[]', maxItems: 4 },
];

/** Mock provider generation params (minimal set) */
const MOCK_PARAMS: GenerationParamSpec[] = [
  { key: 'temperature', label: 'Temperature', type: 'number', min: 0, max: 2, default: 0.7 },
  { key: 'topP', label: 'Top P', type: 'number', min: 0, max: 1, default: 1.0 },
  { key: 'maxOutputTokens', label: 'Max Output Tokens', type: 'number', min: 1, max: 65536, default: 4096 },
];

/**
 * ProviderRegistry — single source of truth for LLM provider metadata.
 *
 * Each provider is a self-describing entry that exposes its credential schema,
 * env var fallbacks, display name, and factory method. This replaces:
 * - provider-constants.ts (frontend hardcoded display names)
 * - REQUIRED_CREDENTIAL_FIELDS / ENV_VAR_FALLBACKS (service hardcoded maps)
 * - switch statement in LlmProviderFactory.buildProvider()
 *
 * ## Adding a New LLM Provider
 *
 * 1. Create a new class implementing `LLMProvider` (e.g., `OpenAiLlmProvider`)
 * 2. Add a new `ProviderRegistryEntry` in the `registerAll()` method below
 * 3. Add the provider key to `KNOWN_PROVIDER_KEYS` in `provider-keys.ts`
 *    (required because DTO validation pipelines use this static array before
 *    the DI container initializes the registry)
 * 4. Run the registry completeness test (`[4-PR-UNIT-002]`) to verify sync
 * 5. Write unit tests for the new provider class
 * 6. Deploy — frontend automatically discovers the new provider via API
 *
 * No DB migration needed. No frontend changes needed.
 */
@Injectable()
export class ProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistry.name);
  private readonly registry = new Map<string, ProviderRegistryEntry>();

  private initialized = false;

  onModuleInit(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.registerAll();
    this.logger.log(
      `Provider registry initialized with ${this.registry.size} providers: ${[...this.registry.keys()].join(', ')}`,
    );
  }

  get(providerKey: string): ProviderRegistryEntry | undefined {
    return this.registry.get(providerKey);
  }

  getAll(): ProviderRegistryEntry[] {
    return [...this.registry.values()];
  }

  getKnownKeys(): string[] {
    return [...this.registry.keys()];
  }

  getCredentialSchema(providerKey: string): CredentialField[] {
    const entry = this.registry.get(providerKey);
    return entry?.credentialSchema ?? [];
  }

  getEnvVarFallbacks(providerKey: string): Record<string, string> {
    const entry = this.registry.get(providerKey);
    return entry?.envVarFallbacks ?? {};
  }

  private registerAll(): void {
    this.register({
      providerKey: 'google-ai-studio',
      displayName: 'Google AI Studio',
      credentialSchema: [
        { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      ],
      envVarFallbacks: { apiKey: 'GEMINI_API_KEY' },
      supportedGenerationParams: GOOGLE_AI_STUDIO_PARAMS,
      isDevelopmentOnly: false,
      createProvider(
        modelId: string,
        credentials: Record<string, string>,
      ) {
        const apiKey = credentials['apiKey'];
        if (!apiKey) {
          throw new BadRequestException(
            'Google AI Studio provider requires an apiKey credential',
          );
        }
        return new GoogleAIStudioLlmProvider(apiKey, modelId);
      },
    });

    this.register({
      providerKey: 'mock',
      displayName: 'Mock Provider',
      credentialSchema: [],
      envVarFallbacks: {},
      supportedGenerationParams: MOCK_PARAMS,
      isDevelopmentOnly: true,
      createProvider() {
        return new MockLlmProvider();
      },
    });

    this.register({
      providerKey: 'vertex',
      displayName: 'Vertex AI',
      credentialSchema: [
        { key: 'projectId', label: 'Project ID', type: 'text', required: true },
        { key: 'location', label: 'Location', type: 'text', required: true },
      ],
      envVarFallbacks: {},
      supportedGenerationParams: GOOGLE_AI_STUDIO_PARAMS, // Same SDK family
      isDevelopmentOnly: false,
      createProvider() {
        throw new BadRequestException(
          'Vertex provider is not yet implemented',
        );
      },
    });

    this.register({
      providerKey: 'openai',
      displayName: 'OpenAI',
      credentialSchema: [
        { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      ],
      envVarFallbacks: {},
      supportedGenerationParams: OPENAI_PARAMS,
      isDevelopmentOnly: false,
      createProvider() {
        throw new BadRequestException(
          'OpenAI provider is not yet implemented',
        );
      },
    });
  }

  private register(entry: ProviderRegistryEntry): void {
    this.registry.set(entry.providerKey, entry);
  }
}
