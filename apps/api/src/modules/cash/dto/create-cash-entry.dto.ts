import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateCashEntryDto {
  @IsEnum(['IN', 'OUT', 'OPENING', 'CLOSING'])
  type: 'IN' | 'OUT' | 'OPENING' | 'CLOSING';

  @IsOptional()
  @IsString()
  category?: string;

  @IsInt()
  amount: number;

  // Note is required with minimum 5 characters when category is 'Divers', otherwise optional
  @ValidateIf((o: CreateCashEntryDto) => o.category === 'Divers')
  @IsString({ message: 'Un commentaire est requis pour la catégorie Divers' })
  @MinLength(5, { message: 'Le commentaire doit contenir au moins 5 caractères' })
  note?: string;

  @IsOptional()
  @IsUUID()
  supplier_id?: string; // Pour les règlements fournisseur

  @IsOptional()
  @IsUUID()
  customer_id?: string; // Pour les remboursements client

  @IsOptional()
  @IsString()
  device_id?: string;

  @IsOptional()
  @IsString()
  client_op_id?: string;
}
