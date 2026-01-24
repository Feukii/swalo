import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class SearchProductDto {
  @IsOptional()
  @IsString()
  search?: string; // Recherche dans sku, name, barcode, brand

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  family?: string; // Filtre par famille (GLASSES, CHARGEURS, etc.)

  @IsOptional()
  @IsString()
  brand?: string; // Filtre par marque (Tecno, Samsung, etc.)

  @IsOptional()
  @IsString()
  article_type?: string; // Filtre par type d'article (Glass 3D, Chargeur 1A TC)

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  sort_by?: string; // name, created_at, sell_price, family, brand

  @IsOptional()
  @IsString()
  sort_order?: 'asc' | 'desc';
}
