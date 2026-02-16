import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNumberString,
  IsObject,
  Min,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';
import { GENERATION_PARAM_KEY_MAP } from '../../types/workflow-definition.interface';

const VALID_CAMEL_KEYS = new Set(Object.values(GENERATION_PARAM_KEY_MAP));

@ValidatorConstraint({ name: 'isValidGenerationDefaults', async: false })
export class IsValidGenerationDefaultsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value !== 'object' || Array.isArray(value)) return false;
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (!VALID_CAMEL_KEYS.has(key)) return false;
      if (typeof val === 'number' && !Number.isNaN(val)) continue;
      if (Array.isArray(val) && val.every((v) => typeof v === 'string')) continue;
      return false;
    }
    return true;
  }

  defaultMessage(): string {
    return 'generationDefaults must contain only known param keys (temperature, topP, topK, maxOutputTokens, stopSequences) with numeric values or string arrays';
  }
}

export class CreateLlmModelDto {
  @ApiProperty({ example: 'google-ai-studio', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  providerKey!: string;

  @ApiProperty({ example: 'models/gemini-2.0-flash', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  modelId!: string;

  @ApiProperty({ example: 'Gemini 2.0 Flash', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName!: string;

  @ApiProperty({ example: 1000000, description: 'Maximum input token context window' })
  @IsInt()
  @Min(1)
  contextWindow!: number;

  @ApiProperty({ example: 8192, description: 'Maximum output tokens' })
  @IsInt()
  @Min(1)
  maxOutputTokens!: number;

  @ApiPropertyOptional({ example: false, default: false })
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
