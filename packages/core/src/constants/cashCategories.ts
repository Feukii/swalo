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
 * Clés canoniques (snake_case) des catégories de caisse.
 *
 * Historiquement, les catégories ont été stockées sous plusieurs formes selon
 * l'écran qui a créé l'entrée : libellé humain capitalisé ("Ventes",
 * "Achats Marchandises"), libellé accentué ("Règlement fournisseur"), ou clé
 * snake_case ("ventes", "achats_marchandises"). De plus, une vente espèces
 * mobile écrit "vente" (singulier). Cette table de correspondance permet aux
 * rapports d'agréger correctement quelle que soit la forme stockée.
 */
export type CashCategoryKey =
  | 'ventes'
  | 'remboursement_client'
  | 'remboursement_fournisseur'
  | 'achats_marchandises'
  | 'loyers'
  | 'reglement_fournisseur'
  | 'depenses_courantes'
  | 'salaires'
  | 'transport'
  | 'electricite_eau'
  | 'taxes_impots'
  | 'retrait_personnel'
  | 'divers';

/**
 * Normalise une valeur de catégorie de caisse (quelle que soit sa forme
 * historique : libellé, accents, casse, singulier "vente") vers sa clé
 * canonique snake_case. Retourne `null` si la catégorie est inconnue/absente.
 */
export function normalizeCashCategory(category: string | null | undefined): CashCategoryKey | null {
  if (!category) return null;

  // Supprime les accents, met en minuscules, remplace les séparateurs par "_".
  const normalized = category
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');

  const map: Record<string, CashCategoryKey> = {
    // Ventes (inclut le singulier "vente" écrit par la vente espèces mobile)
    ventes: 'ventes',
    vente: 'ventes',
    // Remboursement client (entrée ou sortie)
    remboursement_client: 'remboursement_client',
    // Remboursement fournisseur (entrée)
    remboursement_fournisseur: 'remboursement_fournisseur',
    // Achats marchandises
    achats_marchandises: 'achats_marchandises',
    achat_marchandises: 'achats_marchandises',
    // Loyers
    loyers: 'loyers',
    loyer: 'loyers',
    // Règlement fournisseur
    reglement_fournisseur: 'reglement_fournisseur',
    // Dépenses courantes
    depenses_courantes: 'depenses_courantes',
    depense_courante: 'depenses_courantes',
    // Salaires
    salaires: 'salaires',
    salaire: 'salaires',
    // Transport
    transport: 'transport',
    transports: 'transport',
    // Électricité / eau
    electricite_eau: 'electricite_eau',
    electricite: 'electricite_eau',
    eau: 'electricite_eau',
    'electricite_/_eau': 'electricite_eau',
    // Taxes & impôts
    taxes_impots: 'taxes_impots',
    taxes: 'taxes_impots',
    impots: 'taxes_impots',
    'taxes_&_impots': 'taxes_impots',
    // Retrait personnel (prélèvement de l'exploitant)
    retrait_personnel: 'retrait_personnel',
    retrait: 'retrait_personnel',
    // Divers
    divers: 'divers',
  };

  return map[normalized] ?? null;
}

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
