import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Asset, AssetStatus } from '@project_bubble/backend/infra';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AssetsService {
    constructor(@InjectQueue('ingestion') private ingestionQueue: Queue) { }

    async createAsset(
        originalName: string,
        storagePath: string,
        mimeType: string,
        tenantId: string,
        manager: EntityManager
    ): Promise<Asset> {
        const asset = new Asset();
        asset.originalName = originalName;
        asset.storagePath = storagePath;
        asset.mimeType = mimeType;
        asset.tenantId = tenantId;
        asset.status = AssetStatus.PENDING;

        // Save to DB
        const savedAsset = await manager.save(Asset, asset);

        // Push to Queue
        // IMPORTANT: In a real distributed system, we should use the Outbox Pattern or 
        // commit the transaction BEFORE pushing to queue to avoid race conditions.
        // For now, we push after save.
        await this.ingestionQueue.add('process-asset', {
            assetId: savedAsset.id,
            tenantId: savedAsset.tenantId,
            filePath: savedAsset.storagePath,
            mimeType: savedAsset.mimeType
        });

        return savedAsset;
    }
}
