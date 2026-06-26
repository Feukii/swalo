import { IsString, IsOptional, IsUUID, IsEnum, IsArray, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ShopType } from '@prisma/client';
import { SHOP_CODE_REGEX, normalizeShopCode } from '@swalo/core/schemas';

export class CreateShopAdminDto {
  @IsString()
  shop_name: string;

  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const normalized = normalizeShopCode(value);
    // Un code vide => auto-génération côté service : laisser passer IsOptional.
    return normalized.length > 0 ? normalized : undefined;
  })
  @IsOptional()
  @IsString()
  @Length(4, 10, { message: 'Le code boutique doit contenir entre 4 et 10 caractères' })
  @Matches(SHOP_CODE_REGEX, {
    message: 'Le code boutique ne peut contenir que des lettres majuscules et des chiffres',
  })
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
  shop_type?: ShopType;

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
