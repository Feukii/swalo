import { IsString, IsOptional, IsEnum, IsInt, Min, IsDateString } from 'class-validator';

export class UpdateEnterpriseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE'])
  license_tier?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_shops?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_users_per_shop?: number;

  @IsOptional()
  @IsDateString()
  licensed_until?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthly_price?: number;

  @IsOptional()
  @IsString()
  logo_url?: string;
}
