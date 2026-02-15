import { ApiProperty } from '@nestjs/swagger';

export class ImpersonateResponseDto {
  @ApiProperty({ description: 'Short-lived JWT for impersonation session' })
  token!: string;

  @ApiProperty({ description: 'Impersonated tenant summary' })
  tenant!: { id: string; name: string };

  @ApiProperty({ description: 'Support access session ID for audit trail' })
  sessionId!: string;
}
