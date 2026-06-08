/**
 * Utility to verify a customer's credit limit before creating a receivable.
 * Returns null if OK, or an error message string if limit exceeded.
 */

import { clientReceivableRepo } from '../db/repositories';
import { formatMoney } from './money';

export async function checkCreditLimit(
  shopId: string,
  customerId: string,
  creditLimit: number,
  newAmount: number
): Promise<string | null> {
  // credit_limit = 0 means unlimited
  if (!creditLimit || creditLimit <= 0) return null;

  const currentBalance = await clientReceivableRepo.getCustomerBalance(shopId, customerId);

  if (currentBalance + newAmount > creditLimit) {
    return (
      `Plafond de credit atteint.\n\n` +
      `Solde impaye: ${formatMoney(currentBalance)}\n` +
      `Limite: ${formatMoney(creditLimit)}\n\n` +
      `Contactez le manager pour augmenter le plafond.`
    );
  }

  return null;
}
