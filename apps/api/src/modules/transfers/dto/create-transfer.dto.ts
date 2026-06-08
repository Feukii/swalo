import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransferItemDto {
  @IsString()
  product_sku: string;

  @IsString()
  product_name: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsInt()
  @Min(0)
  unit_price: number;

  @IsInt()
  @Min(0)
  cost_price: number;
}

export class CreateTransferDto {
  @IsString()
  source_shop_id: string;

  @IsString()
  target_shop_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransferItemDto)
  @ArrayMinSize(1)
  items: CreateTransferItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
