import { ApiProperty } from '@nestjs/swagger';

export class WorkflowRunResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  tenantId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  versionId!: string;

  @ApiProperty({ enum: ['queued', 'running', 'completed', 'failed', 'cancelled'], example: 'queued' })
  status!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  startedBy!: string;

  @ApiProperty({ example: 0, default: 0 })
  creditsConsumed!: number;

  @ApiProperty()
  createdAt!: Date;
}
