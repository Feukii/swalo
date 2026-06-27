/**
 * Utilitaires pour la gestion des devises.
 * Les montants sont des ENTIERS FCFA (le FCFA n'a pas de décimales/centimes).
 * Aucune conversion d'échelle : la valeur stockée == la valeur affichée.
 */

/**
 * Identité (compat. historique). Le FCFA n'a pas de centimes : aucune conversion.
 * @deprecated Le montant est déjà en FCFA entier ; ne plus convertir.
 */
export function centsToAmount(amount: number): number {
  return amount;
}

/**
 * Identité (compat. historique). Le FCFA n'a pas de centimes : on arrondit seulement.
 * @deprecated Le montant est déjà en FCFA entier ; ne plus convertir.
 */
export function amountToCents(amount: number): number {
  return Math.round(amount);
}

/**
 * Formate un montant FCFA (entier) pour l'affichage.
 * @param amount - Montant en FCFA (entier, pas de centimes)
 * @param currency - Code devise (ex: XOF)
 * @param locale - Locale pour le formatage (ex: fr-FR)
 * @returns Montant formaté
 */
export function formatCurrency(
  amount: number,
  currency: string = 'XOF',
  locale: string = 'fr-FR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/**
 * Additionne plusieurs montants en FCFA
 * @param amounts - Montants à additionner
 * @returns Somme des montants (FCFA)
 */
export function sumCents(...amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0);
}

/**
 * Calcule un pourcentage d'un montant
 * @param amount - Montant en FCFA
 * @param percentage - Pourcentage (ex: 0.18 pour 18%)
 * @returns Montant du pourcentage en FCFA
 */
export function calculatePercentage(amount: number, percentage: number): number {
  return Math.round(amount * percentage);
}

/**
 * Calcule la taxe sur un montant
 * @param amountHT - Montant hors taxe en FCFA
 * @param taxRate - Taux de taxe (ex: 0.18 pour 18%)
 * @returns Montant de la taxe en FCFA
 */
export function calculateTax(amountHT: number, taxRate: number): number {
  return calculatePercentage(amountHT, taxRate);
}

/**
 * Calcule le montant TTC à partir d'un montant HT
 * @param amountHT - Montant hors taxe en FCFA
 * @param taxRate - Taux de taxe (ex: 0.18 pour 18%)
 * @returns Montant TTC en FCFA
 */
export function calculateTTC(amountHT: number, taxRate: number): number {
  return amountHT + calculateTax(amountHT, taxRate);
}
