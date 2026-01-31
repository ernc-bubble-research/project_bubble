import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../types/user.types';

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken!: string;

  @ApiProperty({ description: 'Authenticated user summary' })
  user!: {
    id: string;
    email: string;
    role: UserRole;
    tenantId: string;
  };
}
