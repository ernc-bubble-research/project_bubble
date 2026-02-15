import { LLMProvider } from './llm.provider';

/**
 * Describes a credential field required by a provider.
 * Used to dynamically render credential forms in the admin UI.
 */
export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password';
  required: boolean;
}

/**
 * Describes a generation parameter supported by a provider.
 * Placeholder for Story 4-GP — not populated in 4-PR.
 */
export interface GenerationParamSpec {
  key: string;
  label: string;
  type: 'number' | 'string[]';
  min?: number;
  max?: number;
  default?: number;
  maxItems?: number;
}

/**
 * Self-describing adapter entry in the provider registry.
 * Each LLM provider registers one of these to expose its metadata
 * and factory method. The registry replaces all hardcoded provider
 * knowledge (switch statements, credential maps, display names).
 */
export interface ProviderRegistryEntry {
  providerKey: string;
  displayName: string;
  credentialSchema: CredentialField[];
  envVarFallbacks: Record<string, string>;
  supportedGenerationParams?: GenerationParamSpec[];
  isDevelopmentOnly: boolean;
  createProvider(
    modelId: string,
    credentials: Record<string, string>,
  ): LLMProvider;
}
