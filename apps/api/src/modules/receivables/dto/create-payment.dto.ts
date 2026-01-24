import { IsInt, Min, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
