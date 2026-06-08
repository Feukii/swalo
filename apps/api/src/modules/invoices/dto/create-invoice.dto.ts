import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateInvoiceFromSaleDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SearchInvoiceDto {
  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;
}
