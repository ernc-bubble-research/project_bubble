import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LlmProviderConfigResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'google-ai-studio' })
  providerKey!: string;

  @ApiProperty({ example: 'Google AI Studio' })
  displayName!: string;

  @ApiPropertyOptional({
    example: { apiKey: '**********bcd4' },
    description: 'Credentials with values masked. Full values never returned via API.',
  })
  maskedCredentials!: Record<string, string> | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
