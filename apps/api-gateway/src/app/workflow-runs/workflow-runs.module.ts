import { Module } from '@nestjs/common';
import { WorkflowsModule } from '../workflows/workflows.module';
import { AssetsModule } from '../assets/assets.module';
import { WorkflowExecutionModule } from '../workflow-execution/workflow-execution.module';
import { WorkflowRunsController } from './workflow-runs.controller';
import { WorkflowRunsService } from './workflow-runs.service';

@Module({
  imports: [WorkflowsModule, AssetsModule, WorkflowExecutionModule],
  controllers: [WorkflowRunsController],
  providers: [WorkflowRunsService],
})
export class WorkflowRunsModule {}
