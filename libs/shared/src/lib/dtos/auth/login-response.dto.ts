import { UserRole } from '../../types/user.types';

export class LoginResponseDto {
  accessToken!: string;
  user!: {
    id: string;
    email: string;
    role: UserRole;
    tenantId: string;
  };
}
