import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { WorkflowTemplatesController } from './workflow-templates.controller';
import { WorkflowVersionsController } from './workflow-versions.controller';
import { WorkflowChainsController } from './workflow-chains.controller';
import {
  AppLlmModelsController,
  AdminLlmModelsController,
} from './llm-models.controller';
import { WorkflowCatalogController } from './workflow-catalog.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowTemplateEntity,
      WorkflowVersionEntity,
      WorkflowRunEntity,
      WorkflowChainEntity,
      LlmModelEntity,
    ]),
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
  ],
  exports: [
    WorkflowTemplatesService,
    WorkflowVersionsService,
    WorkflowChainsService,
    LlmModelsService,
  ],
})
export class WorkflowsModule {}
