import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import {
  WorkflowTemplateEntity,
  WorkflowVersionEntity,
  WorkflowRunEntity,
  WorkflowChainEntity,
  LlmModelEntity,
} from '@project-bubble/db-layer';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { WorkflowVersionsService } from './workflow-versions.service';
import { WorkflowChainsService } from './workflow-chains.service';
import { LlmModelsService } from './llm-models.service';
import { ModelReassignmentService } from './model-reassignment.service';
import { WorkflowTestService } from './workflow-test.service';
import { TestRunCacheService } from '../services/test-run-cache.service';
import { TestRunGateway } from '../gateways/test-run.gateway';
import { WorkflowTemplatesController } from './workflow-templates.controller';
import { WorkflowVersionsController } from './workflow-versions.controller';
import { WorkflowChainsController } from './workflow-chains.controller';
import {
  AppLlmModelsController,
  AdminLlmModelsController,
} from './llm-models.controller';
import { WorkflowCatalogController } from './workflow-catalog.controller';
import { ProviderRegistryModule } from '../workflow-execution/llm/provider-registry.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowTemplateEntity,
      WorkflowVersionEntity,
      WorkflowRunEntity,
      WorkflowChainEntity,
      LlmModelEntity,
    ]),
    BullModule.registerQueue({ name: 'workflow-execution' }),
    ProviderRegistryModule,
  ],
  controllers: [
    WorkflowTemplatesController,
    WorkflowVersionsController,
    WorkflowChainsController,
    WorkflowCatalogController,
    AppLlmModelsController,
    AdminLlmModelsController,
  ],
  providers: [
    WorkflowTemplatesService,
    WorkflowVersionsService,
    WorkflowChainsService,
    LlmModelsService,
    ModelReassignmentService,
    WorkflowTestService,
    TestRunCacheService,
    TestRunGateway,
  ],
  exports: [
    WorkflowTemplatesService,
    WorkflowVersionsService,
    WorkflowChainsService,
    LlmModelsService,
    ModelReassignmentService,
  ],
})
export class WorkflowsModule {}
