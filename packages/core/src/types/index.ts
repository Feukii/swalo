/**
 * Types TypeScript inférés depuis les schémas Zod
 */

import { z } from 'zod';
import * as schemas from '../schemas';

// Types de base
export type UUID = string;
export type ISODateTime = string;
export type Currency = number; // En centimes

// Types d'entités
export type Shop = z.infer<typeof schemas.Shop>;
export type User = z.infer<typeof schemas.User>;
export type UserRole = z.infer<typeof schemas.UserRoleSchema>;
export type Product = z.infer<typeof schemas.Product>;
export type InventoryMovement = z.infer<typeof schemas.InventoryMovement>;
export type InventorySession = z.infer<typeof schemas.InventorySession>;
export type InventoryCount = z.infer<typeof schemas.InventoryCount>;
export type Customer = z.infer<typeof schemas.Customer>;
export type CustomerCredit = z.infer<typeof schemas.CustomerCredit>;
export type Supplier = z.infer<typeof schemas.Supplier>;
export type SupplierInvoice = z.infer<typeof schemas.SupplierInvoice>;
export type SupplierInvoiceItem = z.infer<typeof schemas.SupplierInvoiceItem>;
export type Sale = z.infer<typeof schemas.Sale>;
export type SaleItem = z.infer<typeof schemas.SaleItem>;
export type Invoice = z.infer<typeof schemas.Invoice>;
export type InvoiceItem = z.infer<typeof schemas.InvoiceItem>;
export type Payment = z.infer<typeof schemas.Payment>;
export type CashEntry = z.infer<typeof schemas.CashEntry>;
export type CashSession = z.infer<typeof schemas.CashSession>;
export type DeviceSyncState = z.infer<typeof schemas.DeviceSyncState>;

// Types Enums
export type UserRoleType = z.infer<typeof schemas.UserRole>;
export type PaymentMethodType = z.infer<typeof schemas.PaymentMethod>;
export type SaleStatusType = z.infer<typeof schemas.SaleStatus>;
export type InvoiceStatusType = z.infer<typeof schemas.InvoiceStatus>;
export type MovementTypeType = z.infer<typeof schemas.MovementType>;
export type CashEntryTypeType = z.infer<typeof schemas.CashEntryType>;
export type RefTypeType = z.infer<typeof schemas.RefType>;
export type MutationOpType = z.infer<typeof schemas.MutationOp>;

// Types de synchronisation
export type Mutation = z.infer<typeof schemas.Mutation>;
export type SyncPullRequest = z.infer<typeof schemas.SyncPullRequest>;
export type SyncPullResponse = z.infer<typeof schemas.SyncPullResponse>;
export type SyncPushRequest = z.infer<typeof schemas.SyncPushRequest>;
export type SyncPushResponse = z.infer<typeof schemas.SyncPushResponse>;

// Types d'input
export type CreateSaleInput = z.infer<typeof schemas.CreateSaleInput>;
export type CreateInvoiceInput = z.infer<typeof schemas.CreateInvoiceInput>;
export type CreatePaymentInput = z.infer<typeof schemas.CreatePaymentInput>;
export type OpenCashSessionInput = z.infer<typeof schemas.OpenCashSessionInput>;
export type CloseCashSessionInput = z.infer<typeof schemas.CloseCashSessionInput>;

// Types utilitaires
export interface StockLevel {
  product_id: UUID;
  current_qty: number;
  alert_threshold: number;
  is_low_stock: boolean;
  last_movement_at?: ISODateTime;
}

export interface DashboardKPIs {
  daily_sales: Currency;
  weekly_sales: Currency;
  monthly_sales: Currency;
  sales_count: number;
  top_products: Array<{
    product_id: UUID;
    product_name: string;
    qty_sold: number;
    revenue: Currency;
  }>;
  customer_credits: Currency;
  supplier_debts: Currency;
  low_stock_count: number;
}

export interface SyncStatus {
  is_syncing: boolean;
  last_sync_at?: ISODateTime;
  pending_changes: number;
  is_online: boolean;
  error?: string;
}
