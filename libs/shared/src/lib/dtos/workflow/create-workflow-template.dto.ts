import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';

export class CreateWorkflowTemplateDto {
  @ApiProperty({ example: 'Analyze Transcript', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'Analyze a single interview transcript using a codebook' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['public', 'private'], default: 'public' })
  @IsOptional()
  @IsEnum(['public', 'private'] as const)
  visibility?: 'public' | 'private';

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Number of credits consumed per workflow run' })
  @IsOptional()
  @IsInt()
  @Min(1)
  creditsPerRun?: number;
}
