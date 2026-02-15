import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsIn, MaxLength, MinLength } from 'class-validator';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'admin@acme.com', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  primaryContact?: string | null;

  @ApiPropertyOptional({ enum: ['free', 'starter', 'professional', 'enterprise'] })
  @IsOptional()
  @IsIn(['free', 'starter', 'professional', 'enterprise'])
  planTier?: 'free' | 'starter' | 'professional' | 'enterprise';

  @ApiPropertyOptional({ example: 'eu-west' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  dataResidency?: string;

  @ApiPropertyOptional({ enum: ['active', 'suspended'] })
  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  @ApiPropertyOptional({ example: 100, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxMonthlyRuns?: number;

  @ApiPropertyOptional({ example: 30, minimum: 1, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  assetRetentionDays?: number;

  @ApiPropertyOptional({ example: 0, minimum: 0, description: 'Purchased credit balance (persistent, never resets)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  purchasedCredits?: number;

  @ApiPropertyOptional({ example: 1000, minimum: 1, description: 'Hard ceiling for per-run credit cost (Bubble Admin only)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCreditsPerRunLimit?: number;

  @ApiPropertyOptional({ example: 1000, minimum: 1, description: 'Adjustable per-run credit limit (must be <= maxCreditsPerRunLimit)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCreditsPerRun?: number;
}
