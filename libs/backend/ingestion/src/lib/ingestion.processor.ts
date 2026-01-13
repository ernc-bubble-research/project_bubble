import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset, AssetStatus, AssetVector } from '@project_bubble/backend/infra';

@Processor('ingestion')
export class IngestionProcessor extends WorkerHost {
    private readonly logger = new Logger(IngestionProcessor.name);

    constructor(
        @InjectRepository(Asset)
        private assetRepo: Repository<Asset>,
        @InjectRepository(AssetVector)
        private vectorRepo: Repository<AssetVector>
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing job ${job.id} for asset ${job.data.assetId}`);

        // 1. Simulate Processing (Parsing PDF)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 2. Mock Chunking & Embedding
        // In real app: Calls LangChain / Gemini API
        const chunks = [
            { content: "This is chunk 1", embedding: [0.1, 0.2, 0.3] },
            { content: "This is chunk 2", embedding: [0.4, 0.5, 0.6] }
        ];

        // 3. Save Vectors
        for (const chunk of chunks) {
            const vector = new AssetVector();
            vector.assetId = job.data.assetId;
            vector.content = chunk.content;
            vector.embedding = chunk.embedding;
            vector.metadata = { source: 'mock_ingestion' };
            await this.vectorRepo.save(vector);
        }

        // 4. Update Asset Status to COMPLETED
        await this.assetRepo.update(job.data.assetId, {
            status: AssetStatus.COMPLETED
        });

        this.logger.log(`Asset ${job.data.assetId} processed. Created ${chunks.length} vectors.`);
        return {};
    }
}
