import { ApiProperty } from '@nestjs/swagger';

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

export class ProviderTypeDto {
  @ApiProperty({ example: 'google-ai-studio' })
  providerKey!: string;

  @ApiProperty({ example: 'Google AI Studio' })
  displayName!: string;

  @ApiProperty({ type: [CredentialFieldDto] })
  credentialFields!: CredentialFieldDto[];

  @ApiProperty({ example: false })
  isDevelopmentOnly!: boolean;
}
