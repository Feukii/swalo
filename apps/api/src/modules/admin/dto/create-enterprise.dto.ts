import { IsString, IsOptional, IsUUID, IsEnum, IsInt, Min, IsDateString } from 'class-validator';

export class CreateEnterpriseDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsUUID()
  owner_id?: string;

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
  @IsString()
  logo_url?: string;
}
