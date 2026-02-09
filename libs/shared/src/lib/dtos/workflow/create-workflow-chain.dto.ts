import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  Matches,
} from 'class-validator';

export class CreateWorkflowChainDto {
  @ApiProperty({ example: 'Full Qualitative Analysis', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'Analyze transcripts then consolidate findings' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'The chain definition (steps and input mappings)', type: Object })
  @IsObject()
  @IsNotEmpty()
  definition!: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['public', 'private'], default: 'public' })
  @IsOptional()
  @IsEnum(['public', 'private'] as const)
  visibility?: 'public' | 'private';

  @ApiPropertyOptional({
    description: 'Tenant UUIDs allowed to access this chain (required when visibility is private)',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsOptional()
  @IsArray()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { each: true, message: 'each value in allowedTenants must be a valid UUID' })
  allowedTenants?: string[];
}
