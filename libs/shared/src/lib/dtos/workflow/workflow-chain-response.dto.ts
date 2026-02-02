import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkflowChainResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  tenantId!: string;

  @ApiProperty({ example: 'Full Qualitative Analysis' })
  name!: string;

  @ApiPropertyOptional({ example: 'Analyze transcripts then consolidate findings' })
  description!: string | null;

  @ApiProperty({ enum: ['public', 'private'], example: 'public' })
  visibility!: string;

  @ApiPropertyOptional({ type: [String] })
  allowedTenants!: string[] | null;

  @ApiProperty({ description: 'The chain definition as JSONB', type: Object })
  definition!: Record<string, unknown>;

  @ApiProperty({ enum: ['draft', 'published', 'archived'], example: 'draft' })
  status!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  createdBy!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
