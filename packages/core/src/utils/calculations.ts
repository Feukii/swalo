/**
 * Utilitaires de calcul métier
 */

import type { SaleItem, InvoiceItem } from '../types';
import { calculateTax, sumCents } from './currency';

/**
 * Calcule les totaux d'une ligne de vente/facture
 * @param qty - Quantité
 * @param unitPrice - Prix unitaire (en FCFA)
 * @param discount - Remise (en FCFA)
 * @param taxRate - Taux de taxe (ex: 0.18 pour 18%)
 */
export function calculateLineTotal(
  qty: number,
  unitPrice: number,
  discount: number = 0,
  taxRate: number = 0
): {
  subtotal: number;
  tax_total: number;
  total: number;
} {
  const subtotal = qty * unitPrice - discount;
  const tax_total = calculateTax(subtotal, taxRate);
  const total = subtotal + tax_total;

  return {
    subtotal,
    tax_total,
    total,
  };
}

/**
 * Calcule les totaux d'une vente ou facture
 * @param items - Lignes de vente/facture
 * @param globalDiscount - Remise globale (en FCFA)
 */
export function calculateDocumentTotal(
  items: Array<Pick<SaleItem | InvoiceItem, 'subtotal' | 'tax_total' | 'total'>>,
  globalDiscount: number = 0
): {
  subtotal: number;
  discount: number;
  net_total: number;
  tax_total: number;
  grand_total: number;
} {
  const subtotal = sumCents(...items.map(item => item.subtotal));
  const tax_total = sumCents(...items.map(item => item.tax_total));
  const net_total = subtotal - globalDiscount;
  const grand_total = net_total + tax_total;

  return {
    subtotal,
    discount: globalDiscount,
    net_total,
    tax_total,
    grand_total,
  };
}

/**
 * Calcule la monnaie à rendre
 * @param total - Montant total (en FCFA)
 * @param paid - Montant payé (en FCFA)
 */
export function calculateChange(total: number, paid: number): number {
  return Math.max(0, paid - total);
}

/**
 * Calcule le solde dû
 * @param total - Montant total (en FCFA)
 * @param paid - Montant payé (en FCFA)
 */
export function calculateBalance(total: number, paid: number): number {
  return Math.max(0, total - paid);
}

/**
 * Calcule la marge
 * @param sellPrice - Prix de vente (en FCFA)
 * @param costPrice - Prix d'achat (en FCFA)
 */
export function calculateMargin(sellPrice: number, costPrice: number): number {
  return sellPrice - costPrice;
}

/**
 * Calcule le taux de marge
 * @param sellPrice - Prix de vente (en FCFA)
 * @param costPrice - Prix d'achat (en FCFA)
 */
export function calculateMarginRate(sellPrice: number, costPrice: number): number {
  if (costPrice === 0) return 0;
  return (sellPrice - costPrice) / costPrice;
}
