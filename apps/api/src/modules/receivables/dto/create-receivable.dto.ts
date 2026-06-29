import { IsString, IsInt, IsOptional, IsDateString } from 'class-validator';

export class CreateReceivableDto {
  @IsString()
  customer_id: string;

  @IsInt()
  amount: number; // Removed @Min(0) to allow negative amounts (refunds)

  // Date d'échéance : obligatoire pour une nouvelle créance (montant positif),
  // facultative pour un ajustement de solde / remboursement (montant négatif).
  // La règle métier est appliquée dans le service.
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
