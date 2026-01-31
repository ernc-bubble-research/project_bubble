import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsIn(['customer_admin', 'creator'])
  role!: string;

  @IsString()
  @IsOptional()
  name?: string;
}
