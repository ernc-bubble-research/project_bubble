import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(['bubble_admin', 'customer_admin', 'creator'])
  role!: string;

  @IsString()
  @IsOptional()
  name?: string;
}
