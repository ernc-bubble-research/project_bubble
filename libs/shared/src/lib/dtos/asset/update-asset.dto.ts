import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateAssetDto {
  @ApiPropertyOptional({ example: 'renamed-document.pdf', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Move asset to this folder (null for root)',
  })
  @IsOptional()
  @IsUUID()
  folderId?: string;
}
