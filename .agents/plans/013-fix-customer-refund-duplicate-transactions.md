# Feature: Correction des doublons de transactions lors des remboursements clients

## Feature Description

Corriger le bug critique qui cause la creation de transactions en double lors des operations de remboursement client dans CashScreen. Actuellement, lorsqu'un utilisateur effectue un "Remboursement client", le systeme cree deux modifications de solde distinctes au lieu d'une seule, causant une corruption des soldes clients.

## User Story

En tant que commercant utilisant SWALO
Je veux que les remboursements clients ne creent qu'une seule transaction
Afin que les soldes clients soient corrects et que ma comptabilite soit coherente

## Problem Statement

Dans `CashScreen.tsx`, le flux "Remboursement client" effectue DEUX appels API distincts:

1. **Premier appel** (ligne 320-324): `receivablesApi.create()` avec un montant negatif
   - Cree un `ClientReceivable` avec `amount: -X`
   - Reduit directement le solde client

2. **Deuxieme appel** (ligne 362-368): `cashApi.createEntry()` avec `customer_id` et `type: 'IN'`
   - Cree un `CashEntry`
   - Declenche la logique automatique de paiement dans `cash.service.ts` (lignes 150-199)
   - Cette logique trouve les creances PENDING/PARTIAL et cree des `ClientReceivablePayment`
   - Modifie ENCORE les soldes des creances existantes

**Resultat**: Le solde client est modifie deux fois pour une seule operation de remboursement.

## Solution Statement

Unifier le flux de remboursement en utilisant une seule methode coherente:

**Option retenue**: Modifier `CashScreen.tsx` pour utiliser UNIQUEMENT la creation de creance negative (sans appel cash entry) pour les remboursements clients. La creance negative avec status='PAID' represente deja l'ajustement de solde complet.

Alternative: Si un enregistrement cash est necessaire pour la tracabilite, modifier `cash.service.ts` pour NE PAS declencher la logique de paiement automatique lorsque la categorie est 'remboursement_client'.

## Feature Metadata

**Feature Type**: Bug Fix (Critical)
**Estimated Complexity**: Medium
**Primary Systems Affected**:
- `apps/mobile/src/screens/CashScreen.tsx`
- `apps/api/src/modules/cash/cash.service.ts`
**Dependencies**: Aucune

---

## CONTEXT REFERENCES

### Relevant Codebase Files

- `apps/mobile/src/screens/CashScreen.tsx` (lines 326-368)
  - Why: Point d'entree du bug - deux appels API pour un seul remboursement

- `apps/api/src/modules/cash/cash.service.ts` (lines 150-199)
  - Why: Logique de paiement automatique declenchee par le deuxieme appel

- `apps/api/src/modules/receivables/receivables.service.ts` (lines 10-46)
  - Why: Creation de creance negative avec status='PAID'

- `apps/api/src/modules/customers/customers.service.ts` (lines 340-394)
  - Why: Methode `createRefund()` existante qui gere correctement les remboursements

- `apps/api/src/modules/customers/customers.service.ts` (lines 191-200)
  - Why: Calcul de `total_balance` dans `getOne()`

### Patterns to Follow

**Flux de remboursement correct (depuis CustomerDetailsScreen):**
- Appel unique a `customersApi.createRefund()`
- Cree atomiquement: CashEntry (OUT) + ClientReceivable (positif pour offset)
- Transaction Prisma garantit la coherence

**Convention de types cash:**
- `type: 'IN'` = argent qui ENTRE dans la caisse (paiement client)
- `type: 'OUT'` = argent qui SORT de la caisse (remboursement)
- Le code actuel utilise incorrectement `type: 'IN'` pour un remboursement

---

## IMPLEMENTATION PLAN

### Phase 1: Analyse et decision architecturale

Determiner l'approche optimale:
- Option A: Supprimer l'appel `cashApi.createEntry()` dans CashScreen pour les remboursements
- Option B: Modifier `cash.service.ts` pour ignorer le traitement automatique sur 'remboursement_client'
- Option C: Utiliser l'endpoint existant `customersApi.createRefund()` depuis CashScreen

### Phase 2: Correction du flux CashScreen

Modifier le flux "Remboursement client" pour eviter les doubles transactions.

### Phase 3: Tests et validation

Verifier que les remboursements ne creent plus de doublons.

---

## STEP-BY-STEP TASKS

### Task 1: ANALYZE current refund flows

- **IMPLEMENT**: Lire et comprendre les deux flux de remboursement existants:
  1. CashScreen.tsx (lignes 326-368) - flux problematique
  2. CustomerDetailsScreen.tsx "Rembourser Client" button - flux correct via createRefund()
- **PATTERN**: Comparer les deux approches pour determiner la meilleure solution
- **GOTCHA**: Le flux CashScreen est utilise pour "Remboursement client" depuis la caisse, pas depuis les details client
- **VALIDATE**: Lecture des fichiers uniquement, pas de modification

### Task 2: UPDATE `apps/mobile/src/screens/CashScreen.tsx` - Supprimer le double appel

- **IMPLEMENT**: Modifier le bloc `remboursement_client` (lignes 326-368) pour:
  1. GARDER l'appel `receivablesApi.create()` avec montant negatif (premiere modification de solde)
  2. SUPPRIMER l'appel `cashApi.createEntry()` qui declenche le double traitement
  3. OU modifier pour utiliser `type: 'OUT'` et categorie speciale qui ne declenche pas le paiement auto
- **PATTERN**: Suivre le pattern de "paiement_fournisseur" (lignes 448-487) qui cree dette + cash entry separement
- **GOTCHA**: Ne pas supprimer la logique de calcul du nouveau solde pour l'affichage du message
- **GOTCHA**: S'assurer que la caisse est quand meme mise a jour (argent sort)
- **VALIDATE**: `cd apps/mobile && pnpm lint`

### Task 3: UPDATE `apps/api/src/modules/cash/cash.service.ts` - Option alternative

- **IMPLEMENT**: Si l'approche Task 2 necessite toujours un cash entry, modifier `createEntry()` (lignes 150-199) pour:
  1. Ajouter une condition pour ignorer le traitement automatique de paiement si `category === 'remboursement_client'`
  2. Ou ajouter un parametre `skip_auto_payment: boolean` au DTO
- **PATTERN**: Suivre le pattern existant de conditions dans `createEntry()`
- **GOTCHA**: Ne pas casser le flux normal de paiement client qui doit continuer a fonctionner
- **VALIDATE**: `cd apps/api && pnpm lint`

### Task 4: VERIFY balance calculation consistency

- **IMPLEMENT**: Verifier que `customers.service.ts` `getOne()` calcule correctement le solde:
  1. `total_balance` = somme des `receivables.balance` (inclut les negatifs)
  2. Ne pas double-compter les cash entries dans le calcul du solde
- **PATTERN**: Le calcul actuel (ligne 194) est correct, mais verifier qu'il n'y a pas d'autres endroits qui double-comptent
- **VALIDATE**: Lecture et verification uniquement

### Task 5: ADD integration test for refund flow

- **IMPLEMENT**: Ajouter un test dans `apps/api/test/` qui verifie:
  1. Creation d'un client avec solde positif (dette)
  2. Paiement qui cree un solde negatif (overpayment)
  3. Verification qu'une seule transaction est creee
  4. Verification que le solde est modifie une seule fois
- **PATTERN**: Suivre le pattern de `customers-refund.spec.ts`
- **VALIDATE**: `cd apps/api && pnpm test`

### Task 6: TEST manual validation

- **IMPLEMENT**: Test manuel du flux complet:
  1. Creer un client avec une creance de 10000 FCFA
  2. Aller dans Caisse > Remboursement client
  3. Entrer un paiement de 15000 FCFA
  4. Verifier que le solde devient -5000 (pas -10000)
  5. Verifier dans la base de donnees qu'il n'y a qu'une seule nouvelle creance
- **VALIDATE**: Test manuel sur l'application

---

## TESTING STRATEGY

### Unit Tests

**Scope**: cash.service.ts et CashScreen logic
**Requirements**:
- Test que `createEntry()` avec `category='remboursement_client'` ne declenche pas le paiement auto
- Test que le solde client n'est modifie qu'une fois

**VALIDATION COMMAND**: `cd apps/api && pnpm test`

### Integration Tests

**Scope**: Flux complet de remboursement
**Requirements**:
- Test end-to-end du remboursement depuis la creation jusqu'au calcul du solde
- Verification qu'une seule transaction est visible dans l'historique

**VALIDATION COMMAND**: `cd apps/api && pnpm test`

### Edge Cases

1. **Remboursement exact**: Client paie exactement sa dette -> solde = 0, pas de double transaction
2. **Remboursement excessif**: Client paie plus que sa dette -> solde negatif, une seule creance negative creee
3. **Client sans dette**: Tentative de remboursement sur client a solde 0 ou negatif
4. **Remboursement partiel**: Paiement partiel d'une dette existante

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
cd apps/api && pnpm lint
cd apps/mobile && pnpm lint
```

**Expected Result**: Zero errors, zero warnings (nouveaux)

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

### Level 4: Manual Validation

1. Demarrer l'API et l'app mobile
2. Creer un client avec une creance de 10000 FCFA
3. Aller dans Caisse > Remboursement client
4. Entrer un paiement de 15000 FCFA (5000 de plus que la dette)
5. Verifier que le solde affiche -5000 FCFA (pas -10000)
6. Verifier dans Prisma Studio qu'il n'y a qu'UNE SEULE nouvelle creance negative

---

## ACCEPTANCE CRITERIA

- [ ] Un remboursement client ne cree qu'une seule transaction dans la base de donnees
- [ ] Le solde client est modifie une seule fois par remboursement
- [ ] Le calcul du solde dans tous les ecrans est coherent
- [ ] Les tests unitaires passent
- [ ] Pas de regression sur les flux de paiement normaux
- [ ] La caisse enregistre correctement les sorties d'argent

---

## COMPLETION CHECKLIST

- [ ] Task 1: Analyse des flux completee
- [ ] Task 2: CashScreen modifie pour eviter le double appel
- [ ] Task 3: cash.service.ts modifie si necessaire
- [ ] Task 4: Calcul de solde verifie
- [ ] Task 5: Test d'integration ajoute
- [ ] Task 6: Validation manuelle completee
- [ ] Tous les linters passent
- [ ] Tous les tests passent

---

## NOTES

### Decisions de design

1. **Choix de l'approche**: Supprimer le deuxieme appel API plutot que de modifier la logique backend. Cela evite de compliquer `cash.service.ts` avec des cas speciaux.

2. **Tracabilite cash**: Si un enregistrement cash est necessaire pour la comptabilite, utiliser `type: 'OUT'` avec une categorie qui ne declenche pas le paiement automatique.

3. **Coherence avec createRefund()**: L'endpoint `customersApi.createRefund()` existe deja et fonctionne correctement. Considerer son utilisation depuis CashScreen pour unifier les flux.

### Risques identifies

- **Donnees existantes**: Les remboursements deja effectues avec doublons ne seront pas automatiquement corriges. Une migration de donnees pourrait etre necessaire pour nettoyer les doublons existants.

- **Regression**: S'assurer que le flux normal de paiement client (qui doit appliquer les paiements aux creances) continue de fonctionner.

### Analyse des 8 agents

Tous les agents ont converge sur le meme diagnostic:
- Le probleme est dans CashScreen.tsx lignes 326-368
- Deux appels API creent deux modifications de solde
- Le deuxieme appel (cashApi.createEntry) declenche la logique de paiement automatique
- Solution: supprimer ou modifier le deuxieme appel

<!-- EOF -->
