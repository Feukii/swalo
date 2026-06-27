import { operationsToEcritures } from './operations';
import { postJournal } from './journal';
import { computeAccounting } from './index';
import { OperationInput } from './types';

const SCENARIO: OperationInput[] = [
  {
    kind: 'OPENING_BALANCE',
    date: '2026-06-01',
    stock: 100000,
    caisse: 50000,
    banque: 0,
    mobile: 0,
    receivables: 20000,
    debts: 30000,
  },
  { kind: 'CASH_SALE', date: '2026-06-02', saleId: 's1', amount: 12000, treasury: 'CAISSE' },
  { kind: 'COGS', date: '2026-06-02', saleId: 's1', amount: 7000 },
  { kind: 'CREDIT_SALE', date: '2026-06-03', saleId: 's2', amount: 8000 },
  { kind: 'COGS', date: '2026-06-03', saleId: 's2', amount: 5000 },
  {
    kind: 'RECEIVABLE_SETTLEMENT',
    date: '2026-06-04',
    refId: 'r1',
    amount: 6000,
    treasury: 'CAISSE',
  },
  {
    kind: 'CASH_PURCHASE_STOCK',
    date: '2026-06-05',
    refId: 'p1',
    amount: 10000,
    treasury: 'CAISSE',
  },
  {
    kind: 'OPERATING_EXPENSE',
    date: '2026-06-06',
    account: '62',
    amount: 4000,
    treasury: 'CAISSE',
  },
  {
    kind: 'OPERATING_EXPENSE',
    date: '2026-06-06',
    account: '641',
    amount: 9000,
    treasury: 'CAISSE',
  },
  { kind: 'OWNER_DRAWING', date: '2026-06-07', amount: 3000, treasury: 'CAISSE' },
  { kind: 'SUPPLIER_DEBT_CREATE', date: '2026-06-08', refId: 'd1', amount: 15000 },
  { kind: 'SUPPLIER_PAYMENT', date: '2026-06-09', refId: 'd1', amount: 5000, treasury: 'CAISSE' },
  {
    kind: 'STOCK_ADJUSTMENT',
    date: '2026-06-10',
    refId: 'a1',
    amount: 2000,
    direction: 'DECREASE',
  },
  { kind: 'CUSTOMER_REFUND', date: '2026-06-11', amount: 1000, treasury: 'CAISSE' },
  { kind: 'SUPPLIER_REFUND', date: '2026-06-12', amount: 500, treasury: 'CAISSE' },
];

describe('Moteur comptable — invariants', () => {
  const ecritures = operationsToEcritures(SCENARIO);
  const result = postJournal(ecritures);

  it('chaque écriture est équilibrée (Σdébit = Σcrédit)', () => {
    for (const e of ecritures) {
      const d = e.lines.reduce((s, l) => s + l.debit, 0);
      const c = e.lines.reduce((s, l) => s + l.credit, 0);
      expect(d).toBe(c);
    }
  });

  it('balance générale équilibrée (Σdébit total = Σcrédit total)', () => {
    let d = 0;
    let c = 0;
    for (const e of ecritures) {
      for (const l of e.lines) {
        d += l.debit;
        c += l.credit;
      }
    }
    expect(d).toBe(c);
  });

  it('Actif = Passif', () => {
    expect(result.balanceSheet.equilibre).toBe(true);
    expect(result.balanceSheet.totalActif).toBe(result.balanceSheet.totalPassif);
    expect(result.balanceSheet.totalActif).toBe(169500);
  });

  it('compte de résultat correct', () => {
    expect(result.incomeStatement.ca).toBe(19000); // 12000 + 8000 − 1000 remboursement
    expect(result.incomeStatement.cogs).toBe(14000); // 7000 + 5000 + 2000 (perte ajustement)
    expect(result.incomeStatement.margeBrute).toBe(5000);
    expect(result.incomeStatement.autresProduits).toBe(500);
    expect(result.incomeStatement.beneficeNet).toBe(-7500); // 5000 + 500 − (4000 + 9000)
  });

  it('résultat du bilan === bénéfice net du compte de résultat', () => {
    expect(result.balanceSheet.resultat).toBe(result.incomeStatement.beneficeNet);
  });

  it('grand livre : soldes clés', () => {
    const solde = (code: string) => result.ledger.find(a => a.account === code)?.solde ?? 0;
    expect(solde('311')).toBe(111000); // stock
    expect(solde('411')).toBe(22000); // clients
    expect(solde('571')).toBe(36500); // caisse
    expect(solde('401')).toBe(40000); // fournisseurs
    expect(solde('101')).toBe(140000); // capital (plug)
  });
});

describe('Moteur comptable — cas minimal', () => {
  it('vente cash + COGS + ouverture équilibre', () => {
    const res = computeAccounting([
      {
        kind: 'OPENING_BALANCE',
        date: '2026-01-01',
        stock: 10000,
        caisse: 0,
        banque: 0,
        mobile: 0,
        receivables: 0,
        debts: 0,
      },
      { kind: 'CASH_SALE', date: '2026-01-02', saleId: 'x', amount: 3000, treasury: 'CAISSE' },
      { kind: 'COGS', date: '2026-01-02', saleId: 'x', amount: 1800 },
    ]);
    expect(res.balanceSheet.equilibre).toBe(true);
    expect(res.incomeStatement.ca).toBe(3000);
    expect(res.incomeStatement.cogs).toBe(1800);
    expect(res.incomeStatement.beneficeNet).toBe(1200);
  });

  it("le retrait personnel n'est pas une charge (compte 108)", () => {
    const res = computeAccounting([
      { kind: 'OWNER_DRAWING', date: '2026-01-03', amount: 5000, treasury: 'CAISSE' },
    ]);
    // Aucune charge d'exploitation ; le bénéfice net reste nul.
    expect(res.incomeStatement.charges.length).toBe(0);
    expect(res.incomeStatement.beneficeNet).toBe(0);
    expect(res.ledger.find(a => a.account === '108')?.solde).toBe(-5000);
  });
});
