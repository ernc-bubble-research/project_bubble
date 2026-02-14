import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNumberString,
  Min,
} from 'class-validator';

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
}
