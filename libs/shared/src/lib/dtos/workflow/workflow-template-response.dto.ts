import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowVersionResponseDto } from './workflow-version-response.dto';

export class WorkflowTemplateResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  tenantId!: string;

  @ApiProperty({ example: 'Analyze Transcript' })
  name!: string;

  @ApiPropertyOptional({ example: 'Analyze a single interview transcript' })
  description!: string | null;

  @ApiProperty({ enum: ['public', 'private'], example: 'public' })
  visibility!: string;

  @ApiPropertyOptional({ type: [String] })
  allowedTenants!: string[] | null;

  @ApiProperty({ enum: ['draft', 'published', 'archived'], example: 'draft' })
  status!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  currentVersionId!: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  createdBy!: string;

  @ApiPropertyOptional({ type: () => WorkflowVersionResponseDto, description: 'Current version details (included on single-resource GET)' })
  currentVersion?: WorkflowVersionResponseDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
