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

  @IsString()
  @IsOptional()
  notes?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  initial_balance?: number; // Montant initial de la dette en centimes
}
