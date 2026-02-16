import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class DeactivateModelDto {
  @ApiProperty({
    description: 'UUID of the replacement model to assign to affected workflows',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  replacementModelId!: string;
}

export class AffectedWorkflowDto {
  @ApiProperty({ description: 'Workflow version ID' })
  versionId!: string;

  @ApiProperty({ description: 'Workflow template ID' })
  templateId!: string;

  @ApiProperty({ description: 'Template name for display' })
  templateName!: string;

  @ApiProperty({ description: 'Version number' })
  versionNumber!: number;

  @ApiProperty({ description: 'Template status (draft, published, archived)' })
  templateStatus!: string;
}

export class DeactivateModelResponseDto {
  @ApiProperty({ description: 'Number of workflow versions reassigned' })
  versionsReassigned!: number;

  @ApiProperty({ description: 'The model ID that was deactivated' })
  deactivatedModelId!: string;

  @ApiProperty({ description: 'The replacement model ID' })
  replacementModelId!: string;
}
