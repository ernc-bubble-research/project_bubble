import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsBoolean, MaxLength } from 'class-validator';

export class BulkUpdateModelStatusDto {
  @ApiProperty({ example: 'google-ai-studio', description: 'Provider key to update all models for' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  providerKey!: string;

  @ApiProperty({ example: false, description: 'Active status to set on all models for this provider' })
  @IsBoolean()
  isActive!: boolean;
}
