import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';

export enum InsightSourceType {
  REPORT_FEEDBACK = 'report_feedback',
  ASSUMPTION_CORRECTION = 'assumption_correction',
  MANUAL_ENTRY = 'manual_entry',
}

export class CreateValidatedInsightDto {
  @ApiProperty({
    example: 'User confirmed that Trust was the dominant theme in Q3 interviews.',
    description: 'The validated insight text content',
    minLength: 1,
    maxLength: 10000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;

  @ApiProperty({
    enum: InsightSourceType,
    example: InsightSourceType.REPORT_FEEDBACK,
    description: 'How this insight was produced',
  })
  @IsEnum(InsightSourceType)
  sourceType!: InsightSourceType;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID of the workflow run that produced this insight',
  })
  @IsOptional()
  @IsUUID()
  sourceRunId?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'UUID of the report where feedback was given',
  })
  @IsOptional()
  @IsUUID()
  sourceReportId?: string;

  @ApiPropertyOptional({
    example: 'Trust was NOT the dominant theme.',
    description: 'Original text before correction (if applicable)',
    maxLength: 10000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  originalContent?: string;
}
