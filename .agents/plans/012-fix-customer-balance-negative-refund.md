# Feature: Correction de la mise a jour du solde client lors d'un remboursement

## Feature Description

Corriger le bug de mise a jour du solde client lorsqu'un remboursement d'argent est superieur au solde de la caisse ou lorsque le client paie plus que sa dette. Dans ce cas, le solde doit devenir negatif avec une mention claire "Remboursement du" ou "Nous devons au client". Cette correction doit s'appliquer de maniere coherente sur tous les ecrans: solde individuel du client, liste generale des clients, et bilans/rapports.

## User Story

En tant que commercant utilisant SWALO
Je veux que le solde client affiche correctement les montants negatifs avec la mention "Remboursement"
Afin de savoir exactement quand je dois de l'argent a un client et de retrouver cette information partout dans l'application

## Problem Statement

Actuellement, lorsqu'un client paie plus que sa dette via "Remboursement client" dans CashScreen:

1. **Statut incorrect**: Une creance negative est creee avec status `'PENDING'` au lieu de `'PAID'`
2. **Filtrage des bilans**: Dans BusinessReportsScreen, les creances negatives avec status `'PENDING'` sont incluses dans le calcul du `totalBalance`, mais le systeme ne fait pas la distinction entre "dette du client" et "dette envers le client"
3. **Incoherence d'affichage**: Les soldes negatifs ne sont pas toujours affiches avec la mention "Remboursement" ou "Nous devons au client"
4. **Top debiteurs**: Le calcul des "Top 3 debiteurs" filtre uniquement les balances > 0, ce qui est correct, mais les clients avec solde negatif ne sont pas affiches separement

## Solution Statement

1. **Modifier la creation de creances negatives**: Dans `ReceivablesService.create()`, definir automatiquement le statut a `'PAID'` lorsque le montant est negatif (car c'est un ajustement de solde, pas une dette en attente)

2. **Ajouter une description automatique**: Ajouter une description "Remboursement - Nous devons au client" pour les creances negatives

3. **Ameliorer l'affichage des bilans**: Dans BusinessReportsScreen, separer clairement:
   - Total des dettes clients (balance > 0)
   - Total des remboursements dus aux clients (balance < 0)

4. **Uniformiser les messages**: S'assurer que tous les ecrans utilisent les memes messages pour les soldes negatifs

## Feature Metadata

**Feature Type**: Bug Fix
**Estimated Complexity**: Medium
**Primary Systems Affected**:
- `apps/api/src/modules/receivables/receivables.service.ts`
- `apps/mobile/src/screens/CashScreen.tsx`
- `apps/mobile/src/screens/BusinessReportsScreen.tsx`
- `apps/mobile/src/screens/CustomerBalancesSummaryScreen.tsx`
**Dependencies**: Aucune

---

## CONTEXT REFERENCES

### Relevant Codebase Files

- `apps/api/src/modules/receivables/receivables.service.ts` (lines 10-39)
  - Why: Methode `create()` qui doit gerer le statut des creances negatives

- `apps/mobile/src/screens/CashScreen.tsx` (lines 326-365)
  - Why: Logique de creation des creances negatives lors des remboursements clients

- `apps/mobile/src/screens/BusinessReportsScreen.tsx` (lines 346-433)
  - Why: Calcul des statistiques clients et affichage du totalBalance

- `apps/mobile/src/screens/CustomerBalancesSummaryScreen.tsx` (lines 86-111)
  - Why: Affichage des KPIs et badges pour soldes negatifs

- `apps/mobile/src/components/ui/BalanceIndicator.tsx` (lines 48-66)
  - Why: Messages d'affichage pour soldes positifs/negatifs

- `apps/api/src/modules/customers/customers.service.ts` (lines 127-134, 192-199)
  - Why: Calcul du `total_balance` pour chaque client

### Patterns to Follow

**Statut des creances:**
- `PENDING`: Creance positive en attente de paiement
- `PARTIAL`: Creance partiellement payee
- `PAID`: Creance soldee OU creance negative (ajustement)
- `CANCELLED`: Creance annulee

**Convention de nommage pour les montants:**
- Montant positif (`amount > 0`): Le client nous doit de l'argent
- Montant negatif (`amount < 0`): Nous devons de l'argent au client (remboursement)

**Messages uniformes:**
- Solde positif: "Client nous doit" / "Nous doit"
- Solde negatif: "Nous devons au client" / "On lui doit" / "Remboursement du"
- Solde zero: "Solde equilibre" / "Solde"

---

## IMPLEMENTATION PLAN

### Phase 1: Backend - Correction de la creation des creances negatives

Modifier `ReceivablesService.create()` pour:
- Detecter automatiquement les montants negatifs
- Definir le statut a `'PAID'` pour les montants negatifs
- Ajouter une description par defaut pour les remboursements

### Phase 2: Mobile - Correction de l'affichage des bilans

Modifier `BusinessReportsScreen.tsx` pour:
- Separer le calcul des soldes positifs et negatifs
- Afficher un KPI supplementaire pour les "Remboursements dus aux clients"
- Ajouter une liste "Top 3 clients a rembourser" si pertinent

### Phase 3: Mobile - Uniformisation des messages

Verifier et uniformiser les messages dans:
- `CashScreen.tsx`: Message apres creation d'un remboursement
- `CustomerBalancesSummaryScreen.tsx`: Badges et labels
- `BalanceIndicator.tsx`: Messages d'alerte

### Phase 4: Tests et validation

- Tester la creation de creances negatives
- Verifier l'affichage dans tous les ecrans
- Valider les calculs des bilans

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE `apps/api/src/modules/receivables/receivables.service.ts`

- **IMPLEMENT**: Modifier la methode `create()` pour gerer les montants negatifs:
  - Si `dto.amount < 0`, definir automatiquement `status: 'PAID'`
  - Ajouter une description par defaut: "Remboursement - Ajustement de solde"
  - Le `balance` doit etre egal a `amount` (negatif)
- **PATTERN**: Suivre le pattern existant dans `addPayment()` qui gere les soldes negatifs (ligne 136-137)
- **GOTCHA**: Ne pas changer le comportement pour les montants positifs
- **VALIDATE**: `cd apps/api && pnpm lint`

### Task 2: UPDATE `apps/mobile/src/screens/CashScreen.tsx`

- **IMPLEMENT**: Ameliorer le message affiche apres un remboursement client (lignes 349-356):
  - Si `newBalance < 0`, afficher clairement "Vous devez rembourser X FCFA au client"
  - Ajouter une mention "Remboursement" dans la description de la creance creee
- **PATTERN**: Utiliser `formatMoney()` pour l'affichage des montants
- **GOTCHA**: Ne pas dupliquer la logique de calcul du nouveau solde
- **VALIDATE**: `cd apps/mobile && pnpm lint`

### Task 3: UPDATE `apps/mobile/src/screens/BusinessReportsScreen.tsx`

- **IMPLEMENT**: Modifier `loadCustomerStats()` (lignes 346-448) pour:
  - Calculer separement `totalPositiveBalance` (dettes clients) et `totalNegativeBalance` (remboursements dus)
  - Modifier l'interface `customerStats` pour inclure ces deux valeurs
  - Ne pas ajouter les creances negatives au `customersWithDebtSet`
  - Creer une nouvelle liste pour les "clients a rembourser"
- **PATTERN**: Suivre le pattern de calcul existant pour `totalBalance`
- **GOTCHA**: Les creances avec status 'PAID' et montant negatif doivent etre incluses dans le calcul du solde total
- **VALIDATE**: `cd apps/mobile && pnpm lint`

### Task 4: UPDATE `apps/mobile/src/screens/BusinessReportsScreen.tsx` - Affichage

- **IMPLEMENT**: Modifier la section d'affichage des stats clients (lignes 812-879) pour:
  - Afficher "Creances clients" (solde positif) et "Remboursements dus" (solde negatif) separement
  - Utiliser des couleurs differentes (vert pour creances, rouge pour remboursements)
  - Optionnel: Ajouter "Top 3 clients a rembourser" si la somme des remboursements > 0
- **PATTERN**: Utiliser les memes composants KPICard existants
- **VALIDATE**: `cd apps/mobile && pnpm lint`

### Task 5: UPDATE `apps/mobile/src/screens/CustomerBalancesSummaryScreen.tsx`

- **IMPLEMENT**: Verifier et ameliorer les messages (lignes 103-111):
  - Badge pour solde negatif: "Remboursement du" au lieu de "On lui doit"
  - S'assurer que le tri place les remboursements (negatifs) a la fin ou dans une section separee
- **PATTERN**: Utiliser les constantes de couleur de `Colors.danger` pour les remboursements
- **VALIDATE**: `cd apps/mobile && pnpm lint`

### Task 6: VERIFY coherence dans `BalanceIndicator.tsx`

- **IMPLEMENT**: Verifier que les messages sont coherents avec les autres ecrans:
  - Ligne 53: "Nous devons au client" (correct)
  - S'assurer que l'alerte (lignes 80-89) est toujours affichee pour les soldes negatifs
- **PATTERN**: Les messages doivent etre identiques a ceux de CustomerBalancesSummaryScreen
- **VALIDATE**: `cd apps/mobile && pnpm lint`

### Task 7: TEST creation de creance negative

- **IMPLEMENT**: Creer un test pour verifier que:
  - Une creance avec montant negatif est creee avec status 'PAID'
  - La description par defaut est ajoutee si non fournie
  - Le balance est correctement calcule
- **PATTERN**: Suivre le pattern des tests existants dans `apps/api/test/`
- **VALIDATE**: `cd apps/api && pnpm test`

---

## TESTING STRATEGY

### Unit Tests

**Scope**: Service ReceivablesService
**Requirements**:
- Test creation creance negative avec status PAID automatique
- Test que creance positive garde status PENDING
- Test description par defaut pour remboursement

**VALIDATION COMMAND**: `cd apps/api && pnpm test`

### Integration Tests

**Scope**: Workflow complet de remboursement
**Requirements**:
- Creer un client avec dette positive
- Effectuer un remboursement superieur a la dette
- Verifier que le solde devient negatif
- Verifier que le solde s'affiche correctement partout

**VALIDATION COMMAND**: `cd apps/api && pnpm test:e2e`

### Edge Cases

1. **Remboursement exact**: Client paie exactement sa dette -> solde = 0
2. **Remboursement superieur**: Client paie plus que sa dette -> solde negatif
3. **Client sans dette**: Tentative de remboursement sans dette existante
4. **Plusieurs creances**: Client avec plusieurs creances, remboursement partiel

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
cd apps/api && pnpm lint
cd apps/mobile && pnpm lint
```

**Expected Result**: Zero errors, zero warnings

### Level 2: Unit Tests

```bash
cd apps/api && pnpm test
cd apps/mobile && pnpm test
```

**Expected Result**: All tests pass

### Level 3: Type Checking

```bash
cd apps/api && pnpm build
cd apps/mobile && npx tsc --noEmit
```

**Expected Result**: No type errors

### Level 4: Manual Validation

1. Demarrer l'API et l'app mobile
2. Creer un client avec une creance de 10000 FCFA
3. Effectuer un "Remboursement client" de 15000 FCFA
4. Verifier que le solde affiche -5000 FCFA avec mention "Remboursement"
5. Verifier dans CustomerBalancesSummaryScreen
6. Verifier dans BusinessReportsScreen

---

## ACCEPTANCE CRITERIA

- [ ] Une creance avec montant negatif est automatiquement creee avec status 'PAID'
- [ ] Le message affiche clairement quand nous devons de l'argent au client
- [ ] CustomerBalancesSummaryScreen affiche les KPIs "Clients a rembourser" et "Total a rembourser"
- [ ] BusinessReportsScreen separe les creances (positif) des remboursements (negatif)
- [ ] BalanceIndicator affiche l'alerte pour les soldes negatifs
- [ ] Les calculs de solde sont coherents entre tous les ecrans
- [ ] Tous les tests passent
- [ ] Pas de regression sur les fonctionnalites existantes

---

## COMPLETION CHECKLIST

- [ ] Task 1: Backend ReceivablesService modifie
- [ ] Task 2: CashScreen message ameliore
- [ ] Task 3: BusinessReportsScreen calcul separe
- [ ] Task 4: BusinessReportsScreen affichage modifie
- [ ] Task 5: CustomerBalancesSummaryScreen badges ameliores
- [ ] Task 6: BalanceIndicator verifie
- [ ] Task 7: Test unitaire cree
- [ ] Validation manuelle completee
- [ ] Tous les linters passent
- [ ] Tous les tests passent

---

## NOTES

### Decisions de design

1. **Status PAID pour creances negatives**: Une creance negative represente un ajustement de solde instantane, pas une dette en attente. Le status PAID est donc logique car il n'y a rien a "collecter".

2. **Separation des KPIs**: Afficher separement les dettes clients et les remboursements dus permet une meilleure visibilite sur la situation financiere.

3. **Messages uniformes**: Utiliser les memes termes partout pour eviter la confusion (ex: toujours "Remboursement du" plutot que parfois "On lui doit" et parfois "Nous devons au client").

### Risques identifies

- **Donnees existantes**: Les creances negatives existantes avec status PENDING ne seront pas automatiquement corrigees. Une migration de donnees pourrait etre necessaire.
- **Performance bilans**: Ajouter des calculs supplementaires dans BusinessReportsScreen pourrait impacter la performance. A surveiller.

<!-- EOF -->
