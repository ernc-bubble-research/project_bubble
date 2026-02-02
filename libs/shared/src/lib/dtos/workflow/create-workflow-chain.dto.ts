import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEnum,
  IsObject,
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

  @ApiPropertyOptional({ enum: ['public', 'private'], default: 'public' })
  @IsOptional()
  @IsEnum(['public', 'private'] as const)
  visibility?: 'public' | 'private';

  @ApiProperty({ description: 'The chain definition (steps and input mappings)', type: Object })
  @IsObject()
  @IsNotEmpty()
  definition!: Record<string, unknown>;
}
