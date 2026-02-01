import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IngestionService } from './ingestion.service';

interface IndexAssetJobData {
  assetId: string;
  tenantId: string;
}

@Processor('ingestion')
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(private readonly ingestionService: IngestionService) {
    super();
  }

  async process(job: Job<IndexAssetJobData>): Promise<void> {
    const { assetId, tenantId } = job.data;

    this.logger.log({
      message: 'Processing ingestion job',
      jobId: job.id,
      assetId,
      tenantId,
    });

    try {
      await this.ingestionService.processIndexing(assetId, tenantId);
      this.logger.log({
        message: 'Ingestion job completed',
        jobId: job.id,
        assetId,
      });
    } catch (error) {
      this.logger.error({
        message: 'Ingestion job failed',
        jobId: job.id,
        assetId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
