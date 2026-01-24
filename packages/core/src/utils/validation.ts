/**
 * Utilitaires de validation
 */

import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

/**
 * Génère un UUID v4
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Valide un UUID
 * @param uuid - UUID à valider
 */
export function isValidUUID(uuid: string): boolean {
  return uuidValidate(uuid);
}

/**
 * Normalise un numéro de téléphone
 * @param phone - Numéro de téléphone
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
}

/**
 * Normalise un email
 * @param email - Email
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Valide un code SKU (uniquement alphanumérique et tirets)
 * @param sku - Code SKU
 */
export function isValidSKU(sku: string): boolean {
  return /^[A-Z0-9-]+$/i.test(sku);
}

/**
 * Génère un code unique pour une entité
 * @param prefix - Préfixe (ex: "CLI", "PRD")
 * @param number - Numéro séquentiel
 * @param length - Longueur du numéro (avec padding)
 */
export function generateCode(prefix: string, number: number, length: number = 4): string {
  return `${prefix}${number.toString().padStart(length, '0')}`;
}
