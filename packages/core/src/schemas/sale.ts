import { z } from 'zod';
import { UUID, Currency, SyncFields, PaymentMethod, SaleStatus } from './common';

/**
 * Schéma Vente (Sale)
 */
export const Sale = z
  .object({
    id: UUID,
    shop_id: UUID,
    customer_id: UUID.optional(), // Client optionnel (vente au comptoir)
    cashier_id: UUID, // Utilisateur qui a fait la vente
    status: SaleStatus,
    payment_method: PaymentMethod,
    subtotal: Currency, // Total avant remise
    discount: Currency.default(0), // Remise globale
    tax_total: Currency, // Total TVA
    net_total: Currency, // Total après remise et avant TVA
    grand_total: Currency, // Total final TTC
    paid_total: Currency.default(0), // Montant payé
    change: Currency.default(0), // Monnaie rendue
    notes: z.string().optional(),
  })
  .merge(SyncFields);

export type SaleType = z.infer<typeof Sale>;

/**
 * Schéma Ligne de Vente (Sale Item)
 */
export const SaleItem = z
  .object({
    id: UUID,
    sale_id: UUID,
    product_id: UUID,
    product_name: z.string(), // Dénormalisé pour l'historique
    sku: z.string(), // Dénormalisé
    qty: z.number().positive(),
    unit_price: Currency,
    discount: Currency.default(0), // Remise par ligne
    tax_rate: z.number().min(0).max(1),
    subtotal: Currency,
    tax_total: Currency,
    total: Currency,
  })
  .merge(SyncFields);

export type SaleItemType = z.infer<typeof SaleItem>;

/**
 * Schéma pour créer une vente (Input)
 */
export const CreateSaleInput = z.object({
  customer_id: UUID.optional(),
  payment_method: PaymentMethod,
  discount: Currency.default(0),
  paid_amount: Currency.optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        product_id: UUID,
        qty: z.number().positive(),
        unit_price: Currency.optional(), // Si non fourni, utilise le prix du produit
        discount: Currency.default(0),
      })
    )
    .min(1),
});

export type CreateSaleInputType = z.infer<typeof CreateSaleInput>;
