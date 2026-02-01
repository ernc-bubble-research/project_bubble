import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider } from './embedding.provider';

const EMBEDDING_DIMENSIONS = 768;
const MAX_BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const EMBED_TIMEOUT_MS = 30_000; // 30 second timeout per batch

@Injectable()
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private readonly logger = new Logger(GeminiEmbeddingProvider.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly genAIModel: any;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key || key === 'replace_with_real_key') {
      throw new Error(
        'Embedding requires a valid GEMINI_API_KEY. Set it in your .env file.',
      );
    }
    const modelName = this.config.get<string>('EMBEDDING_MODEL') || 'text-embedding-004';

    // Initialize client once — cached for all subsequent embed() calls
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(key);
    this.genAIModel = genAI.getGenerativeModel({ model: modelName });
  }

  async embed(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    // Process in batches of MAX_BATCH_SIZE
    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE);
      const batchResults = await this.embedBatchWithRetry(batch);

      // Validate embedding dimensions
      for (const vec of batchResults) {
        if (vec.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${vec.length}`,
          );
        }
      }

      results.push(...batchResults);
    }

    return results;
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Embedding API timed out after ${EMBED_TIMEOUT_MS}ms`)),
        EMBED_TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }

  private async embedBatchWithRetry(
    texts: string[],
    attempt = 1,
  ): Promise<number[][]> {
    try {
      if (texts.length === 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = await this.withTimeout(this.genAIModel.embedContent(texts[0]));
        return [result.embedding.values];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await this.withTimeout(this.genAIModel.batchEmbedContents({
        requests: texts.map((text) => ({
          content: { role: 'user', parts: [{ text }] },
        })),
      }));

      return result.embeddings.map((e: { values: number[] }) => e.values);
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Embedding attempt ${attempt} failed, retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.embedBatchWithRetry(texts, attempt + 1);
      }
      throw error;
    }
  }
}

@Injectable()
export class MockEmbeddingProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.deterministicVector(text));
  }

  private deterministicVector(text: string): number[] {
    // Generate a deterministic vector based on a simple hash of the text
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }

    const vector = new Array(EMBEDDING_DIMENSIONS);
    let seed = hash;
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      // Simple LCG pseudo-random based on seed
      seed = (seed * 1664525 + 1013904223) | 0;
      vector[i] = (seed >>> 0) / 4294967296; // normalize to [0, 1)
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(
      vector.reduce((sum: number, v: number) => sum + v * v, 0),
    );
    return vector.map((v: number) => v / magnitude);
  }
}
