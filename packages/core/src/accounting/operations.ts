/**
 * Traduction des opérations métier en écritures comptables équilibrées.
 */
import type { Ecriture, EcritureLine, OperationInput } from './types';
import { treasuryAccount } from './accounts';

function d(account: string, amount: number): EcritureLine {
  return { account, debit: amount, credit: 0 };
}
function c(account: string, amount: number): EcritureLine {
  return { account, debit: 0, credit: amount };
}

/** Construit une écriture en vérifiant l'équilibre Σdébit === Σcrédit. */
function ecriture(
  date: string,
  libelle: string,
  lines: EcritureLine[],
  ref?: { type: string; id: string }
): Ecriture {
  const totalD = lines.reduce((s, l) => s + l.debit, 0);
  const totalC = lines.reduce((s, l) => s + l.credit, 0);
  if (totalD !== totalC) {
    throw new Error(`Écriture déséquilibrée "${libelle}": débit ${totalD} ≠ crédit ${totalC}`);
  }
  return { date, libelle, ref, lines };
}

/** Transforme une liste d'opérations en journal d'écritures. */
export function operationsToEcritures(ops: OperationInput[]): Ecriture[] {
  const out: Ecriture[] = [];

  for (const op of ops) {
    switch (op.kind) {
      case 'OPENING_BALANCE': {
        // Classes 1–5 à l'ouverture ; le capital (101) est le solde équilibrant (plug).
        const actif = op.stock + op.caisse + op.banque + op.mobile + op.receivables;
        const capital = actif - op.debts;
        const lines: EcritureLine[] = [];
        if (op.stock) lines.push(d('311', op.stock));
        if (op.caisse) lines.push(d('571', op.caisse));
        if (op.banque) lines.push(d('521', op.banque));
        if (op.mobile) lines.push(d('551', op.mobile));
        if (op.receivables) lines.push(d('411', op.receivables));
        if (op.debts) lines.push(c('401', op.debts));
        // Le plug capital peut être négatif (passif net) → on le porte au crédit/débit selon le signe.
        if (capital >= 0) lines.push(c('101', capital));
        else lines.push(d('101', -capital));
        if (lines.length) out.push(ecriture(op.date, 'Solde à nouveau', lines));
        break;
      }
      case 'CAPITAL_INJECTION':
        out.push(
          ecriture(op.date, op.libelle ?? 'Apport en capital', [
            d(treasuryAccount(op.treasury), op.amount),
            c('101', op.amount),
          ])
        );
        break;
      case 'CASH_SALE':
        out.push(
          ecriture(
            op.date,
            'Vente au comptant',
            [d(treasuryAccount(op.treasury), op.amount), c('701', op.amount)],
            { type: 'SALE', id: op.saleId }
          )
        );
        break;
      case 'CREDIT_SALE':
        out.push(
          ecriture(op.date, 'Vente à crédit', [d('411', op.amount), c('701', op.amount)], {
            type: 'SALE',
            id: op.saleId,
          })
        );
        break;
      case 'COGS':
        // Inventaire permanent : sortie de stock au coût.
        out.push(
          ecriture(
            op.date,
            'Coût des marchandises vendues',
            [d('603', op.amount), c('311', op.amount)],
            {
              type: 'COGS',
              id: op.saleId,
            }
          )
        );
        break;
      case 'RECEIVABLE_SETTLEMENT':
        out.push(
          ecriture(
            op.date,
            'Encaissement créance client',
            [d(treasuryAccount(op.treasury), op.amount), c('411', op.amount)],
            { type: 'RECEIVABLE', id: op.refId }
          )
        );
        break;
      case 'SUPPLIER_DEBT_CREATE':
        // Achat à crédit : charge + dette, et entrée en stock.
        out.push(
          ecriture(
            op.date,
            'Achat marchandises à crédit',
            [d('601', op.amount), c('401', op.amount)],
            {
              type: 'SUPPLIER_DEBT',
              id: op.refId,
            }
          )
        );
        out.push(
          ecriture(
            op.date,
            'Entrée en stock (achat crédit)',
            [d('311', op.amount), c('603', op.amount)],
            {
              type: 'SUPPLIER_DEBT',
              id: op.refId,
            }
          )
        );
        break;
      case 'SUPPLIER_PAYMENT':
        out.push(
          ecriture(
            op.date,
            'Règlement fournisseur',
            [d('401', op.amount), c(treasuryAccount(op.treasury), op.amount)],
            { type: 'SUPPLIER_PAYMENT', id: op.refId }
          )
        );
        break;
      case 'CASH_PURCHASE_STOCK':
        out.push(
          ecriture(
            op.date,
            'Achat marchandises au comptant',
            [d('601', op.amount), c(treasuryAccount(op.treasury), op.amount)],
            { type: 'PURCHASE', id: op.refId }
          )
        );
        out.push(
          ecriture(
            op.date,
            'Entrée en stock (achat comptant)',
            [d('311', op.amount), c('603', op.amount)],
            {
              type: 'PURCHASE',
              id: op.refId,
            }
          )
        );
        break;
      case 'OPERATING_EXPENSE':
        out.push(
          ecriture(op.date, op.libelle ?? 'Charge', [
            d(op.account, op.amount),
            c(treasuryAccount(op.treasury), op.amount),
          ])
        );
        break;
      case 'OWNER_DRAWING':
        out.push(
          ecriture(op.date, 'Prélèvement personnel', [
            d('108', op.amount),
            c(treasuryAccount(op.treasury), op.amount),
          ])
        );
        break;
      case 'CUSTOMER_REFUND':
        // Retour/remboursement client : réduit le chiffre d'affaires.
        out.push(
          ecriture(op.date, 'Remboursement client', [
            d('701', op.amount),
            c(treasuryAccount(op.treasury), op.amount),
          ])
        );
        break;
      case 'SUPPLIER_REFUND':
        out.push(
          ecriture(op.date, 'Remboursement reçu fournisseur', [
            d(treasuryAccount(op.treasury), op.amount),
            c('758', op.amount),
          ])
        );
        break;
      case 'STOCK_ADJUSTMENT':
        if (op.direction === 'INCREASE') {
          out.push(
            ecriture(
              op.date,
              'Ajustement de stock (hausse)',
              [d('311', op.amount), c('603', op.amount)],
              {
                type: 'ADJUSTMENT',
                id: op.refId,
              }
            )
          );
        } else {
          out.push(
            ecriture(
              op.date,
              'Ajustement de stock (baisse)',
              [d('603', op.amount), c('311', op.amount)],
              {
                type: 'ADJUSTMENT',
                id: op.refId,
              }
            )
          );
        }
        break;
    }
  }

  return out;
}
