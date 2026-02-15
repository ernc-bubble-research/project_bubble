import { Module } from '@nestjs/common';
import { WorkflowsModule } from '../workflows/workflows.module';
import { AssetsModule } from '../assets/assets.module';
import { WorkflowExecutionModule } from '../workflow-execution/workflow-execution.module';
import { SettingsModule } from '../settings/settings.module';
import { WorkflowRunsController } from './workflow-runs.controller';
import { WorkflowRunsService } from './workflow-runs.service';
import { PreFlightValidationService } from './pre-flight-validation.service';

@Module({
  imports: [WorkflowsModule, AssetsModule, WorkflowExecutionModule, SettingsModule],
  controllers: [WorkflowRunsController],
  providers: [WorkflowRunsService, PreFlightValidationService],
})
export class WorkflowRunsModule {}
