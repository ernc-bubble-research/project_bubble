import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CredentialFieldDto {
  @ApiProperty({ example: 'apiKey' })
  key!: string;

  @ApiProperty({ example: 'API Key' })
  label!: string;

  @ApiProperty({ enum: ['text', 'password'], example: 'password' })
  type!: 'text' | 'password';

  @ApiProperty({ example: true })
  required!: boolean;
}

export class GenerationParamSpecDto {
  @ApiProperty({ example: 'temperature' })
  key!: string;

  @ApiProperty({ example: 'Temperature' })
  label!: string;

  @ApiProperty({ enum: ['number', 'string[]'], example: 'number' })
  type!: 'number' | 'string[]';

  @ApiPropertyOptional({ example: 0 })
  min?: number;

  @ApiPropertyOptional({ example: 2 })
  max?: number;

  @ApiPropertyOptional({ example: 1.0 })
  default?: number | string[];

  @ApiPropertyOptional({ example: 5 })
  maxItems?: number;
}

export class ProviderTypeDto {
  @ApiProperty({ example: 'google-ai-studio' })
  providerKey!: string;

  @ApiProperty({ example: 'Google AI Studio' })
  displayName!: string;

  @ApiProperty({ type: [CredentialFieldDto] })
  credentialFields!: CredentialFieldDto[];

  @ApiProperty({ type: [GenerationParamSpecDto] })
  supportedGenerationParams!: GenerationParamSpecDto[];

  @ApiProperty({ example: false })
  isDevelopmentOnly!: boolean;
}
