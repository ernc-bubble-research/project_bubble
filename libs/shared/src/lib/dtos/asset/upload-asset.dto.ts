import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class UploadAssetDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Folder ID to place the asset in',
  })
  @IsOptional()
  @IsUUID()
  folderId?: string;
}
