/**
 * Utilitaires pour la gestion des numéros de téléphone camerounais
 * Préfixe: +237
 * Format: +237 6XX XXX XXX (mobile) ou +237 2XX XXX XXX (fixe)
 */

const CAMEROON_PREFIX = '+237';
// Regex for Cameroon phone validation (exported for external use if needed)
export const CAMEROON_PHONE_REGEX = /^(\+237)?[\s]?([62]\d{2})[\s]?(\d{3})[\s]?(\d{3})$/;

/**
 * Nettoie un numéro de téléphone (supprime espaces et caractères non numériques sauf +)
 */
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Formate un numéro de téléphone camerounais
 * @param phone - Numéro brut (avec ou sans préfixe +237)
 * @returns Numéro formaté: +237 6XX XXX XXX
 */
export function formatCameroonPhone(phone: string): string {
  if (!phone) return '';

  // Nettoyer le numéro
  let cleaned = cleanPhoneNumber(phone);

  // Si le numéro commence par 237 sans +, ajouter le +
  if (cleaned.startsWith('237') && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  // Si le numéro ne commence pas par +237, ajouter le préfixe
  if (!cleaned.startsWith(CAMEROON_PREFIX)) {
    // Enlever le 0 initial si présent (format local)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = CAMEROON_PREFIX + cleaned;
  }

  // Extraire les parties du numéro
  const withoutPrefix = cleaned.replace(CAMEROON_PREFIX, '');

  if (withoutPrefix.length === 9) {
    // Format: +237 6XX XXX XXX
    return `${CAMEROON_PREFIX} ${withoutPrefix.substring(0, 3)} ${withoutPrefix.substring(3, 6)} ${withoutPrefix.substring(6, 9)}`;
  }

  // Si le format n'est pas valide, retourner tel quel avec préfixe
  return cleaned;
}

/**
 * Valide un numéro de téléphone camerounais
 * @param phone - Numéro à valider
 * @returns true si le numéro est valide
 */
export function isValidCameroonPhone(phone: string): boolean {
  if (!phone) return false;

  const cleaned = cleanPhoneNumber(phone);

  // Accepter avec ou sans préfixe
  let withoutPrefix = cleaned;
  if (cleaned.startsWith(CAMEROON_PREFIX)) {
    withoutPrefix = cleaned.replace(CAMEROON_PREFIX, '');
  } else if (cleaned.startsWith('237')) {
    withoutPrefix = cleaned.substring(3);
  } else if (cleaned.startsWith('0')) {
    withoutPrefix = cleaned.substring(1);
  }

  // Doit avoir 9 chiffres et commencer par 6 (mobile) ou 2 (fixe)
  return /^[62]\d{8}$/.test(withoutPrefix);
}

/**
 * Extrait le numéro sans préfixe pour stockage
 * @param phone - Numéro formaté
 * @returns Numéro sans préfixe (9 chiffres)
 */
export function extractPhoneWithoutPrefix(phone: string): string {
  const cleaned = cleanPhoneNumber(phone);

  if (cleaned.startsWith(CAMEROON_PREFIX)) {
    return cleaned.replace(CAMEROON_PREFIX, '');
  }
  if (cleaned.startsWith('237')) {
    return cleaned.substring(3);
  }
  if (cleaned.startsWith('0')) {
    return cleaned.substring(1);
  }

  return cleaned;
}

/**
 * Obtient le préfixe téléphonique du Cameroun
 */
export function getCameroonPrefix(): string {
  return CAMEROON_PREFIX;
}
