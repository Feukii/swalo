import { IsString, IsEmail, IsOptional, MinLength, IsUUID, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { SHOP_CODE_REGEX, normalizeShopCode } from '@swalo/core/schemas';

/**
 * Normalise un code boutique entrant (trim + majuscules) lors de la validation.
 * Garantit que la casse est cohérente avant tout lookup en base.
 */
const transformShopCode = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? normalizeShopCode(value) : value;

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  display_name: string;

  @Transform(transformShopCode)
  @IsString()
  @Length(4, 10, { message: 'Le code boutique doit contenir entre 4 et 10 caractères' })
  @Matches(SHOP_CODE_REGEX, {
    message: 'Le code boutique ne peut contenir que des lettres majuscules et des chiffres',
  })
  shop_code: string;

  @IsString()
  shop_name: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class LoginDto {
  @IsString()
  email_or_phone: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsUUID()
  shop_id?: string;
}

export class RefreshTokenDto {
  @IsString()
  refresh_token: string;
}

export class PinLoginDto {
  @Transform(transformShopCode)
  @IsString()
  @Length(4, 10, { message: 'Le code boutique doit contenir entre 4 et 10 caractères' })
  @Matches(SHOP_CODE_REGEX, {
    message: 'Le code boutique ne peut contenir que des lettres majuscules et des chiffres',
  })
  shop_code: string;

  @IsString()
  @Length(4, 4, { message: 'Le code PIN doit contenir exactement 4 chiffres' })
  pin_code: string;

  @IsOptional()
  @IsString()
  device_id?: string;

  @IsOptional()
  @IsString()
  device_name?: string;

  @IsOptional()
  @IsString()
  device_type?: string; // 'mobile', 'web', 'tablet'
}

export class CreateShopDto {
  @IsString()
  shop_name: string;

  @IsString()
  owner_name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdateShopCodeDto {
  @IsString()
  @Length(4, 4, { message: 'Le code PIN doit contenir exactement 4 chiffres' })
  pin_code: string; // Confirmation PIN du propriétaire
}
