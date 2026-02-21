import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {
  WorkflowRunEntity,
  LlmModelEntity,
  AssetEntity,
  LlmProviderConfigEntity,
} from '@project-bubble/db-layer';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowExecutionProcessor } from './workflow-execution.processor';
import { WorkflowExecutionService } from './workflow-execution.service';
import { LlmProviderFactory } from './llm/llm-provider.factory';
import { ProviderRegistryModule } from './llm/provider-registry.module';
import { PromptAssemblyService } from './prompt-assembly.service';
import { TestRunCacheService } from '../services/test-run-cache.service';
import { TestRunGateway } from '../gateways/test-run.gateway';
import { SettingsModule } from '../settings/settings.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowRunEntity,
      LlmModelEntity,
      AssetEntity,
      LlmProviderConfigEntity,
    ]),
    BullModule.registerQueue({
      name: 'workflow-execution',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    }),
    BullModule.registerQueue({
      name: 'workflow-execution-dlq',
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
      },
    }),
    SettingsModule,
    ProviderRegistryModule,
    IngestionModule,
    AssetsModule,
  ],
  providers: [
    WorkflowExecutionProcessor,
    WorkflowExecutionService,
    LlmProviderFactory,
    PromptAssemblyService,
    TestRunCacheService,
    TestRunGateway,
  ],
  exports: [WorkflowExecutionService, ProviderRegistryModule, BullModule],
})
export class WorkflowExecutionModule {}
