import { IsString, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  name: string;

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
  credit_limit?: number; // En centimes

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  email_notifications_enabled?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  initial_balance?: number; // Montant initial de la créance en centimes
}
