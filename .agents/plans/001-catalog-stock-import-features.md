# Plan d'implémentation : Catalogue, Stock avec Prix, Import et Conditionnement

## Résumé Exécutif

Ce plan couvre 7 fonctionnalités demandées pour l'application SWALO :

| # | Fonctionnalité | Complexité | Priorité |
|---|----------------|------------|----------|
| 1 | CRUD complet catalogue (famille, type, marque, référence) | FAIBLE (existant) | 1 |
| 2 | Suppression doublons clients/fournisseurs | MOYENNE | 2 |
| 3 | Préfixe téléphonique +237 Cameroun | FAIBLE | 3 |
| 4 | Prix par article dans catalogue | FAIBLE (existant) | 1 |
| 5 | Gestion stock avec prix par lot et validité | HAUTE | 4 |
| 6 | Champ conditionnement par article | MOYENNE | 3 |
| 7 | Import catalogue Excel/CSV | HAUTE | 5 |

---

## Issue 1 : CRUD Complet Catalogue Hiérarchique

### Analyse
**DÉCOUVERTE MAJEURE** : La fonctionnalité EST DÉJÀ IMPLÉMENTÉE mais souffre d'un problème d'UX.

**Fichiers existants** :
- `apps/mobile/src/screens/CatalogHierarchyScreen.tsx` lignes 156-315 : Modal CRUD complet
- `apps/mobile/src/screens/CatalogHierarchyScreen.tsx` lignes 447-451 : Bouton "+" dans header
- `apps/api/src/modules/products/products.service.ts` lignes 475-508 : `batchUpdateHierarchy()`

### Problème UX identifié
Le bouton "+" existe mais n'est pas visible ou l'utilisateur ne comprend pas comment l'utiliser.

### Solution
Améliorer la visibilité et l'affordance du système existant.

### Tâches
1. **[MOBILE]** Rendre le bouton "+" plus visible dans `CatalogHierarchyScreen.tsx`
   - Ajouter un FAB (Floating Action Button) en plus du header
   - Ajouter des tooltips/indices visuels

2. **[MOBILE]** Ajouter des boutons contextuels "Ajouter" à chaque niveau de hiérarchie
   - Sur une famille : "Ajouter un type"
   - Sur un type : "Ajouter une marque"
   - Sur une marque : "Ajouter une référence"

3. **[MOBILE]** Améliorer les messages de confirmation après ajout

### Fichiers à modifier
- `apps/mobile/src/screens/CatalogHierarchyScreen.tsx`

### Validation
```bash
cd apps/mobile && pnpm lint
# Test manuel : Naviguer vers Catalogue > Hiérarchie > Vérifier boutons d'ajout
```

---

## Issue 2 : Suppression Doublons Clients/Fournisseurs

### Analyse
- La prévention des doublons EXISTE (`mode: 'insensitive'` dans create/update)
- Mais les doublons EXISTANTS nécessitent un nettoyage

### Schema actuel
```prisma
model Customer {
  name String @db.VarChar(255)  // Pas de contrainte unique
  ...
}
```

### Solution
Créer des endpoints de détection et fusion de doublons.

### Tâches API
1. **[API]** Créer endpoint `GET /customers/duplicates` dans `customers.controller.ts`
2. **[API]** Créer endpoint `POST /customers/merge` pour fusionner deux clients
3. **[API]** Créer endpoint `GET /suppliers/duplicates` dans `suppliers.controller.ts`
4. **[API]** Créer endpoint `POST /suppliers/merge` pour fusionner deux fournisseurs

### Logique de fusion
```typescript
async mergeDuplicates(shopId: string, keepId: string, mergeId: string) {
  // 1. Transférer toutes les créances/dettes de mergeId vers keepId
  // 2. Transférer les ventes/factures
  // 3. Transférer les entrées de caisse
  // 4. Soft delete le mergeId
}
```

### Tâches Mobile
5. **[MOBILE]** Créer écran `DuplicatesManagementScreen.tsx`
6. **[MOBILE]** Ajouter bouton "Gérer doublons" dans paramètres

### Fichiers à créer/modifier
- `apps/api/src/modules/customers/customers.service.ts` - Ajouter `findDuplicates()`, `merge()`
- `apps/api/src/modules/customers/customers.controller.ts` - Endpoints
- `apps/api/src/modules/suppliers/suppliers.service.ts` - Ajouter `findDuplicates()`, `merge()`
- `apps/api/src/modules/suppliers/suppliers.controller.ts` - Endpoints
- `apps/mobile/src/screens/DuplicatesManagementScreen.tsx` (nouveau)

### Validation
```bash
cd apps/api && pnpm lint && pnpm test
# curl GET /api/customers/duplicates -H "Authorization: Bearer $TOKEN"
```

---

## Issue 3 : Préfixe Téléphonique +237 (Cameroun)

### Analyse
Actuellement aucune validation de format téléphonique n'est appliquée.

### Solution
Ajouter validation et auto-formatage pour numéros camerounais.

### Règles de validation
- Format attendu : `+237 6XX XXX XXX` ou `+237 2XX XXX XXX`
- 9 chiffres après le préfixe
- Auto-prepend +237 si absent

### Tâches
1. **[CORE]** Créer utilitaire `formatCameroonPhone()` dans `packages/core/src/utils/`
2. **[API]** Ajouter validation dans DTOs clients/fournisseurs
3. **[MOBILE]** Modifier inputs téléphone pour auto-formater

### Fichiers à modifier
- `packages/core/src/utils/phone.ts` (nouveau)
- `apps/api/src/modules/customers/dto/create-customer.dto.ts`
- `apps/api/src/modules/suppliers/dto/create-supplier.dto.ts`
- `apps/mobile/src/screens/CustomerDetailsScreen.tsx`
- `apps/mobile/src/screens/SupplierDetailsScreen.tsx`
- `apps/mobile/src/components/PhoneInput.tsx` (nouveau)

### Validation
```bash
cd packages/core && pnpm test
cd apps/api && pnpm test
```

---

## Issue 4 : Prix par Article dans Catalogue

### Analyse
**DÉCOUVERTE** : Le champ `sell_price` EXISTE DÉJÀ sur le modèle Product.

```prisma
model Product {
  cost_price Int
  sell_price Int
  ...
}
```

### Problème
Le prix n'est simplement pas affiché dans la vue catalogue hiérarchique.

### Solution
Ajouter une colonne prix dans l'affichage du catalogue.

### Tâches
1. **[MOBILE]** Ajouter colonne "Prix" dans `CatalogHierarchyScreen.tsx`
2. **[MOBILE]** Afficher `formatCurrency(product.sell_price)` pour chaque article

### Fichiers à modifier
- `apps/mobile/src/screens/CatalogHierarchyScreen.tsx`

### Validation
```bash
cd apps/mobile && pnpm lint
# Test manuel : Vérifier affichage prix dans catalogue
```

---

## Issue 5 : Gestion Stock avec Prix par Lot et Validité

### Analyse approfondie
C'est la fonctionnalité la plus complexe. Le modèle `StockBatch` existe mais incomplet.

### Schema actuel
```prisma
model StockBatch {
  id                 String
  product_id         String
  quantity           Int
  remaining_quantity Int
  cost_price         Int
  sell_price         Int
  created_at         DateTime
  // MANQUANT : price_valid_from, price_valid_until
}
```

### Conception (basée sur PRIX_HISTORISES_DESIGN.md)
1. **Dates de validité** : `price_valid_from`, `price_valid_until` sur StockBatch
2. **Logique FIFO** : Vendre d'abord les lots les plus anciens
3. **Sélection manuelle** : Permettre choix du lot lors de la vente
4. **Vue répartition** : Afficher stock par prix

### Tâches Migration DB
1. **[DB]** Créer migration pour ajouter champs de validité
```sql
ALTER TABLE stock_batches ADD COLUMN price_valid_from TIMESTAMP DEFAULT NOW();
ALTER TABLE stock_batches ADD COLUMN price_valid_until TIMESTAMP;
ALTER TABLE stock_batches ADD COLUMN notes TEXT;
```

### Tâches API
2. **[API]** Modifier `inventory.service.ts` pour gérer FIFO
3. **[API]** Créer endpoint `GET /products/:id/batches` pour voir lots
4. **[API]** Modifier endpoint de vente pour accepter `batch_id` optionnel
5. **[API]** Ajouter logique de fermeture automatique des anciens prix

### Tâches Mobile
6. **[MOBILE]** Modifier `StockManagementScreen.tsx` pour afficher lots par prix
7. **[MOBILE]** Créer modal de sélection de lot lors de vente multi-prix
8. **[MOBILE]** Ajouter vue "Répartition stock par prix" dans détail produit

### Fichiers à créer/modifier
- `apps/api/prisma/schema.prisma` - Ajouter champs StockBatch
- `apps/api/prisma/migrations/XXXXXXXX_add_stock_batch_validity/`
- `apps/api/src/modules/inventory/inventory.service.ts` - Logique FIFO
- `apps/api/src/modules/products/products.service.ts` - Endpoint batches
- `apps/api/src/modules/sales/sales.service.ts` - Sélection batch
- `apps/mobile/src/screens/StockManagementScreen.tsx`
- `apps/mobile/src/screens/SaleScreen.tsx` - Modal sélection batch
- `apps/mobile/src/components/BatchSelectionModal.tsx` (nouveau)

### Validation
```bash
cd apps/api && pnpm prisma:migrate && pnpm test
cd apps/mobile && pnpm lint
```

---

## Issue 6 : Champ Conditionnement par Article

### Analyse
Le champ `unit` existe avec valeur par défaut "unit".

```prisma
model Product {
  unit String @default("unit") @db.VarChar(20)
}
```

### Options
**Option A** : Étendre les valeurs possibles (enum étendu)
**Option B** : Créer table `PackagingType` pour personnalisation

### Solution recommandée : Option B (table dynamique)

### Tâches DB
1. **[DB]** Créer table `PackagingType`
```prisma
model PackagingType {
  id         String   @id @default(uuid())
  shop_id    String
  name       String   @db.VarChar(50)  // "carton", "pièce", "douzaine"
  symbol     String?  @db.VarChar(10)  // "ctn", "pce", "dz"
  is_default Boolean  @default(false)
  created_at DateTime @default(now())
  shop       Shop     @relation(fields: [shop_id], references: [id])

  @@unique([shop_id, name])
  @@map("packaging_types")
}
```

### Tâches API
2. **[API]** Créer module `packaging-types` avec CRUD
3. **[API]** Seed avec valeurs par défaut : pièce, carton, douzaine, paquet
4. **[API]** Modifier Product pour référencer PackagingType

### Tâches Mobile
5. **[MOBILE]** Créer `PackagingTypePicker` component
6. **[MOBILE]** Ajouter écran gestion des conditionnements dans paramètres
7. **[MOBILE]** Modifier formulaire produit pour utiliser picker

### Fichiers à créer/modifier
- `apps/api/prisma/schema.prisma` - Modèle PackagingType
- `apps/api/src/modules/packaging-types/` (nouveau module)
- `apps/api/prisma/seed.ts` - Ajouter conditionnements par défaut
- `apps/mobile/src/components/PackagingTypePicker.tsx` (nouveau)
- `apps/mobile/src/screens/PackagingTypesScreen.tsx` (nouveau)
- `apps/mobile/src/screens/ProductCatalogScreen.tsx` - Utiliser picker

### Validation
```bash
cd apps/api && pnpm prisma:migrate && pnpm prisma:seed && pnpm test
```

---

## Issue 7 : Import Catalogue Excel/CSV

### Analyse
Fonctionnalité inexistante. Nécessite :
- Upload fichier côté mobile
- Parsing côté API
- Validation et preview
- Import en batch

### Colonnes requises (à confirmer avec utilisateur)
| Colonne | Type | Obligatoire |
|---------|------|-------------|
| sku | string | Oui |
| name | string | Oui |
| family | string | Non |
| article_type | string | Non |
| brand | string | Non |
| reference | string | Non |
| cost_price | number | Oui |
| sell_price | number | Oui |
| unit | string | Non |
| alert_threshold | number | Non |

### Tâches API
1. **[API]** Installer dépendances : `pnpm add multer @types/multer xlsx papaparse`
2. **[API]** Créer `apps/api/src/modules/import/import.module.ts`
3. **[API]** Créer endpoint `POST /import/catalog/preview` (upload + validation)
4. **[API]** Créer endpoint `POST /import/catalog/confirm` (import effectif)
5. **[API]** Gérer erreurs ligne par ligne avec rapport

### Logique de validation
```typescript
interface ImportResult {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  errors: { row: number; field: string; message: string }[];
  preview: ProductDto[]; // 10 premiers produits validés
}
```

### Tâches Mobile
6. **[MOBILE]** Créer écran `ImportCatalogScreen.tsx`
7. **[MOBILE]** Utiliser `expo-document-picker` pour sélection fichier
8. **[MOBILE]** Afficher preview avec erreurs
9. **[MOBILE]** Bouton confirmation import
10. **[MOBILE]** Afficher rapport final

### Fichiers à créer
- `apps/api/src/modules/import/import.module.ts`
- `apps/api/src/modules/import/import.controller.ts`
- `apps/api/src/modules/import/import.service.ts`
- `apps/api/src/modules/import/dto/import-catalog.dto.ts`
- `apps/mobile/src/screens/ImportCatalogScreen.tsx`

### Validation
```bash
cd apps/api && pnpm lint && pnpm test
# Test avec fichier CSV de test
```

---

## Ordre d'implémentation recommandé

### Phase 1 : Quick Wins (Issues 1, 3, 4)
Ces issues sont simples et améliorent immédiatement l'UX.

1. Issue 4 : Afficher prix dans catalogue (30 min)
2. Issue 1 : Améliorer visibilité CRUD catalogue (1h)
3. Issue 3 : Préfixe téléphone +237 (1h)

### Phase 2 : Nettoyage données (Issue 2)
4. Issue 2 : Détection et fusion doublons (3h)

### Phase 3 : Évolutions schema (Issues 5, 6)
5. Issue 6 : Table conditionnement (2h)
6. Issue 5 : Stock avec prix par lot (8h) - LE PLUS COMPLEXE

### Phase 4 : Import (Issue 7)
7. Issue 7 : Import Excel/CSV (6h)

---

## Commandes de validation globale

```bash
# Lint complet
pnpm run validate

# Tests API
cd apps/api && pnpm test

# Tests Mobile
cd apps/mobile && pnpm test

# Migrations
cd apps/api && pnpm prisma:migrate

# Vérifier schema
cd apps/api && pnpm prisma:studio
```

---

## Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| FIFO complexe avec multi-batch | Erreurs calcul stock | Tests unitaires exhaustifs |
| Import CSV avec données sales | Corruption catalogue | Validation stricte + preview obligatoire |
| Fusion doublons perte données | Perte créances/dettes | Transaction + backup avant fusion |
| Conditionnement custom | Confusion utilisateurs | Valeurs par défaut + UI claire |

---

## Questions à clarifier avec l'utilisateur

1. **Import** : Colonnes exactes requises dans le fichier Excel/CSV ?
2. **Doublons** : Quel client garder en cas de fusion ? (plus récent, plus de transactions ?)
3. **Stock multi-prix** : FIFO automatique ou sélection manuelle obligatoire ?
4. **Conditionnement** : Liste initiale de conditionnements souhaités ?
