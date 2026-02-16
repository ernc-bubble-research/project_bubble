import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LlmModelResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'google-ai-studio' })
  providerKey!: string;

  @ApiProperty({ example: 'models/gemini-2.0-flash' })
  modelId!: string;

  @ApiProperty({ example: 'Gemini 2.0 Flash' })
  displayName!: string;

  @ApiProperty({ example: 1000000 })
  contextWindow!: number;

  @ApiProperty({ example: 8192 })
  maxOutputTokens!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ example: '0.000150' })
  costPer1kInput!: string | null;

  @ApiPropertyOptional({ example: '0.000600' })
  costPer1kOutput!: string | null;

  @ApiPropertyOptional({ description: 'Generation parameter defaults (camelCase keys)' })
  generationDefaults!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
