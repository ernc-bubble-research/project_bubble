import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsUUID, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class ListAssetsQueryDto {
  @ApiPropertyOptional({
    example: 50,
    description: 'Maximum number of assets to return (1-200)',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Number of assets to skip for pagination',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    description: 'Filter by folder ID',
  })
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status (ACTIVE or ARCHIVED)',
    default: 'ACTIVE',
  })
  @IsOptional()
  status?: string;
}
