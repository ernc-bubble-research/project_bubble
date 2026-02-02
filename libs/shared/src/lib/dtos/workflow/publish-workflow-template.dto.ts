import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class PublishWorkflowTemplateDto {
  @ApiPropertyOptional({
    description: 'Specific version ID to publish. If omitted, uses current version.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  versionId?: string;
}
