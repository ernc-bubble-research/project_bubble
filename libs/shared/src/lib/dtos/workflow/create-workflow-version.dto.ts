import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsUUID } from 'class-validator';

export class CreateWorkflowVersionDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'ID of the workflow template' })
  @IsUUID()
  @IsNotEmpty()
  templateId!: string;

  @ApiProperty({ description: 'The full workflow definition (YAML schema stored as JSON)', type: Object })
  @IsObject()
  @IsNotEmpty()
  definition!: Record<string, unknown>;
}
