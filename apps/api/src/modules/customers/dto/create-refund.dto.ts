import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateRefundDto {
  @IsInt()
  @Min(1, { message: 'Le montant doit être supérieur à 0' })
  amount: number; // Montant en FCFA

  @IsEnum(['CASH'], {
    message: 'Le mode de paiement doit être CASH',
  })
  payment_method: 'CASH';

  @IsOptional()
  @IsString()
  note?: string; // Note optionnelle
}
