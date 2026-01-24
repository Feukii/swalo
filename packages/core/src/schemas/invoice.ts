import { z } from 'zod';
import { UUID, Currency, SyncFields, InvoiceStatus } from './common';

/**
 * Schéma Facture (Invoice)
 */
export const Invoice = z
  .object({
    id: UUID,
    shop_id: UUID,
    sale_id: UUID.optional(), // Facture peut être liée à une vente
    customer_id: UUID.optional(),
    number: z.string().min(1), // Numéro de facture (ex: BTQ01-2025-0001)
    status: InvoiceStatus,
    issue_date: z.string().datetime(),
    due_date: z.string().datetime().optional(),
    subtotal: Currency,
    discount: Currency.default(0),
    tax_total: Currency,
    grand_total: Currency,
    paid_total: Currency.default(0),
    balance_due: Currency,
    notes: z.string().optional(),
    pdf_url: z.string().url().optional(),
  })
  .merge(SyncFields);

export type InvoiceType = z.infer<typeof Invoice>;

/**
 * Schéma Ligne de Facture (Invoice Item)
 */
export const InvoiceItem = z
  .object({
    id: UUID,
    invoice_id: UUID,
    product_id: UUID.optional(),
    description: z.string().min(1), // Description du produit/service
    qty: z.number().positive(),
    unit_price: Currency,
    discount: Currency.default(0),
    tax_rate: z.number().min(0).max(1),
    subtotal: Currency,
    tax_total: Currency,
    total: Currency,
  })
  .merge(SyncFields);

export type InvoiceItemType = z.infer<typeof InvoiceItem>;

/**
 * Schéma pour créer une facture (Input)
 */
export const CreateInvoiceInput = z.object({
  customer_id: UUID.optional(),
  sale_id: UUID.optional(),
  due_date: z.string().datetime().optional(),
  discount: Currency.default(0),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        product_id: UUID.optional(),
        description: z.string().min(1),
        qty: z.number().positive(),
        unit_price: Currency,
        discount: Currency.default(0),
        tax_rate: z.number().min(0).max(1).default(0),
      })
    )
    .min(1),
});

export type CreateInvoiceInputType = z.infer<typeof CreateInvoiceInput>;
