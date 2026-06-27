/**
 * Report des écritures au grand livre, puis dérivation du bilan et du compte
 * de résultat. Garantit : Σdébit = Σcrédit et Actif = Passif (si un solde
 * d'ouverture des classes 1–5 est présent).
 */
import type {
  AccountingResult,
  BalanceSheet,
  BilanLine,
  ChargeLine,
  Ecriture,
  IncomeStatement,
  LedgerAccount,
} from './types';
import { ACCOUNTS, getAccount } from './accounts';

/** Solde signé selon la nature du compte. */
function signedSolde(nature: string, debit: number, credit: number): number {
  if (nature === 'ACTIF' || nature === 'CHARGE') return debit - credit;
  return credit - debit; // PASSIF, PRODUIT, CAPITAUX
}

const CHARGE_ACCOUNTS = ['61', '62', '64', '641', '658'] as const;

export function postJournal(ecritures: Ecriture[]): AccountingResult {
  // 1. Report au grand livre (agrégat par compte).
  const ledgerMap = new Map<string, LedgerAccount>();
  const ensure = (code: string): LedgerAccount => {
    let acc = ledgerMap.get(code);
    if (!acc) {
      const meta = getAccount(code);
      acc = {
        account: code,
        name: meta.name,
        classe: meta.classe,
        mouvements: [],
        debit: 0,
        credit: 0,
        solde: 0,
      };
      ledgerMap.set(code, acc);
    }
    return acc;
  };

  for (const e of ecritures) {
    for (const line of e.lines) {
      const acc = ensure(line.account);
      acc.debit += line.debit;
      acc.credit += line.credit;
      acc.mouvements.push({ ...line, date: e.date, libelle: e.libelle });
    }
  }

  const ledger = [...ledgerMap.values()];
  for (const acc of ledger) {
    const meta = getAccount(acc.account);
    acc.solde = signedSolde(meta.nature, acc.debit, acc.credit);
  }
  ledger.sort((a, b) => a.account.localeCompare(b.account));

  const soldeOf = (code: string): number => {
    const acc = ledgerMap.get(code);
    if (!acc) return 0;
    const meta = getAccount(code);
    return signedSolde(meta.nature, acc.debit, acc.credit);
  };

  // 2. Compte de résultat (classes 6 & 7).
  const ca = soldeOf('701'); // produit : crédit − débit (remboursements en débit réduisent le CA)
  const cogs = soldeOf('601') + soldeOf('603'); // charges : débit − crédit ; net = coût réellement vendu
  const margeBrute = ca - cogs;
  const autresProduits = soldeOf('758');
  const charges: ChargeLine[] = CHARGE_ACCOUNTS.map(code => ({
    account: code,
    name: getAccount(code).name,
    montant: soldeOf(code),
  })).filter(l => l.montant !== 0);
  const totalAutresCharges = charges.reduce((s, l) => s + l.montant, 0);
  const beneficeNet = margeBrute + autresProduits - totalAutresCharges;

  const incomeStatement: IncomeStatement = {
    ca,
    cogs,
    margeBrute,
    charges,
    autresProduits,
    beneficeNet,
  };

  // 3. Bilan (classes 1–5 + résultat 120).
  const actif: BilanLine[] = [];
  const passif: BilanLine[] = [];
  for (const meta of ACCOUNTS) {
    if (meta.classe >= 6) continue; // les classes 6/7 se soldent dans le résultat
    const solde = soldeOf(meta.code);
    if (solde === 0) continue;
    const line: BilanLine = { account: meta.code, name: meta.name, montant: solde };
    if (meta.nature === 'ACTIF') actif.push(line);
    else passif.push(line); // PASSIF + CAPITAUX (108 ressort en négatif)
  }
  // Résultat de l'exercice (compte 120) — non posté, calculé.
  passif.push({ account: '120', name: "Résultat de l'exercice", montant: beneficeNet });

  const totalActif = actif.reduce((s, l) => s + l.montant, 0);
  const totalPassif = passif.reduce((s, l) => s + l.montant, 0);

  const balanceSheet: BalanceSheet = {
    actif,
    passif,
    totalActif,
    totalPassif,
    resultat: beneficeNet,
    equilibre: totalActif === totalPassif,
  };

  return { journal: ecritures, ledger, balanceSheet, incomeStatement };
}
