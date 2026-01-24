import { IsInt, Min, IsOptional, IsString } from 'class-validator';

export class CreateDebtPaymentDto {
  @IsInt()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  cash_exit_id?: string;
}
