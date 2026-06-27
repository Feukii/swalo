import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateSupplierDto {
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
  borrowing_limit?: number; // Limite d'emprunt en FCFA (0 = pas de limite)

  @IsString()
  @IsOptional()
  notes?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  initial_balance?: number; // Montant initial de la dette en FCFA
}
