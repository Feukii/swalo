/**
 * Formate un nombre en devise
 * @param amount - Montant en FCFA (entier, pas de centimes pour le FCFA)
 * @param currency - Devise (par defaut FCFA)
 */
export function formatCurrency(amount: number, currency: string = 'FCFA'): string {
  // Les montants sont stockes en FCFA (entiers), pas besoin de diviser par 100
  return `${amount.toLocaleString('fr-FR')} ${currency}`;
}
