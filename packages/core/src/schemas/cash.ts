import { z } from 'zod';
import { UUID, Currency, SyncFields, CashEntryType } from './common';

/**
 * Schéma Entrée de Caisse (Cash Entry)
 * Journal de caisse : ouvertures, clôtures, entrées/sorties hors ventes
 */
export const CashEntry = z
  .object({
    id: UUID,
    shop_id: UUID,
    type: CashEntryType,
    amount: Currency,
    note: z.string().optional(),
    cashier_id: UUID,
    device_id: z.string(),
    client_op_id: UUID,
  })
  .merge(SyncFields);

export type CashEntrySchemaType = z.infer<typeof CashEntry>;

/**
 * Schéma Session de Caisse
 * Représente une session de caisse (ouverture -> clôture)
 */
export const CashSession = z
  .object({
    id: UUID,
    shop_id: UUID,
    cashier_id: UUID,
    status: z.enum(['OPEN', 'CLOSED']),
    opening_balance: Currency,
    closing_balance: Currency.optional(),
    expected_balance: Currency.optional(),
    difference: Currency.optional(),
    opened_at: z.string().datetime(),
    closed_at: z.string().datetime().optional(),
    notes: z.string().optional(),
  })
  .merge(SyncFields);

export type CashSessionType = z.infer<typeof CashSession>;

/**
 * Schéma pour ouvrir une caisse
 */
export const OpenCashSessionInput = z.object({
  opening_balance: Currency.nonnegative(),
  notes: z.string().optional(),
});

export type OpenCashSessionInputType = z.infer<typeof OpenCashSessionInput>;

/**
 * Schéma pour clôturer une caisse
 */
export const CloseCashSessionInput = z.object({
  closing_balance: Currency.nonnegative(),
  notes: z.string().optional(),
});

export type CloseCashSessionInputType = z.infer<typeof CloseCashSessionInput>;
