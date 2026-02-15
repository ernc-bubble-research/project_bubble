/**
 * Canonical list of known LLM provider keys.
 * Retained as a static artifact validated by the registry completeness test
 * (`provider-registry.service.spec.ts` [4-PR-UNIT-002]). The ProviderRegistry
 * is the runtime source of truth; this array ensures static analysis and DTO
 * validation pipelines (which run before DI container init) have access to
 * the valid key set.
 */
export const KNOWN_PROVIDER_KEYS = [
  'google-ai-studio',
  'vertex',
  'openai',
  'mock',
] as const;

export type ProviderKey = (typeof KNOWN_PROVIDER_KEYS)[number];
