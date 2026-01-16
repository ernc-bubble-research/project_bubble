import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { INGESTION_QUEUE, IngestionJob } from './ingestion.queue';
import { PrismaService } from '@bubble/backend/core';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Processor(INGESTION_QUEUE)
export class VectorEmbedderProcessor extends WorkerHost {
    private genAI: GoogleGenerativeAI;

    constructor(private prisma: PrismaService) {
        super();
        this.genAI = new GoogleGenerativeAI(process.env['GEMINI_API_KEY'] || '');
    }

    async process(job: Job<{ assetId: string }>): Promise<any> {
        if (job.name !== IngestionJob.EMBED_TEXT) return;

        const { assetId } = job.data;
        const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });

        if (!asset || !asset.extractedText) throw new Error(`Asset ${assetId} has no text to embed`);

        console.log(`Embedding text for asset: ${asset.originalName}`);

        const model = this.genAI.getGenerativeModel({ model: 'embedding-001' });

        // Chunking logic would go here (omitted for MVP simplicity - taking first 2000 chars)
        const textSnippet = asset.extractedText.substring(0, 2000);

        const result = await model.embedContent(textSnippet);
        const embedding = result.embedding.values; // Array of numbers

        // Store in pgvector using raw query
        // Prisma doesn't support writing vectors natively yet without TypedSQL or Raw
        const vectorString = `[${embedding.join(',')}]`;

        await this.prisma.$executeRaw`
      UPDATE assets 
      SET embedding = ${vectorString}::vector
      WHERE id = ${assetId}
    `;

        console.log(`Embedding stored for asset ${assetId}`);
        return { success: true };
    }
}
