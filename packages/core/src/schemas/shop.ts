import { z } from 'zod';
import { UUID, SyncFields } from './common';

/**
 * Schéma Boutique (Shop)
 */
export const Shop = z
  .object({
    id: UUID,
    code: z
      .string()
      .min(2)
      .max(10)
      .regex(/^[A-Z0-9]+$/), // Ex: "BTQ01"
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
    role: z.enum(['OWNER', 'MANAGER', 'CASHIER']),
  })
  .merge(SyncFields);

export type UserRoleSchemaType = z.infer<typeof UserRoleSchema>;
