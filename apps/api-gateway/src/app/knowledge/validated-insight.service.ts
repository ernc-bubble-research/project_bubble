import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TransactionManager } from '@project-bubble/db-layer';
import {
  EmbeddingProvider,
  EMBEDDING_PROVIDER,
} from '../ingestion/embedding.provider';
import {
  InsightMetadata,
  ValidatedInsightResponseDto,
} from '@project-bubble/shared';

@Injectable()
export class ValidatedInsightService {
  private readonly logger = new Logger(ValidatedInsightService.name);

  constructor(
    private readonly txManager: TransactionManager,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  async store(
    content: string,
    tenantId: string,
    userId: string,
    metadata: InsightMetadata,
  ): Promise<ValidatedInsightResponseDto> {
    let embedding: number[];
    try {
      [embedding] = await this.embeddingProvider.embed([content]);
    } catch (error) {
      this.logger.error({
        message: 'Embedding provider failed for insight storage',
        tenantId,
        sourceType: metadata.sourceType,
        contentLength: content.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new InternalServerErrorException(
        'Insight storage unavailable: embedding service failed',
      );
    }

    const embeddingStr = JSON.stringify(embedding);
    const now = new Date();
    const insightMetadata = {
      sourceType: metadata.sourceType,
      sourceRunId: metadata.sourceRunId ?? null,
      sourceReportId: metadata.sourceReportId ?? null,
      verifiedBy: userId,
      verifiedAt: now.toISOString(),
      originalContent: metadata.originalContent ?? null,
    };

    const rows: Array<Record<string, unknown>> = await this.txManager.run(
      tenantId,
      async (manager) => {
        return manager.query(
          `INSERT INTO knowledge_chunks
            (tenant_id, asset_id, content, chunk_index, metadata, embedding, is_verified, verified_by)
          VALUES ($1, NULL, $2, 0, $3, $4::vector, true, $5)
          RETURNING
            id,
            asset_id AS "assetId",
            content,
            chunk_index AS "chunkIndex",
            metadata,
            is_verified AS "isVerified",
            verified_by AS "verifiedBy",
            created_at AS "createdAt"`,
          [tenantId, content, JSON.stringify(insightMetadata), embeddingStr, userId],
        );
      },
    );

    const row = rows[0];

    this.logger.log({
      message: 'Validated insight stored',
      tenantId,
      sourceType: metadata.sourceType,
      sourceRunId: metadata.sourceRunId ?? null,
      contentLength: content.length,
    });

    return {
      id: row['id'] as string,
      assetId: (row['assetId'] as string) ?? null,
      content: row['content'] as string,
      chunkIndex: row['chunkIndex'] as number,
      metadata: row['metadata'] as Record<string, unknown>,
      isVerified: row['isVerified'] as boolean,
      verifiedBy: insightMetadata.verifiedBy,
      verifiedAt: insightMetadata.verifiedAt,
      sourceType: insightMetadata.sourceType,
      sourceRunId: insightMetadata.sourceRunId,
      sourceReportId: insightMetadata.sourceReportId,
    };
  }

  async getByRun(
    runId: string,
    tenantId: string,
  ): Promise<ValidatedInsightResponseDto[]> {
    const rows: Array<Record<string, unknown>> = await this.txManager.run(
      tenantId,
      async (manager) => {
        return manager.query(
          `SELECT
            id,
            asset_id AS "assetId",
            content,
            chunk_index AS "chunkIndex",
            metadata,
            is_verified AS "isVerified",
            verified_by AS "verifiedBy",
            created_at AS "createdAt"
          FROM knowledge_chunks
          WHERE tenant_id = $2
            AND is_verified = true
            AND deleted_at IS NULL
            AND metadata->>'sourceRunId' = $1
          ORDER BY created_at DESC`,
          [runId, tenantId],
        );
      },
    );

    return rows.map((row) => this.mapToResponseDto(row));
  }

  async getByTenant(
    tenantId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<ValidatedInsightResponseDto[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const rows: Array<Record<string, unknown>> = await this.txManager.run(
      tenantId,
      async (manager) => {
        return manager.query(
          `SELECT
            id,
            asset_id AS "assetId",
            content,
            chunk_index AS "chunkIndex",
            metadata,
            is_verified AS "isVerified",
            verified_by AS "verifiedBy",
            created_at AS "createdAt"
          FROM knowledge_chunks
          WHERE tenant_id = $3
            AND is_verified = true
            AND deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT $1 OFFSET $2`,
          [limit, offset, tenantId],
        );
      },
    );

    return rows.map((row) => this.mapToResponseDto(row));
  }

  async softDelete(insightId: string, tenantId: string): Promise<void> {
    const rows: Array<Record<string, unknown>> = await this.txManager.run(
      tenantId,
      async (manager) => {
        return manager.query(
          `UPDATE knowledge_chunks
          SET deleted_at = NOW()
          WHERE id = $1 AND tenant_id = $2 AND is_verified = true AND deleted_at IS NULL
          RETURNING id`,
          [insightId, tenantId],
        );
      },
    );

    if (rows.length === 0) {
      throw new NotFoundException(
        `Validated insight ${insightId} not found or already deleted`,
      );
    }

    this.logger.log({
      message: 'Validated insight soft-deleted',
      tenantId,
      insightId,
    });
  }

  private mapToResponseDto(
    row: Record<string, unknown>,
  ): ValidatedInsightResponseDto {
    const metadata = row['metadata'] as Record<string, unknown>;
    return {
      id: row['id'] as string,
      assetId: (row['assetId'] as string) ?? null,
      content: row['content'] as string,
      chunkIndex: row['chunkIndex'] as number,
      metadata,
      isVerified: row['isVerified'] as boolean,
      verifiedBy: (metadata['verifiedBy'] as string) ?? (row['verifiedBy'] as string),
      verifiedAt: (metadata['verifiedAt'] as string) ?? '',
      sourceType: (metadata['sourceType'] as string) ?? '',
      sourceRunId: (metadata['sourceRunId'] as string) ?? null,
      sourceReportId: (metadata['sourceReportId'] as string) ?? null,
    };
  }
}
