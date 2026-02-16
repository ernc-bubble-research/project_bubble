import { ApiProperty } from '@nestjs/swagger';

export class WorkflowVersionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  tenantId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  templateId!: string;

  @ApiProperty({ example: 1 })
  versionNumber!: number;

  @ApiProperty({ description: 'The full workflow definition as JSONB', type: Object })
  definition!: Record<string, unknown>;

  @ApiProperty({
    description: 'N-1 generation config snapshot for rollback (model UUID + param overrides)',
    type: Object,
    nullable: true,
    required: false,
  })
  previousGenerationConfig!: Record<string, unknown> | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  createdBy!: string;

  @ApiProperty()
  createdAt!: Date;
}
