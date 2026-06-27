import { IsString, IsNumber, IsOptional, IsBoolean, Min, IsInt } from 'class-validator';

export class CreateProductDto {
  @IsString()
  sku: string; // Code Article (ex: GLA01TECSpk4)

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  name: string; // Libellé Article / Désignation

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string; // Ancien champ (conservé pour compatibilité)

  @IsOptional()
  @IsString()
  family?: string; // Famille (ex: GLASSES, CHARGEURS, KIT BLUETOOTH)

  @IsOptional()
  @IsString()
  article_type?: string; // Type d'article (ex: Glass 3D, Chargeur 1A TC)

  @IsOptional()
  @IsString()
  brand?: string; // Marque (ex: Tecno, Samsung, Oraimo)

  @IsOptional()
  @IsString()
  reference?: string; // Référence/Série (ex: Spark 4, A10E, 2ème choix)

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  packaging_type_id?: string; // Conditionnement (Carton, Boîte…)

  @IsOptional()
  @IsInt()
  @Min(1)
  units_per_package?: number; // Pièces par conditionnement (ex: 24)

  @IsOptional()
  @IsInt()
  @Min(0)
  package_price?: number; // Prix du conditionnement complet (en FCFA)

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_rate?: number;

  @IsInt()
  @Min(0)
  cost_price: number; // En FCFA

  @IsInt()
  @Min(0)
  sell_price: number; // En FCFA

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  alert_threshold?: number;

  @IsOptional()
  @IsString()
  image_url?: string;
}
