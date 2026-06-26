import { IsString, IsInt, IsOptional, IsDateString } from 'class-validator';

export class CreateReceivableDto {
  @IsString()
  customer_id: string;

  @IsInt()
  amount: number; // Removed @Min(0) to allow negative amounts (refunds)

  // Date d'échéance obligatoire pour toute nouvelle créance.
  @IsDateString()
  due_date: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
