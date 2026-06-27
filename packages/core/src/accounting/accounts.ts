/**
 * Plan de comptes SYSCOHADA simplifié (stocké comme donnée pour être ajustable
 * sans toucher à la logique du moteur).
 */
import type { Account, Treasury } from './types';

export const ACCOUNTS: Account[] = [
  // Classe 1 — Capitaux
  { code: '101', name: 'Capital', classe: 1, nature: 'CAPITAUX', sideNormal: 'CREDIT' },
  {
    code: '108',
    name: "Compte de l'exploitant",
    classe: 1,
    nature: 'CAPITAUX',
    sideNormal: 'DEBIT',
  },
  { code: '110', name: 'Report à nouveau', classe: 1, nature: 'CAPITAUX', sideNormal: 'CREDIT' },
  {
    code: '120',
    name: "Résultat de l'exercice",
    classe: 1,
    nature: 'CAPITAUX',
    sideNormal: 'CREDIT',
  },
  // Classe 3 — Stocks
  { code: '311', name: 'Stocks de marchandises', classe: 3, nature: 'ACTIF', sideNormal: 'DEBIT' },
  // Classe 4 — Tiers
  { code: '401', name: 'Fournisseurs', classe: 4, nature: 'PASSIF', sideNormal: 'CREDIT' },
  { code: '411', name: 'Clients', classe: 4, nature: 'ACTIF', sideNormal: 'DEBIT' },
  // Classe 5 — Trésorerie
  { code: '521', name: 'Banque', classe: 5, nature: 'ACTIF', sideNormal: 'DEBIT' },
  { code: '551', name: 'Mobile Money', classe: 5, nature: 'ACTIF', sideNormal: 'DEBIT' },
  { code: '571', name: 'Caisse', classe: 5, nature: 'ACTIF', sideNormal: 'DEBIT' },
  // Classe 6 — Charges
  { code: '601', name: 'Achats de marchandises', classe: 6, nature: 'CHARGE', sideNormal: 'DEBIT' },
  { code: '603', name: 'Variation des stocks', classe: 6, nature: 'CHARGE', sideNormal: 'DEBIT' },
  { code: '61', name: 'Transports', classe: 6, nature: 'CHARGE', sideNormal: 'DEBIT' },
  { code: '62', name: 'Services extérieurs', classe: 6, nature: 'CHARGE', sideNormal: 'DEBIT' },
  { code: '64', name: 'Impôts et taxes', classe: 6, nature: 'CHARGE', sideNormal: 'DEBIT' },
  { code: '641', name: 'Charges de personnel', classe: 6, nature: 'CHARGE', sideNormal: 'DEBIT' },
  { code: '658', name: 'Charges diverses', classe: 6, nature: 'CHARGE', sideNormal: 'DEBIT' },
  // Classe 7 — Produits
  {
    code: '701',
    name: 'Ventes de marchandises',
    classe: 7,
    nature: 'PRODUIT',
    sideNormal: 'CREDIT',
  },
  { code: '758', name: 'Produits divers', classe: 7, nature: 'PRODUIT', sideNormal: 'CREDIT' },
];

const BY_CODE: Record<string, Account> = Object.fromEntries(ACCOUNTS.map(a => [a.code, a]));

export function getAccount(code: string): Account {
  const a = BY_CODE[code];
  if (!a) throw new Error(`Compte inconnu: ${code}`);
  return a;
}

/** Compte de trésorerie selon le moyen de règlement. */
export function treasuryAccount(t: Treasury): string {
  switch (t) {
    case 'BANQUE':
      return '521';
    case 'MOBILE':
      return '551';
    case 'CAISSE':
    default:
      return '571';
  }
}
