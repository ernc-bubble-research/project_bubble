import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { TransactionManager } from '@project-bubble/db-layer';
import {
  EmbeddingProvider,
  EMBEDDING_PROVIDER,
} from '../ingestion/embedding.provider';
import { SearchResultDto } from '@project-bubble/shared';

@Injectable()
export class KnowledgeSearchService {
  private readonly logger = new Logger(KnowledgeSearchService.name);

  constructor(
    private readonly txManager: TransactionManager,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  async search(
    query: string,
    tenantId: string,
    options?: {
      limit?: number;
      similarityThreshold?: number;
      verifiedBoost?: number;
    },
  ): Promise<SearchResultDto[]> {
    const limit = options?.limit ?? 10;
    const similarityThreshold = options?.similarityThreshold ?? 0.3;
    const verifiedBoost = options?.verifiedBoost ?? 0.1;

    let queryEmbedding: number[];
    try {
      [queryEmbedding] = await this.embeddingProvider.embed([query]);
    } catch (error) {
      this.logger.error({
        message: 'Embedding provider failed',
        tenantId,
        queryLength: query.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new InternalServerErrorException(
        'Knowledge search unavailable: embedding service failed',
      );
    }

    const queryEmbeddingStr = JSON.stringify(queryEmbedding);

    const results: SearchResultDto[] = await this.txManager.run(
      tenantId,
      async (manager) => {
        return manager.query(
          `SELECT
            kc.id,
            kc.asset_id AS "assetId",
            kc.content,
            kc.chunk_index AS "chunkIndex",
            kc.metadata,
            a.original_name AS "assetName",
            LEAST(
              (1 - (kc.embedding <=> $1::vector)) + CASE WHEN kc.is_verified THEN $4 ELSE 0 END,
              1.0
            )::float8 AS similarity
          FROM knowledge_chunks kc
          LEFT JOIN assets a ON a.id = kc.asset_id
          WHERE kc.tenant_id = $5
            AND kc.embedding IS NOT NULL
            AND kc.deleted_at IS NULL
            AND (1 - (kc.embedding <=> $1::vector))
                + CASE WHEN kc.is_verified THEN $4 ELSE 0 END >= $2
          ORDER BY similarity DESC
          LIMIT $3`,
          [queryEmbeddingStr, similarityThreshold, limit, verifiedBoost, tenantId],
        );
      },
    );

    this.logger.log({
      message: 'Knowledge search completed',
      tenantId,
      queryLength: query.length,
      resultCount: results.length,
      topSimilarity: results.length > 0 ? results[0].similarity : null,
    });

    return results;
  }
}
