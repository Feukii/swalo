import { IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';

export class CreateEnterpriseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'Le code doit contenir uniquement des majuscules, chiffres, tirets et underscores',
  })
  code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;
}

export class UpdateEnterpriseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;
}

export class AddShopToEnterpriseDto {
  @IsString()
  shop_id: string;

  @IsOptional()
  @IsString()
  shop_type?: 'MAGASIN' | 'BOUTIQUE';
}
