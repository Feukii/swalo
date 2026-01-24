/**
 * Catégories de caisse pour les entrées et sorties
 * Utilisé par mobile et web pour assurer la cohérence
 */

export const ENTRY_CATEGORIES = [
  'Ventes',
  'Remboursement client',
  'Remboursement fournisseur',
  'Divers',
] as const;

export const EXIT_CATEGORIES = [
  'Achats Marchandises',
  'Loyers',
  'Règlement fournisseur',
  'Remboursement client',
  'Dépenses courantes',
  'Divers',
] as const;

export type EntryCategoryType = (typeof ENTRY_CATEGORIES)[number];
export type ExitCategoryType = (typeof EXIT_CATEGORIES)[number];

/**
 * Vérifie si une catégorie nécessite un commentaire obligatoire
 */
export function requiresNote(category: string): boolean {
  return category === 'Divers';
}

/**
 * Longueur minimale requise pour le commentaire de la catégorie "Divers"
 */
export const MIN_NOTE_LENGTH = 5;
