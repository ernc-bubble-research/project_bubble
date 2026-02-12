import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsObject,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';

export class CreateLlmProviderConfigDto {
  @ApiProperty({
    example: 'google-ai-studio',
    maxLength: 50,
    description: 'Provider key identifier (google-ai-studio, vertex, openai, mock)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  providerKey!: string;

  @ApiProperty({ example: 'Google AI Studio', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName!: string;

  @ApiPropertyOptional({
    example: { apiKey: 'AIza...' },
    description: 'Provider-specific credential fields. Keys depend on provider type.',
  })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;

  @ApiPropertyOptional({
    example: 60,
    description: 'Maximum requests per minute for this provider. Enforcement is handled by the execution engine.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimitRpm?: number;
}
