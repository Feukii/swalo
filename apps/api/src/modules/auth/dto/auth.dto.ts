import { IsString, IsEmail, IsOptional, MinLength, IsUUID, Length } from 'class-validator';

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

  @IsString()
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
  @IsString()
  @Length(6, 6, { message: 'Le code boutique doit contenir exactement 6 chiffres' })
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
