import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() role!: string;
  @ApiPropertyOptional() name?: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() createdAt!: Date;
}
