import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsInt,
  IsBoolean,
  IsNumberString,
  IsObject,
  Min,
  Validate,
} from 'class-validator';
import { IsValidGenerationDefaultsConstraint } from './create-llm-model.dto';

export class UpdateLlmModelDto {
  @ApiPropertyOptional({ example: 'Gemini 2.0 Flash', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ example: 1000000, description: 'Maximum input token context window' })
  @IsOptional()
  @IsInt()
  @Min(1)
  contextWindow?: number;

  @ApiPropertyOptional({ example: 8192, description: 'Maximum output tokens' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOutputTokens?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '0.000150', description: 'Cost per 1k input tokens (decimal string)' })
  @IsOptional()
  @IsNumberString()
  costPer1kInput?: string;

  @ApiPropertyOptional({ example: '0.000600', description: 'Cost per 1k output tokens (decimal string)' })
  @IsOptional()
  @IsNumberString()
  costPer1kOutput?: string;

  @ApiPropertyOptional({ description: 'Generation parameter defaults (camelCase keys, e.g. { temperature: 0.7, topP: 0.9 })' })
  @IsOptional()
  @IsObject()
  @Validate(IsValidGenerationDefaultsConstraint)
  generationDefaults?: Record<string, unknown>;
}
