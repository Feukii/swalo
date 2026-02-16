import {
  IsString,
  IsUUID,
  IsEnum,
  IsArray,
  ValidateNested,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class SaleItemDto {
  @IsUUID()
  product_id: string;

  @IsInt()
  @Min(1)
  qty: number;

  @IsInt()
  @Min(0)
  unit_price: number; // En centimes

  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number; // En centimes

  @IsOptional()
  @IsUUID()
  batch_id?: string; // Lot spécifique pour le destockage (si non fourni, FIFO automatique)
}

export class CreateSaleDto {
  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number; // En centimes - remise globale

  @IsOptional()
  @IsInt()
  @Min(0)
  tax?: number; // En centimes

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(['DRAFT', 'COMPLETED', 'CANCELLED'])
  status?: 'DRAFT' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsEnum(['CASH', 'CARD', 'MOBILE', 'CREDIT'])
  payment_method?: 'CASH' | 'CARD' | 'MOBILE' | 'CREDIT';

  @IsOptional()
  @IsString()
  device_id?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expected_total?: number; // Total calculé côté client avant override

  @IsOptional()
  @IsString()
  pricing_notes?: string; // Raison de la modification du prix
}
