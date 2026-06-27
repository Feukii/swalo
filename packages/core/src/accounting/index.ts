/**
 * Moteur comptable partagé (partie double, OHADA/SYSCOHADA simplifié).
 * Pur, sans IO : consommé par le mobile (SQLite), le backend (Prisma) et le web.
 */
export * from './types';
export { ACCOUNTS, getAccount, treasuryAccount } from './accounts';
export { operationsToEcritures } from './operations';
export { postJournal } from './journal';

import type { OperationInput, AccountingResult } from './types';
import { operationsToEcritures } from './operations';
import { postJournal } from './journal';

/** Raccourci : opérations → résultat comptable complet (journal, grand livre, bilan, résultat). */
export function computeAccounting(ops: OperationInput[]): AccountingResult {
  return postJournal(operationsToEcritures(ops));
}
