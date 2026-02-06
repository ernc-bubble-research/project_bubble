/**
 * Canonical list of known LLM provider keys.
 * Used by LlmModelsService (AC 9 validation) and LlmProviderConfigService.
 * Rationale: providerKey is a type discriminator, not a FK reference.
 * Provider configs are optional (env var fallback) and models are seeded
 * before configs in the boot sequence, so we validate against a static enum.
 */
export const KNOWN_PROVIDER_KEYS = [
  'google-ai-studio',
  'vertex',
  'openai',
  'mock',
] as const;

export type ProviderKey = (typeof KNOWN_PROVIDER_KEYS)[number];
