import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BackendCoreModule } from '@bubble/backend/core';
import { INGESTION_QUEUE } from './ingestion.queue';
import { TextExtractorProcessor } from './text-extractor.processor';
import { VectorEmbedderProcessor } from './vector-embedder.processor';

@Module({
    imports: [
        BackendCoreModule,
        BullModule.registerQueue({
            name: INGESTION_QUEUE,
        }),
    ],
    providers: [TextExtractorProcessor, VectorEmbedderProcessor],
    exports: [BullModule],
})
export class IngestionModule { }
