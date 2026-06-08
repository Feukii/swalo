import { IsString, IsOptional, IsUUID, IsEnum, IsArray } from 'class-validator';

export class CreateShopAdminDto {
  @IsString()
  shop_name: string;

  @IsOptional()
  @IsString()
  shop_code?: string;

  @IsOptional()
  @IsUUID()
  owner_id?: string;

  @IsOptional()
  @IsString()
  owner_name?: string;

  @IsOptional()
  @IsString()
  owner_phone?: string;

  @IsUUID()
  enterprise_id: string;

  @IsOptional()
  @IsEnum(['BOUTIQUE', 'MAGASIN'])
  shop_type?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabled_modules?: string[];
}
