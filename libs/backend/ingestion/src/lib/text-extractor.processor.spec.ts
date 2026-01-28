import { Test, TestingModule } from '@nestjs/testing';
import { TextExtractorProcessor } from './text-extractor.processor';
import { Job } from 'bullmq';
import { PrismaService } from '@bubble/backend/core';

// Mock dependencies
jest.mock('fs', () => ({
    readFileSync: jest.fn().mockReturnValue(Buffer.from('Mock content')),
}));
jest.mock('pdf-parse', () => jest.fn().mockResolvedValue({ text: 'Mock PDF Content' }));
jest.mock('@bubble/backend/core', () => ({
    PrismaService: jest.fn().mockImplementation(() => ({
        asset: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    })),
}));


describe('TextExtractorProcessor', () => {
    let processor: TextExtractorProcessor;
    let prismaService: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TextExtractorProcessor,
                PrismaService, // Uses the mock from jest.mock above
            ],
        }).compile();

        processor = module.get<TextExtractorProcessor>(TextExtractorProcessor);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(processor).toBeDefined();
    });

    it('should sanitize valid text', async () => {
        const assetId = '123';
        // We access the mock instance methods directly
        const assetMock = {
            id: assetId,
            originalName: 'test.txt',
            storagePath: '/tmp/test.txt',
            mimeType: 'text/plain',
        };
        (prismaService.asset.findUnique as jest.Mock).mockResolvedValue(assetMock);

        // Mock readFileSync to return malicious string
        const maliciousText = 'Hello <script>alert("xss")</script> world';
        const fs = require('fs');
        (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from(maliciousText));

        await processor.process({ name: 'extract_text', data: { assetId } } as Job);

        expect(prismaService.asset.update).toHaveBeenCalledWith({
            where: { id: assetId },
            data: { extractedText: 'Hello  world' }, // sanitize-html preserves whitespace by default
        });
    });
});
