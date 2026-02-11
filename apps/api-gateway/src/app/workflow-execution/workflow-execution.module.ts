import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowRunEntity } from '@project-bubble/db-layer';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowExecutionProcessor } from './workflow-execution.processor';
import { WorkflowExecutionService } from './workflow-execution.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowRunEntity]),
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
  ],
  providers: [WorkflowExecutionProcessor, WorkflowExecutionService],
  exports: [WorkflowExecutionService],
})
export class WorkflowExecutionModule {}
