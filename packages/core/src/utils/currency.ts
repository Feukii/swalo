/**
 * Utilitaires pour la gestion des devises
 * Les montants sont stockés en centimes (entiers) pour éviter les problèmes de précision
 */

/**
 * Convertit un montant en centimes vers un montant en devise (float)
 * @param cents - Montant en centimes
 * @returns Montant en devise
 */
export function centsToAmount(cents: number): number {
  return cents / 100;
}

/**
 * Convertit un montant en devise vers un montant en centimes
 * @param amount - Montant en devise
 * @returns Montant en centimes
 */
export function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Formate un montant en centimes pour l'affichage
 * @param cents - Montant en centimes
 * @param currency - Code devise (ex: XOF, EUR)
 * @param locale - Locale pour le formatage (ex: fr-FR)
 * @returns Montant formaté
 */
export function formatCurrency(
  cents: number,
  currency: string = 'XOF',
  locale: string = 'fr-FR'
): string {
  const amount = centsToAmount(cents);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Additionne plusieurs montants en centimes
 * @param amounts - Montants à additionner
 * @returns Somme des montants
 */
export function sumCents(...amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0);
}

/**
 * Calcule un pourcentage d'un montant
 * @param amount - Montant en centimes
 * @param percentage - Pourcentage (ex: 0.18 pour 18%)
 * @returns Montant du pourcentage en centimes
 */
export function calculatePercentage(amount: number, percentage: number): number {
  return Math.round(amount * percentage);
}

/**
 * Calcule la taxe sur un montant
 * @param amountHT - Montant hors taxe en centimes
 * @param taxRate - Taux de taxe (ex: 0.18 pour 18%)
 * @returns Montant de la taxe en centimes
 */
export function calculateTax(amountHT: number, taxRate: number): number {
  return calculatePercentage(amountHT, taxRate);
}

/**
 * Calcule le montant TTC à partir d'un montant HT
 * @param amountHT - Montant hors taxe en centimes
 * @param taxRate - Taux de taxe (ex: 0.18 pour 18%)
 * @returns Montant TTC en centimes
 */
export function calculateTTC(amountHT: number, taxRate: number): number {
  return amountHT + calculateTax(amountHT, taxRate);
}
