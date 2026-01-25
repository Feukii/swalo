# Feature: Fix Internal Server Error on Catalog Operations

## Feature Description

Correction des erreurs 500 (Internal Server Error) qui surviennent lors de toutes les opérations liées au catalogue produits:
- Import de fichiers CSV/Excel
- Création manuelle d'articles
- Création manuelle de familles/types/marques dans la hiérarchie

## User Story

En tant qu'utilisateur (OWNER ou MANAGER)
Je veux pouvoir créer des produits, importer des catalogues et gérer la hiérarchie des articles
Pour alimenter le catalogue de ma boutique

## Problem Statement

L'API renvoie des erreurs 500 (Internal Server Error) lors de:
1. La confirmation d'un import de catalogue (`POST /api/import/catalog/confirm`)
2. La création d'un produit (`POST /api/products`)
3. La création d'une famille/type/marque (qui crée un produit placeholder)

Ces erreurs sont génériques et ne donnent pas d'information sur la cause réelle.

## Solution Statement

Après analyse approfondie via 8 stratégies d'investigation parallèles, les causes probables identifiées sont:

1. **Validation du rôle utilisateur**: Le `RolesGuard` fait une requête DB à chaque appel protégé, ce qui peut échouer silencieusement
2. **Champs requis manquants**: Le DTO `CreateProductDto` requiert `sku`, `name`, `cost_price`, `sell_price` - mais le code peut envoyer des valeurs incorrectes
3. **Erreurs Prisma non gérées**: Les erreurs de contrainte unique ou de clé étrangère ne sont pas toujours interceptées
4. **Problème de payload JWT**: Le `shopId` peut ne pas être correctement extrait du token

## Feature Metadata

**Feature Type**: Bug Fix
**Estimated Complexity**: Medium
**Primary Systems Affected**: API Products Module, API Import Module, Mobile Catalog Screens
**Dependencies**: Prisma ORM, NestJS Guards, JWT Authentication

---

## CONTEXT REFERENCES

### Relevant Codebase Files - MUST READ BEFORE IMPLEMENTING

- `apps/api/src/modules/products/products.controller.ts` - Endpoints produits avec guards @Roles
- `apps/api/src/modules/products/products.service.ts` (lines 15-57) - Méthode create() qui insère en DB
- `apps/api/src/modules/products/dto/create-product.dto.ts` - DTO avec validations class-validator
- `apps/api/src/modules/import/import.service.ts` (lines 250-330) - confirmCatalogImport()
- `apps/api/src/modules/import/import.controller.ts` - Endpoints import avec guards
- `apps/api/src/common/guards/roles.guard.ts` - Guard qui vérifie les rôles
- `apps/api/src/common/strategies/jwt.strategy.ts` - Extraction du payload JWT
- `apps/api/src/main.ts` - Configuration globale (ValidationPipe, CORS)
- `apps/mobile/src/screens/CatalogHierarchyScreen.tsx` (lines 260-305) - Création produit placeholder
- `apps/mobile/src/screens/ProductCatalogScreen.tsx` (lines 250-307) - Formulaire création produit
- `apps/mobile/src/lib/api.ts` (lines 537-554) - productsApi.create()

### New Files to Create

- Aucun nouveau fichier nécessaire

### Patterns to Follow

**Error Handling Pattern:**
- Utiliser des blocs try-catch explicites avec logging
- Retourner des messages d'erreur clairs au client
- Ne pas exposer les erreurs Prisma brutes

**Validation Pattern:**
- class-validator avec decorators @IsString, @IsInt, @Min
- Validation implicite via ValidationPipe global

**Guard Pattern:**
- @UseGuards(JwtAuthGuard, RolesGuard) sur les controllers
- @Roles(Role.OWNER, Role.MANAGER) sur les endpoints protégés

---

## IMPLEMENTATION PLAN

### Phase 1: Diagnostic et Logging

Ajouter du logging détaillé pour identifier précisément la cause des erreurs 500.

**Tasks:**
- Ajouter des logs dans ProductsService.create()
- Ajouter des logs dans ImportService.confirmCatalogImport()
- Ajouter un filtre d'exception global pour capturer les erreurs non gérées

### Phase 2: Correction des Erreurs Silencieuses

Corriger les points où des erreurs peuvent survenir sans être correctement gérées.

**Tasks:**
- Améliorer la gestion des erreurs Prisma dans products.service.ts
- Ajouter try-catch autour des opérations critiques
- Valider que le shopId est présent avant les opérations

### Phase 3: Validation des Données

S'assurer que les données envoyées par le mobile correspondent aux attentes de l'API.

**Tasks:**
- Vérifier que CatalogHierarchyScreen envoie des données valides
- Vérifier que ProductCatalogScreen envoie des données valides
- Ajouter une validation côté mobile avant l'envoi

### Phase 4: Tests et Validation

Valider que les corrections fonctionnent.

**Tasks:**
- Tester la création de produit via l'API
- Tester la création de famille via l'écran hiérarchie
- Tester l'import de catalogue

---

## STEP-BY-STEP TASKS

### Task 1: ADD Global Exception Filter

**IMPLEMENT**: Créer un filtre d'exception global pour logger toutes les erreurs non gérées et retourner des messages clairs

**FILE**: `apps/api/src/common/filters/http-exception.filter.ts`

**PATTERN**: Suivre le pattern NestJS ExceptionFilter - https://docs.nestjs.com/exception-filters

**DEPENDENCIES**: @nestjs/common

**GOTCHA**: Ne pas exposer les stack traces en production

**VALIDATE**: `cd apps/api && pnpm run lint`

### Task 2: UPDATE products.service.ts - Add Error Handling

**IMPLEMENT**: Entourer la méthode create() avec un try-catch qui log les erreurs et les renvoie avec des messages clairs

**FILE**: `apps/api/src/modules/products/products.service.ts`

**PATTERN**: Utiliser le pattern de logging existant dans auth.service.ts

**GOTCHA**: Les erreurs Prisma P2002 (unique constraint) doivent être converties en ConflictException

**VALIDATE**: `cd apps/api && pnpm test`

### Task 3: UPDATE import.service.ts - Add Error Handling

**IMPLEMENT**: Améliorer la gestion d'erreur dans confirmCatalogImport() pour logger les échecs d'insertion

**FILE**: `apps/api/src/modules/import/import.service.ts`

**PATTERN**: Logger chaque erreur d'insertion avec le détail du produit concerné

**GOTCHA**: Les erreurs dans la boucle for ne doivent pas arrêter tout l'import

**VALIDATE**: `cd apps/api && pnpm test`

### Task 4: UPDATE main.ts - Register Exception Filter

**IMPLEMENT**: Enregistrer le filtre d'exception global dans le bootstrap

**FILE**: `apps/api/src/main.ts`

**PATTERN**: app.useGlobalFilters(new HttpExceptionFilter())

**VALIDATE**: `cd apps/api && pnpm run lint`

### Task 5: UPDATE CatalogHierarchyScreen.tsx - Improve Error Display

**IMPLEMENT**: Améliorer l'affichage des erreurs pour montrer le message exact de l'API

**FILE**: `apps/mobile/src/screens/CatalogHierarchyScreen.tsx`

**PATTERN**: Utiliser error.response?.data?.message comme dans ProductCatalogScreen

**VALIDATE**: `cd apps/mobile && pnpm run lint`

### Task 6: VERIFY API Payload Structure

**IMPLEMENT**: S'assurer que les payloads envoyés par le mobile correspondent exactement au DTO attendu

**FILES**:
- `apps/mobile/src/screens/CatalogHierarchyScreen.tsx` - vérifier newProduct
- `apps/mobile/src/screens/ProductCatalogScreen.tsx` - vérifier data

**GOTCHA**: Le DTO requiert cost_price et sell_price comme integers, pas strings

**VALIDATE**: Tester manuellement via l'application

---

## TESTING STRATEGY

### Unit Tests

**Scope**: ProductsService.create(), ImportService.confirmCatalogImport()

**Requirements**:
- Tester la création avec des données valides
- Tester la création avec SKU dupliqué (doit retourner ConflictException)
- Tester la création avec données manquantes (doit retourner BadRequestException)

**VALIDATION COMMAND**: `cd apps/api && pnpm test`

### Integration Tests

**Scope**: Endpoints POST /api/products et POST /api/import/catalog/confirm

**Requirements**:
- Tester avec token JWT valide
- Tester avec rôle OWNER
- Tester avec rôle non autorisé (doit retourner 403)

**VALIDATION COMMAND**: `cd apps/api && pnpm test`

### Manual Tests

1. Ouvrir l'application mobile
2. Aller dans Plus → Catalogue Articles → Hiérarchie
3. Tenter d'ajouter une nouvelle famille
4. Vérifier qu'aucune erreur 500 ne survient

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
cd apps/api && pnpm run lint
cd apps/mobile && pnpm run lint
```

### Level 2: Unit Tests

```bash
cd apps/api && pnpm test
cd apps/mobile && pnpm test
```

### Level 3: Full Validation

```bash
pnpm run validate
```

### Level 4: Manual API Test

```bash
# Test création produit (nécessite un token valide)
curl -X POST "https://swalo-api.onrender.com/api/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"sku":"TEST001","name":"Test Product","cost_price":100,"sell_price":150}'
```

---

## ACCEPTANCE CRITERIA

- [ ] Toutes les opérations du catalogue retournent des erreurs claires (pas de 500 générique)
- [ ] La création de produit fonctionne depuis ProductCatalogScreen
- [ ] La création de famille fonctionne depuis CatalogHierarchyScreen
- [ ] L'import de catalogue fonctionne
- [ ] Tous les tests passent
- [ ] Pas de régression sur les fonctionnalités existantes

---

## COMPLETION CHECKLIST

- [ ] Exception filter global créé et enregistré
- [ ] Gestion d'erreur améliorée dans products.service.ts
- [ ] Gestion d'erreur améliorée dans import.service.ts
- [ ] Affichage d'erreur amélioré dans CatalogHierarchyScreen
- [ ] Tous les tests passent
- [ ] Validation manuelle effectuée
- [ ] Code committé et pushé

---

## NOTES

### Analyse des 8 Stratégies

1. **Risk-First**: Identifié le RolesGuard comme point de défaillance potentiel
2. **Simplest-Solution**: Le problème est probablement une erreur Prisma non catchée
3. **Best-Practices**: Le manque d'exception filter global est un écart aux bonnes pratiques
4. **Edge-Cases**: Les valeurs 0 pour cost_price/sell_price pourraient poser problème
5. **Contrarian**: Le problème n'est peut-être pas dans le code mais dans la config Render
6. **Performance-First**: Pas de problème de performance identifié
7. **Security-First**: La validation JWT semble correcte
8. **Maintainability**: Le manque de logging rend le debug difficile

### Points d'attention

- Le ValidationPipe est configuré avec `whitelist: true` qui filtre les propriétés inconnues
- Le RolesGuard fait une requête DB à chaque appel, ce qui pourrait échouer si la connexion est instable
- Les erreurs Prisma P2002 (violation de contrainte unique) ne sont pas toujours converties en 409 Conflict
