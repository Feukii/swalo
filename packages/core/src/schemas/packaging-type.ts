import { z } from 'zod';
import { UUID } from './common';

/**
 * Schema PackagingType (Conditionnement)
 */
export const PackagingType = z.object({
  id: UUID,
  shop_id: UUID,
  name: z.string().min(1).max(50),
  symbol: z.string().max(10).optional(),
  is_default: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted: z.boolean().default(false),
  deleted_at: z.string().datetime().optional(),
});

export type PackagingTypeType = z.infer<typeof PackagingType>;

/**
 * Schema pour creer un conditionnement (Input)
 */
export const CreatePackagingTypeInput = z.object({
  name: z.string().min(1).max(50),
  symbol: z.string().max(10).optional(),
  is_default: z.boolean().optional(),
});

export type CreatePackagingTypeInputType = z.infer<typeof CreatePackagingTypeInput>;

/**
 * Schema pour mettre a jour un conditionnement (Input)
 */
export const UpdatePackagingTypeInput = CreatePackagingTypeInput.partial();

export type UpdatePackagingTypeInputType = z.infer<typeof UpdatePackagingTypeInput>;
