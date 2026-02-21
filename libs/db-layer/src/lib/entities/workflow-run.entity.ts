import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { WorkflowVersionEntity } from './workflow-version.entity';
import { WorkflowChainEntity } from './workflow-chain.entity';
import { LlmModelEntity } from './llm-model.entity';
import type { PerFileResult } from '@project-bubble/shared';

export enum WorkflowRunStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  COMPLETED_WITH_ERRORS = 'completed_with_errors',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('workflow_runs')
@Check('"version_id" IS NOT NULL OR "chain_id" IS NOT NULL')
@Index(['status'])
@Index(['startedBy'])
@Index(['chainId', 'chainStepIndex'])
@Index(['tenantId', 'createdAt'])
export class WorkflowRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => WorkflowVersionEntity, { nullable: true })
  @JoinColumn({ name: 'version_id' })
  version?: WorkflowVersionEntity;

  @Column({ name: 'version_id', type: 'uuid', nullable: true })
  versionId!: string | null;

  @ManyToOne(() => WorkflowChainEntity, { nullable: true })
  @JoinColumn({ name: 'chain_id' })
  chain?: WorkflowChainEntity;

  @Column({ name: 'chain_id', type: 'uuid', nullable: true })
  chainId!: string | null;

  @Column({ name: 'chain_step_index', type: 'int', nullable: true })
  chainStepIndex!: number | null;

  @Column({
    type: 'enum',
    enum: WorkflowRunStatus,
    default: WorkflowRunStatus.QUEUED,
  })
  status!: WorkflowRunStatus;

  @Column({ name: 'started_by', type: 'uuid' })
  startedBy!: string;

  @Column({ name: 'input_snapshot', type: 'jsonb' })
  inputSnapshot!: Record<string, unknown>;

  @Column({ name: 'output_asset_ids', type: 'uuid', array: true, nullable: true })
  outputAssetIds!: string[] | null;

  @Column({ name: 'assembled_prompt', type: 'text', nullable: true })
  assembledPrompt!: string | null;

  @Column({ name: 'raw_llm_response', type: 'text', nullable: true })
  rawLlmResponse!: string | null;

  @Column({ name: 'retry_history', type: 'jsonb', nullable: true })
  retryHistory!: Record<string, unknown>[] | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'validation_warnings', type: 'text', array: true, nullable: true })
  validationWarnings!: string[] | null;

  @Column({ name: 'token_usage', type: 'jsonb', nullable: true })
  tokenUsage!: Record<string, unknown> | null;

  @ManyToOne(() => LlmModelEntity, { nullable: true })
  @JoinColumn({ name: 'model_id' })
  model?: LlmModelEntity;

  @Column({ name: 'model_id', type: 'uuid', nullable: true })
  modelId!: string | null;

  @Column({ name: 'credits_consumed', type: 'int', default: 0 })
  creditsConsumed!: number;

  @Column({ name: 'is_test_run', type: 'boolean', default: false })
  isTestRun!: boolean;

  @Column({ name: 'credits_from_monthly', type: 'int', default: 0 })
  creditsFromMonthly!: number;

  @Column({ name: 'credits_from_purchased', type: 'int', default: 0 })
  creditsFromPurchased!: number;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'last_retried_at', type: 'timestamp', nullable: true })
  lastRetriedAt!: Date | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs!: number | null;

  @Column({ name: 'total_jobs', type: 'int', nullable: true })
  totalJobs!: number | null;

  @Column({ name: 'completed_jobs', type: 'int', nullable: true })
  completedJobs!: number | null;

  @Column({ name: 'failed_jobs', type: 'int', nullable: true })
  failedJobs!: number | null;

  @Column({ name: 'per_file_results', type: 'jsonb', nullable: true })
  perFileResults!: PerFileResult[] | null;

  @Column({ name: 'max_retry_count', type: 'int', default: 3 })
  maxRetryCount!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
