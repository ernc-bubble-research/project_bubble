import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { PerFileResult } from '../../types/workflow-job.interface';

export class WorkflowRunResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  tenantId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  versionId!: string;

  @ApiProperty({ enum: ['queued', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled'], example: 'queued' })
  status!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  startedBy!: string;

  @ApiProperty({ example: 0, default: 0 })
  creditsConsumed!: number;

  @ApiProperty({ example: false, default: false })
  isTestRun!: boolean;

  @ApiProperty({ example: 0, default: 0 })
  creditsFromMonthly!: number;

  @ApiProperty({ example: 0, default: 0 })
  creditsFromPurchased!: number;

  @ApiProperty({ example: 1, nullable: true, required: false })
  totalJobs?: number | null;

  @ApiProperty({ example: 0, nullable: true, required: false })
  completedJobs?: number | null;

  @ApiProperty({ example: 0, nullable: true, required: false })
  failedJobs?: number | null;

  @ApiProperty({ nullable: true, required: false, type: 'array' })
  perFileResults?: PerFileResult[] | null;

  @ApiProperty({ nullable: true, required: false, type: [String] })
  outputAssetIds?: string[] | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({ example: '2026-02-22T14:00:00.000Z', nullable: true })
  startedAt?: Date | null;

  @ApiPropertyOptional({ example: '2026-02-22T14:05:00.000Z', nullable: true })
  completedAt?: Date | null;

  @ApiPropertyOptional({ example: 300000, nullable: true, description: 'Duration in milliseconds' })
  durationMs?: number | null;

  @ApiPropertyOptional({ example: 'LLM provider timeout', nullable: true })
  errorMessage?: string | null;

  @ApiPropertyOptional({ example: 3, description: 'Maximum retry attempts per file' })
  maxRetryCount?: number;

  @ApiPropertyOptional({ example: 1, description: 'Credits charged per file' })
  creditsPerRun?: number;

  @ApiPropertyOptional({ example: 'My Analysis Workflow', description: 'Workflow template name from inputSnapshot' })
  templateName?: string;
}
