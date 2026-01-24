import { z } from 'zod';
import { UUID, Currency, SyncFields } from './common';

/**
 * Schéma Fournisseur (Supplier)
 */
export const Supplier = z
  .object({
    id: UUID,
    shop_id: UUID,
    code: z.string().optional(), // Code fournisseur
    name: z.string().min(1).max(255),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    is_active: z.boolean().default(true),
  })
  .merge(SyncFields);

export type SupplierType = z.infer<typeof Supplier>;

/**
 * Schéma Facture Fournisseur (Purchase/Supplier Invoice)
 */
export const SupplierInvoice = z
  .object({
    id: UUID,
    shop_id: UUID,
    supplier_id: UUID,
    number: z.string().min(1), // Numéro de facture fournisseur
    invoice_date: z.string().datetime(),
    due_date: z.string().datetime().optional(),
    status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED']),
    subtotal: Currency,
    tax_total: Currency,
    total: Currency,
    paid_total: Currency.default(0),
    notes: z.string().optional(),
  })
  .merge(SyncFields);

export type SupplierInvoiceType = z.infer<typeof SupplierInvoice>;

/**
 * Schéma Ligne de Facture Fournisseur
 */
export const SupplierInvoiceItem = z
  .object({
    id: UUID,
    invoice_id: UUID,
    product_id: UUID,
    description: z.string().optional(),
    qty: z.number().positive(),
    unit_cost: Currency,
    tax_rate: z.number().min(0).max(1),
    subtotal: Currency,
    tax_total: Currency,
    total: Currency,
  })
  .merge(SyncFields);

export type SupplierInvoiceItemType = z.infer<typeof SupplierInvoiceItem>;
