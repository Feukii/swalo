import { z } from 'zod';
import { UUID, Currency, SyncFields } from './common';

/**
 * Schéma Produit (Product)
 */
export const Product = z
  .object({
    id: UUID,
    shop_id: UUID,
    sku: z.string().min(1).max(50), // Code article
    barcode: z.string().optional(), // Code-barres
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    category: z.string().optional(),
    family: z.string().max(100).optional(), // Famille de produits (e.g., GLASSES, CHARGEURS)
    article_type: z.string().max(100).optional(), // Type d'article (e.g., Glass 3D, Chargeur 1A TC)
    brand: z.string().max(100).optional(), // Marque (e.g., Tecno, Samsung, Oraimo)
    reference: z.string().max(100).optional(), // Référence/Série (e.g., Spark 4, A10E)
    unit: z.string().default('unit'), // unité, kg, litre, etc.
    packaging_type_id: UUID.optional(), // Conditionnement (Carton, Boîte…) — réf. PackagingType
    units_per_package: z.number().int().positive().optional(), // Pièces par conditionnement (ex: 24)
    package_price: Currency.optional(), // Prix du conditionnement complet (en FCFA)
    tax_rate: z.number().min(0).max(1).default(0),
    cost_price: Currency, // Prix d'achat (en FCFA)
    sell_price: Currency, // Prix de vente (en FCFA)
    is_active: z.boolean().default(true),
    alert_threshold: z.number().int().default(5), // Seuil d'alerte stock
    image_url: z.string().url().optional(),
  })
  .merge(SyncFields);

export type ProductType = z.infer<typeof Product>;

/**
 * Schéma Mouvement de Stock (Inventory Movement)
 */
export const InventoryMovement = z
  .object({
    id: UUID,
    shop_id: UUID,
    product_id: UUID,
    type: z.enum(['SALE', 'PURCHASE', 'ADJUSTMENT', 'INVENTORY']),
    qty: z.number(), // Peut être négatif (vente) ou positif (achat)
    reason: z.string().optional(),
    ref_type: z.string().optional(), // Type de référence (SALE, PURCHASE, etc.)
    ref_id: UUID.optional(), // ID de la référence
    unit_cost: Currency.optional(), // Coût unitaire (pour valorisation)
    device_id: z.string(),
    client_op_id: UUID,
  })
  .merge(SyncFields);

export type InventoryMovementType = z.infer<typeof InventoryMovement>;

/**
 * Schéma Inventaire (pour les opérations d'inventaire physique)
 */
export const InventorySession = z
  .object({
    id: UUID,
    shop_id: UUID,
    user_id: UUID,
    status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    started_at: z.string().datetime(),
    completed_at: z.string().datetime().optional(),
    notes: z.string().optional(),
  })
  .merge(SyncFields);

export type InventorySessionType = z.infer<typeof InventorySession>;

export const InventoryCount = z
  .object({
    id: UUID,
    session_id: UUID,
    product_id: UUID,
    expected_qty: z.number().int(),
    counted_qty: z.number().int(),
    difference: z.number().int(),
    notes: z.string().optional(),
  })
  .merge(SyncFields);

export type InventoryCountType = z.infer<typeof InventoryCount>;
