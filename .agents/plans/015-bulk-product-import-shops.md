# Feature: Import en masse de produits pour les boutiques 042026 et 122026

## Feature Description

Ajouter des produits au catalogue des boutiques identifiees par les codes 042026 et 122026, en utilisant une fonctionnalite d'import de tableau CSV/Excel avec les colonnes suivantes: Famille, Article, Marque, Reference (Serie), Code Article, Libelle Article (Designation).

Le systeme dispose deja d'un module d'import complet. Cette feature necessite:
1. Amelioration du mapping des colonnes francaises vers les champs anglais
2. Ajout des colonnes de prix manquantes (obligatoires)
3. Script de seed pour ajouter les produits aux boutiques cibles
4. Tests de validation

## User Story

En tant que proprietaire de boutique SWALO
Je veux importer un catalogue de produits depuis un fichier CSV/Excel
Afin de rapidement alimenter mon inventaire avec les references standards

## Problem Statement

L'utilisateur souhaite ajouter 27+ produits aux boutiques 042026 et 122026 en utilisant un fichier CSV avec des colonnes en francais. Le module d'import existant fonctionne mais:
1. Attend des noms de colonnes en anglais (sku, name, family, etc.)
2. Requiert les colonnes cost_price et sell_price non mentionnees dans les donnees fournies
3. Pas de support natif pour le mapping "Code Article" → "sku", "Libelle Article" → "name", etc.

## Solution Statement

1. Enrichir le module ImportService avec un mapping de colonnes francaises
2. Clarifier les colonnes de prix requises et ajouter des valeurs par defaut si necessaire
3. Creer un script de seed pour les boutiques 042026 et 122026
4. Documenter le format CSV attendu

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Low-Medium
**Primary Systems Affected**:
- `apps/api/src/modules/import/import.service.ts`
- `apps/api/prisma/` (nouveau script de seed)
**Dependencies**: Aucune nouvelle dependance

---

## CONTEXT REFERENCES

### Relevant Codebase Files

- `apps/api/src/modules/import/import.service.ts` (lines 108-188)
  - Why: Logique de parsing CSV existante avec validation des colonnes

- `apps/api/src/modules/import/import.controller.ts` (lines 15-45)
  - Why: Endpoints REST pour preview et confirmation d'import

- `apps/api/prisma/schema.prisma` (lines 110-148)
  - Why: Definition du modele Product avec tous les champs de hierarchie

- `apps/api/prisma/seed-test-shop.ts` (entire file)
  - Why: Pattern de seed pour creer des produits avec hierarchie complete

- `apps/api/src/modules/products/products.service.ts` (lines 475-507)
  - Why: Pattern batchUpdateHierarchy() pour operations en masse

- `apps/api/test/products-hierarchy.spec.ts`
  - Why: Tests existants pour les operations de hierarchie produits

### New Files to Create

- `apps/api/prisma/seed-shops-042026-122026.ts` - Script de seed pour les produits des deux boutiques
- `apps/api/src/modules/import/column-mapping.ts` - Mapping des noms de colonnes francaises

### Patterns to Follow

**Naming Conventions:**
- Fichiers de seed: `seed-{description}.ts` dans `prisma/`
- Services NestJS: Methodes async avec retour type

**Error Handling:**
- Utiliser `BadRequestException` pour erreurs de validation
- Logger les erreurs avec contexte (row number, field name)
- Limiter les erreurs retournees a 100 max

**Transaction Pattern:**
- Wrapper les operations de masse dans `prisma.$transaction()`
- Pattern existant dans `suppliers.service.ts`, `sales.service.ts`

**Column Validation:**
- Normaliser les headers: lowercase, trim, suppression accents
- Valider les champs requis: sku, name, cost_price, sell_price

---

## IMPLEMENTATION PLAN

### Phase 1: Mapping des colonnes francaises

Ajouter un dictionnaire de mapping dans le module import pour traduire les noms de colonnes francaises vers les champs attendus.

### Phase 2: Script de seed pour les boutiques cibles

Creer un script qui:
1. Verifie l'existence des boutiques 042026 et 122026
2. Cree les boutiques si necessaire
3. Insere les produits fournis avec valeurs par defaut pour les prix

### Phase 3: Amelioration de la validation

Ajouter des valeurs par defaut pour cost_price et sell_price si non specifiees dans le CSV.

### Phase 4: Tests et validation

Executer les tests existants et ajouter des tests pour le nouveau mapping.

---

## STEP-BY-STEP TASKS

### Task 1: CREATE `apps/api/src/modules/import/column-mapping.ts`

- **IMPLEMENT**: Creer un fichier de mapping avec un dictionnaire de traduction des colonnes:
  - `famille` / `family` → `family`
  - `article` / `type article` → `article_type`
  - `marque` / `brand` → `brand`
  - `reference` / `reference (serie)` / `serie` → `reference`
  - `code article` / `code_article` / `sku` → `sku`
  - `libelle article` / `libelle` / `designation` / `name` → `name`
  - `prix achat` / `cout` / `cost_price` → `cost_price`
  - `prix vente` / `prix` / `sell_price` → `sell_price`
- **PATTERN**: Suivre le pattern de normalisation existant dans import.service.ts (lines 116-120)
- **GOTCHA**: Les accents doivent etre geres (e, e, e → e)
- **VALIDATE**: `cd apps/api && pnpm lint`

### Task 2: UPDATE `apps/api/src/modules/import/import.service.ts`

- **IMPLEMENT**: Integrer le mapping de colonnes dans la methode de parsing:
  - Importer le dictionnaire de mapping depuis column-mapping.ts
  - Appliquer le mapping apres la normalisation lowercase
  - Ajouter des valeurs par defaut: cost_price=0, sell_price=0 si non specifiees
- **PATTERN**: Suivre le pattern existant de normalisation (lines 116-120)
- **GOTCHA**: Ne pas casser la compatibilite avec les colonnes anglaises existantes
- **VALIDATE**: `cd apps/api && pnpm lint && pnpm test`

### Task 3: CREATE `apps/api/prisma/seed-shops-042026-122026.ts`

- **IMPLEMENT**: Creer un script de seed qui:
  1. Se connecte a la base via Prisma
  2. Cree ou trouve les boutiques 042026 et 122026
  3. Cree un utilisateur owner pour chaque boutique si necessaire
  4. Insere les 27+ produits fournis dans la demande
  5. Utilise upsert pour idempotence (eviter doublons)
- **PATTERN**: Suivre exactement le pattern de `seed-test-shop.ts`
- **GOTCHA**: Les prix doivent etre en centimes FCFA (entiers)
- **VALIDATE**: `cd apps/api && npx ts-node prisma/seed-shops-042026-122026.ts`

### Task 4: ADD test for column mapping

- **IMPLEMENT**: Ajouter des tests unitaires pour verifier:
  - Le mapping "Famille" → "family" fonctionne
  - Le mapping "Code Article" → "sku" fonctionne
  - Les accents sont geres correctement
  - Les colonnes anglaises restent fonctionnelles
- **PATTERN**: Suivre le pattern de test dans `test/products-hierarchy.spec.ts`
- **VALIDATE**: `cd apps/api && pnpm test`

### Task 5: CREATE CSV template documentation

- **IMPLEMENT**: Creer un fichier exemple CSV avec les colonnes attendues:
  - Documenter les deux formats supportes (francais et anglais)
  - Inclure des exemples de donnees
  - Preciser les formats de prix attendus
- **PATTERN**: Format Markdown dans le dossier docs/
- **VALIDATE**: Verification manuelle

### Task 6: VALIDATE complete flow

- **IMPLEMENT**: Tester le flux complet:
  1. Executer le script de seed
  2. Verifier les produits dans Prisma Studio
  3. Tester l'import CSV via API
  4. Verifier les erreurs de validation
- **VALIDATE**: `cd apps/api && pnpm lint && pnpm test`

---

## TESTING STRATEGY

### Unit Tests

**Scope**: Mapping de colonnes et validation
**Requirements**:
- Tester chaque alias de colonne francaise
- Tester la normalisation des accents
- Tester les valeurs par defaut pour les prix

**VALIDATION COMMAND**: `cd apps/api && pnpm test`

### Integration Tests

**Scope**: Import CSV complet
**Requirements**:
- Importer un CSV avec colonnes francaises
- Verifier la creation des produits
- Tester les doublons et erreurs

**VALIDATION COMMAND**: `cd apps/api && pnpm test`

### Edge Cases

1. CSV avec melange de colonnes francaises et anglaises
2. CSV sans colonnes de prix (doit utiliser defauts)
3. SKU dupliques dans le meme fichier
4. SKU existant deja en base
5. Caracteres speciaux dans les noms de produits

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
cd apps/api && pnpm lint
```

**Expected Result**: Zero new errors

### Level 2: Unit Tests

```bash
cd apps/api && pnpm test
```

**Expected Result**: All tests pass (34+ tests)

### Level 3: Type Checking

```bash
cd apps/api && pnpm type-check
```

**Expected Result**: No TypeScript errors

### Level 4: Seed Script Execution

```bash
cd apps/api && npx ts-node prisma/seed-shops-042026-122026.ts
```

**Expected Result**: Products created in target shops

---

## ACCEPTANCE CRITERIA

- [ ] Le mapping de colonnes francaises fonctionne correctement
- [ ] Les boutiques 042026 et 122026 contiennent les produits importes
- [ ] Les produits ont les champs family, article_type, brand, reference remplis
- [ ] L'import CSV via API fonctionne avec les colonnes francaises
- [ ] Tous les tests passent
- [ ] Pas de regression sur les fonctionnalites existantes

---

## COMPLETION CHECKLIST

- [ ] Task 1: Fichier column-mapping.ts cree
- [ ] Task 2: import.service.ts mis a jour avec le mapping
- [ ] Task 3: Script de seed cree et execute
- [ ] Task 4: Tests de mapping ajoutes
- [ ] Task 5: Documentation CSV creee
- [ ] Task 6: Validation complete
- [ ] Tous les linters passent
- [ ] Tous les tests passent

---

## NOTES

### Donnees produits fournies

Les produits a importer sont repartis en 4 familles:
- **GLASSES** (6 produits): Glass 3D, Glass Fume, Glass Incuve pour differentes marques
- **CHARGEURS** (6 produits): Chargeur 1A, 2A, 67W pour Oraimo, Itel, Infinix
- **KIT BLUETOOTH** (8 produits): Casques, Ecouteurs, Kit Bluetooth
- **CARTES MEMOIRES** (7+ produits): Cartes memoire Faster, Calus, Speedar

### Considerations de prix

Les colonnes cost_price et sell_price sont **obligatoires** dans le schema actuel.
Options:
1. Demander a l'utilisateur de fournir les prix dans le CSV
2. Utiliser des valeurs par defaut (0) pour permettre l'import sans prix
3. Rendre les prix optionnels avec valeur par defaut

**Recommandation**: Option 2 - permettre l'import avec prix=0 par defaut, l'utilisateur pourra mettre a jour les prix apres.

### Colonnes du CSV fourni

```csv
Famille,Article,Marque,Reference (Serie),Code Article,Libelle Article (Designation)
GLASSES,Glass 3D,Tecno,Spark 4,GLA01TECSpk4,Glass 3D Tecno Spark 4
```

### Mapping des colonnes

| Colonne CSV (FR) | Champ Prisma | Obligatoire |
|------------------|--------------|-------------|
| Famille | family | Non |
| Article | article_type | Non |
| Marque | brand | Non |
| Reference (Serie) | reference | Non |
| Code Article | sku | **Oui** |
| Libelle Article | name | **Oui** |
| Prix Achat | cost_price | **Oui** (defaut: 0) |
| Prix Vente | sell_price | **Oui** (defaut: 0) |

<!-- EOF -->
