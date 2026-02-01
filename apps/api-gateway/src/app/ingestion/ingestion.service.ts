import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import {
  TransactionManager,
  AssetEntity,
  KnowledgeChunkEntity,
} from '@project-bubble/db-layer';
import { TextExtractorService } from './text-extractor.service';
import { ChunkerService } from './chunker.service';
import { EmbeddingProvider, EMBEDDING_PROVIDER } from './embedding.provider';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly txManager: TransactionManager,
    private readonly textExtractor: TextExtractorService,
    private readonly chunker: ChunkerService,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
    @InjectQueue('ingestion') private readonly ingestionQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  async indexAsset(
    assetId: string,
    tenantId: string,
  ): Promise<{ jobId: string }> {
    // Validate asset exists and is not already indexed
    const asset = await this.txManager.run(tenantId, async (manager) => {
      return manager.findOne(AssetEntity, { where: { id: assetId } });
    });

    if (!asset) {
      throw new NotFoundException(`Asset "${assetId}" not found`);
    }

    if (asset.isIndexed) {
      throw new BadRequestException(
        `Asset "${assetId}" is already indexed in the Knowledge Base`,
      );
    }

    const jobId = `idx-${uuidv4()}`;

    await this.ingestionQueue.add(
      'index-asset',
      { assetId, tenantId },
      { jobId },
    );

    this.logger.log({
      message: 'Indexing job queued',
      jobId,
      assetId,
      tenantId,
    });

    return { jobId };
  }

  async processIndexing(
    assetId: string,
    tenantId: string,
  ): Promise<void> {
    this.logger.log({
      message: 'Processing indexing',
      assetId,
      tenantId,
    });

    // Load asset
    const asset = await this.txManager.run(tenantId, async (manager) => {
      return manager.findOne(AssetEntity, { where: { id: assetId } });
    });

    if (!asset) {
      throw new NotFoundException(`Asset "${assetId}" not found during processing`);
    }

    try {
      // Step 1: Extract text
      const extracted = await this.textExtractor.extract(
        asset.storagePath,
        asset.mimeType,
      );

      if (!extracted.text || extracted.text.trim().length === 0) {
        this.logger.warn({
          message: 'No text extracted from asset',
          assetId,
        });
        return;
      }

      // Step 2: Chunk text
      const chunkSize = parseInt(
        this.config.get<string>('CHUNK_SIZE') || '2000',
        10,
      );
      const overlap = parseInt(
        this.config.get<string>('CHUNK_OVERLAP') || '400',
        10,
      );
      const chunks = this.chunker.chunk(extracted.text, {
        chunkSize,
        overlap,
      });

      if (chunks.length === 0) {
        this.logger.warn({
          message: 'No chunks generated from extracted text',
          assetId,
        });
        return;
      }

      // Step 3: Embed chunks
      const texts = chunks.map((c) => c.content);
      const embeddings = await this.embeddingProvider.embed(texts);

      // Step 4: Store chunks + update isIndexed in a single transaction
      await this.txManager.run(tenantId, async (manager) => {
        const chunkEntities = chunks.map((chunk, i) => {
          return manager.create(KnowledgeChunkEntity, {
            tenantId,
            assetId,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            metadata: {
              ...chunk.metadata,
              ...(extracted.pages ? { totalPages: extracted.pages } : {}),
            },
            embedding: embeddings[i],
          });
        });

        await manager.save(KnowledgeChunkEntity, chunkEntities);
        await manager.update(AssetEntity, { id: assetId }, { isIndexed: true });
      });

      this.logger.log({
        message: 'Indexing completed',
        assetId,
        chunkCount: chunks.length,
        embeddingDimensions: embeddings[0]?.length,
      });
    } catch (error) {
      // On failure: clean up any partial chunks and keep isIndexed = false
      this.logger.error({
        message: 'Indexing failed, cleaning up partial data',
        assetId,
        error: error instanceof Error ? error.message : String(error),
      });

      try {
        await this.txManager.run(tenantId, async (manager) => {
          await manager.delete(KnowledgeChunkEntity, { assetId });
        });
      } catch (cleanupError) {
        this.logger.error({
          message: 'Failed to clean up partial chunks',
          assetId,
          error:
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError),
        });
      }

      throw error;
    }
  }

  async deIndexAsset(
    assetId: string,
    tenantId: string,
  ): Promise<void> {
    const asset = await this.txManager.run(tenantId, async (manager) => {
      return manager.findOne(AssetEntity, { where: { id: assetId } });
    });

    if (!asset) {
      throw new NotFoundException(`Asset "${assetId}" not found`);
    }

    if (!asset.isIndexed) {
      throw new BadRequestException(
        `Asset "${assetId}" is not indexed in the Knowledge Base`,
      );
    }

    await this.txManager.run(tenantId, async (manager) => {
      await manager.delete(KnowledgeChunkEntity, { assetId });
      await manager.update(AssetEntity, { id: assetId }, { isIndexed: false });
    });

    this.logger.log({
      message: 'Asset de-indexed',
      assetId,
      tenantId,
    });
  }
}
