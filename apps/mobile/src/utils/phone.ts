/**
 * Utilitaires pour la gestion des numéros de téléphone camerounais
 * Préfixe: +237
 * Format: +237 6XX XXX XXX (mobile) ou +237 2XX XXX XXX (fixe)
 */

const CAMEROON_PREFIX = '+237';

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
  if (!phone) return true; // Téléphone optionnel

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
 * Obtient le préfixe téléphonique du Cameroun
 */
export function getCameroonPrefix(): string {
  return CAMEROON_PREFIX;
}

/**
 * Formate le numéro pendant la saisie (auto-format live)
 * @param text - Texte saisi par l'utilisateur
 * @returns Numéro partiellement formaté
 */
export function formatPhoneOnInput(text: string): string {
  // Nettoyer le texte
  let cleaned = text.replace(/[^\d+]/g, '');

  // Si l'utilisateur efface tout, laisser vide
  if (!cleaned) return '';

  // Si l'utilisateur tape sans préfixe, ajouter automatiquement +237
  if (!cleaned.startsWith('+') && !cleaned.startsWith('237')) {
    // Enlever le 0 initial si présent
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = '+237' + cleaned;
  } else if (cleaned.startsWith('237') && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  // Limiter à +237 + 9 chiffres = 13 caractères max
  const prefix = '+237';
  if (cleaned.startsWith(prefix)) {
    const digits = cleaned.substring(4).substring(0, 9);

    // Formater progressivement
    if (digits.length <= 3) {
      return `${prefix} ${digits}`;
    } else if (digits.length <= 6) {
      return `${prefix} ${digits.substring(0, 3)} ${digits.substring(3)}`;
    } else {
      return `${prefix} ${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6)}`;
    }
  }

  return cleaned;
}
