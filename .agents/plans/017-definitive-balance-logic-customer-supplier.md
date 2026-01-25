# Feature: 017-definitive-balance-logic-customer-supplier

## Feature Description

Ce plan etablit une structure DEFINITIVE et PERENNE pour la gestion des soldes clients et fournisseurs. Apres 5 bugs recurrents sur cette fonctionnalite, nous devons:
1. Documenter clairement la logique metier
2. Identifier TOUTES les operations qui affectent les soldes
3. Verifier que l'implementation actuelle est correcte
4. Creer une reference definitive pour eviter les futures regressions

## User Story

En tant que commercant utilisant SWALO
Je veux que les soldes clients et fournisseurs soient toujours corrects
Afin de savoir exactement qui me doit de l'argent et a qui je dois de l'argent

## Problem Statement

Les bugs recurrents proviennent de:
1. **Confusion semantique**: Manque de documentation claire sur ce que signifie un solde positif/negatif
2. **Operations multiples**: Plusieurs endroits du code modifient les soldes
3. **Logique dispersee**: La logique est repartie entre services sans vue d'ensemble
4. **Tests insuffisants**: Les tests ne couvrent pas tous les scenarios

## Solution Statement

1. **Documenter la logique metier** de maniere definitive dans ce plan
2. **Auditer toutes les operations** qui affectent les soldes
3. **Verifier l'implementation actuelle** contre la specification
4. **Creer des tests exhaustifs** pour chaque scenario

---

## SPECIFICATION METIER DEFINITIVE

### SOLDE CLIENT (ClientReceivable)

**Definition**: Le solde client represente ce que le client nous doit.

| Solde | Signification | Exemple |
|-------|---------------|---------|
| **POSITIF** (+10000) | Le client nous doit de l'argent | Vente a credit non payee |
| **NEGATIF** (-10000) | Nous devons de l'argent au client | Trop-percu, remboursement du |
| **ZERO** (0) | Compte equilibre | Aucune dette |

**Formule de calcul**:
```
total_balance = SUM(ClientReceivable.balance) pour toutes les creances du client
```

### SOLDE FOURNISSEUR (SupplierDebt)

**Definition**: Le solde fournisseur represente ce que nous devons au fournisseur.

| Solde | Signification | Exemple |
|-------|---------------|---------|
| **POSITIF** (+10000) | Nous devons de l'argent au fournisseur | Achat a credit non paye |
| **NEGATIF** (-10000) | Le fournisseur nous doit de l'argent | Trop-paye, remboursement du |
| **ZERO** (0) | Compte equilibre | Aucune dette |

**Formule de calcul**:
```
total_balance = SUM(SupplierDebt.balance) pour toutes les dettes du fournisseur
```

---

## OPERATIONS QUI AFFECTENT LES SOLDES

### A. OPERATIONS CLIENT (ClientReceivable)

#### 1. Vente a credit
- **Declencheur**: Creation d'une vente avec paiement differe
- **Impact**: +amount sur ClientReceivable
- **Cash Impact**: Aucun (pas d'argent physique)
- **Fichier**: `sales.service.ts`

#### 2. Paiement client (encaissement creance)
- **Declencheur**: Client paie sa dette
- **Impact**: Reduction du `balance` sur les ClientReceivable existantes
- **Cash Impact**: +amount (IN) dans CashEntry
- **Fichier**: `cash.service.ts` (ligne 155-199)

#### 3. Remboursement client (le client nous paye)
- **Declencheur**: Le client nous rembourse / nous paye
- **Precondition**: Aucune (fonctionne quel que soit le solde)
- **Impact**: -amount sur ClientReceivable (creance NEGATIVE = solde DIMINUE)
- **Cash Impact**: +amount (IN) dans CashEntry
- **Fichier**: `CashScreen.tsx` (entryCategory = 'remboursement_client')
- **Exemples**:
  - Solde 10000, remboursement 3000 → nouveau solde 7000
  - Solde -5000, remboursement 2500 → nouveau solde -7500

#### 4. Ajustement de solde (creance initiale/manuelle)
- **Declencheur**: Creation manuelle d'une creance
- **Impact**: +/- amount sur ClientReceivable
- **Cash Impact**: Aucun
- **Fichier**: `receivables.service.ts`

### B. OPERATIONS FOURNISSEUR (SupplierDebt)

#### 1. Achat a credit
- **Declencheur**: Achat de marchandises avec paiement differe
- **Impact**: +amount sur SupplierDebt
- **Cash Impact**: Aucun ou partiel
- **Fichier**: `cash.service.ts` (createMerchandisePurchase)

#### 2. Reglement fournisseur (nous payons le fournisseur)
- **Declencheur**: Nous payons le fournisseur
- **Precondition**: Aucune (fonctionne quel que soit le solde)
- **Impact**: -amount sur SupplierDebt (dette NEGATIVE = solde DIMINUE)
- **Cash Impact**: -amount (OUT) dans CashEntry
- **Fichier**: `CashScreen.tsx` (exitCategory = 'reglement_fournisseur')
- **Exemples**:
  - Solde 3000, reglement 2000 → nouveau solde 1000
  - Solde -3500, reglement 4000 → nouveau solde -7500

#### 4. Ajustement de solde (dette initiale/manuelle)
- **Declencheur**: Creation manuelle d'une dette
- **Impact**: +/- amount sur SupplierDebt
- **Cash Impact**: Aucun
- **Fichier**: `debts.service.ts`

---

## TABLEAU RECAPITULATIF DES IMPACTS

### CLIENT

| Operation | ClientReceivable | CashEntry | Exemple |
|-----------|------------------|-----------|---------|
| Vente a credit | +5000 (PENDING) | - | Solde: 0 → +5000 |
| Remboursement client (client nous paye) | -3000 (PAID) | +3000 (IN) | Solde: +5000 → +2000 |
| Remboursement client (sur solde negatif) | -2500 (PAID) | +2500 (IN) | Solde: -5000 → -7500 |
| Solde initial positif | +5000 (PENDING) | - | Solde: 0 → +5000 |

**REGLE SIMPLE**: Remboursement client = Client nous paye = Caisse IN + Solde client DIMINUE

### FOURNISSEUR

| Operation | SupplierDebt | CashEntry | Exemple |
|-----------|--------------|-----------|---------|
| Achat a credit | +5000 (PENDING) | - | Solde: 0 → +5000 |
| Reglement fournisseur (on paye) | -2000 (PAID) | -2000 (OUT) | Solde: +3000 → +1000 |
| Reglement fournisseur (sur solde negatif) | -4000 (PAID) | -4000 (OUT) | Solde: -3500 → -7500 |
| Solde initial positif | +5000 (PENDING) | - | Solde: 0 → +5000 |

**REGLE SIMPLE**: Reglement fournisseur = On paye le fournisseur = Caisse OUT + Solde fournisseur DIMINUE

---

## CONTEXT REFERENCES

### Fichiers critiques a verifier

**Services principaux:**
- `apps/api/src/modules/customers/customers.service.ts` (lignes 127-134, 340-394)
- `apps/api/src/modules/suppliers/suppliers.service.ts` (lignes 127-134, 340-394)
- `apps/api/src/modules/cash/cash.service.ts` (lignes 99-200)
- `apps/api/src/modules/receivables/receivables.service.ts`
- `apps/api/src/modules/debts/debts.service.ts`

**Tests existants:**
- `apps/api/test/customers-refund.spec.ts`
- `apps/api/test/suppliers-refund.spec.ts`

**Ecrans mobiles:**
- `apps/mobile/src/screens/CustomerDetailScreen.tsx`
- `apps/mobile/src/screens/SupplierDetailScreen.tsx`
- `apps/mobile/src/screens/CashScreen.tsx`

---

## IMPLEMENTATION PLAN

### Phase 1: Audit de l'implementation actuelle

Verifier que le code actuel respecte la specification ci-dessus.

### Phase 2: Correction si necessaire

Corriger les ecarts entre specification et implementation.

### Phase 3: Tests exhaustifs

Creer des tests pour chaque scenario documente.

---

## STEP-BY-STEP TASKS

### Task 1: VERIFY Customer createRefund logic

- **IMPLEMENT**: Verifier que `createRefund` dans `customers.service.ts`:
  1. Verifie que `total_balance < 0` (nous devons au client)
  2. Cree un CashEntry de type `OUT` (sortie de caisse)
  3. Cree un ClientReceivable avec montant POSITIF pour compenser le negatif
  4. Le nouveau solde = ancien + montant_rembourse (vers zero ou positif)
- **PATTERN**: Reference `customers.service.ts:340-394`
- **VALIDATE**: `cd apps/api && pnpm jest customers-refund`
- **TEST_REQUIREMENT**: Tous les tests existants passent

### Task 2: VERIFY Supplier claimRefund logic

- **IMPLEMENT**: Verifier que `claimRefund` dans `suppliers.service.ts`:
  1. Verifie que `total_balance < 0` (fournisseur nous doit)
  2. Cree un CashEntry de type `IN` (entree de caisse - on recoit l'argent)
  3. Cree un SupplierDebt avec montant POSITIF pour compenser le negatif
  4. Le nouveau solde = ancien + montant_rembourse (vers zero ou positif)
- **PATTERN**: Reference `suppliers.service.ts:340-394`
- **VALIDATE**: `cd apps/api && pnpm jest suppliers-refund`
- **TEST_REQUIREMENT**: Tous les tests existants passent

### Task 3: VERIFY Balance calculation in getAll/getOne

- **IMPLEMENT**: Verifier dans `customers.service.ts` et `suppliers.service.ts`:
  1. `getAll()` calcule `total_balance = sum(receivables/debts.balance)`
  2. `getOne()` retourne `stats.total_balance` correctement
  3. Pas de filtrage qui exclurait des creances/dettes
- **PATTERN**: Reference `customers.service.ts:127-134`
- **VALIDATE**: Revue de code manuelle

### Task 4: VERIFY Cash payment auto-processing

- **IMPLEMENT**: Verifier dans `cash.service.ts`:
  1. Paiement client (IN + customer_id): reduit les ClientReceivable.balance
  2. Paiement fournisseur (OUT + supplier_id): reduit les SupplierDebt.balance
  3. Exception: `remboursement_client` et `reglement_fournisseur` ne declenchent PAS le traitement auto
- **PATTERN**: Reference `cash.service.ts:99-200`
- **GOTCHA**: Les categories speciales sont exclues du traitement automatique
- **VALIDATE**: `cd apps/api && pnpm test`

### Task 5: CREATE comprehensive balance test suite

- **IMPLEMENT**: Creer un fichier de test `test/balance-logic.spec.ts` qui teste:
  1. Solde client positif -> paiement -> solde diminue
  2. Solde client negatif -> remboursement -> solde augmente (vers zero)
  3. Solde fournisseur positif -> paiement -> solde diminue
  4. Solde fournisseur negatif -> remboursement recu -> solde augmente (vers zero)
  5. Cas limites: solde zero, montant exact, montant partiel
- **VALIDATE**: `cd apps/api && pnpm jest balance-logic`
- **TEST_REQUIREMENT**: 100% des scenarios documentes couverts

### Task 6: VERIFY Frontend balance display

- **IMPLEMENT**: Verifier que les ecrans affichent correctement:
  1. Solde positif client: "Nous doit X FCFA"
  2. Solde negatif client: "On lui doit X FCFA"
  3. Solde positif fournisseur: "On lui doit X FCFA"
  4. Solde negatif fournisseur: "Nous doit X FCFA"
- **PATTERN**: Reference `BalanceIndicator.tsx`
- **VALIDATE**: Revue de code manuelle

### Task 7: RUN full validation suite

- **IMPLEMENT**: Executer la validation complete
- **VALIDATE**: `pnpm run validate`
- **TEST_REQUIREMENT**: 0 erreurs, tous les tests passent

---

## TESTING STRATEGY

### Unit Tests

**Scope**: Services customers, suppliers, cash
**Requirements**:
- Test createRefund avec solde negatif -> succès
- Test createRefund avec solde positif -> erreur
- Test createRefund avec montant > solde du -> erreur
- Test claimRefund avec solde negatif -> succès
- Test claimRefund avec solde positif -> erreur
- Test calcul de balance apres operations
**VALIDATION COMMAND**: `cd apps/api && pnpm test`

### Integration Tests

**Scope**: Flux complet de transactions
**Requirements**:
- Creation vente a credit -> verification solde
- Paiement creance -> verification solde
- Remboursement -> verification solde et caisse
**VALIDATION COMMAND**: `cd apps/api && pnpm test`

---

## VALIDATION COMMANDS

### Level 1: Syntax and Style
```bash
pnpm run validate
```
**Expected Result**: 0 errors

### Level 2: Unit Tests
```bash
cd apps/api && pnpm test
```
**Expected Result**: All 58+ tests pass

### Level 3: Full Validation
```bash
pnpm run validate
```
**Expected Result**: All tasks successful

---

## ACCEPTANCE CRITERIA

- [ ] Specification metier documentee et validee
- [ ] Toutes les operations impactant les soldes identifiees
- [ ] Implementation actuelle conforme a la specification
- [ ] Tests exhaustifs pour chaque scenario
- [ ] Zero regression sur les tests existants
- [ ] Documentation de reference pour futures evolutions

---

## COMPLETION CHECKLIST

- [ ] Task 1: Customer createRefund verified
- [ ] Task 2: Supplier claimRefund verified
- [ ] Task 3: Balance calculation verified
- [ ] Task 4: Cash payment processing verified
- [ ] Task 5: Comprehensive test suite created
- [ ] Task 6: Frontend display verified
- [ ] Task 7: Full validation passed

---

## NOTES

### Historique des bugs corriges

1. **Plan 012**: Creances negatives avec status PENDING au lieu de PAID
2. **Plan 013**: Double transaction lors des remboursements (CashEntry + Receivable)
3. **Plan 014**: Meme logique appliquee aux fournisseurs
4. **Plan 016**: KPI excluant les montants negatifs
5. **Plan 017**: Confusion semantique - "remboursement client" = CLIENT nous paye (pas l'inverse)

### Points de vigilance permanents

1. **Ne jamais modifier la formule de calcul du solde** sans mettre a jour ce document
2. **Toute nouvelle operation** affectant les soldes doit etre ajoutee ici
3. **Les tests doivent couvrir** tous les scenarios documentes
4. **La categorie cash** determine si le traitement automatique s'applique

### Convention de signes - REFERENCE DEFINITIVE

**CLIENT**:
- ClientReceivable.amount POSITIF = le client nous doit de l'argent (sa dette augmente)
- ClientReceivable.amount NEGATIF = le client nous paye (sa dette diminue)
- **Remboursement client** = Le CLIENT nous paye = CashEntry IN + ClientReceivable NEGATIF
- Le solde client DIMINUE toujours lors d'un remboursement (quel que soit le signe actuel)

**FOURNISSEUR**:
- SupplierDebt.amount POSITIF = nous devons au fournisseur (notre dette augmente)
- SupplierDebt.amount NEGATIF = nous payons le fournisseur (notre dette diminue)
- **Reglement fournisseur** = NOUS payons le fournisseur = CashEntry OUT + SupplierDebt NEGATIF
- Le solde fournisseur DIMINUE toujours lors d'un reglement (quel que soit le signe actuel)

### Exemples concrets

**Remboursement client**:
- Solde client +10000, remboursement 3000 → nouveau solde +7000 (client nous devait, il paye)
- Solde client -5000, remboursement 2500 → nouveau solde -7500 (client nous paye en avance)

**Reglement fournisseur**:
- Solde fournisseur +3000, reglement 2000 → nouveau solde +1000 (on lui devait, on paye)
- Solde fournisseur -3500, reglement 4000 → nouveau solde -7500 (on le paye en avance)
