import { z } from 'zod';

/**
 * Schémas communs utilisés à travers l'application
 */

// Types de base
export const UUID = z.string().uuid();
export const ISODateTime = z.string().datetime();
export const PositiveInt = z.number().int().nonnegative();
export const Currency = z.number().int().nonnegative(); // En centimes

// Enums
export const UserRole = z.enum(['OWNER', 'MANAGER', 'CASHIER']);
export type UserRoleType = z.infer<typeof UserRole>;

export const PaymentMethod = z.enum(['CASH', 'CARD', 'MOBILE', 'CREDIT']);
export type PaymentMethodType = z.infer<typeof PaymentMethod>;

export const SaleStatus = z.enum(['DRAFT', 'COMPLETED', 'CANCELLED']);
export type SaleStatusType = z.infer<typeof SaleStatus>;

export const InvoiceStatus = z.enum(['DRAFT', 'ISSUED', 'PAID', 'CANCELLED']);
export type InvoiceStatusType = z.infer<typeof InvoiceStatus>;

export const MovementType = z.enum(['SALE', 'PURCHASE', 'ADJUSTMENT', 'INVENTORY']);
export type MovementTypeType = z.infer<typeof MovementType>;

export const CashEntryType = z.enum(['IN', 'OUT', 'OPENING', 'CLOSING']);
export type CashEntryTypeType = z.infer<typeof CashEntryType>;

export const RefType = z.enum(['SALE', 'INVOICE', 'SUPPLIER_INVOICE', 'CUSTOMER_CREDIT']);
export type RefTypeType = z.infer<typeof RefType>;

// Champs de synchronisation communs
export const SyncFields = z.object({
  created_at: ISODateTime,
  updated_at: ISODateTime,
  deleted: z.boolean().default(false),
  deleted_at: ISODateTime.optional(),
  version: z.number().int().default(1),
  device_id: z.string().optional(),
  client_op_id: UUID.optional(),
});

// Metadata de sync
export const SyncMetadata = z.object({
  lastSyncAt: ISODateTime.optional(),
  cursor: z.string().optional(),
  entityVersions: z.record(z.number().int()).optional(),
});
