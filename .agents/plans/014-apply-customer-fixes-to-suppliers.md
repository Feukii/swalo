# Feature: Application des corrections clients aux fournisseurs

## Feature Description

Appliquer de maniere analogue aux fournisseurs toutes les corrections qui ont ete faites pour les clients dans les plans 012 et 013. Ces corrections concernent:

1. **Gestion des montants negatifs**: Les dettes negatives (fournisseur nous doit) doivent avoir status='PAID' automatiquement
2. **Prevention des doublons**: Eviter les doubles transactions lors des reglements fournisseurs
3. **Affichage des soldes negatifs**: Separer les dettes (positives) et remboursements (negatifs) dans BusinessReportsScreen

## User Story

En tant que commercant utilisant SWALO
Je veux que les soldes fournisseurs soient geres de la meme maniere coherente que les soldes clients
Afin d'avoir une vue claire de qui me doit de l'argent et de qui je dois payer

## Problem Statement

Apres les corrections appliquees aux clients (plans 012 et 013), les fournisseurs ont des problemes analogues non corriges:

1. **debts.service.ts**: La methode `create()` ne gere pas les montants negatifs avec status='PAID' automatique (contrairement a receivables.service.ts)

2. **cash.service.ts**: La condition pour eviter les doublons existe pour `remboursement_client` mais pas pour `reglement_fournisseur` - le code a la ligne 99-148 traite automatiquement les paiements fournisseurs sans condition d'exclusion

3. **BusinessReportsScreen.tsx**: Les stats fournisseurs ne separent pas les soldes positifs (on leur doit) et negatifs (ils nous doivent) comme c'est fait pour les clients

## Solution Statement

Appliquer les memes corrections que pour les clients:

1. **debts.service.ts**: Ajouter la logique de detection des montants negatifs pour auto-set status='PAID' et description par defaut

2. **cash.service.ts**: Ajouter la condition `&& dto.category !== 'reglement_fournisseur'` pour eviter le traitement automatique des dettes lors des reglements

3. **BusinessReportsScreen.tsx**: Ajouter les champs `totalPositiveBalance`, `totalNegativeBalance`, `suppliersToRefund`, et `top3ToRefund` dans les stats fournisseurs, et afficher ces KPIs separement

## Feature Metadata

**Feature Type**: Bug Fix / Enhancement
**Estimated Complexity**: Medium
**Primary Systems Affected**:
- `apps/api/src/modules/debts/debts.service.ts`
- `apps/api/src/modules/cash/cash.service.ts`
- `apps/mobile/src/screens/BusinessReportsScreen.tsx`
**Dependencies**: Aucune

---

## CONTEXT REFERENCES

### Relevant Codebase Files

- `apps/api/src/modules/debts/debts.service.ts` (lines 10-40)
  - Why: Methode `create()` qui doit gerer les montants negatifs comme receivables.service.ts

- `apps/api/src/modules/receivables/receivables.service.ts` (lines 10-17)
  - Why: PATTERN A SUIVRE - gestion des montants negatifs avec status='PAID'

- `apps/api/src/modules/cash/cash.service.ts` (lines 99-148, 150-153)
  - Why: Logique de paiement automatique fournisseur a modifier, pattern client a suivre

- `apps/mobile/src/screens/BusinessReportsScreen.tsx` (lines 497-614, 990-1028)
  - Why: Stats fournisseurs a enrichir avec separation positif/negatif

- `apps/mobile/src/screens/BusinessReportsScreen.tsx` (lines 329-495, 874-905)
  - Why: PATTERN A SUIVRE - implementation client avec separation des soldes

### Patterns to Follow

**Pattern 1 - Gestion montants negatifs (receivables.service.ts):**
- Detecter si `dto.amount < 0`
- Definir automatiquement `status: 'PAID'` pour les negatifs
- Ajouter description par defaut "Remboursement - Ajustement de solde"

**Pattern 2 - Prevention doublons (cash.service.ts ligne 153):**
- Condition existante: `dto.category !== 'remboursement_client'`
- Appliquer le meme pattern: `dto.category !== 'reglement_fournisseur'`

**Pattern 3 - Stats avec separation (BusinessReportsScreen customerStats):**
- Interface avec `totalPositiveBalance`, `totalNegativeBalance`
- Compteur `suppliersToRefund` (au lieu de `customersToRefund`)
- Liste `top3ToRefund` pour les fournisseurs qui nous doivent

---

## IMPLEMENTATION PLAN

### Phase 1: Backend - debts.service.ts

Modifier la methode `create()` pour:
- Detecter les montants negatifs
- Auto-set status='PAID' pour les negatifs
- Ajouter description par defaut

### Phase 2: Backend - cash.service.ts

Ajouter la condition d'exclusion pour eviter le traitement automatique lors des reglements fournisseurs manuels.

### Phase 3: Mobile - BusinessReportsScreen.tsx

Modifier les stats fournisseurs pour:
- Separer les soldes positifs et negatifs
- Ajouter les compteurs et listes de fournisseurs a rembourser
- Afficher les KPIs separement dans l'UI

### Phase 4: Tests et validation

Verifier que toutes les modifications fonctionnent correctement.

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE `apps/api/src/modules/debts/debts.service.ts`

- **IMPLEMENT**: Modifier la methode `create()` pour gerer les montants negatifs:
  - Ajouter detection: `const isNegativeAmount = dto.amount < 0`
  - Definir status conditionnel: `status: isNegativeAmount ? 'PAID' : 'PENDING'`
  - Ajouter description par defaut pour negatifs: "Remboursement - Ajustement de solde fournisseur"
- **PATTERN**: Suivre exactement le pattern de `receivables.service.ts` lignes 10-17
- **GOTCHA**: Ne pas modifier le comportement pour les montants positifs
- **VALIDATE**: `cd apps/api && pnpm lint`

### Task 2: UPDATE `apps/api/src/modules/cash/cash.service.ts`

- **IMPLEMENT**: Modifier la condition de traitement automatique des paiements fournisseurs (lignes 99-148):
  - Ajouter la condition `&& dto.category !== 'reglement_fournisseur'`
  - Cela evitera le double traitement quand CashScreen cree manuellement une dette negative
- **PATTERN**: Suivre le pattern de la ligne 153 pour les clients: `dto.category !== 'remboursement_client'`
- **GOTCHA**: Verifier que la categorie utilisee dans CashScreen est bien 'reglement_fournisseur'
- **VALIDATE**: `cd apps/api && pnpm lint`

### Task 3: UPDATE `apps/mobile/src/screens/BusinessReportsScreen.tsx` - Interface SupplierStats

- **IMPLEMENT**: Modifier l'interface `SupplierStats` (vers ligne 45) pour ajouter:
  - `totalPositiveBalance: number` (dettes - on leur doit)
  - `totalNegativeBalance: number` (remboursements - ils nous doivent)
  - `suppliersToRefund: number` (nombre de fournisseurs qui nous doivent)
  - `top3ToRefund: Array<{ name: string; amount: number }>` (top 3 fournisseurs qui nous doivent)
- **PATTERN**: Suivre l'interface `CustomerStats` qui a deja ces champs
- **VALIDATE**: `cd apps/mobile && pnpm lint`

### Task 4: UPDATE `apps/mobile/src/screens/BusinessReportsScreen.tsx` - loadSupplierStats()

- **IMPLEMENT**: Modifier `loadSupplierStats()` (lignes 497-614) pour:
  - Calculer separement les balances positives et negatives
  - Compter les fournisseurs avec solde negatif (`suppliersToRefund`)
  - Construire la liste des top 3 fournisseurs qui nous doivent (`top3ToRefund`)
- **PATTERN**: Suivre exactement la logique de `loadCustomerStats()` (lignes 329-495)
- **GOTCHA**: Les semantiques sont inversees par rapport aux clients:
  - Client balance > 0 = ils nous doivent (bon pour nous)
  - Fournisseur balance > 0 = on leur doit (dette pour nous)
  - Fournisseur balance < 0 = ils nous doivent (bon pour nous)
- **VALIDATE**: `cd apps/mobile && pnpm lint`

### Task 5: UPDATE `apps/mobile/src/screens/BusinessReportsScreen.tsx` - Affichage

- **IMPLEMENT**: Modifier la section d'affichage des stats fournisseurs (lignes 990-1028) pour:
  - Ajouter une alerte si `totalNegativeBalance > 0` (fournisseurs nous doivent)
  - Afficher separement "Dettes fournisseurs" et "Remboursements dus par fournisseurs"
  - Ajouter section "Fournisseurs qui nous doivent" si applicable
- **PATTERN**: Suivre l'affichage des stats clients (lignes 874-905)
- **VALIDATE**: `cd apps/mobile && pnpm lint`

### Task 6: VALIDATE all changes

- **IMPLEMENT**: Executer tous les tests et linters
- **VALIDATE**:
  - `cd apps/api && pnpm lint`
  - `cd apps/api && pnpm test`
  - `cd apps/mobile && pnpm lint`

---

## TESTING STRATEGY

### Unit Tests

**Scope**: debts.service.ts et cash.service.ts
**Requirements**:
- Test que `create()` dans debts.service.ts definit status='PAID' pour montants negatifs
- Test que `createEntry()` dans cash.service.ts ne declenche pas le paiement auto pour 'reglement_fournisseur'

**VALIDATION COMMAND**: `cd apps/api && pnpm test`

### Integration Tests

**Scope**: Flux complet de reglement fournisseur
**Requirements**:
- Creer un fournisseur avec dette positive
- Effectuer un reglement qui cree un solde negatif
- Verifier qu'une seule transaction est creee (pas de doublon)

**VALIDATION COMMAND**: `cd apps/api && pnpm test`

### Edge Cases

1. **Reglement exact**: Reglement egal a la dette -> solde = 0
2. **Reglement excessif**: Reglement superieur a la dette -> solde negatif, une seule dette negative
3. **Fournisseur sans dette**: Tentative de reglement sans dette existante

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
cd apps/api && pnpm lint
cd apps/mobile && pnpm lint
```

**Expected Result**: Zero new errors

### Level 2: Unit Tests

```bash
cd apps/api && pnpm test
cd apps/mobile && pnpm test
```

**Expected Result**: All tests pass

### Level 3: Type Checking

```bash
cd apps/api && pnpm type-check
cd apps/mobile && pnpm type-check
```

**Expected Result**: No TypeScript errors

---

## ACCEPTANCE CRITERIA

- [ ] Une dette avec montant negatif est automatiquement creee avec status 'PAID'
- [ ] Un reglement fournisseur ne cree qu'une seule transaction (pas de doublon)
- [ ] BusinessReportsScreen affiche separement les dettes et remboursements fournisseurs
- [ ] Les calculs de solde fournisseur sont coherents entre tous les ecrans
- [ ] Tous les tests passent
- [ ] Pas de regression sur les fonctionnalites existantes

---

## COMPLETION CHECKLIST

- [ ] Task 1: debts.service.ts modifie pour montants negatifs
- [ ] Task 2: cash.service.ts modifie pour eviter doublons
- [ ] Task 3: Interface SupplierStats enrichie
- [ ] Task 4: loadSupplierStats() modifie avec separation
- [ ] Task 5: Affichage stats fournisseurs modifie
- [ ] Task 6: Validation complete
- [ ] Tous les linters passent
- [ ] Tous les tests passent

---

## NOTES

### Differences semantiques Client vs Fournisseur

**Pour les clients:**
- `balance > 0`: Le client nous doit de l'argent (creance)
- `balance < 0`: Nous devons de l'argent au client (remboursement)

**Pour les fournisseurs:**
- `balance > 0`: Nous devons de l'argent au fournisseur (dette)
- `balance < 0`: Le fournisseur nous doit de l'argent (remboursement du)

### Elements deja corrects

D'apres l'analyse, les elements suivants sont deja corrects:
- `suppliers.service.ts`: Calcul de solde et logique `claimRefund()` OK
- `SupplierBalancesSummaryScreen.tsx`: Badges avec bons labels OK

<!-- EOF -->
