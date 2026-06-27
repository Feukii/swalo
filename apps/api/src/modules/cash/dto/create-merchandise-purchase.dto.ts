import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateMerchandisePurchaseDto {
  @IsUUID()
  supplier_id: string;

  @IsInt()
  @Min(1, { message: 'Le montant doit être supérieur à 0' })
  amount: number; // Montant en FCFA

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['CASH'], {
    message: 'Le mode de paiement doit être CASH',
  })
  payment_method: 'CASH';

  @IsBoolean()
  create_debt: boolean; // Si true, crée une dette fournisseur

  @IsOptional()
  @IsString()
  device_id?: string;

  @IsOptional()
  @IsString()
  client_op_id?: string;
}
