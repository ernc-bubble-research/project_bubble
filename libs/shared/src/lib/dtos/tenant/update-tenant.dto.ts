import { IsString, IsOptional, IsInt, Min, Max, IsIn, MaxLength, MinLength } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  primaryContact?: string | null;

  @IsOptional()
  @IsIn(['free', 'starter', 'professional', 'enterprise'])
  planTier?: 'free' | 'starter' | 'professional' | 'enterprise';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  dataResidency?: string;

  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  @IsOptional()
  @IsInt()
  @Min(0)
  maxMonthlyRuns?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  assetRetentionDays?: number;
}
