
// Scripts usually run outside of Nx context easily, but we can use ts-node via the apps/api context or just use a small standalone script that connects to Redis/Postgres.
// Easiest is to make a small NestJS stand-alone app or just a script using the libraries.
// Since we have the libraries, let's make a script in `tools/scripts/verify-ingestion.ts`.

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BackendCoreModule, PrismaService } from '@bubble/backend/core';
import { INGESTION_QUEUE, IngestionJob } from '@bubble/backend/ingestion';
import * as fs from 'fs';
import * as path from 'path';

// Mini App to inject dependencies
@Module({
    imports: [
        BackendCoreModule,
        BullModule.forRoot({
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
            },
        }),
        BullModule.registerQueue({
            name: INGESTION_QUEUE,
        }),
    ],
})
class SmokeTestModule { }

async function bootstrap() {
    console.log('🚀 Starting Ingestion Smoke Test...');

    const app = await NestFactory.createApplicationContext(SmokeTestModule);
    const prisma = app.get(PrismaService);
    // @ts-ignore
    const ingestionQueue = app.get<Queue>(`BullQueue_${INGESTION_QUEUE}`);

    // 1. Create Test Tenant
    console.log('1. Creating Test Tenant...');
    let tenant = await prisma.tenant.findFirst({ where: { name: 'SmokeTestTenant' } });
    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: { name: 'SmokeTestTenant' },
        });
    }
    console.log(`   Tenant ID: ${tenant.id}`);

    // 2. Create Test Asset
    console.log('2. Creating Test Asset...');
    const testFilePath = path.join(__dirname, 'smoke-test-asset.txt');
    fs.writeFileSync(testFilePath, 'This is a smoke test asset with <script>evil</script> content.');

    const asset = await prisma.asset.create({
        data: {
            tenantId: tenant.id,
            originalName: 'smoke-test-asset.txt',
            storagePath: testFilePath,
            mimeType: 'text/plain',
            sizeBytes: 100,
        },
    });
    console.log(`   Asset ID: ${asset.id}`);

    // 3. Trigger Job
    console.log('3. Triggering Extraction Job...');
    await ingestionQueue.add(IngestionJob.EXTRACT_TEXT, { assetId: asset.id });
    console.log('   Job added to queue.');

    // 4. Poll for Result
    console.log('4. Waiting for Worker to Process (30s timeout)...');
    let processed = false;
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const latestAsset = await prisma.asset.findUnique({ where: { id: asset.id } });
        if (latestAsset?.extractedText) {
            console.log('✅ Asset Processed!');
            console.log(`   Extracted Text: "${latestAsset.extractedText}"`);
            if (latestAsset.extractedText === 'This is a smoke test asset with  content.') {
                console.log('✅ Sanitization Verified!');
            } else {
                console.error('❌ Sanitization Failed or Unexpected Content');
            }
            processed = true;
            break;
        }
    }

    if (!processed) {
        console.error('❌ Timeout: Worker did not process the job in time.');
        console.log('   Ensure "nx serve worker" is running!');
    }

    // Cleanup
    await prisma.asset.delete({ where: { id: asset.id } });
    // await prisma.tenant.delete({ where: { id: tenant.id } }); // Keep tenant for debugging
    fs.unlinkSync(testFilePath);

    await app.close();
    process.exit(processed ? 0 : 1);
}

bootstrap();
