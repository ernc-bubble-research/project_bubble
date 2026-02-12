import { Logger } from '@nestjs/common';
import { LLMProvider, LLMGenerateOptions, LLMGenerateResult } from './llm.provider';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const GENERATE_TIMEOUT_MS = 60_000; // 60 second timeout

/**
 * GoogleAIStudioLlmProvider — calls Google Generative AI SDK for content generation.
 *
 * Constructed by LlmProviderFactory with credentials + modelId.
 * Retry logic: 3 attempts, exponential backoff, 60s timeout.
 */
export class GoogleAIStudioLlmProvider implements LLMProvider {
  private readonly logger = new Logger(GoogleAIStudioLlmProvider.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly genAIModel: any;

  constructor(apiKey: string, modelId: string) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    this.genAIModel = genAI.getGenerativeModel({ model: modelId });
  }

  async generate(
    prompt: string,
    options: LLMGenerateOptions,
  ): Promise<LLMGenerateResult> {
    return this.generateWithRetry(prompt, options, 1);
  }

  private async generateWithRetry(
    prompt: string,
    options: LLMGenerateOptions,
    attempt: number,
  ): Promise<LLMGenerateResult> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await this.withTimeout(
        this.genAIModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options.temperature,
            maxOutputTokens: options.maxOutputTokens,
          },
        }),
      );

      const response = result.response;
      const text = response.text();
      const usage = response.usageMetadata ?? {};

      return {
        text,
        tokenUsage: {
          inputTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
          totalTokens: usage.totalTokenCount ?? 0,
        },
      };
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Google AI Studio generate attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${delay}ms: ${error instanceof Error ? error.message : String(error)}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.generateWithRetry(prompt, options, attempt + 1);
      }
      throw error;
    }
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `Google AI Studio API timed out after ${GENERATE_TIMEOUT_MS}ms`,
            ),
          ),
        GENERATE_TIMEOUT_MS,
      );
    });
    return Promise.race([promise, timeout]).finally(() =>
      clearTimeout(timer!),
    );
  }
}
