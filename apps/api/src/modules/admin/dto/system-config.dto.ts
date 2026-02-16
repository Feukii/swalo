import { IsString, IsOptional } from 'class-validator';

export class CreateSystemConfigDto {
  @IsString()
  key: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateSystemConfigDto {
  @IsString()
  value: string;

  @IsOptional()
  @IsString()
  description?: string;
}
