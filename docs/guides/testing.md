# SWALO - Tests

Ce guide regroupe les verifications rapides et les tests plus complets.

## Prerequis

- Node.js 20+
- pnpm
- Database configuree (local ou Neon)

## Lancer l'app pour tests

```bash
cd apps/api
pnpm dev
```

```bash
cd apps/web
pnpm dev --host
```

## Smoke tests (API)

```bash
curl http://localhost:3000/api/health
```

## Scripts utiles

Depuis la racine:

```bash
./test-api.sh
./test-debts.sh
./test-receivables.sh
./test-comprehensive.sh
./test-full-application.sh
```

## Scenarios a valider

- Authentification (PIN / email)
- Caisse: entrees, sorties, bilan
- Produits: creation, recherche, validation SKU
- Dettes fournisseurs: creation, paiements, statuts
- Creances clients: creation, paiements, statuts

## Rapport de tests

Le rapport historique est dans `docs/reports/TEST_REPORT.md`.
