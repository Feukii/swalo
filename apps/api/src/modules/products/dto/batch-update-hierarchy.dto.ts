import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum HierarchyLevel {
  FAMILY = 'family',
  ARTICLE_TYPE = 'article_type',
  BRAND = 'brand',
  REFERENCE = 'reference',
}

export class BatchUpdateHierarchyDto {
  @IsEnum(HierarchyLevel, {
    message: "Le niveau doit être 'family', 'article_type', 'brand', ou 'reference'",
  })
  level: HierarchyLevel;

  @IsString()
  old_value: string; // Ancienne valeur à remplacer

  @IsString()
  new_value: string; // Nouvelle valeur

  // Filtres optionnels pour restreindre les produits à mettre à jour
  @IsOptional()
  @IsString()
  family?: string;

  @IsOptional()
  @IsString()
  article_type?: string;

  @IsOptional()
  @IsString()
  brand?: string;
}
