import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsBoolean,
  IsObject,
} from 'class-validator';

export class UpdateLlmProviderConfigDto {
  @ApiPropertyOptional({ example: 'Google AI Studio', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({
    example: { apiKey: 'AIza...' },
    description: 'Provider-specific credential fields. Replaces existing credentials entirely.',
  })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
