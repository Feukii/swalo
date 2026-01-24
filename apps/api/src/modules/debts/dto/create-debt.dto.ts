import { IsString, IsInt, IsOptional } from 'class-validator';

export class CreateDebtDto {
  @IsString()
  supplier_id: string;

  @IsInt()
  amount: number; // Removed @Min(0) to allow negative amounts (overpayments)

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
