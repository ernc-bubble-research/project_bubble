import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsIn(['bubble_admin', 'customer_admin', 'creator'])
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  name?: string;
}
