import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { TransactionManager, AssetEntity } from '@project-bubble/db-layer';
import { ExecuteTestRunDto, TestRunResultDto, WorkflowRunInputValueDto, WorkflowDefinition, WorkflowJobSubjectFile } from '@project-bubble/shared';
import { TestRunCacheService } from '../services/test-run-cache.service';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { In } from 'typeorm';

@Injectable()
export class WorkflowTestService {
  private readonly logger = new Logger(WorkflowTestService.name);

  constructor(
    private readonly txManager: TransactionManager,
    @InjectQueue('workflow-execution') private readonly executionQueue: Queue,
    private readonly testRunCache: TestRunCacheService,
    private readonly templatesService: WorkflowTemplatesService,
  ) {}

  /**
   * Initiates a test run for a workflow template.
   * Validates template completeness, generates sessionId, and enqueues job.
   */
  async executeTest(
    templateId: string,
    inputs: Record<string, WorkflowRunInputValueDto>,
    adminUserId: string,
    tenantId: string,
  ): Promise<{ sessionId: string }> {
    // Load template + current version (Rule 2c compliant)
    const { template, version } = await this.templatesService.findOneWithVersion(
      templateId,
      tenantId,
    );

    // Extract definition from version
    const definition = version.definition as unknown as WorkflowDefinition;

    // Pre-flight validation (AC7)
    if (!definition.execution?.model) {
      throw new BadRequestException('Template must have LLM model selected (Prompt step)');
    }

    if (!definition.inputs || definition.inputs.length === 0) {
      throw new BadRequestException('Workflow must have at least one input defined (Inputs step)');
    }

    // Generate unique sessionId
    const sessionId = randomUUID();

    // Extract subject file asset IDs from inputs
    const subjectAssetIds: string[] = [];
    for (const [inputName, inputValue] of Object.entries(inputs)) {
      if (inputValue.type === 'asset' && inputValue.assetIds) {
        subjectAssetIds.push(...inputValue.assetIds);
      }
    }

    // Resolve subject files with metadata (Rule 2c compliant)
    const subjectFiles: WorkflowJobSubjectFile[] = await this.resolveSubjectFiles(
      subjectAssetIds,
      tenantId,
    );

    // Enqueue BullMQ job with isTestRun flag (AC1)
    await this.executionQueue.add(
      'execute-workflow',
      {
        isTestRun: true,
        sessionId,
        tenantId,
        versionId: version.id,
        definition,
        contextInputs: {}, // Test runs have no context inputs
        subjectFiles,
      },
      {
        jobId: sessionId, // Use sessionId as jobId for easy tracking
        attempts: 1, // Test runs don't retry on failure
      },
    );

    this.logger.log(`Test run enqueued: sessionId=${sessionId}, templateId=${template.id}`);

    return { sessionId };
  }

  /**
   * Exports test run results from in-memory cache.
   * Returns 404 if sessionId not found or expired (5-minute TTL).
   */
  async exportResults(sessionId: string): Promise<TestRunResultDto> {
    const cached = this.testRunCache.get(sessionId);

    if (!cached) {
      throw new NotFoundException('Test run not found or expired (5-minute TTL)');
    }

    return {
      sessionId: cached.sessionId,
      templateId: cached.templateId,
      templateName: cached.templateName,
      inputs: cached.inputs,
      results: cached.results,
      executedAt: cached.createdAt,
    };
  }

  /**
   * Resolves subject file metadata from asset IDs.
   * Loads originalName and storagePath from database (Rule 2c compliant).
   */
  private async resolveSubjectFiles(
    assetIds: string[],
    tenantId: string,
  ): Promise<WorkflowJobSubjectFile[]> {
    if (assetIds.length === 0) {
      return [];
    }

    return this.txManager.run(tenantId, async (manager) => {
      const assets = await manager.find(AssetEntity, {
        where: { id: In(assetIds), tenantId },
      });

      // Validate all requested assets were found
      if (assets.length !== assetIds.length) {
        const foundIds = new Set(assets.map((a) => a.id));
        const missing = assetIds.filter((id) => !foundIds.has(id));
        throw new BadRequestException(
          `Subject file asset(s) not found: ${missing.join(', ')}`,
        );
      }

      // Return in the same order as input assetIds
      const assetMap = new Map(assets.map((a) => [a.id, a]));
      return assetIds.map((id) => {
        const asset = assetMap.get(id)!;
        return {
          assetId: asset.id,
          originalName: asset.originalName,
          storagePath: asset.storagePath,
        };
      });
    });
  }
}
