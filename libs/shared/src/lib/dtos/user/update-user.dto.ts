import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: ['bubble_admin', 'customer_admin', 'creator'] })
  @IsIn(['bubble_admin', 'customer_admin', 'creator'])
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsString()
  @IsOptional()
  name?: string;
}
