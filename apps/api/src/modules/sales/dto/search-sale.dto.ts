import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';

export class SearchSaleDto {
  @IsOptional()
  @IsString()
  customer_id?: string;

  @IsOptional()
  @IsEnum(['DRAFT', 'COMPLETED', 'CANCELLED'])
  status?: 'DRAFT' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsEnum(['created_at', 'total'])
  sort_by?: 'created_at' | 'total';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sort_order?: 'asc' | 'desc';
}
