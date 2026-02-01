import { z } from 'zod';
import { UUID, Currency, SyncFields } from './common';

/**
 * Enums Multi-Boutiques
 */
export const ShopTypeEnum = z.enum(['MAGASIN', 'BOUTIQUE']);
export type ShopTypeEnumType = z.infer<typeof ShopTypeEnum>;

export const TransferStatus = z.enum(['DRAFT', 'CONFIRMED', 'SHIPPED', 'RECEIVED', 'CANCELLED']);
export type TransferStatusType = z.infer<typeof TransferStatus>;

/**
 * Schema Entreprise
 */
export const Enterprise = z
  .object({
    id: UUID,
    code: z
      .string()
      .min(2)
      .max(20)
      .regex(/^[A-Z0-9_-]+$/),
    name: z.string().min(1).max(255),
    owner_id: UUID,
  })
  .merge(SyncFields);

export type EnterpriseType = z.infer<typeof Enterprise>;

export const CreateEnterpriseInput = z.object({
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/),
  name: z.string().min(1).max(255),
});

export type CreateEnterpriseInputType = z.infer<typeof CreateEnterpriseInput>;

export const UpdateEnterpriseInput = z.object({
  name: z.string().min(1).max(255).optional(),
});

export type UpdateEnterpriseInputType = z.infer<typeof UpdateEnterpriseInput>;

/**
 * Schema Transfert Inter-Boutiques
 */
export const InterShopTransferItem = z.object({
  id: UUID.optional(),
  product_sku: z.string().min(1).max(50),
  product_name: z.string().min(1).max(255),
  quantity: z.number().int().positive(),
  unit_price: Currency,
  cost_price: Currency,
  total: Currency,
});

export type InterShopTransferItemType = z.infer<typeof InterShopTransferItem>;

export const InterShopTransfer = z
  .object({
    id: UUID,
    enterprise_id: UUID,
    source_shop_id: UUID,
    target_shop_id: UUID,
    status: TransferStatus,
    notes: z.string().optional(),
    created_by: UUID,
    items: z.array(InterShopTransferItem).optional(),
  })
  .merge(SyncFields);

export type InterShopTransferType = z.infer<typeof InterShopTransfer>;

export const CreateTransferItemInput = z.object({
  product_sku: z.string().min(1).max(50),
  product_name: z.string().min(1).max(255),
  quantity: z.number().int().positive(),
  unit_price: Currency,
  cost_price: Currency,
});

export type CreateTransferItemInputType = z.infer<typeof CreateTransferItemInput>;

export const CreateTransferInput = z.object({
  source_shop_id: UUID,
  target_shop_id: UUID,
  items: z.array(CreateTransferItemInput).min(1),
  notes: z.string().optional(),
});

export type CreateTransferInputType = z.infer<typeof CreateTransferInput>;
