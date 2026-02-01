/**
 * Local database module - barrel export
 */

export {
  initDatabase,
  resetDatabase,
  closeDatabase,
  getDatabase,
  getSchemaVersion,
} from './schema';
export type { SyncStatus, SyncableEntity } from './schema';
export { SYNCABLE_ENTITIES } from './schema';

export { LocalRepository, generateId, nowISO } from './repository';
export type { LocalRecord, QueryOptions } from './repository';

export {
  productRepo,
  stockBatchRepo,
  customerRepo,
  saleRepo,
  saleItemRepo,
  cashEntryRepo,
  inventoryMovementRepo,
} from './repositories';
export type {
  LocalProduct,
  LocalStockBatch,
  LocalCustomer,
  LocalSale,
  LocalSaleWithItems,
  LocalSaleItem,
  LocalCashEntry,
  LocalInventoryMovement,
} from './repositories';

export {
  enqueueMutation,
  dequeuePending,
  getFailedMutations,
  markProcessing,
  markBatchProcessing,
  markApplied,
  markBatchApplied,
  markFailed,
  retryMutation,
  resetProcessingToPending,
  getPendingCount,
  getFailedCount,
  getTotalQueueCount,
  clearQueue,
  getPendingGroupedByEntity,
} from './queue';
export type { MutationOp, MutationStatus, MutationRecord } from './queue';
