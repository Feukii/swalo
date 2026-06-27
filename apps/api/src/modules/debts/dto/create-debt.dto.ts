import { IsString, IsInt, IsOptional, IsDateString } from 'class-validator';

export class CreateDebtDto {
  @IsString()
  supplier_id: string;

  @IsInt()
  amount: number; // Removed @Min(0) to allow negative amounts (overpayments)

  // Date d'échéance optionnelle de la dette fournisseur (pour les relances).
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
