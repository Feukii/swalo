import { z } from 'zod';
import { UUID, Currency, SyncFields, PaymentMethod, RefType } from './common';

/**
 * Schéma Paiement (Payment)
 * Enregistre tous les paiements : ventes, factures, fournisseurs, crédits clients
 */
export const Payment = z
  .object({
    id: UUID,
    shop_id: UUID,
    ref_type: RefType, // Type de référence
    ref_id: UUID, // ID de la référence (sale_id, invoice_id, etc.)
    method: PaymentMethod,
    amount: Currency,
    receipt_ref: z.string().optional(), // Référence du reçu/transaction
    notes: z.string().optional(),
    cashier_id: UUID.optional(), // Utilisateur qui a encaissé
    device_id: z.string(),
    client_op_id: UUID,
  })
  .merge(SyncFields);

export type PaymentType = z.infer<typeof Payment>;

/**
 * Schéma pour créer un paiement (Input)
 */
export const CreatePaymentInput = z.object({
  ref_type: RefType,
  ref_id: UUID,
  method: PaymentMethod,
  amount: Currency.positive(),
  receipt_ref: z.string().optional(),
  notes: z.string().optional(),
});

export type CreatePaymentInputType = z.infer<typeof CreatePaymentInput>;
