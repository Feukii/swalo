import { IsString, IsInt, IsOptional } from 'class-validator';

export class CreateReceivableDto {
  @IsString()
  customer_id: string;

  @IsInt()
  amount: number; // Removed @Min(0) to allow negative amounts (refunds)

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
