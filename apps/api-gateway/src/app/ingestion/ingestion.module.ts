import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { TextExtractorService } from './text-extractor.service';
import { ChunkerService } from './chunker.service';
import {
  GeminiEmbeddingProvider,
  MockEmbeddingProvider,
} from './embedding.service';
import { EMBEDDING_PROVIDER } from './embedding.provider';
import { IngestionService } from './ingestion.service';
import { IngestionProcessor } from './ingestion.processor';
import { IngestionController } from './ingestion.controller';

// BullMQ processor runs in api-gateway for MVP.
// Worker-engine is reserved for Epic 4 (LangGraph workflow execution).
// Ingestion is lightweight enough to coexist here for now.

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'ingestion',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [IngestionController],
  providers: [
    TextExtractorService,
    ChunkerService,
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('EMBEDDING_PROVIDER') || 'gemini';
        if (provider === 'mock') {
          return new MockEmbeddingProvider();
        }
        return new GeminiEmbeddingProvider(config);
      },
      inject: [ConfigService],
    },
    IngestionService,
    IngestionProcessor,
  ],
  exports: [IngestionService, EMBEDDING_PROVIDER],
})
export class IngestionModule {}
