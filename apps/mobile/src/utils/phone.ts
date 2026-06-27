/**
 * Utilitaires pour les numéros de téléphone camerounais.
 * Format cible : +237 6XX XXX XXX (mobile : +237 6 suivi de 8 chiffres)
 *                +237 2XX XXX XXX (fixe)
 *
 * Implémentation 100% "digits-only" : on supprime TOUT sauf les chiffres, puis on
 * reconstruit le préfixe. Garantit qu'il n'y a JAMAIS deux "+" (ex. un numéro
 * étranger +241… ne devient pas "+237+241…").
 */

const CAMEROON_PREFIX = '+237';

/** Garde uniquement les chiffres. */
function digitsOnly(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

/**
 * Renvoie le numéro local (9 chiffres max), sans indicatif pays ni 0 initial.
 */
function localDigits(phone: string): string {
  let d = digitsOnly(phone);
  if (d.startsWith('237')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 9);
}

/** Nettoie un numéro (chiffres uniquement). */
export function cleanPhoneNumber(phone: string): string {
  return digitsOnly(phone);
}

/** Formate un numéro pour l'affichage : +237 6XX XXX XXX. */
export function formatCameroonPhone(phone: string): string {
  if (!phone) return '';
  const d = localDigits(phone);
  if (d.length === 0) return '';
  if (d.length <= 3) return `${CAMEROON_PREFIX} ${d}`;
  if (d.length <= 6) return `${CAMEROON_PREFIX} ${d.slice(0, 3)} ${d.slice(3)}`;
  return `${CAMEROON_PREFIX} ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`;
}

/**
 * Valide un numéro camerounais : 9 chiffres commençant par 6 (mobile) ou 2 (fixe).
 */
export function isValidCameroonPhone(phone: string): boolean {
  if (!phone) return true; // téléphone optionnel
  return /^[62]\d{8}$/.test(localDigits(phone));
}

/** Préfixe téléphonique du Cameroun. */
export function getCameroonPrefix(): string {
  return CAMEROON_PREFIX;
}

/**
 * Formatage en direct pendant la saisie. Toujours un seul "+237 ".
 */
export function formatPhoneOnInput(text: string): string {
  if (!text) return '';
  const d = localDigits(text);
  if (d.length === 0) return `${CAMEROON_PREFIX} `;
  if (d.length <= 3) return `${CAMEROON_PREFIX} ${d}`;
  if (d.length <= 6) return `${CAMEROON_PREFIX} ${d.slice(0, 3)} ${d.slice(3)}`;
  return `${CAMEROON_PREFIX} ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`;
}
