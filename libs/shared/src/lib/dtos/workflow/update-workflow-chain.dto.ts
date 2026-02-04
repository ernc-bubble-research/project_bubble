import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  IsOptional,
  IsObject,
  IsEnum,
  IsArray,
  IsUUID,
} from 'class-validator';

export class UpdateWorkflowChainDto {
  @ApiPropertyOptional({ example: 'Updated Chain Name', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description for the chain' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'The updated chain definition', type: Object })
  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['public', 'private'], description: 'Chain visibility' })
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
  @IsUUID('4', { each: true })
  allowedTenants?: string[];
}
