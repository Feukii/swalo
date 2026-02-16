import { z } from 'zod';
import { UUID, Currency, SyncFields } from './common';

/**
 * Schéma Client (Customer)
 */
export const Customer = z
  .object({
    id: UUID,
    shop_id: UUID,
    code: z.string().optional(), // Code client auto-généré
    name: z.string().min(1).max(255),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    credit_limit: Currency.default(0), // Limite de crédit (en centimes)
    notes: z.string().optional(),
    is_active: z.boolean().default(true),
    email_notifications_enabled: z.boolean().default(true),
  })
  .merge(SyncFields);

export type CustomerType = z.infer<typeof Customer>;

/**
 * Schéma Crédit Client
 * Le solde est calculé : Σ ventes à crédit - Σ paiements
 */
export const CustomerCredit = z.object({
  customer_id: UUID,
  total_credit: Currency, // Total des ventes à crédit
  total_paid: Currency, // Total payé
  balance: Currency, // Solde dû
  last_payment_date: z.string().datetime().optional(),
});

export type CustomerCreditType = z.infer<typeof CustomerCredit>;
