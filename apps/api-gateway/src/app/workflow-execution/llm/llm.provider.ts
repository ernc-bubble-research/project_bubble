/**
 * Hexagonal LLM Provider Interface
 *
 * Mirrors the existing EmbeddingProvider pattern but for content generation.
 * Implementations: MockLlmProvider, GoogleAIStudioLlmProvider.
 * Resolved dynamically at runtime by LlmProviderFactory (not a static factory).
 */

export interface LLMGenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
}

export interface LLMGenerateResult {
  text: string;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface LLMProvider {
  generate(prompt: string, options: LLMGenerateOptions): Promise<LLMGenerateResult>;
}
