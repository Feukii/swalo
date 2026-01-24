import { getShopItem, setShopItem } from './storage';

export interface CashTransaction {
  id: string;
  timestamp: string;
  category: 'vente' | 'entree' | 'sortie' | 'reglement_fournisseur';
  amount: number;
  paymentMethod?: 'cash' | 'mobile' | 'card' | 'credit';
  note: string;
  customerId?: string;
  customerName?: string;
  isCredit?: boolean; // Indicates if this is a credit transaction
  saleItems?: Array<{
    productId: string;
    productName: string;
    quantity: number;
  }>;
}

const CASH_TRANSACTIONS_KEY = 'cash_transactions';
const CASH_BALANCE_KEY = 'cash_balance';

/**
 * Get all cash transactions from storage (shop-specific)
 */
export async function getCashTransactions(): Promise<CashTransaction[]> {
  try {
    const data = await getShopItem(CASH_TRANSACTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading cash transactions:', error);
    return [];
  }
}

/**
 * Get cash balance from storage (shop-specific)
 */
export async function getCashBalance(): Promise<number> {
  try {
    const data = await getShopItem(CASH_BALANCE_KEY);
    return data ? parseFloat(data) : 0;
  } catch (error) {
    console.error('Error loading cash balance:', error);
    return 0;
  }
}

/**
 * Add a cash transaction (shop-specific)
 */
export async function addCashTransaction(
  transaction: Omit<CashTransaction, 'id' | 'timestamp'>
): Promise<CashTransaction> {
  try {
    // Create transaction with ID and timestamp
    const newTransaction: CashTransaction = {
      ...transaction,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };

    // Get existing transactions
    const transactions = await getCashTransactions();
    transactions.unshift(newTransaction); // Add to beginning

    // Save updated transactions
    await setShopItem(CASH_TRANSACTIONS_KEY, JSON.stringify(transactions));

    // Update balance
    const currentBalance = await getCashBalance();
    const newBalance = currentBalance + transaction.amount;
    await setShopItem(CASH_BALANCE_KEY, newBalance.toString());

    return newTransaction;
  } catch (error) {
    console.error('Error adding cash transaction:', error);
    throw error;
  }
}

/**
 * Get today's transactions
 */
export async function getTodayTransactions(): Promise<CashTransaction[]> {
  const transactions = await getCashTransactions();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return transactions.filter(t => {
    const transactionDate = new Date(t.timestamp);
    transactionDate.setHours(0, 0, 0, 0);
    return transactionDate.getTime() === today.getTime();
  });
}

/**
 * Get today's stats
 */
export async function getTodayStats() {
  const todayTransactions = await getTodayTransactions();

  const entries = todayTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);

  const exits = Math.abs(
    todayTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)
  );

  // Net = total entrées - total sorties
  const net = entries - exits;

  return {
    entries,
    exits,
    net,
    balance: await getCashBalance(),
  };
}

/**
 * Format time from ISO string
 */
export function formatTransactionTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Get category label
 */
export function getCategoryLabel(category: CashTransaction['category']): string {
  const labels = {
    vente: 'Vente',
    entree: 'Entrée',
    sortie: 'Sortie',
    reglement_fournisseur: 'Règlement fournisseur',
  };
  return labels[category] || category;
}
