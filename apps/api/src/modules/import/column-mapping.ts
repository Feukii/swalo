/**
 * Mapping des colonnes francaises vers les champs anglais pour l'import CSV
 * Supporte les accents et variations de noms de colonnes
 */

/**
 * Dictionnaire de mapping: cle normalisee -> nom de champ standard
 */
export const COLUMN_ALIASES: Record<string, string> = {
  // SKU / Code Article
  sku: 'sku',
  code: 'sku',
  'code article': 'sku',
  code_article: 'sku',
  codearticle: 'sku',
  ref: 'sku',
  'code produit': 'sku',

  // Name / Libelle
  name: 'name',
  nom: 'name',
  libelle: 'name',
  'libelle article': 'name',
  libelle_article: 'name',
  'libelle article (designation)': 'name',
  designation: 'name',
  'designation article': 'name',
  description: 'name',
  produit: 'name',

  // Family / Famille
  family: 'family',
  famille: 'family',
  categorie: 'family',
  category: 'family',

  // Article Type / Type d'article
  article_type: 'article_type',
  'article type': 'article_type',
  articletype: 'article_type',
  article: 'article_type',
  type: 'article_type',
  'type article': 'article_type',
  "type d'article": 'article_type',
  type_article: 'article_type',
  sous_categorie: 'article_type',
  'sous categorie': 'article_type',

  // Brand / Marque
  brand: 'brand',
  marque: 'brand',
  fabricant: 'brand',
  manufacturer: 'brand',

  // Reference / Serie
  reference: 'reference',
  ref_serie: 'reference',
  serie: 'reference',
  'reference (serie)': 'reference',
  'reference serie': 'reference',
  modele: 'reference',
  model: 'reference',

  // Cost Price / Prix d'achat
  cost_price: 'cost_price',
  'cost price': 'cost_price',
  costprice: 'cost_price',
  'prix achat': 'cost_price',
  prix_achat: 'cost_price',
  "prix d'achat": 'cost_price',
  prixachat: 'cost_price',
  cout: 'cost_price',
  'prix cout': 'cost_price',
  pa: 'cost_price',

  // Sell Price / Prix de vente
  sell_price: 'sell_price',
  'sell price': 'sell_price',
  sellprice: 'sell_price',
  'prix vente': 'sell_price',
  prix_vente: 'sell_price',
  'prix de vente': 'sell_price',
  prixvente: 'sell_price',
  prix: 'sell_price',
  pv: 'sell_price',

  // Unit / Unite
  unit: 'unit',
  unite: 'unit',
  'unite de mesure': 'unit',

  // Packaging / Conditionnement (nom du conditionnement, ex: Carton, Boite)
  cond: 'packaging',
  'cond.': 'packaging',
  conditionnement: 'packaging',
  emballage: 'packaging',
  packaging: 'packaging',
  'type conditionnement': 'packaging',

  // Units per package / Pieces par conditionnement (ex: 24 pieces / carton)
  'sous-cond': 'units_per_package',
  'sous-cond.': 'units_per_package',
  'sous cond': 'units_per_package',
  units_per_package: 'units_per_package',
  'pieces / cart': 'units_per_package',
  'pieces/cart': 'units_per_package',
  'pieces par cart': 'units_per_package',
  'pieces par carton': 'units_per_package',
  'pieces par conditionnement': 'units_per_package',
  'pieces par paquet': 'units_per_package',
  'qte par carton': 'units_per_package',
  'qte par conditionnement': 'units_per_package',
  'nb pieces': 'units_per_package',

  // Package price / Prix du conditionnement complet (optionnel)
  package_price: 'package_price',
  'prix conditionnement': 'package_price',
  'prix du conditionnement': 'package_price',
  'prix carton': 'package_price',
  'prix du carton': 'package_price',
  'prix pack': 'package_price',
  'prix paquet': 'package_price',

  // Alert Threshold / Seuil d'alerte
  alert_threshold: 'alert_threshold',
  'alert threshold': 'alert_threshold',
  alertthreshold: 'alert_threshold',
  seuil: 'alert_threshold',
  'seuil alerte': 'alert_threshold',
  seuil_alerte: 'alert_threshold',
  'stock minimum': 'alert_threshold',
  'stock min': 'alert_threshold',
};

/**
 * Supprime les accents d'une chaine de caracteres
 */
export function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'");
}

/**
 * Normalise un nom de colonne: lowercase, trim, suppression accents
 */
export function normalizeColumnName(columnName: string): string {
  return removeAccents(columnName.toLowerCase().trim());
}

/**
 * Traduit un nom de colonne vers le nom de champ standard
 * Retourne le nom normalise si aucun alias trouve
 */
export function mapColumnName(columnName: string): string {
  const normalized = normalizeColumnName(columnName);
  return COLUMN_ALIASES[normalized] || normalized;
}

/**
 * Liste des colonnes requises pour l'import
 */
export const REQUIRED_COLUMNS = ['sku', 'name'];

/**
 * Liste des colonnes optionnelles
 */
export const OPTIONAL_COLUMNS = [
  'family',
  'article_type',
  'brand',
  'reference',
  'cost_price',
  'sell_price',
  'unit',
  'alert_threshold',
  'packaging',
  'units_per_package',
  'package_price',
];

/**
 * Valeurs par defaut pour les colonnes optionnelles
 */
export const DEFAULT_VALUES: Record<string, number | string> = {
  cost_price: 0,
  sell_price: 0,
  unit: 'unit',
  alert_threshold: 5,
};
