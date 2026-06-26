/**
 * Utility to verify a supplier's borrowing limit before creating a debt.
 * Returns null if OK, or an error message string if limit exceeded.
 */

import { supplierDebtRepo } from '../db/repositories';
import { formatMoney } from './money';

export async function checkBorrowingLimit(
  shopId: string,
  supplierId: string,
  borrowingLimit: number,
  newAmount: number
): Promise<string | null> {
  // borrowing_limit = 0 means unlimited
  if (!borrowingLimit || borrowingLimit <= 0) return null;

  const currentBalance = await supplierDebtRepo.getSupplierBalance(shopId, supplierId);

  if (currentBalance + newAmount > borrowingLimit) {
    return (
      `Plafond d'endettement atteint.\n\n` +
      `Solde du: ${formatMoney(currentBalance)}\n` +
      `Limite: ${formatMoney(borrowingLimit)}\n\n` +
      `Contactez le manager pour augmenter le plafond.`
    );
  }

  return null;
}
