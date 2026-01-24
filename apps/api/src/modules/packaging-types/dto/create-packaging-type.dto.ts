import { IsString, IsOptional, MaxLength, MinLength, IsBoolean } from 'class-validator';

export class CreatePackagingTypeDto {
  @IsString()
  @MinLength(1, { message: 'Le nom du conditionnement est requis' })
  @MaxLength(50, { message: 'Le nom ne peut pas dépasser 50 caractères' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(10, { message: 'Le symbole ne peut pas dépasser 10 caractères' })
  symbol?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
