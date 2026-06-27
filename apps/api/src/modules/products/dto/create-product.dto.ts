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
  packaging_type_id?: string; // Conditionnement / carton (Carton, Boîte…)

  @IsOptional()
  @IsInt()
  @Min(1)
  units_per_package?: number; // Pièces par carton (ex: 24). null/1 = vendu à la pièce uniquement

  @IsOptional()
  @IsInt()
  @Min(0)
  package_price?: number; // Prix de GROS du carton entier (en FCFA)

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_rate?: number;

  // En FCFA, stocké PAR PIÈCE (valorisation/COGS). Dans l'UI il est saisi & affiché
  // PAR CARTON : coût_carton = cost_price × units_per_package ; à l'enregistrement
  // cost_price = round(coût_carton / units_per_package).
  @IsInt()
  @Min(0)
  cost_price: number;

  @IsInt()
  @Min(0)
  sell_price: number; // Prix de DÉTAIL (à la pièce) en FCFA

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  // Seuil d'alerte exprimé en CARTONS quand l'article est conditionné
  // (units_per_package > 1), sinon en pièces.
  @IsOptional()
  @IsInt()
  @Min(0)
  alert_threshold?: number;

  @IsOptional()
  @IsString()
  image_url?: string;
}
