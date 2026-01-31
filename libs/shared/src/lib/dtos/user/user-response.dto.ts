export class UserResponseDto {
  id!: string;
  email!: string;
  role!: string;
  name?: string;
  tenantId!: string;
  status!: string;
  createdAt!: Date;
}
