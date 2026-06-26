import { z } from 'zod';
import { UUID, SyncFields } from './common';

/**
 * Politique du code boutique (alphanumérique majuscule).
 *
 * - Charset : `[A-Z0-9]` (lettres majuscules + chiffres).
 * - Longueur : 4 à 10 caractères.
 * - Le tiret `-` est interdit (protège le parsing des numéros de facture
 *   `${shop.code}-${année}-` dans invoices.service.ts).
 * - Les anciens codes numériques restent valides (numérique ⊂ alphanumérique).
 *
 * Le code doit être normalisé (trim + majuscules) à chaque écriture, lecture,
 * génération et mise en cache hors-ligne — voir `normalizeShopCode`.
 */
export const SHOP_CODE_REGEX = /^[A-Z0-9]+$/;
export const SHOP_CODE_MIN_LENGTH = 4;
export const SHOP_CODE_MAX_LENGTH = 10;

/**
 * Normalise un code boutique : supprime les espaces et force les majuscules.
 * À utiliser de façon identique partout (écriture, lookup, génération, cache offline)
 * pour éviter toute incohérence de casse (PostgreSQL/SQLite sont sensibles à la casse).
 */
export function normalizeShopCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Schéma Boutique (Shop)
 */
export const Shop = z
  .object({
    id: UUID,
    code: z.string().min(SHOP_CODE_MIN_LENGTH).max(SHOP_CODE_MAX_LENGTH).regex(SHOP_CODE_REGEX), // Ex: "BTQ01"
    name: z.string().min(1).max(255),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    currency: z.string().default('XOF'), // Devise par défaut
    tax_rate: z.number().min(0).max(1).default(0), // TVA par défaut
    owner_id: UUID,
  })
  .merge(SyncFields);

export type ShopType = z.infer<typeof Shop>;

/**
 * Schéma Utilisateur (User)
 */
export const User = z
  .object({
    id: UUID,
    email: z.string().email().optional(),
    phone: z.string().optional(),
    password_hash: z.string().optional(), // Optionnel car pas exposé côté client
    display_name: z.string().min(1).max(255),
    is_active: z.boolean().default(true),
  })
  .merge(SyncFields)
  .refine(data => data.email || data.phone, {
    message: 'Email ou téléphone requis',
  });

export type UserType = z.infer<typeof User>;

/**
 * Schéma Rôle Utilisateur (UserRole)
 */
export const UserRoleSchema = z
  .object({
    id: UUID,
    user_id: UUID,
    shop_id: UUID,
    role: z.enum(['EMPLOYEE', 'MANAGER', 'BOSS', 'SUPERADMIN']),
  })
  .merge(SyncFields);

export type UserRoleSchemaType = z.infer<typeof UserRoleSchema>;
