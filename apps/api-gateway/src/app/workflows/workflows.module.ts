import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  WorkflowTemplateEntity,
  WorkflowVersionEntity,
  LlmModelEntity,
} from '@project-bubble/db-layer';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { WorkflowVersionsService } from './workflow-versions.service';
import { LlmModelsService } from './llm-models.service';
import { WorkflowTemplatesController } from './workflow-templates.controller';
import { WorkflowVersionsController } from './workflow-versions.controller';
import {
  AppLlmModelsController,
  AdminLlmModelsController,
} from './llm-models.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowTemplateEntity,
      WorkflowVersionEntity,
      LlmModelEntity,
    ]),
  ],
  controllers: [
    WorkflowTemplatesController,
    WorkflowVersionsController,
    AppLlmModelsController,
    AdminLlmModelsController,
  ],
  providers: [
    WorkflowTemplatesService,
    WorkflowVersionsService,
    LlmModelsService,
  ],
  exports: [
    WorkflowTemplatesService,
    WorkflowVersionsService,
    LlmModelsService,
  ],
})
export class WorkflowsModule {}
