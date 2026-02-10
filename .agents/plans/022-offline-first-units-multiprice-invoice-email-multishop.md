# Feature: 022 - Mode Offline, Unites Produits, Gestion Multi-Prix, Facturation PDF, Notifications Email, Multi-Boutiques

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

---

## Feature Description

Ce plan couvre **6 fonctionnalites majeures** demandees pour faire evoluer SWALO d'un ERP connecte vers un ERP offline-first, multi-boutiques et complet :

1. **Mode Offline-First** : L'application mobile doit fonctionner sans connexion internet. Les donnees sont stockees localement et synchronisees automatiquement lorsque la connexion revient.
2. **Unites/Formats produits** : Ajout d'une liste deroulante parametrable (piece, douzaine, carton, paquet, etc.) pour les unites de conditionnement des produits.
3. **Gestion de stock multi-prix avancee** : Lors d'une mise a jour de stock, signalement du nouveau prix de revient. Si different, l'ancien stock conserve son prix et le nouveau a son prix propre. Lors de la vente, destockage FIFO avec choix obligatoire du prix unitaire pour les produits multi-prix.
4. **Facturation PDF** : Generation et impression d'une facture PDF depuis l'onglet vente mobile.
5. **Notifications email clients** : Information par email a chaque mouvement de solde client et recapitulatif mensuel.
6. **Multi-boutiques & entreprise** : Gestion autonome de chaque boutique avec lien entre boutiques d'une meme entreprise. Livraisons inter-boutiques (magasin vers boutique = vente/achat automatique croisee).

## User Stories

### US1 - Mode Offline

En tant que **caissier/vendeur**, je veux pouvoir creer des ventes, entrees de caisse et mouvements de stock meme sans connexion internet, afin de ne jamais bloquer l'activite de la boutique.

### US2 - Unites Produits

En tant que **gestionnaire**, je veux choisir l'unite de conditionnement d'un produit (piece, douzaine, carton, paquet...) via une liste parametrable, afin de refleter fidement le mode de vente.

### US3 - Stock Multi-Prix Avance

En tant que **gestionnaire de stock**, je veux que chaque lot de marchandise conserve son propre prix de revient et de vente, et que le vendeur soit contraint de choisir le prix correct lors de la vente d'un article multi-prix, afin de garantir un destockage et une comptabilite precis.

### US4 - Facturation PDF

En tant que **vendeur**, je veux generer et partager une facture PDF directement depuis l'ecran de vente sur mobile, afin de fournir un justificatif professionnel au client.

### US5 - Notifications Email Clients

En tant que **client de la boutique**, je veux etre informe par email de chaque mouvement de mon solde et recevoir un recapitulatif mensuel, afin de suivre ma situation avec la boutique.

### US6 - Multi-Boutiques Entreprise

En tant que **proprietaire d'entreprise**, je veux lier mes boutiques entre elles pour que les livraisons entre un magasin et une boutique creent automatiquement les ecritures correspondantes (vente/sortie cote magasin, achat/entree cote boutique), tout en gardant l'autonomie de gestion de chaque boutique.

## Problem Statement

- L'application est inutilisable sans connexion internet, ce qui est courant en Afrique Centrale
- Pas de choix d'unite de conditionnement flexible pour les produits
- Le systeme FIFO multi-prix existe (Phase 2) mais ne force pas le choix du prix lors de la vente
- Aucune facturation PDF n'est disponible
- Aucune notification client n'existe
- Les boutiques sont completement isolees, sans concept d'entreprise ni de transferts inter-boutiques

## Solution Statement

Implementer les 6 fonctionnalites en 6 phases independantes, ordonnees par priorite business et complexite technique. Chaque phase est deployable independamment.

## Feature Metadata

**Feature Type**: New Capability (6 features)
**Estimated Complexity**: Very High (6 phases, ~3-4 mois de travail)
**Primary Systems Affected**: apps/api, apps/mobile, apps/web, packages/core, prisma/schema
**Dependencies**:

- Phase 1 (Offline): expo-sqlite, @nozbe/watermelondb OU expo-sqlite/next
- Phase 4 (PDF): react-native-html-to-pdf, expo-sharing, expo-print
- Phase 5 (Email): @nestjs-modules/mailer, nodemailer, handlebars
- Phase 6 (Multi-shop): Prisma schema extensions

---

## CONTEXT REFERENCES

### Relevant Codebase Files - MUST READ BEFORE IMPLEMENTING

**Database & Schema:**

- `apps/api/prisma/schema.prisma` - Schema complet (744 lignes) avec tous les modeles, enums, relations. Contient deja DeviceSyncState, StockBatch, PackagingType
- `packages/core/src/schemas/sync.ts` - Schemas Zod pour sync (SyncPullRequest/Response, SyncPushRequest/Response, Mutation, DeviceSyncState)
- `packages/core/src/schemas/product.ts` - Schema produit avec champ `unit` existant
- `packages/core/src/schemas/sale.ts` - Schema vente avec CreateSaleInput
- `packages/core/src/schemas/invoice.ts` - Schema facture (existe deja mais non implemente)
- `packages/core/src/schemas/common.ts` - Types de base: UUID, Currency, Role, SyncFields, enums

**API Modules:**

- `apps/api/src/modules/sync/` - Module sync VIDE (a implementer)
- `apps/api/src/modules/products/products.service.ts` - Service produits avec getAvailablePrices(), calculateStock()
- `apps/api/src/modules/products/products.controller.ts` - Endpoints produits incluant GET /:id/prices
- `apps/api/src/modules/inventory/inventory.service.ts` - FIFO destocking (deductStockFIFO, deductFromBatch, createStockBatch)
- `apps/api/src/modules/sales/sales.service.ts` - Creation vente avec FIFO (lignes 151-340), annulation avec restauration batch
- `apps/api/src/modules/customers/customers.service.ts` - CRUD clients avec stats, merge, refunds
- `apps/api/src/modules/receivables/receivables.service.ts` - Gestion creances avec paiements
- `apps/api/src/modules/invoices/` - Module factures (schema pret, service non implemente)
- `apps/api/src/modules/admin/admin.service.ts` - Gestion multi-shop SUPERADMIN
- `apps/api/src/modules/auth/auth.service.ts` - Auth PIN + email, JWT avec shopId
- `apps/api/src/modules/packaging-types/` - Types d'emballage parametrables par boutique

**Mobile:**

- `apps/mobile/src/lib/api.ts` - Client API avec retry, timeout 30s, auto-logout 401, device_id SecureStore
- `apps/mobile/src/screens/SaleScreen.tsx` - Ecran vente (cash + credit, pas de Sale API centralise)
- `apps/mobile/src/screens/POSScreen.tsx` - Ecran caisse (1327 lignes)
- `apps/mobile/src/screens/ProductCatalogScreen.tsx` - Catalogue produits avec import batch
- `apps/mobile/src/screens/StockManagementScreen.tsx` - Gestion stock avec creation batch
- `apps/mobile/src/screens/products/ProductBatchesScreen.tsx` - Visualisation lots FIFO
- `apps/mobile/App.tsx` - Navigation racine (stack)
- `apps/mobile/src/navigation/MainTabNavigator.tsx` - Tabs principaux

**Web:**

- `apps/web/src/lib/api.ts` - Client API web Axios
- `apps/web/src/pages/` - Pages web (dashboard, produits, ventes)

**Tests:**

- `apps/api/test/fifo-destock.spec.ts` - 12 tests FIFO existants (pattern a suivre)

**Documentation:**

- `docs/specs/cahier-des-charges-unifie.md` - Specifications fonctionnelles v2.0
- `docs/architecture/overview.md` - Architecture technique avec strategie sync documentee

### New Files to Create

**Phase 1 - Offline:**

- `apps/mobile/src/db/schema.ts` - Schema base locale (WatermelonDB ou SQLite)
- `apps/mobile/src/db/models/` - Modeles locaux pour chaque entite
- `apps/mobile/src/db/sync.ts` - Moteur de synchronisation (pull/push)
- `apps/mobile/src/db/queue.ts` - File d'attente des operations offline
- `apps/mobile/src/hooks/useOfflineStatus.ts` - Hook etat connexion
- `apps/mobile/src/components/OfflineBanner.tsx` - Indicateur visuel offline
- `apps/api/src/modules/sync/sync.service.ts` - Service sync API
- `apps/api/src/modules/sync/sync.controller.ts` - Endpoints sync (pull/push)
- `apps/api/src/modules/sync/dto/` - DTOs sync
- `packages/core/src/schemas/sync.ts` - Mettre a jour schemas sync existants

**Phase 2 - Unites:**

- `apps/api/src/modules/packaging-types/dto/` - DTOs mise a jour si necessaire
- Pas de nouveaux fichiers majeurs, principalement des modifications

**Phase 3 - Multi-Prix Avance:**

- Modifications dans les fichiers existants (sales, products, mobile screens)

**Phase 4 - PDF:**

- `apps/mobile/src/utils/invoiceTemplate.ts` - Template HTML facture
- `apps/mobile/src/utils/pdfGenerator.ts` - Generateur PDF
- `apps/api/src/modules/invoices/invoices.service.ts` - Service factures API
- `apps/api/src/modules/invoices/invoices.controller.ts` - Endpoints factures

**Phase 5 - Email:**

- `apps/api/src/modules/notifications/` - Module notifications
- `apps/api/src/modules/notifications/notifications.service.ts` - Service envoi email
- `apps/api/src/modules/notifications/templates/` - Templates email Handlebars
- `apps/api/src/modules/notifications/notifications.module.ts` - Module NestJS

**Phase 6 - Multi-Boutiques:**

- Modifications schema Prisma (Enterprise, ShopGroup, InterShopTransfer models)
- `apps/api/src/modules/enterprise/` - Module entreprise
- `apps/api/src/modules/transfers/` - Module transferts inter-boutiques
- Ecrans mobile et web pour gestion entreprise

### Patterns to Follow

**Naming Conventions:**

- Modules NestJS: kebab-case pour dossiers, PascalCase pour classes (ex: `sync.service.ts` → `SyncService`)
- Prisma models: PascalCase singulier (ex: `Enterprise`, `InterShopTransfer`)
- Schemas Zod: PascalCase + Schema suffix (ex: `EnterpriseSchema`)
- Mobile screens: PascalCase + Screen suffix (ex: `InvoiceScreen.tsx`)
- Fichiers source packages/core: camelCase (ex: `enterprise.ts`)

**Error Handling:**

- API: Utiliser les exceptions NestJS (`NotFoundException`, `BadRequestException`, `ConflictException`)
- Transactions Prisma: `$transaction` avec rollback automatique
- Mobile: try/catch avec Alert.alert pour erreurs utilisateur

**Data Validation:**

- Zod schemas dans packages/core pour validation partagee
- DTOs NestJS avec class-validator dans apps/api
- Double validation: client (Zod) + serveur (class-validator + Prisma constraints)

**Monetary Values:**

- Toujours en entiers FCFA (pas de decimales)
- Type `Currency` = `z.number().int().nonnegative()`

**Idempotency:**

- Format client*op_id: `{prefix}*{device*id}*{timestamp}\_{random}`
- Contrainte unique sur `[device_id, client_op_id]` pour operations critiques

**Multi-Tenancy:**

- Toujours filtrer par `shop_id` depuis le JWT payload
- Pattern: `const shopId = user.shopId` dans chaque controller

---

## IMPLEMENTATION PLAN

### Phase 1: Mode Offline-First (PRIORITE MAXIMALE)

**Description:** Transformer l'application mobile en application offline-first avec synchronisation automatique.

**Sous-phases:**

#### Phase 1.1: Infrastructure Base Locale

- Integrer une base de donnees locale (expo-sqlite ou WatermelonDB)
- Creer le schema local miroir des entites critiques (Product, StockBatch, Customer, Sale, SaleItem, CashEntry, InventoryMovement)
- Implementer la couche d'acces aux donnees locale

#### Phase 1.2: File d'Attente Operations (Mutation Queue)

- Creer une queue persistante pour les operations effectuees offline
- Chaque operation stockee avec: entity, op (insert/update/delete), data, client_op_id, device_id, timestamp
- Queue ordonnee par timestamp (FIFO pour le replay)

#### Phase 1.3: Moteur de Synchronisation API

- Implementer `POST /sync/pull` : le client envoie son dernier cursor/timestamp, le serveur retourne les changements depuis
- Implementer `POST /sync/push` : le client envoie ses mutations locales, le serveur les applique avec resolution de conflits
- Utiliser le modele `DeviceSyncState` deja present dans le schema
- Strategie de resolution: Last-Write-Wins (LWW) base sur timestamp + version, avec exceptions pour les operations financieres (server-wins)

#### Phase 1.4: Integration Mobile

- Modifier tous les ecrans pour lire/ecrire depuis la base locale
- Ajouter un hook `useOfflineStatus` (NetInfo) pour detecter l'etat connexion
- Ajouter un composant `OfflineBanner` visible quand offline
- Implementer la sync automatique au retour de connexion
- Sync periodique en arriere-plan quand connecte (toutes les 30s-60s)

#### Phase 1.5: Gestion des Conflits

- Pour les ventes: le serveur valide le stock au moment du push (peut rejeter si stock insuffisant)
- Pour les mouvements de caisse: server-wins en cas de conflit
- Pour les produits/clients: LWW avec version field
- Notifier l'utilisateur des conflits resolus via une liste consultable

---

### Phase 2: Unites/Formats Produits Parametrables

**Description:** Rendre l'unite de conditionnement des produits parametrable par boutique.

**Taches:**

- Exploiter le modele `PackagingType` existant dans le schema Prisma (deja present)
- Ajouter les valeurs par defaut: piece, douzaine, carton, paquet
- Creer un ecran de parametrage des unites dans les settings mobile et web
- Modifier le formulaire de creation/edition produit pour utiliser une liste deroulante alimentee par `PackagingType`
- Mettre a jour le champ `Product.unit` pour referencer `PackagingType` au lieu d'un string libre
- Ajouter la gestion CRUD complete des `PackagingType` dans le module existant

---

### Phase 3: Stock Multi-Prix Avance (Evolution Phase 2 FIFO)

**Description:** Ameliorer le systeme FIFO multi-prix existant pour forcer le choix du prix lors de la vente.

**Taches:**

- Lors de la creation d'un batch (`createStockBatch`), si le `cost_price` ou `sell_price` differe du dernier batch actif, afficher clairement la difference a l'utilisateur
- Modifier l'ecran de vente mobile : quand un produit a plusieurs prix actifs (batches avec `remaining_quantity > 0` et `sell_price` differents), afficher un selecteur de prix obligatoire
- Chaque choix de prix determine le batch source pour le destockage (utiliser `deductFromBatch` au lieu de `deductStockFIFO` quand le prix est choisi manuellement)
- Mettre a jour l'API `/products/:id/prices` pour retourner les batches actifs groupes par prix avec quantites disponibles
- Ajouter un indicateur visuel dans le catalogue quand un produit a des prix multiples

---

### Phase 4: Facturation PDF

**Description:** Generer et partager des factures PDF depuis l'application mobile.

**Taches:**

- Implementer le service `InvoicesService` cote API (le schema Invoice existe deja dans Prisma)
- Creer un template HTML de facture aux normes CEMAC/Afrique Centrale (nom boutique, NIF, adresse, date, items, totaux, mentions legales)
- Utiliser `expo-print` et `expo-sharing` sur mobile pour generer le PDF depuis le HTML
- Ajouter un bouton "Imprimer facture" sur l'ecran de confirmation de vente
- Generer automatiquement un numero de facture sequentiel par boutique (format: `{SHOP_CODE}-{ANNEE}-{SEQ}`)
- Stocker le lien PDF dans `Invoice.pdf_url` (optionnel: upload vers stockage cloud)
- Permettre de re-generer/re-imprimer une facture depuis l'historique des ventes

---

### Phase 5: Notifications Email Clients

**Description:** Informer les clients par email de chaque mouvement de solde et envoyer un recapitulatif mensuel.

**Taches:**

- Integrer `@nestjs-modules/mailer` avec Nodemailer et un provider SMTP (SendGrid, Brevo/Sendinblue, ou Mailgun - tier gratuit)
- Creer un module `notifications` dans l'API
- Templates email Handlebars :
  - `balance-movement.hbs` : notification de mouvement (montant, solde avant/apres, date, boutique)
  - `monthly-summary.hbs` : recapitulatif mensuel (liste mouvements, solde debut/fin mois, total achats/paiements)
- Declencher l'envoi d'email a chaque :
  - Creation de `ClientReceivable` (nouvelle dette)
  - Paiement sur `ClientReceivablePayment` (paiement recu)
  - Remboursement client
- Implementer un CRON job (`@nestjs/schedule`) pour le recapitulatif mensuel (1er du mois)
- Gerer les cas sans email (skip silencieux)
- Ajouter un flag `email_notifications_enabled` sur le modele Customer

---

### Phase 6: Multi-Boutiques & Entreprise

**Description:** Permettre de regrouper des boutiques en entreprise et gerer les transferts inter-boutiques.

**Taches:**

#### Phase 6.1: Modele Entreprise

- Creer un modele `Enterprise` (id, name, code, owner_id)
- Creer un modele `ShopGroup` ou ajouter `enterprise_id` nullable sur `Shop`
- Definir les types de boutique: `MAGASIN` (grossiste/entrepot), `BOUTIQUE` (detail)
- Un shop peut exister sans entreprise (backward compatible)

#### Phase 6.2: Transferts Inter-Boutiques

- Creer un modele `InterShopTransfer` (id, enterprise_id, source_shop_id, target_shop_id, status, items, created_by)
- Workflow de livraison:
  1. Le magasin cree un transfert (= vente sortante) → `Sale` cote source + `InventoryMovement` type SALE
  2. Automatiquement, une entree d'achat est creee cote boutique cible → `InventoryMovement` type PURCHASE + `StockBatch` avec les prix du transfert
  3. Le transfert peut etre en DRAFT, SHIPPED, RECEIVED, CANCELLED
- Chaque boutique reste autonome pour ses propres achats externes

#### Phase 6.3: Vue Consolidee Entreprise

- Dashboard entreprise avec KPIs agreges (CA total, stock total, dettes/creances consolidees)
- Liste des transferts inter-boutiques avec statuts
- Rapports consolides par periode

#### Phase 6.4: Navigation Mobile Multi-Boutiques

- Permettre le switch de boutique sans re-login complet (si l'utilisateur a des roles dans plusieurs boutiques de la meme entreprise)
- Menu "Mes boutiques" dans l'ecran "Plus"
- Badge/indicateur de la boutique active

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

---

### PHASE 1: MODE OFFLINE-FIRST

#### Task 1.1: CREATE Base de donnees locale mobile

- **IMPLEMENT**: Installer et configurer `expo-sqlite` (ou `@nozbe/watermelondb`) dans `apps/mobile`. Creer le schema de la base locale avec les tables miroir des entites critiques: `products`, `stock_batches`, `customers`, `sales`, `sale_items`, `cash_entries`, `inventory_movements`. Chaque table doit avoir les memes champs que le schema Prisma plus un champ `_sync_status` (synced/pending/conflict) et `_server_id` (UUID du serveur).
- **PATTERN**: Suivre la structure du schema Prisma dans `apps/api/prisma/schema.prisma` pour les noms de colonnes et types. Suivre les schemas Zod de `packages/core/src/schemas/` pour la validation.
- **DEPENDENCIES**: `expo-sqlite` (Expo SDK), ou `@nozbe/watermelondb` + `@nozbe/watermelondb/adapters/sqlite`
- **GOTCHA**: WatermelonDB necessite une configuration native specifique avec Expo prebuild. expo-sqlite est plus simple a integrer avec Expo managed workflow. Evaluer les deux options et choisir la plus adaptee au workflow Expo existant.
- **RESOURCES**:
  - https://docs.expo.dev/versions/latest/sdk/sqlite/
  - https://watermelondb.dev/docs/Installation
  - https://docs.expo.dev/versions/latest/sdk/sqlite-next/
- **VALIDATE**: `cd apps/mobile && npx expo install expo-sqlite && npx expo start` (l'app demarre sans erreur)
- **TEST_REQUIREMENT**: Test unitaire verifiant la creation des tables et l'insertion/lecture de donnees

#### Task 1.2: CREATE Couche d'acces donnees locale

- **IMPLEMENT**: Creer des fonctions CRUD pour chaque entite locale (getAll, getById, create, update, delete) dans `apps/mobile/src/db/`. Ces fonctions doivent ecrire dans la base locale et marquer les enregistrements comme `pending` pour la sync. Implementer un pattern Repository pour chaque entite.
- **PATTERN**: Suivre le pattern des methodes du client API existant dans `apps/mobile/src/lib/api.ts` (productsApi.getAll, create, update, etc.) pour garder la meme interface.
- **DEPENDENCIES**: Base locale de Task 1.1
- **GOTCHA**: Les IDs doivent etre generes cote client (UUID v4) pour fonctionner offline. Le champ `client_op_id` doit suivre le format existant: `{prefix}_{device_id}_{timestamp}_{random}`.
- **VALIDATE**: Tests unitaires pour chaque operation CRUD sur chaque entite
- **TEST_REQUIREMENT**: Au minimum 1 test par entite couvrant insert, read, update, soft-delete

#### Task 1.3: CREATE File d'attente des mutations (Mutation Queue)

- **IMPLEMENT**: Creer une table `_mutation_queue` dans la base locale avec les champs: id, entity, op (insert/upsert/update/delete), entity_id, data (JSON), client_op_id, device_id, timestamp, status (pending/processing/applied/failed), error_message. Implementer les fonctions: enqueueMutation(), dequeuePending(), markApplied(), markFailed(), getPendingCount().
- **PATTERN**: Suivre le schema `Mutation` defini dans `packages/core/src/schemas/sync.ts`
- **DEPENDENCIES**: Base locale de Task 1.1
- **GOTCHA**: La queue doit etre persistante (survivre au redemarrage de l'app). L'ordre d'execution doit etre strictement FIFO par timestamp.
- **VALIDATE**: Test: creer 5 mutations, les dequeue dans l'ordre, verifier FIFO
- **TEST_REQUIREMENT**: Tests couvrant enqueueing, dequeuing FIFO, marking status, error recovery

#### Task 1.4: UPDATE Endpoints API Sync - Pull

- **IMPLEMENT**: Implementer `POST /sync/pull` dans le module sync existant (`apps/api/src/modules/sync/`). Le endpoint recoit `{ device_id, last_sync_at, entity_versions }` et retourne les enregistrements modifies depuis `last_sync_at` pour chaque entite, filtres par `shop_id`. Retourner aussi un `cursor` (timestamp du dernier enregistrement) et `server_time`. Paginer les resultats (max 500 enregistrements par entite). Mettre a jour `DeviceSyncState` apres chaque pull reussi.
- **PATTERN**: Utiliser le schema `SyncPullRequest`/`SyncPullResponse` de `packages/core/src/schemas/sync.ts`. Suivre le pattern des services existants pour le filtrage `shop_id`.
- **DEPENDENCIES**: Module sync existant (vide), modele DeviceSyncState dans schema Prisma
- **GOTCHA**: Inclure les enregistrements soft-deleted (le client doit savoir supprimer localement). Attention aux fuseaux horaires (utiliser UTC partout). L'endpoint doit etre protege par JwtAuthGuard.
- **VALIDATE**: `cd apps/api && pnpm jest sync` - Tests du endpoint pull
- **TEST_REQUIREMENT**: Tests: pull initial (tout), pull incremental (depuis timestamp), pull avec soft-deletes, pagination

#### Task 1.5: UPDATE Endpoints API Sync - Push

- **IMPLEMENT**: Implementer `POST /sync/push` dans le module sync. Le endpoint recoit les mutations du client groupees par entite, les valide et les applique dans une transaction Prisma. Pour chaque mutation: verifier l'idempotence via `client_op_id`, verifier la version pour conflits optimistes, appliquer ou reporter un conflit. Retourner `{ applied: {entity: [ids]}, conflicts: [{entity, id, reason, serverVersion, clientVersion}], new_cursor, server_time }`.
- **PATTERN**: Utiliser le schema `SyncPushRequest`/`SyncPushResponse` de `packages/core/src/schemas/sync.ts`. Pour les ventes, reutiliser la logique FIFO de `SalesService.create()`.
- **DEPENDENCIES**: Module sync, tous les services metier existants
- **GOTCHA**: Les operations financieres (ventes, cash entries) doivent etre en mode server-wins pour les conflits. Les idempotency keys (`client_op_id` UNIQUE) protegent deja contre les doublons. Utiliser `$transaction` pour atomicite.
- **VALIDATE**: `cd apps/api && pnpm jest sync` - Tests du endpoint push
- **TEST_REQUIREMENT**: Tests: push simple, push idempotent (doublon rejete gracieusement), push avec conflit version, push vente avec stock insuffisant

#### Task 1.6: UPDATE Integration mobile - Lecture locale

- **IMPLEMENT**: Modifier tous les ecrans mobiles pour lire les donnees depuis la base locale au lieu de l'API directement. Creer des hooks React (`useLocalProducts`, `useLocalCustomers`, `useLocalSales`, etc.) qui lisent la base locale. L'API reste utilisee pour la synchronisation en arriere-plan mais n'est plus appelee directement par les ecrans.
- **PATTERN**: Remplacer les appels `productsApi.getAll()`, `customersApi.getAll()`, etc. par les fonctions locales. Garder la meme structure de donnees retournee.
- **DEPENDENCIES**: Tasks 1.1, 1.2
- **GOTCHA**: Les ecrans existants utilisent `useState` + `useEffect` avec appels API. La migration doit conserver le meme comportement UX. Attention au chargement initial (premiere sync).
- **VALIDATE**: L'application demarre et affiche les donnees en mode avion (apres une premiere sync)
- **TEST_REQUIREMENT**: Test: l'ecran produits affiche les donnees depuis la base locale

#### Task 1.7: UPDATE Integration mobile - Ecriture locale + queue

- **IMPLEMENT**: Modifier les operations d'ecriture (creation vente, entree caisse, mouvement stock) pour ecrire dans la base locale ET enqueuer la mutation. Le flow devient: UI → base locale (immediate) → mutation queue (async) → sync push (quand connecte). Mettre a jour les ecrans SaleScreen, POSScreen, StockManagementScreen.
- **PATTERN**: Suivre le pattern d'idempotence existant avec `client_op_id` et `device_id` generes cote client.
- **DEPENDENCIES**: Tasks 1.2, 1.3, 1.6
- **GOTCHA**: Le stock local doit etre mis a jour immediatement (optimistic update). En cas de conflit au push, restaurer l'etat local.
- **VALIDATE**: Creer une vente en mode avion, verifier qu'elle apparait immediatement dans l'historique local
- **TEST_REQUIREMENT**: Test: creation vente offline → mutation en queue → stock local decrement

#### Task 1.8: CREATE Moteur de synchronisation automatique

- **IMPLEMENT**: Creer un service de sync qui: (1) ecoute les changements de connectivite via `@react-native-community/netinfo`, (2) au retour de connexion, execute un push (mutations locales) puis un pull (changements serveur), (3) en mode connecte, execute une sync periodique toutes les 60 secondes, (4) affiche un badge avec le nombre de mutations en attente.
- **PATTERN**: Utiliser les schemas sync de `packages/core/src/schemas/sync.ts`
- **DEPENDENCIES**: Tasks 1.3, 1.4, 1.5, 1.7
- **RESOURCES**:
  - https://github.com/react-native-netinfo/react-native-netinfo
  - https://docs.expo.dev/versions/latest/sdk/network/
- **GOTCHA**: Eviter les syncs concurrentes (mutex/lock). Gerer les erreurs reseau gracieusement (retry avec backoff). La sync ne doit pas bloquer l'UI.
- **VALIDATE**: Test: passer en mode avion → creer operations → repasser en ligne → verifier sync automatique
- **TEST_REQUIREMENT**: Test du cycle complet: offline operations → reconnection → push → pull → donnees coherentes

#### Task 1.9: CREATE Indicateurs visuels offline

- **IMPLEMENT**: Creer un composant `OfflineBanner` affiche en haut de l'ecran quand hors ligne (barre orange "Mode hors-ligne - X operations en attente"). Ajouter un indicateur de sync en cours (spinner). Ajouter un ecran "Etat de synchronisation" accessible depuis le menu "Plus" montrant: derniere sync, mutations en attente, conflits.
- **PATTERN**: Utiliser le design system existant des ecrans mobiles (couleurs, typographie)
- **DEPENDENCIES**: Tasks 1.7, 1.8
- **GOTCHA**: Le banner ne doit pas masquer le contenu important. Utiliser SafeAreaView.
- **VALIDATE**: L'indicateur apparait/disparait correctement lors du changement de connectivite
- **TEST_REQUIREMENT**: Test du composant avec mock NetInfo (online → offline → online)

#### Task 1.10: CREATE Gestion des conflits utilisateur

- **IMPLEMENT**: Quand le push retourne des conflits, les stocker localement et notifier l'utilisateur. Creer un ecran "Conflits" listant les operations en conflit avec: entite, operation tentee, raison du conflit, version serveur vs client. Permettre de "forcer" (re-push avec version serveur) ou "abandonner" (supprimer la mutation locale et accepter la version serveur).
- **PATTERN**: Utiliser le format `SyncPushResponse.conflicts` de `packages/core/src/schemas/sync.ts`
- **DEPENDENCIES**: Tasks 1.5, 1.8
- **GOTCHA**: Les conflits sur les ventes avec stock insuffisant ne peuvent pas etre forces. Les conflits sur les donnees maitre (produits, clients) peuvent utiliser LWW.
- **VALIDATE**: Simuler un conflit (modifier un produit sur web pendant que mobile est offline) → verifier la resolution
- **TEST_REQUIREMENT**: Test: conflit version → affichage dans liste → resolution par l'utilisateur

---

### PHASE 2: UNITES/FORMATS PRODUITS PARAMETRABLES

#### Task 2.1: UPDATE Module PackagingType - CRUD complet

- **IMPLEMENT**: Le modele `PackagingType` existe deja dans le schema Prisma. Verifier et completer le service CRUD du module `packaging-types` dans l'API. S'assurer que: creation avec nom unique par boutique, liste triee alphabetiquement, soft delete, valeurs par defaut inserees au seed (piece, douzaine, carton, paquet, unite, kg, gramme, litre).
- **PATTERN**: Suivre le pattern des services existants (ProductsService, CustomersService) pour le CRUD shop-scoped.
- **DEPENDENCIES**: Modele PackagingType existant
- **GOTCHA**: Les valeurs par defaut doivent etre creees par shop (pas globales). Le seed existant doit etre mis a jour.
- **VALIDATE**: `cd apps/api && pnpm jest packaging` - Tests CRUD
- **TEST_REQUIREMENT**: Tests: create, list, update, delete, unicite par shop, valeurs par defaut

#### Task 2.2: UPDATE Schema et formulaire produit

- **IMPLEMENT**: Modifier le formulaire de creation/edition produit sur mobile (`ProductCatalogScreen`) et web pour remplacer le champ texte libre `unit` par un dropdown alimente par `GET /packaging-types`. Mettre a jour le schema Zod `Product` pour valider que `unit` correspond a un `PackagingType` existant. Ajouter un bouton "+" pour creer un nouveau type directement depuis le formulaire.
- **PATTERN**: Suivre le pattern des dropdowns existants (family, brand, article_type) dans le formulaire produit.
- **DEPENDENCIES**: Task 2.1
- **GOTCHA**: Migration backward compatible: les produits existants avec `unit: "unit"` ou `"pcs"` doivent continuer a fonctionner. Mapper les anciennes valeurs vers les nouveaux PackagingType.
- **VALIDATE**: Creer un produit avec une unite de la liste → verifier en base → modifier l'unite → verifier
- **TEST_REQUIREMENT**: Test: formulaire affiche la liste, selection fonctionne, creation inline fonctionne

#### Task 2.3: UPDATE Web - Parametrage des unites

- **IMPLEMENT**: Ajouter une page de parametrage des unites dans la section admin/parametres du dashboard web. Permettre: lister, creer, modifier, supprimer les types d'emballage. Afficher le nombre de produits utilisant chaque type.
- **PATTERN**: Suivre le design des pages existantes du dashboard web.
- **DEPENDENCIES**: Task 2.1
- **GOTCHA**: Ne pas permettre la suppression d'un type utilise par des produits (soft delete ou blocage avec message).
- **VALIDATE**: CRUD complet depuis l'interface web
- **TEST_REQUIREMENT**: Test E2E: creation type → utilisation dans produit → tentative suppression bloquee

---

### PHASE 3: STOCK MULTI-PRIX AVANCE

#### Task 3.1: UPDATE Notification nouveau prix lors creation batch

- **IMPLEMENT**: Modifier `InventoryService.createStockBatch()` pour: (1) recuperer le dernier batch actif du produit, (2) comparer `cost_price` et `sell_price` avec le nouveau batch, (3) si different, retourner dans la reponse un objet `price_change: { old_cost, new_cost, old_sell, new_sell, cost_diff, sell_diff, cost_diff_pct, sell_diff_pct }`. Cote mobile (`StockManagementScreen`), afficher une alerte claire montrant la difference de prix avant confirmation.
- **PATTERN**: Suivre le pattern de `getAvailablePrices()` dans `ProductsService` pour acceder aux batches actifs.
- **DEPENDENCIES**: Systeme FIFO existant (Phase 2 commit fb828cc)
- **GOTCHA**: Le batch doit quand meme etre cree meme si le prix differe (apres confirmation utilisateur). L'alerte est informative, pas bloquante.
- **VALIDATE**: Creer un batch avec prix different → verifier l'alerte → confirmer → verifier en base
- **TEST_REQUIREMENT**: Test: batch avec prix identique (pas d'alerte), batch avec prix different (alerte avec bonnes valeurs)

#### Task 3.2: UPDATE Choix obligatoire du prix en vente

- **IMPLEMENT**: Modifier l'ecran de vente mobile (`SaleScreen`) : quand un produit est ajoute au panier et qu'il a plusieurs prix actifs (retour de `GET /products/:id/prices` avec plus d'un prix distinct), afficher un modal de selection de prix obligatoire. Le modal montre chaque prix avec la quantite disponible a ce prix. Le choix du prix determine le(s) batch(es) source pour le destockage. Si un seul prix actif, le selectionner automatiquement.
- **PATTERN**: Utiliser `ProductsService.getAvailablePrices()` et `InventoryService.deductFromBatch()` (destockage par batch specifique).
- **DEPENDENCIES**: Task 3.1, endpoint GET /products/:id/prices existant
- **GOTCHA**: Si la quantite demandee depasse le stock disponible au prix choisi, proposer de completer avec le batch suivant (prix different). Le total de la vente doit refleter le prix reel de chaque unite.
- **VALIDATE**: Vendre un produit multi-prix → verifier le modal → choisir un prix → verifier le destockage correct du batch
- **TEST_REQUIREMENT**: Test: produit mono-prix (pas de modal), produit multi-prix (modal obligatoire), destockage correct par batch

#### Task 3.3: UPDATE API Vente avec selection batch explicite

- **IMPLEMENT**: Modifier `SalesService.create()` pour accepter un champ optionnel `batch_id` dans chaque `SaleItem`. Si `batch_id` est fourni, utiliser `deductFromBatch()` au lieu de `deductStockFIFO()`. Si non fourni, continuer avec le FIFO automatique (backward compatible). Mettre a jour le DTO `CreateSaleItemDto` et le schema Zod `CreateSaleInput`.
- **PATTERN**: Reutiliser `InventoryService.deductFromBatch()` existant.
- **DEPENDENCIES**: Task 3.2
- **GOTCHA**: Valider que le batch_id appartient au bon produit et a la bonne boutique. Valider que le batch a suffisamment de stock restant.
- **VALIDATE**: `cd apps/api && pnpm jest sales` + `cd apps/api && pnpm jest fifo-destock`
- **TEST_REQUIREMENT**: Ajouter des tests: vente avec batch_id explicite, vente avec batch_id insuffisant, vente mixte (certains items avec batch_id, d'autres FIFO)

#### Task 3.4: UPDATE Indicateur visuel multi-prix catalogue

- **IMPLEMENT**: Dans le catalogue produits mobile (`ProductCatalogScreen`) et la liste des produits web, ajouter un badge/icone sur les produits ayant plusieurs prix actifs. Afficher le prix minimum et maximum (ex: "2 500 - 3 000 FCFA"). Permettre de cliquer pour voir le detail des prix par batch.
- **PATTERN**: Utiliser l'endpoint `GET /products/:id/prices` existant. Suivre le design du badge stock bas existant.
- **DEPENDENCIES**: Task 3.1
- **GOTCHA**: Ne charger les prix multiples que pour les produits affiches (pas de bulk query sur tout le catalogue). Cacher si possible au niveau de la liste avec un champ calcule.
- **VALIDATE**: Verifier le badge sur un produit multi-prix dans le catalogue
- **TEST_REQUIREMENT**: Test: badge absent si mono-prix, badge present avec bon range si multi-prix

---

### PHASE 4: FACTURATION PDF

#### Task 4.1: UPDATE Service Invoices API

- **IMPLEMENT**: Implementer `InvoicesService` dans le module `invoices` existant (le schema Prisma `Invoice` et `InvoiceItem` existent deja). Methodes: `createFromSale(shopId, saleId)` (cree une facture a partir d'une vente existante), `findAll(shopId, filters)`, `findOne(shopId, invoiceId)`, `cancel(shopId, invoiceId)`. Le numero de facture doit etre genere automatiquement au format `{SHOP_CODE}-{YYYY}-{SEQ:4}` (ex: BTQ01-2026-0001). Incrementer le compteur sequentiel par boutique et par annee.
- **PATTERN**: Suivre le pattern de `SalesService` pour le CRUD shop-scoped. Utiliser le schema Invoice existant dans Prisma.
- **DEPENDENCIES**: Schema Invoice dans Prisma, module invoices existant
- **GOTCHA**: Le numero de facture doit etre atomiquement incremente (race condition). Utiliser une sequence ou un compteur en transaction.
- **VALIDATE**: `cd apps/api && pnpm jest invoices`
- **TEST_REQUIREMENT**: Tests: creation depuis vente, numero sequentiel correct, annulation, re-creation

#### Task 4.2: CREATE Template HTML facture

- **IMPLEMENT**: Creer un template HTML/CSS inline pour la facture, adapte aux normes CEMAC. Contenu: en-tete (nom boutique, adresse, telephone, NIF si disponible), informations client, date et numero facture, tableau des articles (description, qte, prix unitaire, total), sous-total, remise, taxes, total general, mentions legales, pied de page. Le template doit etre une fonction qui recoit les donnees et retourne du HTML string.
- **PATTERN**: HTML inline avec CSS inline (pour compatibilite PDF). Design professionnel et sobre.
- **DEPENDENCIES**: Aucune
- **GOTCHA**: Le HTML doit etre compatible avec les moteurs de rendu PDF mobile (expo-print utilise WebView). Eviter le CSS avance (flexbox ok, grid non). Tester sur Android et iOS.
- **RESOURCES**:
  - https://docs.expo.dev/versions/latest/sdk/print/
- **VALIDATE**: Generer le HTML avec des donnees de test et le visualiser dans un navigateur
- **TEST_REQUIREMENT**: Test: template genere du HTML valide avec toutes les donnees injectees

#### Task 4.3: CREATE Generateur PDF mobile

- **IMPLEMENT**: Installer `expo-print` et `expo-sharing` dans l'app mobile. Creer un utilitaire `pdfGenerator.ts` qui: (1) recupere les donnees de la vente + facture, (2) genere le HTML avec le template, (3) utilise `Print.printToFileAsync()` pour generer le PDF, (4) propose le partage via `Sharing.shareAsync()` ou l'impression directe via `Print.printAsync()`.
- **DEPENDENCIES**: Tasks 4.1, 4.2
- **RESOURCES**:
  - https://docs.expo.dev/versions/latest/sdk/print/
  - https://docs.expo.dev/versions/latest/sdk/sharing/
- **GOTCHA**: Sur Android, le chemin du fichier PDF temporaire peut varier. Utiliser `FileSystem.cacheDirectory`. Gerer les permissions de partage.
- **VALIDATE**: Generer un PDF depuis une vente de test → ouvrir le PDF → verifier le contenu
- **TEST_REQUIREMENT**: Test: generation PDF avec donnees valides, partage fonctionne

#### Task 4.4: UPDATE Ecran vente mobile - Bouton facture

- **IMPLEMENT**: Ajouter un bouton "Generer facture" sur l'ecran de confirmation/succes de vente (`SaleScreen`). Le bouton: (1) appelle `POST /invoices/from-sale/{saleId}` pour creer la facture cote serveur (ou localement si offline), (2) genere le PDF via le generateur local, (3) propose "Imprimer" et "Partager". Ajouter aussi un bouton facture dans l'historique des ventes pour re-generer.
- **PATTERN**: Suivre le design des boutons d'action existants dans SaleScreen.
- **DEPENDENCIES**: Tasks 4.1, 4.3
- **GOTCHA**: En mode offline, la facture doit etre generee localement avec un numero provisoire (synchronise plus tard). Gerer l'absence de client (facture anonyme).
- **VALIDATE**: Faire une vente → generer la facture → verifier le PDF → re-generer depuis l'historique
- **TEST_REQUIREMENT**: Test: bouton visible apres vente, generation PDF, numero de facture correct

---

### PHASE 5: NOTIFICATIONS EMAIL CLIENTS

#### Task 5.1: CREATE Module notifications API

- **IMPLEMENT**: Installer `@nestjs-modules/mailer`, `nodemailer`, `handlebars`. Configurer le module Mailer dans l'API avec un provider SMTP (variable d'environnement `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). Creer un module `notifications` avec un service `NotificationsService` qui expose `sendBalanceMovement()` et `sendMonthlySummary()`.
- **PATTERN**: Suivre le pattern des modules NestJS existants (module, service, controller optionnel).
- **DEPENDENCIES**: `@nestjs-modules/mailer`, `nodemailer`, `handlebars`
- **RESOURCES**:
  - https://nest-modules.github.io/mailer/
  - https://nodemailer.com/about/
- **GOTCHA**: En developpement, utiliser un service de test email (Ethereal/Mailtrap). Ne pas envoyer de vrais emails en dev/staging. Ajouter un flag `NODE_ENV` pour desactiver en dev.
- **VALIDATE**: `cd apps/api && pnpm jest notifications`
- **TEST_REQUIREMENT**: Test: envoi email mock avec template correct, skip si pas d'email client

#### Task 5.2: CREATE Templates email

- **IMPLEMENT**: Creer les templates Handlebars dans `apps/api/src/modules/notifications/templates/`:
  - `balance-movement.hbs`: "Cher {customer_name}, votre solde chez {shop_name} a ete modifie. Mouvement: {type} de {amount} FCFA. Nouveau solde: {balance} FCFA. Date: {date}."
  - `monthly-summary.hbs`: Recapitulatif avec tableau des mouvements du mois, solde debut/fin, total debits/credits, contact boutique.
    Les emails doivent etre en francais, professionnels, responsifs (HTML + texte brut).
- **PATTERN**: Templates Handlebars standard avec variables injectees.
- **DEPENDENCIES**: Task 5.1
- **GOTCHA**: Fournir une version texte brut pour les clients email qui ne supportent pas HTML. Tester avec differents clients email.
- **VALIDATE**: Rendu du template avec donnees de test → verification visuelle
- **TEST_REQUIREMENT**: Test: template compile sans erreur, variables injectees correctement

#### Task 5.3: UPDATE Declencheurs email sur mouvements

- **IMPLEMENT**: Modifier `ReceivablesService.create()`, `ReceivablesService.addPayment()`, et `CustomersService.refund()` pour appeler `NotificationsService.sendBalanceMovement()` apres chaque operation reussie. L'envoi doit etre asynchrone (ne pas bloquer la reponse API). Verifier que le client a un email et que `email_notifications_enabled` est true.
- **PATTERN**: Utiliser des events NestJS (`EventEmitter2`) ou simplement un appel asynchrone (fire-and-forget avec catch pour log erreur).
- **DEPENDENCIES**: Tasks 5.1, 5.2
- **GOTCHA**: L'envoi d'email ne doit JAMAIS faire echouer l'operation metier. Toujours try/catch avec log. Respecter les rate limits du provider SMTP.
- **VALIDATE**: Creer une creance pour un client avec email → verifier reception email
- **TEST_REQUIREMENT**: Test: operation reussie meme si email echoue, email envoye si client a un email, pas d'envoi si pas d'email

#### Task 5.4: CREATE CRON recapitulatif mensuel

- **IMPLEMENT**: Installer `@nestjs/schedule`. Creer un CRON job qui s'execute le 1er de chaque mois a 8h00 UTC. Pour chaque boutique, pour chaque client ayant un email et des mouvements dans le mois precedent: generer le recapitulatif et l'envoyer. Limiter l'envoi a 50 emails par execution (pagination) pour respecter les quotas SMTP.
- **DEPENDENCIES**: Tasks 5.1, 5.2
- **RESOURCES**:
  - https://docs.nestjs.com/techniques/task-scheduling
- **GOTCHA**: Attention au timezone (Afrique Centrale = UTC+1). Le CRON doit etre idempotent (ne pas re-envoyer si deja envoye ce mois). Ajouter un log de suivi des envois.
- **VALIDATE**: Declencher manuellement le CRON via un endpoint admin protege → verifier les emails
- **TEST_REQUIREMENT**: Test: generation correcte du recapitulatif, pas de double envoi, skip si pas de mouvements

#### Task 5.5: UPDATE Modele Customer - Flag notifications

- **IMPLEMENT**: Ajouter le champ `email_notifications_enabled: Boolean @default(true)` au modele Customer dans le schema Prisma. Creer la migration. Mettre a jour le formulaire client mobile et web pour permettre d'activer/desactiver les notifications. Mettre a jour le DTO et le schema Zod.
- **PATTERN**: Suivre le pattern des champs boolean existants (`is_active`, `deleted`).
- **DEPENDENCIES**: Aucune (peut etre fait en parallele des autres tasks Phase 5)
- **GOTCHA**: Migration non-breaking: le default `true` signifie que les clients existants recevront des emails s'ils ont un email. Documenter ce comportement.
- **VALIDATE**: `cd apps/api && pnpm prisma:migrate` + verifier le champ en base
- **TEST_REQUIREMENT**: Test: client avec flag false ne recoit pas d'email, client avec flag true recoit

---

### PHASE 6: MULTI-BOUTIQUES & ENTREPRISE

#### Task 6.1: UPDATE Schema Prisma - Modele Enterprise

- **IMPLEMENT**: Ajouter au schema Prisma:
  - Modele `Enterprise` (id, code unique, name, owner_id → User, created_at, updated_at, deleted, version)
  - Ajouter `enterprise_id: String?` nullable sur `Shop` (FK vers Enterprise)
  - Ajouter `shop_type: ShopType @default(BOUTIQUE)` sur Shop
  - Enum `ShopType`: MAGASIN, BOUTIQUE
  - Relations: Enterprise has many Shops, Shop optionally belongs to Enterprise
    Creer la migration. Mettre a jour les schemas Zod dans packages/core.
- **PATTERN**: Suivre le pattern des modeles existants (soft delete, version, timestamps).
- **DEPENDENCIES**: Aucune
- **GOTCHA**: Migration backward compatible: `enterprise_id` nullable signifie que les shops existants restent autonomes. Pas de breaking change.
- **VALIDATE**: `cd apps/api && pnpm prisma:migrate` + verifier le schema en base
- **TEST_REQUIREMENT**: Test: shop sans enterprise fonctionne comme avant, shop avec enterprise a le lien correct

#### Task 6.2: CREATE Module Enterprise API

- **IMPLEMENT**: Creer un module `enterprise` dans l'API avec: `EnterpriseService` (create, findAll, findOne, update, addShop, removeShop, getShops, getStats), `EnterpriseController` (endpoints REST proteges par OWNER/SUPERADMIN). Permettre: creer une entreprise, lier/delier des shops, lister les shops d'une entreprise, voir les stats consolidees.
- **PATTERN**: Suivre le pattern du module admin existant pour les operations cross-shop (accessible au SUPERADMIN et OWNER de l'entreprise).
- **DEPENDENCIES**: Task 6.1
- **GOTCHA**: Seul le proprietaire (owner) de l'entreprise ou SUPERADMIN peut gerer l'entreprise. Les managers de boutique ne voient que leur boutique.
- **VALIDATE**: `cd apps/api && pnpm jest enterprise`
- **TEST_REQUIREMENT**: Tests CRUD complets, ajout/retrait de shop, verification permissions

#### Task 6.3: CREATE Modele InterShopTransfer

- **IMPLEMENT**: Ajouter au schema Prisma:
  - Modele `InterShopTransfer` (id, enterprise_id, source_shop_id, target_shop_id, status: TransferStatus, notes, created_by → User, created_at, updated_at, version)
  - Modele `InterShopTransferItem` (id, transfer_id, product_sku, product_name, quantity, unit_price, cost_price, total)
  - Enum `TransferStatus`: DRAFT, CONFIRMED, SHIPPED, RECEIVED, CANCELLED
  - Relations bidirectionnelles avec Shop et Enterprise
    Creer la migration et les schemas Zod correspondants.
- **PATTERN**: Suivre le pattern de Sale/SaleItem pour la structure parent-enfant.
- **DEPENDENCIES**: Task 6.1
- **GOTCHA**: Le produit est reference par SKU (pas par ID) car les shops ont des produits independants. Le SKU doit etre identique dans les deux boutiques pour le mapping automatique.
- **VALIDATE**: `cd apps/api && pnpm prisma:migrate`
- **TEST_REQUIREMENT**: Test: migration reussie, modele cree avec toutes les relations

#### Task 6.4: CREATE Service de transfert inter-boutiques

- **IMPLEMENT**: Creer `TransfersService` dans un module `transfers`. Methode principale `createTransfer(enterpriseId, sourceShopId, targetShopId, items)` qui dans une transaction:
  1. Verifie que les deux shops appartiennent a la meme entreprise
  2. Cote source (MAGASIN): destock FIFO pour chaque item, cree un `InventoryMovement` type SALE, cree une `Sale` si necessaire
  3. Cote cible (BOUTIQUE): cree un `StockBatch` avec les quantites et prix du transfert, cree un `InventoryMovement` type PURCHASE
  4. Cree l'enregistrement `InterShopTransfer` avec status CONFIRMED
     Gerer aussi: confirmer reception (`RECEIVED`), annuler (`CANCELLED` avec rollback).
- **PATTERN**: Reutiliser `InventoryService.deductStockFIFO()` pour le destockage source et `InventoryService.createStockBatch()` pour l'entree cible.
- **DEPENDENCIES**: Tasks 6.2, 6.3
- **GOTCHA**: Le transfert utilise les connexions Prisma de la meme base (toutes les boutiques sont dans la meme DB). La transaction atomique couvre les deux shops. Attention au mapping produit par SKU (le produit doit exister dans la boutique cible, sinon le creer automatiquement ou rejeter).
- **VALIDATE**: `cd apps/api && pnpm jest transfers`
- **TEST_REQUIREMENT**: Tests: transfert complet (source destock, cible stock), annulation avec rollback, rejet si shops pas meme entreprise, rejet si stock insuffisant source

#### Task 6.5: UPDATE Mobile - Ecran transferts

- **IMPLEMENT**: Creer un ecran `TransfersScreen` accessible depuis le menu "Plus" (visible uniquement si le shop appartient a une entreprise). L'ecran permet: voir les transferts entrants/sortants, creer un nouveau transfert (selection boutique cible, ajout produits avec quantites), confirmer reception d'un transfert entrant. Ajouter un indicateur du type de boutique (MAGASIN/BOUTIQUE) dans le header.
- **PATTERN**: Suivre le design de SaleScreen pour la creation avec panier.
- **DEPENDENCIES**: Tasks 6.2, 6.4
- **GOTCHA**: L'ecran n'est visible que si `shop.enterprise_id` n'est pas null. Le RBAC doit limiter la creation de transferts aux OWNER et MANAGER.
- **VALIDATE**: Creer un transfert depuis le mobile → verifier les deux cotes (source et cible)
- **TEST_REQUIREMENT**: Test: ecran masque si pas d'entreprise, creation transfert, confirmation reception

#### Task 6.6: UPDATE Mobile - Switch boutique

- **IMPLEMENT**: Si l'utilisateur connecte a des roles dans plusieurs boutiques de la meme entreprise, ajouter un selecteur de boutique dans le menu "Plus" ou dans le header. Le switch doit: (1) appeler un endpoint `POST /auth/switch-shop` qui genere de nouveaux tokens avec le nouveau `shopId`, (2) recharger les donnees locales pour la nouvelle boutique, (3) afficher clairement la boutique active.
- **PATTERN**: Suivre le flow de login PIN existant pour la generation de tokens.
- **DEPENDENCIES**: Task 6.2
- **GOTCHA**: Le switch ne doit pas perdre les mutations offline en attente pour l'ancienne boutique. Les donnees locales doivent etre separees par shop_id. Attention a la base locale offline (partitionnement par shop).
- **VALIDATE**: Switch entre deux boutiques → verifier que les donnees changent → switch retour → donnees initiales
- **TEST_REQUIREMENT**: Test: switch genere nouveau token, donnees changent, mutations offline preservees

#### Task 6.7: UPDATE Web - Dashboard entreprise

- **IMPLEMENT**: Ajouter une section "Entreprise" dans le dashboard web (visible si l'utilisateur est OWNER d'une entreprise). Contenu: liste des boutiques avec KPIs individuels (CA, stock, dettes), KPIs consolides, liste des transferts recents, formulaire de creation transfert. Graphiques comparatifs par boutique.
- **PATTERN**: Suivre le design du dashboard existant avec composants React + Tailwind.
- **DEPENDENCIES**: Tasks 6.2, 6.4
- **GOTCHA**: Le dashboard entreprise necessite des requetes cross-shop. Creer des endpoints dedies dans EnterpriseController (pas de reutilisation des endpoints shop-scoped).
- **VALIDATE**: Visualiser le dashboard avec donnees de test → verifier les chiffres
- **TEST_REQUIREMENT**: Test: KPIs corrects, transferts listes, comparatif coherent

---

## TESTING STRATEGY

### Unit Tests

**Scope**: Chaque service API, chaque utilitaire, chaque composant critique
**Requirements**:

- Coverage minimum: 80% pour les nouveaux modules
- Framework: Jest (deja configure)
- Mocking: Prisma mock pour les services, MSW ou jest.mock pour les API calls mobiles
- **VALIDATION COMMAND**:
  - `cd apps/api && pnpm jest --coverage`
  - `cd apps/mobile && pnpm jest --coverage`

**Test Categories Required**:

- Happy path pour chaque operation CRUD
- Erreurs metier (stock insuffisant, client sans email, shop pas dans meme entreprise)
- Idempotence (double submission)
- Conflits de version (optimistic locking)
- Cas offline (mutation queue, sync)

### Integration Tests

**Scope**: Flux complets cross-modules
**Requirements**:

- Tests de flux vente offline → sync → verification serveur
- Tests transfert inter-boutiques complet
- Tests notification email end-to-end (avec mock SMTP)
- **VALIDATION COMMAND**: `cd apps/api && pnpm jest --testPathPattern=integration`

**Test Scenarios Required**:

- Vente complete: produit → panier → paiement → stock deducted → facture PDF
- Sync offline: operations offline → reconnexion → push → pull → coherence
- Transfert: creation → destock source → stock cible → confirmation
- Email: mouvement solde → notification → recapitulatif mensuel

### Edge Cases

**MANDATORY EDGE CASES TO TEST**:

- Vente offline d'un produit dont le stock a ete epuise par une autre caisse online
- Sync avec mutations conflictuelles sur le meme produit depuis deux devices
- Transfert inter-boutiques d'un produit qui n'existe pas dans la boutique cible
- Generation PDF avec des caracteres speciaux francais (accents, cedille)
- Email avec client sans adresse email (skip silencieux)
- Switch boutique avec mutations offline en attente
- Creation batch avec prix identique au precedent (pas d'alerte)
- Facture avec TVA 0% et avec TVA positive

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
pnpm run validate
pnpm --filter @swalo/api run lint
pnpm --filter @swalo/mobile run lint
pnpm --filter @swalo/core run lint
```

**Expected Result**: Zero errors, zero warnings

### Level 2: Unit Tests

```bash
cd apps/api && pnpm jest --coverage
cd apps/mobile && pnpm jest --coverage
pnpm --filter @swalo/api run test
pnpm --filter @swalo/mobile run test
```

**Expected Result**: All tests pass, coverage >= 80% for new code

### Level 3: Integration Tests

```bash
cd apps/api && pnpm jest --testPathPattern=integration
cd apps/api && pnpm jest sync
cd apps/api && pnpm jest transfers
cd apps/api && pnpm jest invoices
cd apps/api && pnpm jest notifications
```

**Expected Result**: All integration tests pass

### Level 4: Build Verification

```bash
pnpm build
cd apps/mobile && npx expo start --no-dev
```

**Expected Result**: Build succeeds for all packages, mobile starts without errors

### Level 5: Manual Validation

**Phase 1 (Offline):**

- Activer mode avion sur device
- Creer une vente → verifier qu'elle apparait localement
- Desactiver mode avion → verifier la sync automatique
- Verifier les donnees en base serveur

**Phase 2 (Unites):**

- Creer un nouveau type d'emballage
- Creer un produit avec cette unite
- Verifier dans le catalogue

**Phase 3 (Multi-Prix):**

- Creer deux batches avec prix differents
- Vendre le produit → verifier le modal de choix de prix
- Verifier le destockage correct

**Phase 4 (PDF):**

- Faire une vente → generer la facture → ouvrir le PDF
- Verifier le contenu (en-tete, items, totaux)

**Phase 5 (Email):**

- Creer une creance pour un client avec email
- Verifier la reception de l'email

**Phase 6 (Multi-Boutiques):**

- Creer une entreprise avec 2 boutiques
- Faire un transfert → verifier les deux cotes
- Switch boutique → verifier les donnees

---

## ACCEPTANCE CRITERIA

**MANDATORY REQUIREMENTS - ALL MUST BE MET**:

### Phase 1 - Offline

- [ ] L'application mobile fonctionne sans connexion internet (ventes, caisse, stock)
- [ ] Les operations offline sont synchronisees automatiquement au retour de connexion
- [ ] Un indicateur visuel montre l'etat online/offline et le nombre d'operations en attente
- [ ] Les conflits sont detectes et presentes a l'utilisateur pour resolution
- [ ] Les idempotency keys empechent les doublons lors de la sync

### Phase 2 - Unites

- [ ] Les unites de conditionnement sont parametrables par boutique
- [ ] La liste deroulante est alimentee par les PackagingType de la boutique
- [ ] Un type peut etre cree directement depuis le formulaire produit
- [ ] Les valeurs par defaut sont presentes (piece, douzaine, carton, paquet)

### Phase 3 - Multi-Prix

- [ ] Lors de la creation d'un batch avec prix different, l'ecart est clairement affiche
- [ ] Lors de la vente d'un produit multi-prix, le choix du prix est obligatoire
- [ ] Le destockage est effectue sur le bon batch correspondant au prix choisi
- [ ] Un indicateur visuel signale les produits multi-prix dans le catalogue

### Phase 4 - PDF

- [ ] Une facture PDF est generable depuis l'ecran de vente
- [ ] Le PDF contient toutes les informations requises (en-tete, items, totaux)
- [ ] Le numero de facture est sequentiel et unique par boutique
- [ ] Le PDF peut etre partage et imprime

### Phase 5 - Email

- [ ] Un email est envoye a chaque mouvement de solde client (si email present)
- [ ] Un recapitulatif mensuel est envoye le 1er du mois
- [ ] Les notifications sont desactivables par client
- [ ] L'echec d'envoi email ne bloque jamais l'operation metier

### Phase 6 - Multi-Boutiques

- [ ] Une entreprise peut regrouper plusieurs boutiques
- [ ] Les transferts inter-boutiques creent automatiquement les ecritures croisees
- [ ] Chaque boutique reste autonome pour ses propres operations
- [ ] Le switch de boutique est possible sans re-login complet
- [ ] Un dashboard consolide est disponible pour l'entreprise

### Global

- [ ] **ALL validation commands pass with zero errors**
- [ ] **ALL unit tests pass** with >= 80% coverage on new code
- [ ] **ALL integration tests pass**
- [ ] Code follows existing project conventions and patterns
- [ ] No regressions in existing functionality (existing tests still pass)
- [ ] Documentation updated in `docs/` if necessary

---

## COMPLETION CHECKLIST

**MANDATORY - EVERY ITEM MUST BE CHECKED BEFORE COMPLETION**:

- [ ] Phase 1: Offline mode fonctionnel et teste
- [ ] Phase 2: Unites parametrables et testees
- [ ] Phase 3: Multi-prix avance avec choix obligatoire et teste
- [ ] Phase 4: Facturation PDF fonctionnelle et testee
- [ ] Phase 5: Notifications email fonctionnelles et testees
- [ ] Phase 6: Multi-boutiques avec transferts et teste
- [ ] All validation commands executed successfully (Level 1-5)
- [ ] Full test suite passes (unit + integration + existing tests)
- [ ] No linting or type checking errors
- [ ] Manual testing completed for each phase
- [ ] Acceptance criteria all met
- [ ] Code reviewed for quality and maintainability
- [ ] Each phase deployable independamment

---

## EXTERNAL RESOURCES AND REFERENCES

### Official Documentation

- **Expo SQLite**: https://docs.expo.dev/versions/latest/sdk/sqlite/
- **WatermelonDB**: https://watermelondb.dev/docs
- **NestJS**: https://docs.nestjs.com/
- **Prisma**: https://www.prisma.io/docs
- **React Native NetInfo**: https://github.com/react-native-netinfo/react-native-netinfo
- **Expo Print**: https://docs.expo.dev/versions/latest/sdk/print/
- **Expo Sharing**: https://docs.expo.dev/versions/latest/sdk/sharing/
- **NestJS Mailer**: https://nest-modules.github.io/mailer/
- **Nodemailer**: https://nodemailer.com/about/
- **NestJS Schedule**: https://docs.nestjs.com/techniques/task-scheduling
- **Handlebars**: https://handlebarsjs.com/

### Internal Resources

- Architecture: `docs/architecture/overview.md`
- Specifications: `docs/specs/cahier-des-charges-unifie.md`
- Development Workflow: `docs/guides/development-workflow.md`
- Environments: `docs/deployment/environments.md`
- Sync Schemas: `packages/core/src/schemas/sync.ts`
- FIFO Tests: `apps/api/test/fifo-destock.spec.ts`

### API References

- API Base URL (Dev): `http://localhost:3000/api`
- API Base URL (Prod): `https://swalo-api.onrender.com/api`
- Prisma Schema: `apps/api/prisma/schema.prisma`

---

## NOTES

**Ordre de priorite recommande:**

1. **Phase 1 (Offline)** - Critique pour l'usage en Afrique Centrale (coupures frequentes)
2. **Phase 3 (Multi-Prix)** - Evolution naturelle du FIFO Phase 2 deja implemente
3. **Phase 2 (Unites)** - Rapide a implementer, haute valeur utilisateur
4. **Phase 4 (PDF)** - Demande frequente des utilisateurs
5. **Phase 5 (Email)** - Amelioration communication client
6. **Phase 6 (Multi-Boutiques)** - Fonctionnalite avancee, plus complexe

**Decisions architecturales cles:**

- **expo-sqlite vs WatermelonDB**: expo-sqlite est recommande pour sa simplicite d'integration avec Expo managed workflow. WatermelonDB offre plus de fonctionnalites (observables, lazy loading) mais necessite Expo prebuild. Decision a prendre en Task 1.1.
- **Sync strategy**: Pull/Push avec LWW (Last-Write-Wins) pour les donnees maitre, Server-Wins pour les operations financieres. Les schemas sync sont deja definis dans packages/core.
- **Email provider**: Brevo (ex-Sendinblue) recommande pour son tier gratuit generous (300 emails/jour) et son support en Afrique francophone. Alternative: SendGrid.
- **Transfert inter-boutiques**: Utilise la meme base de donnees (toutes les boutiques dans Neon). Pas de sync cross-DB necessaire. Le transfert est une transaction atomique Prisma couvrant les deux shops.

**Risques identifies:**

- Phase 1 (Offline): Complexite elevee, necessite des tests approfondis sur devices reels
- Phase 5 (Email): Deliverabilite en Afrique (DNS, SPF/DKIM, FAI locaux)
- Phase 6 (Multi-Boutiques): Impact sur le modele de donnees existant, migration delicate
- Performance: La sync de grandes quantites de donnees peut etre lente sur reseaux mobiles africains (3G)

**Important Reminders:**

- Ce plan contient UNIQUEMENT des specifications fonctionnelles - PAS d'exemples de code
- TOUS les tests doivent etre ecrits et passer avant qu'une feature soit consideree complete
- TOUTES les commandes de validation doivent s'executer avec succes
- Chaque phase est deployable independamment
- La branche de travail doit etre creee depuis `develop` selon le workflow du projet

<!-- EOF -->
