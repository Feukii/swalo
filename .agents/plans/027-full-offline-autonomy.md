# Feature: Full Offline Autonomy - Mobile App

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Rendre l'application mobile SWALO **totalement autonome hors-ligne**. Actuellement, seules 7 entites sur ~20 sont synchronisees localement (products, stock_batches, customers, sales, sale_items, cash_entries, inventory_movements). De nombreuses fonctionnalites critiques (fournisseurs, creances, dettes, factures, rapports, authentification PIN) necessitent une connexion reseau.

L'objectif est que l'application fonctionne **indefiniment sans reseau** avec une synchronisation automatique et transparente des que la connexion est retablie. Le tout en gardant l'APK leger pour les telephones a stockage limite en Afrique Centrale.

## User Story

As a **cashier/manager in a phone accessory shop in Central Africa**
I want to **use the entire SWALO app without internet connection**
So that **I can continue selling, managing stock, tracking debts/receivables, and viewing reports even during frequent network outages**

## Problem Statement

Les coupures reseau sont frequentes et longues en Afrique Centrale. Actuellement, de nombreuses fonctionnalites sont inaccessibles hors-ligne :

- Login PIN impossible (requiert API)
- CRUD fournisseurs, creances, dettes : online uniquement
- Rapports et KPIs : online uniquement
- Creation/modification produits et clients : partiellement offline
- Facturation : online uniquement
- Gestion utilisateurs : online uniquement

Cela bloque les operations commerciales quotidiennes et entraine des pertes de revenus.

## Solution Statement

Etendre l'architecture offline existante (expo-sqlite + mutation queue) de maniere incrementale :

1. Ajouter l'authentification PIN offline (cache hash bcrypt)
2. Ajouter les entites manquantes au schema SQLite et au moteur de sync
3. Creer les fonctions d'ecriture offline pour toutes les operations CRUD
4. Implementer les rapports locaux via requetes SQLite agregees
5. Optimiser le protocole de sync (compression, intervalles adaptatifs, priorites)
6. Nettoyer les dependances mortes pour reduire la taille de l'APK
7. Ajouter une politique de retention des donnees (purge > 90 jours)

## Feature Metadata

**Feature Type**: Enhancement (extension majeure de l'architecture existante)
**Estimated Complexity**: High
**Primary Systems Affected**: Mobile app (db, sync, screens, hooks), API (sync service)
**Dependencies**: expo-sqlite (existant), expo-secure-store (existant), expo-network (existant)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

**Mobile - Offline Database Layer:**

- `apps/mobile/src/db/schema.ts` (lignes 1-362) - Why: Schema SQLite actuel avec 8 tables de donnees + 3 tables metadata. Base a etendre.
- `apps/mobile/src/db/offlineWrite.ts` (lignes 1-318) - Why: 3 fonctions d'ecriture offline existantes. Patron a reproduire pour les nouvelles entites.
- `apps/mobile/src/db/sync.ts` (lignes 1-435) - Why: Moteur de sync (push/pull/conflits). Doit etre etendu pour les nouvelles entites.
- `apps/mobile/src/db/queue.ts` (lignes 1-234) - Why: File de mutations FIFO. Architecture a preserver.
- `apps/mobile/src/db/repository.ts` (lignes 1-301) - Why: CRUD generique avec tracking sync. Patron a reproduire.
- `apps/mobile/src/db/repositories.ts` (lignes 1-450) - Why: 7 repositories specifiques. A etendre avec les nouvelles entites.
- `apps/mobile/src/db/index.ts` (lignes 1-55) - Why: Barrel exports. Doit etre mis a jour.

**Mobile - Hooks & State:**

- `apps/mobile/src/hooks/` (tous les fichiers) - Why: Hooks offline-first existants. Patron a reproduire.
- `apps/mobile/src/lib/api.ts` - Why: Client API fetch-based avec 48 methodes. Comprend syncApi.

**Mobile - Screens:**

- `apps/mobile/src/screens/LoginPinScreen.tsx` - Why: Ecran de login PIN a modifier pour offline.
- `apps/mobile/src/screens/HomeScreen.tsx` - Why: Dashboard avec KPIs a rendre offline.
- `apps/mobile/src/screens/BusinessReportsScreen.tsx` - Why: Rapports a rendre offline.
- `apps/mobile/src/screens/SuppliersScreen.tsx` - Why: Ecran fournisseurs a rendre offline.
- `apps/mobile/src/screens/SupplierDetailsScreen.tsx` - Why: Details fournisseur + dettes a rendre offline.
- `apps/mobile/src/screens/CustomerDetailsScreen.tsx` - Why: Details client + creances a rendre offline.
- `apps/mobile/src/screens/SyncStatusScreen.tsx` - Why: Moniteur de sync a enrichir.

**API - Sync Service:**

- `apps/api/src/modules/sync/sync.service.ts` - Why: Service de sync serveur. Doit supporter les nouvelles entites.
- `apps/api/src/modules/sync/sync.controller.ts` - Why: Endpoints sync (push/pull/status).
- `apps/api/src/modules/sync/dto/` - Why: DTOs de sync a etendre.

**API - Schema:**

- `apps/api/prisma/schema.prisma` - Why: Source de verite pour tous les modeles. Reference pour les nouveaux schemas SQLite.

**Config & Dependencies:**

- `apps/mobile/package.json` - Why: Dependances a nettoyer (axios, zustand morts).
- `apps/mobile/app.config.ts` - Why: Configuration Expo.

### New Files to Create

**Phase 1 - Auth Offline:**

- Pas de nouveau fichier, extension de `schema.ts` (table `auth_cache`) et `LoginPinScreen.tsx`

**Phase 2 - Nouvelles entites:**

- Pas de nouveaux fichiers, extension de `schema.ts`, `repositories.ts`, `offlineWrite.ts`, `sync.ts`

**Phase 3 - Rapports offline:**

- `apps/mobile/src/db/reports.ts` - Requetes agregees SQLite pour rapports locaux
- `apps/mobile/src/hooks/useOfflineReports.ts` - Hook pour rapports offline

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- Expo SQLite documentation: https://docs.expo.dev/versions/latest/sdk/sqlite/
- Expo SecureStore: https://docs.expo.dev/versions/latest/sdk/securestore/
- Expo Network: https://docs.expo.dev/versions/latest/sdk/network/
- React Navigation lazy loading: https://reactnavigation.org/docs/lazy/

### Patterns to Follow

**Naming Conventions:**

- Tables SQLite en snake_case pluriel (ex: `suppliers`, `client_receivables`)
- Champs miroir du schema Prisma (memes noms)
- Sync metadata: `_sync_status`, `_server_id`, `_last_synced_at` sur chaque entite
- Repositories en PascalCase + "Repository" (ex: `SupplierRepository`)
- Fonctions offline: `create{Entity}Offline()` (ex: `createSupplierOffline()`)

**Error Handling:**

- Les fonctions offline ne doivent JAMAIS throw pour des erreurs reseau
- Les erreurs de contrainte SQLite doivent etre capturees et loguees
- Les conflits de sync sont stockes dans `_sync_conflicts`, jamais silences

**Data Validation:**

- Validation cote client avant ecriture SQLite (memes regles que l'API)
- Montants toujours en entiers FCFA (pas de decimales)
- IDs generes localement via `generateId()` (UUID v4)

**Other Relevant Patterns:**

- Toutes les ecritures dans une transaction SQLite exclusive
- Mutation enqueue + fire-and-forget sync attempt apres chaque ecriture
- `SYNCABLE_ENTITIES` dans `schema.ts` doit etre mis a jour pour chaque nouvelle entite
- Le service sync API (`sync.service.ts`) utilise un mapping `SYNC_ENTITIES` pour router les mutations

---

## IMPLEMENTATION PLAN

### Phase 1: Nettoyage APK & Auth Offline (Fondation)

Nettoyer les dependances mortes, reduire la taille de l'APK, et implementer l'authentification PIN offline pour que l'app puisse demarrer sans reseau.

**Tasks:**

- Supprimer les dependances inutilisees (axios, zustand)
- Remplacer les imports lucide-react-native par les icones SimpleIcons existantes
- Ajouter une table `auth_cache` au schema SQLite pour stocker le hash PIN
- Implementer la verification PIN offline dans LoginPinScreen
- Gerer le cycle de vie des tokens JWT en mode offline
- Ajouter un cache RBAC local pour enforcement des permissions offline

### Phase 2: Extension Schema & Sync (Entites Manquantes)

Ajouter toutes les entites manquantes au schema SQLite local, creer les repositories correspondants, et etendre le moteur de sync pour les supporter.

**Tasks:**

- Ajouter les tables SQLite : `suppliers`, `supplier_debts`, `supplier_debt_payments`, `client_receivables`, `client_receivable_payments`, `payments`, `invoices`, `invoice_items`, `packaging_types`
- Creer les classes Repository pour chaque nouvelle entite
- Etendre `SYNCABLE_ENTITIES` dans schema.ts et sync.service.ts
- Implementer les hooks offline-first pour les nouvelles entites
- Migrer les ecrans existants (Suppliers, CustomerDetails, etc.) vers le mode offline-first

### Phase 3: Ecriture Offline Completes (CRUD)

Creer les fonctions d'ecriture offline pour toutes les operations CRUD sur les nouvelles entites.

**Tasks:**

- `createSupplierOffline()`, `updateSupplierOffline()`, `deleteSupplierOffline()`
- `createReceivableOffline()`, `addReceivablePaymentOffline()`
- `createDebtOffline()`, `addDebtPaymentOffline()`
- `createProductOffline()`, `updateProductOffline()`
- `createCustomerOffline()`, `updateCustomerOffline()`
- `createInvoiceOffline()` (generation locale de facture depuis une vente)
- Mettre a jour les ecrans pour utiliser les fonctions offline au lieu des appels API directs

### Phase 4: Rapports & KPIs Offline

Implementer les rapports et tableaux de bord entierement en local via des requetes SQLite agregees.

**Tasks:**

- Creer le module `reports.ts` avec les requetes agregees (ventes, caisse, stock, creances, dettes)
- Creer le hook `useOfflineReports()` pour alimenter les ecrans
- Migrer HomeScreen (KPIs) vers les donnees locales
- Migrer BusinessReportsScreen vers les donnees locales
- Ajouter un indicateur de fraicheur des donnees (badge vert/orange/rouge)

### Phase 5: Optimisation Sync & Retention

Optimiser le protocole de sync pour les contraintes reseau africaines et ajouter une politique de retention des donnees.

**Tasks:**

- Implementer la compression gzip sur les payloads sync
- Ajouter des intervalles adaptatifs (60s online, 5min batterie faible, backoff exponentiel offline)
- Ajouter une file de priorite (ventes/caisse d'abord, produits ensuite)
- Implementer la reprise de sync interrompue (cursor-based pagination)
- Ajouter une politique de purge (garder 90 jours en local, archiver le reste)
- Ameliorer la resolution de conflits (auto-resolve pour inventaire, LWW pour donnees de reference)

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Phase 1: Nettoyage APK & Auth Offline

#### 1.1 REMOVE dead dependencies from mobile package.json

- **IMPLEMENT**: Supprimer `axios` et `zustand` du `package.json` mobile. Verifier qu'aucun import n'existe dans le code mobile. Lancer `pnpm install` pour mettre a jour le lockfile.
- **PATTERN**: Verifier via grep que zero imports de `axios` ou `zustand` existent dans `apps/mobile/src/`
- **DEPENDENCIES**: Aucune
- **GOTCHA**: `axios` est importe dans `api.ts` sur web mais PAS sur mobile. Ne toucher que `apps/mobile/package.json`.
- **VALIDATE**: `cd apps/mobile && pnpm install && pnpm lint`
- **TEST_REQUIREMENT**: Lint passe sans erreur, app demarre correctement

#### 1.2 REPLACE lucide-react-native icons with SimpleIcons

- **IMPLEMENT**: Identifier tous les imports de `lucide-react-native` dans le code mobile. Pour chaque icone utilisee, verifier si un equivalent existe dans `SimpleIcons.tsx`. Si oui, remplacer l'import. Si non, ajouter l'icone SVG a SimpleIcons. Supprimer `lucide-react-native` du package.json.
- **PATTERN**: `apps/mobile/src/components/ui/SimpleIcons.tsx` - contient deja 47+ icones SVG
- **DEPENDENCIES**: Aucune
- **GOTCHA**: Verifier que les noms de props sont compatibles (size, color, etc.). SimpleIcons utilise `width`/`height`/`fill` vs lucide qui utilise `size`/`color`.
- **VALIDATE**: `cd apps/mobile && pnpm lint && pnpm test`
- **TEST_REQUIREMENT**: Tous les ecrans utilisant des icones s'affichent correctement

#### 1.3 CREATE auth_cache table in SQLite schema

- **IMPLEMENT**: Ajouter une table `auth_cache` dans `schema.ts` avec les champs : `user_id` (PK), `shop_id`, `shop_code`, `pin_hash` (bcrypt), `name`, `role`, `enabled_modules` (JSON), `work_days` (JSON), `work_start_time`, `work_end_time`, `cached_at`, `expires_at` (7 jours TTL). Incrementer la version du schema et ajouter une migration.
- **PATTERN**: Suivre le patron des tables existantes dans `schema.ts` (lignes 43-300)
- **DEPENDENCIES**: Aucune nouvelle dependance. Utiliser une librairie de hachage compatible React Native (expo-crypto ou bcryptjs).
- **GOTCHA**: Ne PAS stocker le PIN en clair. Utiliser un hash bcrypt avec salt. Le TTL doit etre de 7 jours max (aligne sur le refresh token). Stocker dans expo-secure-store si possible.
- **VALIDATE**: `cd apps/mobile && pnpm test`
- **TEST_REQUIREMENT**: `initDatabase()` cree la table sans erreur, migration fonctionne

#### 1.4 UPDATE LoginPinScreen for offline PIN verification

- **IMPLEMENT**: Modifier le flux de login dans `LoginPinScreen.tsx` pour tenter d'abord le login online (comportement actuel). En cas d'echec reseau, verifier le PIN contre le cache local (`auth_cache`). Sur login online reussi, mettre a jour le cache avec le hash du PIN. En mode offline, restaurer les tokens depuis AsyncStorage si non expires, sinon creer une session offline temporaire. Afficher un indicateur visuel "Mode hors-ligne" quand le login est offline.
- **PATTERN**: Flux actuel dans `LoginPinScreen.tsx` - modifier le handler `handleLogin`
- **DEPENDENCIES**: `auth_cache` table (tache 1.3)
- **GOTCHA**: Ne PAS permettre le premier login offline (l'utilisateur doit avoir fait au moins un login online pour peupler le cache). Verifier `expires_at` avant d'accepter le cache. Gerer le cas ou le PIN a ete change cote serveur (le cache sera invalide au prochain sync).
- **VALIDATE**: Test manuel : login online, couper le reseau, tenter login offline
- **TEST_REQUIREMENT**: Login offline fonctionne avec PIN cache valide, refuse avec PIN expire

#### 1.5 ADD offline RBAC enforcement

- **IMPLEMENT**: Lors du login online, stocker le role et les modules actives dans `auth_cache`. Creer un hook `useOfflinePermissions()` qui retourne le role et les modules depuis le cache local. Mettre a jour les ecrans qui verifient les permissions pour utiliser ce hook en fallback quand offline.
- **PATTERN**: Le role est deja stocke dans AsyncStorage via `useCurrentUser()`. Etendre ce patron.
- **DEPENDENCIES**: `auth_cache` table (tache 1.3)
- **GOTCHA**: En mode offline, les permissions peuvent etre stale (ex: role revoque). Accepter ce risque avec un TTL de 7 jours. Au prochain sync, les mutations seront validees cote serveur.
- **VALIDATE**: `cd apps/mobile && pnpm lint`
- **TEST_REQUIREMENT**: Hook retourne les bonnes permissions en mode offline

---

### Phase 2: Extension Schema & Sync

#### 2.1 ADD supplier tables to SQLite schema

- **IMPLEMENT**: Ajouter les tables `suppliers` et `supplier_debts` et `supplier_debt_payments` au schema SQLite. Les champs doivent miroir le schema Prisma. Ajouter les champs de sync metadata (`_sync_status`, `_server_id`, `_last_synced_at`). Ajouter les index pertinents (shop_id, is_active, supplier_id). Mettre a jour `SYNCABLE_ENTITIES`.
- **PATTERN**: Miroir exact du schema Prisma (`schema.prisma` modeles Supplier, SupplierDebt, SupplierDebtPayment) + metadata sync comme les tables existantes
- **DEPENDENCIES**: Aucune
- **GOTCHA**: Les foreign keys doivent referencer les tables locales. `supplier_debts.supplier_id` -> `suppliers.id`. S'assurer que les cascades de suppression sont correctes.
- **VALIDATE**: `cd apps/mobile && pnpm test`
- **TEST_REQUIREMENT**: `initDatabase()` cree les tables sans erreur

#### 2.2 ADD receivable tables to SQLite schema

- **IMPLEMENT**: Ajouter les tables `client_receivables` et `client_receivable_payments` au schema SQLite. Miroir du schema Prisma. Ajouter sync metadata et index (shop_id, customer_id, status).
- **PATTERN**: Meme patron que 2.1
- **DEPENDENCIES**: Table `customers` existante
- **GOTCHA**: `client_receivables.customer_id` -> `customers.id` (FK). Le champ `status` est un enum ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED') - stocker en TEXT dans SQLite.
- **VALIDATE**: `cd apps/mobile && pnpm test`
- **TEST_REQUIREMENT**: Tables creees sans erreur

#### 2.3 ADD payment and invoice tables to SQLite schema

- **IMPLEMENT**: Ajouter les tables `payments`, `invoices`, `invoice_items`, `packaging_types` au schema SQLite. Miroir du schema Prisma. Ajouter sync metadata.
- **PATTERN**: Meme patron que 2.1
- **DEPENDENCIES**: Tables existantes (`sales`, `customers`, `products`)
- **GOTCHA**: `invoices` a une relation avec `sales` (sale_id). `invoice_items` avec `invoices` et `products`. Les factures sont surtout en lecture offline (generees depuis une vente).
- **VALIDATE**: `cd apps/mobile && pnpm test`
- **TEST_REQUIREMENT**: Tables creees sans erreur

#### 2.4 CREATE repositories for new entities

- **IMPLEMENT**: Creer les classes `SupplierRepository`, `SupplierDebtRepository`, `SupplierDebtPaymentRepository`, `ClientReceivableRepository`, `ClientReceivablePaymentRepository`, `PaymentRepository`, `InvoiceRepository`, `InvoiceItemRepository`, `PackagingTypeRepository` dans `repositories.ts`. Chacune etend `LocalRepository<T>` avec les methodes specifiques necessaires (search, getBySupplier, getByCustomer, getStats, etc.).
- **PATTERN**: `ProductRepository`, `CustomerRepository`, `SaleRepository` dans `repositories.ts` - reproduire le patron
- **DEPENDENCIES**: Tables SQLite (taches 2.1-2.3)
- **GOTCHA**: Les types TypeScript doivent etre definis pour chaque entite. Utiliser les types existants comme reference.
- **VALIDATE**: `cd apps/mobile && pnpm lint && pnpm test`
- **TEST_REQUIREMENT**: Chaque repository peut effectuer CRUD basique

#### 2.5 EXTEND sync engine for new entities

- **IMPLEMENT**: Ajouter les nouvelles entites a `SYNCABLE_ENTITIES` dans `schema.ts`. Mettre a jour le moteur de sync (`sync.ts`) pour pousser et tirer les nouvelles entites. Cote API, ajouter les nouvelles entites au mapping `SYNC_ENTITIES` dans `sync.service.ts`. S'assurer que le pull inclut les nouvelles entites et que le push les accepte.
- **PATTERN**: Mapping existant dans `sync.service.ts` - ajouter les nouveaux modeles Prisma
- **DEPENDENCIES**: Repositories (tache 2.4), tables SQLite (taches 2.1-2.3)
- **GOTCHA**: L'ordre de sync est important pour les FK. Pull d'abord les parents (suppliers, customers) puis les enfants (debts, receivables, payments). Le push doit aussi respecter cet ordre.
- **VALIDATE**: `cd apps/api && pnpm test` + test manuel de sync
- **TEST_REQUIREMENT**: Sync pull ramene les nouvelles entites, sync push les envoie

#### 2.6 CREATE offline-first hooks for new entities

- **IMPLEMENT**: Creer les hooks `useLocalSuppliers()`, `useLocalSupplierDebts()`, `useLocalReceivables()`, `useLocalPayments()`, `useLocalInvoices()`, `useLocalPackagingTypes()`. Chaque hook lit depuis SQLite local et se rafraichit apres un sync. Utiliser le patron `useOfflineFirstQuery` existant.
- **PATTERN**: `useLocalProducts()`, `useLocalCustomers()`, `useLocalSales()` dans les hooks existants
- **DEPENDENCIES**: Repositories (tache 2.4)
- **GOTCHA**: Les hooks doivent ecouter les evenements sync pour se rafraichir automatiquement apres un pull.
- **VALIDATE**: `cd apps/mobile && pnpm lint`
- **TEST_REQUIREMENT**: Hooks retournent des donnees depuis SQLite local

#### 2.7 MIGRATE screens to offline-first mode

- **IMPLEMENT**: Mettre a jour les ecrans suivants pour utiliser les hooks offline-first au lieu des appels API directs :
  - `SuppliersScreen.tsx` : utiliser `useLocalSuppliers()` au lieu de `suppliersApi.getAll()`
  - `SupplierDetailsScreen.tsx` : utiliser donnees locales pour details + dettes
  - `CustomerDetailsScreen.tsx` : utiliser donnees locales pour creances
  - `ProductCatalogScreen.tsx` : s'assurer que le CRUD produit utilise les fonctions offline
  - `ProductBatchesScreen.tsx` : utiliser `useLocalStockBatches()`
    Ajouter un indicateur de fraicheur des donnees (derniere sync) sur chaque ecran.
- **PATTERN**: `SaleScreen.tsx` qui utilise deja `useLocalProducts()` et `useLocalCustomers()`
- **DEPENDENCIES**: Hooks offline (tache 2.6)
- **GOTCHA**: Garder le fallback API pour les cas ou les donnees locales sont vides (premier lancement). Afficher un message "Synchronisation en cours..." si les donnees locales sont vides.
- **VALIDATE**: Test manuel : naviguer dans les ecrans en mode offline
- **TEST_REQUIREMENT**: Tous les ecrans affichent des donnees en mode offline

---

### Phase 3: Ecriture Offline Completes

#### 3.1 ADD offline write functions for suppliers

- **IMPLEMENT**: Creer `createSupplierOffline()`, `updateSupplierOffline()`, `deleteSupplierOffline()` dans `offlineWrite.ts`. Chaque fonction ecrit en local, enqueue la mutation, et tente un sync. Pour les dettes : `createSupplierDebtOffline()`, `addDebtPaymentOffline()`.
- **PATTERN**: `createSaleOffline()`, `createCashEntryOffline()` dans `offlineWrite.ts`
- **DEPENDENCIES**: `SupplierRepository`, `SupplierDebtRepository` (tache 2.4)
- **GOTCHA**: Les paiements de dette doivent mettre a jour le solde du fournisseur localement. Verifier que le montant ne depasse pas le montant restant.
- **VALIDATE**: `cd apps/mobile && pnpm lint && pnpm test`
- **TEST_REQUIREMENT**: Creation fournisseur offline fonctionne, mutation enqueue

#### 3.2 ADD offline write functions for receivables

- **IMPLEMENT**: Creer `createReceivableOffline()`, `addReceivablePaymentOffline()`, `cancelReceivableOffline()`. Mettre a jour le solde client localement lors d'un paiement. Creer une entree de caisse correspondante si paiement en especes.
- **PATTERN**: `createCashEntryOffline()` dans `offlineWrite.ts`
- **DEPENDENCIES**: `ClientReceivableRepository` (tache 2.4), `CashEntryRepository` existant
- **GOTCHA**: Un paiement de creance genere aussi une entree de caisse (IN). Les deux doivent etre dans la meme transaction SQLite. Utiliser le meme `client_op_id` pour lier les mutations.
- **VALIDATE**: `cd apps/mobile && pnpm lint && pnpm test`
- **TEST_REQUIREMENT**: Paiement creance genere entree de caisse + mutation enqueue

#### 3.3 ADD offline write functions for products and customers

- **IMPLEMENT**: Creer `createProductOffline()`, `updateProductOffline()`, `deleteProductOffline()`, `createCustomerOffline()`, `updateCustomerOffline()`, `deleteCustomerOffline()`. Ces fonctions ecrivent en local et enqueue pour sync.
- **PATTERN**: `createSaleOffline()` dans `offlineWrite.ts`
- **DEPENDENCIES**: `ProductRepository`, `CustomerRepository` existants
- **GOTCHA**: La creation de produit doit generer un SKU unique localement si non fourni. Les soft deletes doivent marquer `deleted=1` et `deleted_at=now`. S'assurer que les produits supprimes ne sont plus visibles dans les listes mais restent en DB pour le sync.
- **VALIDATE**: `cd apps/mobile && pnpm lint && pnpm test`
- **TEST_REQUIREMENT**: CRUD produit/client offline complet

#### 3.4 ADD offline invoice generation

- **IMPLEMENT**: Creer `createInvoiceFromSaleOffline()` qui genere une facture locale a partir d'une vente. Assigner un numero de facture sequentiel local (prefix device_id pour eviter les collisions). Stocker les items de facture en local. La facture sera synchronisee et le numero potentiellement realigne cote serveur.
- **PATTERN**: `createSaleOffline()` pour la creation transactionnelle (sale + items)
- **DEPENDENCIES**: `InvoiceRepository`, `InvoiceItemRepository` (tache 2.4), `SaleRepository` existant
- **GOTCHA**: Le numero de facture doit etre unique. Utiliser un format `{device_id_short}-{sequence}` en local, le serveur reassignera un numero definitif au sync. Stocker les deux (local_number et server_number).
- **VALIDATE**: `cd apps/mobile && pnpm lint`
- **TEST_REQUIREMENT**: Facture generee depuis une vente offline

#### 3.5 UPDATE screens to use offline write functions

- **IMPLEMENT**: Remplacer tous les appels API directs par les fonctions offline dans :
  - `SuppliersScreen.tsx` : creation/modification fournisseur
  - `SupplierDetailsScreen.tsx` : paiement dette, remboursement
  - `CustomerDetailsScreen.tsx` : paiement creance, remboursement
  - `ProductCatalogScreen.tsx` : creation/modification produit
  - `StockManagementScreen.tsx` : deja partiellement offline, completer
  - `CashScreen.tsx` : deja partiellement offline, completer
    Conserver le feedback optimiste (UI mise a jour immediatement, sync en arriere-plan).
- **PATTERN**: `SaleScreen.tsx` qui utilise `createSaleOffline()` avec feedback immediat
- **DEPENDENCIES**: Fonctions offline (taches 3.1-3.4)
- **GOTCHA**: En cas d'echec d'ecriture locale (ex: contrainte unique violee), afficher un message d'erreur clair. Ne PAS silencer les erreurs.
- **VALIDATE**: Test manuel : creer un fournisseur offline, observer la sync au retour reseau
- **TEST_REQUIREMENT**: Toutes les operations CRUD fonctionnent offline

---

### Phase 4: Rapports & KPIs Offline

#### 4.1 CREATE reports module with SQLite aggregate queries

- **IMPLEMENT**: Creer `apps/mobile/src/db/reports.ts` avec des fonctions de requetes agregees :
  - `getDailySalesReport(shopId, date)` : total ventes, nombre, ventilation par methode de paiement
  - `getCashFlowReport(shopId, dateRange)` : entrees/sorties, solde, par categorie
  - `getStockReport(shopId)` : valeur stock total, produits en rupture, top vendeurs
  - `getReceivablesReport(shopId)` : total creances en cours, montant paye, par client
  - `getDebtsReport(shopId)` : total dettes en cours, montant paye, par fournisseur
  - `getTopProductsReport(shopId, dateRange)` : top N produits par quantite et CA
  - `getTopCustomersReport(shopId, dateRange)` : top N clients par CA
- **PATTERN**: Requetes SQL agregees simples (SUM, COUNT, GROUP BY) sur les tables locales
- **DEPENDENCIES**: Toutes les tables SQLite (Phase 2)
- **GOTCHA**: Les performances SQLite sur mobile sont bonnes pour < 100K records. Utiliser les index existants. Ne PAS creer de tables de pre-aggregation (sur-ingenierie).
- **VALIDATE**: `cd apps/mobile && pnpm lint && pnpm test`
- **TEST_REQUIREMENT**: Chaque fonction retourne des donnees correctes

#### 4.2 CREATE useOfflineReports hook

- **IMPLEMENT**: Creer `apps/mobile/src/hooks/useOfflineReports.ts` qui expose les fonctions de rapport via des hooks React. Chaque hook ecoute les evenements sync pour se rafraichir automatiquement. Ajouter un etat `lastSyncedAt` pour afficher la fraicheur.
- **PATTERN**: `useLocalCashBalance()` et `useOfflineStatus()` existants
- **DEPENDENCIES**: Module reports (tache 4.1)
- **GOTCHA**: Ne pas re-executer les requetes trop frequemment (debounce 5s apres sync).
- **VALIDATE**: `cd apps/mobile && pnpm lint`
- **TEST_REQUIREMENT**: Hook retourne des donnees agregees

#### 4.3 MIGRATE HomeScreen to offline reports

- **IMPLEMENT**: Remplacer les appels `cashApi.getStats()` et `cashApi.getAll()` dans HomeScreen par les requetes locales du module reports. Afficher les KPIs depuis SQLite local. Ajouter un badge de fraicheur (vert: < 10min, orange: > 1h, rouge: > 24h ou offline).
- **PATTERN**: L'ecran utilise deja `useLocalCashBalance()` - etendre ce patron
- **DEPENDENCIES**: Hook useOfflineReports (tache 4.2)
- **GOTCHA**: Le premier lancement avec une base vide doit afficher des zeros, pas des erreurs. Afficher "Synchronisation en cours..." si aucune donnee.
- **VALIDATE**: Test manuel : verifier les KPIs offline vs online
- **TEST_REQUIREMENT**: HomeScreen affiche des donnees coherentes en mode offline

#### 4.4 MIGRATE BusinessReportsScreen to offline reports

- **IMPLEMENT**: Remplacer les appels API dans BusinessReportsScreen par les requetes locales. Ajouter des filtres de date (aujourd'hui, semaine, mois, personnalise). Ajouter les rapports creances/dettes maintenant disponibles localement.
- **PATTERN**: Meme patron que HomeScreen (tache 4.3)
- **DEPENDENCIES**: Hook useOfflineReports (tache 4.2)
- **GOTCHA**: Les rapports doivent etre coherents avec les donnees affichees sur d'autres ecrans (memes totaux).
- **VALIDATE**: Test manuel : comparer rapports offline vs donnees API
- **TEST_REQUIREMENT**: Rapports affichent des donnees en mode offline

---

### Phase 5: Optimisation Sync & Retention

#### 5.1 ADD priority-based sync queue

- **IMPLEMENT**: Ajouter un champ `priority` (INTEGER, 1-5) a la table `_mutation_queue`. Les ventes et entrees de caisse = priorite 1 (critique). Les creances/dettes = priorite 2. Les produits/clients/fournisseurs = priorite 3. Mettre a jour `dequeuePending()` pour trier par priorite puis timestamp.
- **PATTERN**: `queue.ts` - modifier `dequeuePending()`
- **DEPENDENCIES**: Aucune
- **GOTCHA**: Migration schema necessaire. S'assurer que les mutations existantes sans priorite recoivent une valeur par defaut (3).
- **VALIDATE**: `cd apps/mobile && pnpm test`
- **TEST_REQUIREMENT**: Les mutations haute priorite sont envoyees en premier

#### 5.2 ADD adaptive sync intervals

- **IMPLEMENT**: Modifier le `SyncEngine` pour adapter l'intervalle de sync :
  - Online + batterie > 30% : 60 secondes (actuel)
  - Online + batterie < 30% : 5 minutes
  - Retour en ligne apres coupure : sync immediat
  - Offline : pas de tentative (actuel)
    Utiliser `expo-battery` (si disponible) ou une heuristique simple.
- **PATTERN**: `sync.ts` - modifier `start()` et `periodicSync()`
- **DEPENDENCIES**: Aucune nouvelle dependance requise (expo-battery est optionnel)
- **GOTCHA**: Ne PAS ajouter expo-battery si ca augmente significativement l'APK. Un intervalle fixe de 60s est acceptable comme fallback.
- **VALIDATE**: `cd apps/mobile && pnpm lint`
- **TEST_REQUIREMENT**: L'intervalle s'adapte correctement

#### 5.3 ADD data retention policy

- **IMPLEMENT**: Creer une fonction `pruneOldData(shopId, retentionDays = 90)` dans `schema.ts` ou un nouveau fichier `maintenance.ts`. Cette fonction supprime (hard delete) les enregistrements synchronises (`_sync_status = 'synced'`) plus vieux que `retentionDays` jours pour : `sales`, `sale_items`, `cash_entries`, `inventory_movements`, `payments`. Les produits, clients, fournisseurs ne sont JAMAIS purges. Executer cette fonction une fois par jour au demarrage de l'app.
- **PATTERN**: `resetDatabase()` dans `schema.ts` pour le patron de nettoyage
- **DEPENDENCIES**: Aucune
- **GOTCHA**: Ne JAMAIS purger des enregistrements avec `_sync_status = 'pending'` (pas encore synchronises). Verifier avant de supprimer. Purger d'abord les enfants (sale_items) puis les parents (sales) pour respecter les FK.
- **VALIDATE**: `cd apps/mobile && pnpm test`
- **TEST_REQUIREMENT**: Seuls les vieux enregistrements synchronises sont supprimes

#### 5.4 IMPROVE conflict auto-resolution

- **IMPLEMENT**: Ajouter une strategie de resolution automatique dans `sync.ts` :
  - **Donnees de reference** (products, customers, suppliers) : Last-Write-Wins (accepter le serveur)
  - **Mouvements d'inventaire** : merge delta (les deductions de stock sont additives/commutatives)
  - **Donnees financieres** (sales, cash_entries, receivables, debts) : JAMAIS auto-resolve, toujours manuel
    Ajouter un champ `auto_resolved` a `_sync_conflicts` pour tracer les resolutions automatiques.
- **PATTERN**: `storeConflict()` et `resolveConflict()` dans `sync.ts`
- **DEPENDENCIES**: Aucune
- **GOTCHA**: Le merge delta pour l'inventaire est simple (somme des deltas) mais doit etre teste soigneusement. Ne PAS auto-resolve les conflits de prix.
- **VALIDATE**: `cd apps/mobile && pnpm test`
- **TEST_REQUIREMENT**: Les conflits de produits sont auto-resolus, les conflits de ventes restent manuels

---

## TESTING STRATEGY

**MANDATORY REQUIREMENT**: All implementation tasks MUST have corresponding tests that validate functionality.

### Unit Tests

**Scope**: Toutes les nouvelles fonctions de base de donnees, repositories, fonctions offline write, et fonctions de rapport
**Requirements**:

- Framework: Jest (deja configure pour le mobile)
- Mocker expo-sqlite pour les tests unitaires
- Tester chaque repository method (CRUD, search, aggregate)
- Tester chaque offline write function (creation, enqueue, erreurs)
- **VALIDATION COMMAND**: `cd apps/mobile && pnpm test`

**Test Categories Required**:

- Happy path : creation, lecture, mise a jour, suppression offline
- Erreurs : contraintes violees, donnees invalides, base vide
- Validation : montants negatifs, champs requis manquants
- Logique metier : FIFO deduction, calcul soldes, generation facture

### Integration Tests

**Scope**: Sync push/pull avec les nouvelles entites, auth offline
**Requirements**:

- Tester le flux complet : ecriture locale -> enqueue -> push -> serveur accepte
- Tester le pull : serveur -> local -> donnees accessibles via hooks
- Tester l'auth offline : login online -> cache -> login offline
- **VALIDATION COMMAND**: `cd apps/api && pnpm test && pnpm test:e2e`

**Test Scenarios Required**:

- Sync complete d'un fournisseur cree offline
- Paiement de dette cree offline avec entree de caisse liee
- Conflit de mise a jour produit resolu automatiquement
- Login PIN offline apres cache

### Edge Cases

**MANDATORY EDGE CASES TO TEST**:

- Premier lancement sans reseau (base vide, pas de cache auth)
- 1000+ mutations en queue (depassement de capacite)
- Sync interrompu a mi-chemin (reprise)
- Meme entite modifiee sur 2 appareils offline
- Suppression d'un fournisseur qui a des dettes en cours
- Paiement de creance depassant le montant restant
- Expiration du cache auth (7 jours sans reseau)
- Base SQLite corrompue (reset et resync)

### Test Resources

**Testing Documentation Links**:

- Jest documentation: https://jestjs.io/docs/getting-started
- React Native Testing Library: https://callstack.github.io/react-native-testing-library/
- Expo SQLite testing: https://docs.expo.dev/versions/latest/sdk/sqlite/

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
pnpm --filter @swalo/mobile run lint
pnpm --filter @swalo/api run lint
pnpm run format:check
```

**Expected Result**: Zero errors, zero warnings (warnings existants acceptes)

### Level 2: Unit Tests

```bash
pnpm --filter @swalo/mobile run test
pnpm --filter @swalo/api run test
```

**Expected Result**: Tous les tests passent, aucun test saute

### Level 3: Integration Tests

```bash
pnpm --filter @swalo/api run test:e2e
```

**Expected Result**: Tous les tests E2E passent

### Level 4: Type Checking

```bash
pnpm --filter @swalo/mobile run type-check
pnpm --filter @swalo/api run type-check
```

**Expected Result**: Zero erreurs TypeScript

### Level 5: Manual Validation

**Test offline complet:**

1. Demarrer l'app avec reseau -> login PIN -> verifier que le cache est peuple
2. Couper le reseau (mode avion)
3. Fermer et relancer l'app -> login PIN offline -> verifier acces
4. Creer un fournisseur offline
5. Creer une vente offline
6. Creer une entree de caisse offline
7. Naviguer dans les rapports -> verifier les KPIs
8. Reactiver le reseau -> observer la sync automatique
9. Verifier cote serveur que toutes les donnees sont arrivees
10. Verifier que les conflits eventuels sont affiches

**Test de retention:**

1. Peupler la base avec > 100 jours de donnees
2. Declencher la purge
3. Verifier que seules les donnees > 90 jours et synchronisees sont supprimees

---

## ACCEPTANCE CRITERIA

**MANDATORY REQUIREMENTS - ALL MUST BE MET**:

- [ ] L'app demarre et fonctionne entierement sans reseau (apres au moins un login online initial)
- [ ] Login PIN offline fonctionne avec cache valide (TTL 7 jours)
- [ ] CRUD complet offline pour : produits, clients, fournisseurs, creances, dettes, ventes, caisse
- [ ] Rapports et KPIs accessibles offline avec indicateur de fraicheur
- [ ] Sync automatique et transparente au retour du reseau
- [ ] Resolution automatique des conflits pour donnees de reference (produits, clients, fournisseurs)
- [ ] Resolution manuelle preservee pour donnees financieres (ventes, creances, dettes)
- [ ] Politique de retention : donnees > 90 jours purgees automatiquement
- [ ] Taille APK : pas d'augmentation > 2 MB par rapport a l'APK actuel
- [ ] Dependances mortes supprimees (axios, zustand, lucide-react-native)
- [ ] **ALL validation commands executed and pass with zero errors**
- [ ] **ALL unit tests pass**
- [ ] **ALL integration tests pass**
- [ ] Code suit les conventions du projet (CLAUDE.md)
- [ ] Pas de regression sur les fonctionnalites existantes
- [ ] `docs/specs/features-catalog.md` mis a jour avec les nouvelles capacites offline

---

## COMPLETION CHECKLIST

**MANDATORY - EVERY ITEM MUST BE CHECKED BEFORE COMPLETION**:

- [ ] Phase 1 complete : nettoyage APK + auth offline
- [ ] Phase 2 complete : nouvelles entites synchees
- [ ] Phase 3 complete : CRUD offline complet
- [ ] Phase 4 complete : rapports offline
- [ ] Phase 5 complete : optimisation sync + retention
- [ ] Tous les tests unitaires ecrits et passent
- [ ] Tous les tests d'integration passent
- [ ] Tests E2E passent
- [ ] Validation manuelle complete (10 etapes)
- [ ] Format check passe (prettier)
- [ ] Lint passe (eslint)
- [ ] Type check passe (tsc)
- [ ] Features catalog mis a jour
- [ ] Pas de regression

---

## EXTERNAL RESOURCES AND REFERENCES

### Official Documentation

- Expo SQLite: https://docs.expo.dev/versions/latest/sdk/sqlite/
- Expo SecureStore: https://docs.expo.dev/versions/latest/sdk/securestore/
- Expo Network: https://docs.expo.dev/versions/latest/sdk/network/
- Expo Device: https://docs.expo.dev/versions/latest/sdk/device/
- React Navigation: https://reactnavigation.org/docs/getting-started
- NestJS Guards: https://docs.nestjs.com/guards
- Prisma Client: https://www.prisma.io/docs/concepts/components/prisma-client

### Internal Resources

- Schema Prisma: `apps/api/prisma/schema.prisma`
- Module registry: `packages/core/src/modules/registry.ts`
- Features catalog: `docs/specs/features-catalog.md`
- Development workflow: `docs/guides/development-workflow.md`
- Architecture: `CLAUDE.md`

### Existing Patterns to Reference

- Offline write: `apps/mobile/src/db/offlineWrite.ts`
- Sync engine: `apps/mobile/src/db/sync.ts`
- Repository pattern: `apps/mobile/src/db/repository.ts`
- Hooks offline-first: `apps/mobile/src/hooks/`
- API sync service: `apps/api/src/modules/sync/sync.service.ts`

---

## NOTES

**Decisions architecturales:**

- Garder expo-sqlite (pas de migration vers WatermelonDB/Realm/PowerSync). L'architecture actuelle est solide et extensible. Une migration pourrait etre envisagee plus tard si la complexite explose.
- Le hash bcrypt pour le PIN offline est un compromis securite/usabilite accepte. TTL de 7 jours max.
- Les rapports sont calcules en temps reel via SQLite (pas de pre-aggregation). Les volumes de donnees (< 100K records) le permettent sur mobile.
- La purge a 90 jours est un compromis espace disque/historique. Les donnees completes restent sur le serveur.

**Consensus des 8 agents strategiques:**

- 8/8 recommandent de garder expo-sqlite et etendre incrementalement
- 8/8 recommandent la suppression des dependances mortes
- 7/8 recommandent l'approche tiered (priorites par entite)
- 8/8 donnent un score de confiance >= 8/10

**Contraintes specifiques Afrique Centrale:**

- Reseau lent et couteux : minimiser les payloads de sync
- Telephones a stockage limite : garder l'APK < 50 MB
- Coupures frequentes et longues : l'app doit fonctionner indefiniment offline
- Faible bande passante : la premiere sync complete doit etre rapide (< 2 min pour une boutique typique)

<!-- EOF -->
