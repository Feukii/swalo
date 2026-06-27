import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateSupplierDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  borrowing_limit?: number; // Limite d'emprunt en FCFA (0 = pas de limite)

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsBoolean()
  @IsOptional()
  sms_notifications_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  whatsapp_notifications_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  email_notifications_enabled?: boolean;
}
