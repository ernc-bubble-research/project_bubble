import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsArray,
  Matches,
} from 'class-validator';

export class UpdateWorkflowTemplateDto {
  @ApiPropertyOptional({ example: 'Updated Workflow Name', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['public', 'private'] })
  @IsOptional()
  @IsEnum(['public', 'private'] as const)
  visibility?: 'public' | 'private';

  @ApiPropertyOptional({ type: [String], description: 'Tenant UUIDs allowed when visibility is private' })
  @IsOptional()
  @IsArray()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { each: true, message: 'each value in allowedTenants must be a valid UUID' })
  allowedTenants?: string[];

  @ApiPropertyOptional({ enum: ['draft', 'published', 'archived'] })
  @IsOptional()
  @IsEnum(['draft', 'published', 'archived'] as const)
  status?: 'draft' | 'published' | 'archived';
}
