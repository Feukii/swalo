/**
 * Utilitaires pour la gestion des dates
 * Toutes les dates sont stockées en ISO8601 UTC
 */

/**
 * Retourne la date/heure actuelle en ISO8601
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Formate une date ISO vers un format lisible
 * @param isoDate - Date au format ISO8601
 * @param locale - Locale pour le formatage (ex: fr-FR)
 * @param options - Options de formatage
 */
export function formatDate(
  isoDate: string,
  locale: string = 'fr-FR',
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
): string {
  if (!isoDate) {
    return 'Date inconnue';
  }
  try {
    return new Date(isoDate).toLocaleDateString(locale, options);
  } catch (error) {
    return 'Date invalide';
  }
}

/**
 * Formate une date ISO vers un format date + heure
 * @param isoDate - Date au format ISO8601
 * @param locale - Locale pour le formatage
 */
export function formatDateTime(isoDate: string, locale: string = 'fr-FR'): string {
  return new Date(isoDate).toLocaleString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Retourne le début de la journée pour une date donnée
 * @param date - Date (ISO ou Date)
 */
export function startOfDay(date: string | Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Retourne la fin de la journée pour une date donnée
 * @param date - Date (ISO ou Date)
 */
export function endOfDay(date: string | Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/**
 * Ajoute des jours à une date
 * @param date - Date de départ (ISO ou Date)
 * @param days - Nombre de jours à ajouter
 */
export function addDays(date: string | Date, days: number): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Vérifie si une date est dans le passé
 * @param date - Date à vérifier (ISO)
 */
export function isPast(date: string): boolean {
  return new Date(date) < new Date();
}

/**
 * Vérifie si une date est dans le futur
 * @param date - Date à vérifier (ISO)
 */
export function isFuture(date: string): boolean {
  return new Date(date) > new Date();
}

/**
 * Retourne le nombre de jours entre deux dates
 * @param date1 - Première date (ISO)
 * @param date2 - Deuxième date (ISO)
 */
export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get French day of week
 */
export function getDayOfWeek(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(date);
}

/**
 * Format short date in French
 * Returns format like "27 déc"
 */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

/**
 * Get today's label
 * Returns format like "Samedi, 27 déc"
 */
export function getTodayLabel(): string {
  const today = new Date();
  const dayOfWeek = getDayOfWeek(today);
  const formatted = formatShortDate(today);
  return `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, ${formatted}`;
}
