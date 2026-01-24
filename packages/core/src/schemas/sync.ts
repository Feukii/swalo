import { z } from 'zod';
import { UUID, ISODateTime } from './common';

/**
 * Schémas pour la synchronisation
 */

/**
 * État de synchronisation d'un device
 */
export const DeviceSyncState = z.object({
  id: UUID,
  device_id: z.string(),
  shop_id: UUID,
  last_sync_at: ISODateTime.optional(),
  cursor: z.string().optional(),
  entity_versions: z.record(z.number().int()).optional(), // { "product": 123, "customer": 45, ... }
});

export type DeviceSyncStateType = z.infer<typeof DeviceSyncState>;

/**
 * Opération de mutation (pour push)
 */
export const MutationOp = z.enum(['insert', 'upsert', 'update', 'delete']);
export type MutationOpType = z.infer<typeof MutationOp>;

/**
 * Mutation générique
 */
export const Mutation = z.object({
  op: MutationOp,
  id: UUID,
  data: z.record(z.any()), // Données de l'entité
  entity: z.string(), // Nom de l'entité (product, sale, etc.)
  client_op_id: UUID,
  device_id: z.string(),
  timestamp: ISODateTime,
});

export type MutationType = z.infer<typeof Mutation>;

/**
 * Requête de synchronisation Pull
 */
export const SyncPullRequest = z.object({
  clientID: z.string(),
  lastSyncAt: ISODateTime.optional(),
  entityVersions: z.record(z.number().int()).optional(),
});

export type SyncPullRequestType = z.infer<typeof SyncPullRequest>;

/**
 * Réponse de synchronisation Pull
 */
export const SyncPullResponse = z.object({
  changes: z.record(z.array(z.record(z.any()))), // { entity: [records] }
  newCursor: z.string(),
  serverTime: ISODateTime,
});

export type SyncPullResponseType = z.infer<typeof SyncPullResponse>;

/**
 * Requête de synchronisation Push
 */
export const SyncPushRequest = z.object({
  clientID: z.string(),
  changes: z.record(z.array(z.record(z.any()))), // { entity: [records with ops] }
  baseCursor: z.string().optional(),
});

export type SyncPushRequestType = z.infer<typeof SyncPushRequest>;

/**
 * Réponse de synchronisation Push
 */
export const SyncPushResponse = z.object({
  applied: z.record(z.array(UUID)), // { entity: [ids appliqués] }
  conflicts: z.array(
    z.object({
      entity: z.string(),
      id: UUID,
      reason: z.string(),
      serverVersion: z.record(z.any()).optional(),
      clientVersion: z.record(z.any()).optional(),
    })
  ),
  newCursor: z.string(),
  serverTime: ISODateTime,
});

export type SyncPushResponseType = z.infer<typeof SyncPushResponse>;
