/**
 * Canonical provider display names and options.
 * Single source of truth for the Settings UI — prevents drift when new providers are added.
 */

export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  'google-ai-studio': 'Google AI Studio',
  vertex: 'Vertex AI',
  openai: 'OpenAI',
  mock: 'Mock Provider',
};

export const PROVIDER_OPTIONS = [
  { value: 'google-ai-studio', label: 'Google AI Studio' },
  { value: 'vertex', label: 'Vertex AI' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'mock', label: 'Mock Provider' },
] as const;
