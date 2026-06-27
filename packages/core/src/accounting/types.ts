/**
 * Moteur comptable en partie double (OHADA / SYSCOHADA simplifié).
 * Types purs — aucun IO. Tous les montants sont des ENTIERS FCFA (pas de centimes).
 */

export type AccountClass = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type AccountNature = 'ACTIF' | 'PASSIF' | 'CAPITAUX' | 'CHARGE' | 'PRODUIT';
export type Side = 'DEBIT' | 'CREDIT';

export interface Account {
  /** Code du compte, ex. '571'. */
  code: string;
  /** Libellé, ex. 'Caisse'. */
  name: string;
  classe: AccountClass;
  nature: AccountNature;
  /** Côté du solde normal (sens d'augmentation). */
  sideNormal: Side;
}

/** Une ligne d'écriture : exactement un des deux montants est > 0. */
export interface EcritureLine {
  account: string;
  debit: number;
  credit: number;
}

/** Une écriture comptable équilibrée (Σ débit === Σ crédit). */
export interface Ecriture {
  /** Date ISO (sert au filtrage par période). */
  date: string;
  libelle: string;
  /** Référence vers l'opération source (vente, paiement…). */
  ref?: { type: string; id: string };
  lines: EcritureLine[];
}

/** Trésorerie : moyen de règlement → compte (571 Caisse / 521 Banque / 551 Mobile). */
export type Treasury = 'CAISSE' | 'BANQUE' | 'MOBILE';

/** Comptes de charges d'exploitation utilisables pour une dépense de caisse. */
export type ExpenseAccount = '61' | '62' | '64' | '641' | '658';

/**
 * Opération métier normalisée, indépendante du stockage (SQLite ou Prisma).
 * Chaque variante est traduite en une ou plusieurs écritures équilibrées.
 */
export type OperationInput =
  | {
      kind: 'OPENING_BALANCE';
      date: string;
      stock: number;
      caisse: number;
      banque: number;
      mobile: number;
      receivables: number;
      debts: number;
    }
  | {
      kind: 'CAPITAL_INJECTION';
      date: string;
      amount: number;
      treasury: Treasury;
      libelle?: string;
    }
  | { kind: 'CASH_SALE'; date: string; saleId: string; amount: number; treasury: Treasury }
  | { kind: 'CREDIT_SALE'; date: string; saleId: string; amount: number }
  | { kind: 'COGS'; date: string; saleId: string; amount: number }
  | {
      kind: 'RECEIVABLE_SETTLEMENT';
      date: string;
      refId: string;
      amount: number;
      treasury: Treasury;
    }
  | { kind: 'SUPPLIER_DEBT_CREATE'; date: string; refId: string; amount: number }
  | { kind: 'SUPPLIER_PAYMENT'; date: string; refId: string; amount: number; treasury: Treasury }
  | { kind: 'CASH_PURCHASE_STOCK'; date: string; refId: string; amount: number; treasury: Treasury }
  | {
      kind: 'OPERATING_EXPENSE';
      date: string;
      account: ExpenseAccount;
      amount: number;
      treasury: Treasury;
      libelle?: string;
    }
  | { kind: 'OWNER_DRAWING'; date: string; amount: number; treasury: Treasury }
  | { kind: 'CUSTOMER_REFUND'; date: string; amount: number; treasury: Treasury }
  | { kind: 'SUPPLIER_REFUND'; date: string; amount: number; treasury: Treasury }
  | {
      kind: 'STOCK_ADJUSTMENT';
      date: string;
      refId: string;
      amount: number;
      direction: 'INCREASE' | 'DECREASE';
    };

// ── Résultats du moteur ────────────────────────────────────────────────────

export interface LedgerAccount {
  account: string;
  name: string;
  classe: AccountClass;
  mouvements: (EcritureLine & { date: string; libelle: string })[];
  debit: number;
  credit: number;
  /** Solde signé selon la nature (ACTIF/CHARGE = +débit ; PASSIF/PRODUIT/CAPITAUX = +crédit). */
  solde: number;
}

export interface BilanLine {
  account: string;
  name: string;
  montant: number;
}

export interface ChargeLine {
  account: string;
  name: string;
  montant: number;
}

export interface BalanceSheet {
  actif: BilanLine[];
  passif: BilanLine[];
  totalActif: number;
  totalPassif: number;
  /** Résultat net (compte 120) inclus dans le passif. */
  resultat: number;
  equilibre: boolean;
}

export interface IncomeStatement {
  ca: number;
  cogs: number;
  margeBrute: number;
  charges: ChargeLine[];
  autresProduits: number;
  beneficeNet: number;
}

export interface AccountingResult {
  journal: Ecriture[];
  ledger: LedgerAccount[];
  balanceSheet: BalanceSheet;
  incomeStatement: IncomeStatement;
}
