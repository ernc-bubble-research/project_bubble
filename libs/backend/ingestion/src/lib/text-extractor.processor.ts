import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { INGESTION_QUEUE, IngestionJob } from './ingestion.queue';
import { PrismaService } from '@bubble/backend/core';
import * as fs from 'fs';
const sanitizeHtml = require('sanitize-html');
const pdf = require('pdf-parse');

@Processor(INGESTION_QUEUE)
export class TextExtractorProcessor extends WorkerHost {
    constructor(private prisma: PrismaService) {
        super();
        console.log('TextExtractorProcessor Initialized!');
    }

    async process(job: Job<{ assetId: string }>): Promise<any> {
        console.log(`Processing Job: ${job.name} for Asset: ${job.data?.assetId}`);
        if (job.name !== IngestionJob.EXTRACT_TEXT) return;

        const { assetId } = job.data;
        const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });

        if (!asset) throw new Error(`Asset ${assetId} not found`);

        console.log(`Extracting text for asset: ${asset.originalName}`);

        // Mock loading from S3/Storage - assuming local file for MVP Phase 1
        // In real storage, we'd getter from asset.storagePath
        // For now, we simulate by reading a test file or expected path
        const fileBuffer = fs.readFileSync(asset.storagePath); // Ensure path is absolute or relative to cwd

        let rawText = '';
        if (asset.mimeType === 'application/pdf') {
            const data = await pdf(fileBuffer);
            rawText = data.text;
        } else {
            // Assume text/markdown
            rawText = fileBuffer.toString('utf-8');
        }

        // SANITIZATION (Critical Security Requirement)
        // sanitize-html defaults are safe (strips scripts, etc.)
        const sanitizedText = sanitizeHtml(rawText, {
            allowedTags: [], // Strip all HTML tags for pure text extraction
            allowedAttributes: {},
        });

        await this.prisma.asset.update({
            where: { id: assetId },
            data: { extractedText: sanitizedText },
        });

        console.log(`Text extracted and sanitized for asset ${assetId}`);
        return { success: true, length: sanitizedText.length };
    }
}
