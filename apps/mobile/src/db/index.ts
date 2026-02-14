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
  supplierRepo,
  supplierDebtRepo,
  supplierDebtPaymentRepo,
  supplierInvoiceRepo,
  supplierInvoiceItemRepo,
  clientReceivableRepo,
  clientReceivablePaymentRepo,
  paymentRepo,
  invoiceRepo,
  invoiceItemRepo,
  packagingTypeRepo,
  cashSessionRepo,
  inventorySessionRepo,
  inventoryCountRepo,
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
  LocalSupplier,
  LocalSupplierDebt,
  LocalSupplierDebtPayment,
  LocalSupplierInvoice,
  LocalSupplierInvoiceItem,
  LocalClientReceivable,
  LocalClientReceivablePayment,
  LocalPayment,
  LocalInvoice,
  LocalInvoiceItem,
  LocalPackagingType,
  LocalCashSession,
  LocalInventorySession,
  LocalInventoryCount,
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

export { cacheAuthCredentials, verifyOfflinePin, getCachedAuth, clearAuthCache } from './authCache';
export type { AuthCacheEntry } from './authCache';
