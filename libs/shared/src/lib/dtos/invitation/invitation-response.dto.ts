import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvitationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() role!: string;
  @ApiProperty() status!: string;
  @ApiProperty() invitedBy!: string;
  @ApiPropertyOptional() inviterName?: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty() createdAt!: string;
}
