/**
 * Types pour le système de gestion de stock
 */

// Catégorie de produit (dynamique, stockée dans AsyncStorage)
export interface Category {
  id: string;
  key: string; // Identifiant unique (ex: 'alimentation')
  label: string; // Nom affiché (ex: 'Alimentation')
  isDefault?: boolean; // Catégorie par défaut (ne peut pas être supprimée)
  createdAt: string;
  updatedAt: string;
}

// Type pour compatibilité (maintenant string pour supporter les catégories personnalisées)
export type ProductCategory = string;

// Catégories par défaut
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: '1',
    key: 'alimentation',
    label: 'Alimentation',
    isDefault: true,
    createdAt: '',
    updatedAt: '',
  },
  { id: '2', key: 'boissons', label: 'Boissons', isDefault: true, createdAt: '', updatedAt: '' },
  { id: '3', key: 'hygiene', label: 'Hygiène', isDefault: true, createdAt: '', updatedAt: '' },
  {
    id: '4',
    key: 'electronique',
    label: 'Électronique',
    isDefault: true,
    createdAt: '',
    updatedAt: '',
  },
  { id: '5', key: 'vetements', label: 'Vêtements', isDefault: true, createdAt: '', updatedAt: '' },
  { id: '6', key: 'autres', label: 'Autres', isDefault: true, createdAt: '', updatedAt: '' },
];

// Produit dans le catalogue
export interface Product {
  id: string;
  reference: string;
  name: string;
  category: ProductCategory;
  description?: string;
  price?: number; // Prix de vente en FCFA
  stockQuantity: number;
  stockThreshold: number;
  unit: string;
  size?: string; // Size variant (e.g., "500ml", "XL")
  createdAt: string;
  updatedAt: string;
}

// Mouvement de stock
export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'entry' | 'exit' | 'adjustment' | 'sale';
  quantity: number;
  reason: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

// Inventaire
export interface Inventory {
  id: string;
  date: string;
  status: 'draft' | 'completed';
  items: InventoryItem[];
  createdBy: string;
  completedAt?: string;
}

export interface InventoryItem {
  productId: string;
  productName: string;
  theoreticalStock: number;
  actualStock: number;
  difference: number;
}

// Vente
export interface Sale {
  id: string;
  date: string;
  items: SaleItem[];
  paymentMethod: 'cash' | 'mobile' | 'card' | 'credit';
  customerId?: string;
  customerName?: string;
  createdBy: string;
  notes?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
}

// Typologie caisse
export type CashEntryType =
  | 'sale'
  | 'supplier_payment'
  | 'expense'
  | 'deposit'
  | 'withdrawal'
  | 'other';

export interface CashTransaction {
  id: string;
  type: CashEntryType;
  amount: number;
  category: string;
  description: string;
  date: string;
  createdBy: string;
  saleId?: string;
}
