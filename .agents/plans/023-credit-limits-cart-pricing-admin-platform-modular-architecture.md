# Plan 023 : Limites de Crédit, Tarification Panier, Plateforme Admin, Architecture Modulaire

## Feature Description

Ce plan couvre 6 axes majeurs d'évolution de SWALO :

1. **Limites de crédit client / emprunt fournisseur** : Bloquer les transactions dépassant un seuil configurable
2. **Modification des seuils dans les détails client/fournisseur** : Éditer le seuil même s'il n'a pas été défini à la création
3. **Calcul automatique du prix total dans le panier de vente** : Auto-total + traçabilité des écarts de prix
4. **Alignement du design web** : Harmoniser l'UI web avec la charte couleurs mobile
5. **Plateforme globale d'administration** : Suivi utilisateurs, boutiques, blocage/déblocage, gestion entreprise
6. **Architecture modulaire offline-first** : Application coeur + modules activables, licences par taille d'entreprise

## User Stories

**US1** : En tant que gérant, je veux définir une limite de crédit pour mes clients et une limite d'emprunt pour mes fournisseurs, afin de bloquer automatiquement toute transaction qui dépasserait ce seuil.

**US2** : En tant que gérant, je veux pouvoir modifier la limite de crédit/emprunt depuis la fiche client ou fournisseur, même si aucune limite n'a été définie à la création.

**US3** : En tant que caissier, je veux que le prix total de ma vente soit calculé automatiquement à partir du panier, avec possibilité de modifier le prix final en laissant un commentaire de traçabilité.

**US4** : En tant qu'utilisateur web, je veux une interface alignée sur la charte graphique définie (couleurs, gradients, badges, typographie).

**US5** : En tant que superadmin, je veux une plateforme d'administration pour suivre les utilisateurs, boutiques, entreprises, et pouvoir bloquer/débloquer l'accès.

**US6** : En tant que propriétaire de SWALO, je veux une architecture modulaire avec un coeur applicatif et des modules activables selon la taille et le secteur de l'entreprise.

## Feature Metadata

**Feature Type** : New Capability + Enhancement + Refactor
**Estimated Complexity** : High (6 axes, multi-plateforme)
**Primary Systems Affected** : API (Prisma, NestJS), Mobile (React Native), Web (React/Vite/Tailwind), Core (shared types)
**Dependencies** : Prisma migrations, Tailwind config, Expo SQLite schema update

---

## CONTEXT REFERENCES

### Relevant Codebase Files

#### Phase 1 : Limites de crédit/emprunt

- `apps/api/prisma/schema.prisma` (lines 280-306) - Customer model, `credit_limit` existe déjà
- `apps/api/prisma/schema.prisma` (lines 351-374) - Supplier model, `borrowing_limit` MANQUANT
- `apps/api/src/modules/customers/customers.service.ts` (lines 129-133, 193-201) - Calcul balance client
- `apps/api/src/modules/suppliers/suppliers.service.ts` (lines 127-133, 191-199) - Calcul balance fournisseur
- `apps/api/src/modules/receivables/receivables.service.ts` - Création de créances
- `apps/api/src/modules/debts/debts.service.ts` - Création de dettes
- `apps/api/src/modules/sales/sales.service.ts` (line 151) - Création vente, payment_method toujours 'CASH'
- `apps/api/src/modules/customers/dto/create-customer.dto.ts` (line 26) - credit_limit dans DTO
- `apps/api/src/modules/suppliers/dto/create-supplier.dto.ts` - borrowing_limit ABSENT
- `apps/mobile/src/screens/CustomerDetailsScreen.tsx` - Affichage détails client
- `apps/mobile/src/screens/SupplierDetailsScreen.tsx` - Affichage détails fournisseur
- `apps/web/src/pages/CustomerDetails.tsx` - Détails client web
- `apps/web/src/pages/SupplierDetails.tsx` - Détails fournisseur web

#### Phase 2 : Tarification panier

- `apps/mobile/src/screens/SaleScreen.tsx` (1295 lines) - Écran de vente mobile
  - Line 70 : `totalPrice` saisi manuellement
  - Lines 328-334 : Checkout modal
  - Lines 336-537 : `confirmSale()` prend le total sans vérification
  - Lines 732-742 : Input texte "Prix total (FCFA)"
  - Lines 829-885 : Modal multi-prix (batches)
- `apps/api/src/modules/sales/dto/create-sale.dto.ts` (lines 13-66) - SaleItemDto et CreateSaleDto
- `apps/api/src/modules/sales/sales.service.ts` (lines 195-230) - Backend recalcule les totaux
- `apps/api/prisma/schema.prisma` (lines 468-525) - Sale et SaleItem models
- `apps/mobile/src/db/offlineWrite.ts` (lines 61-76) - OfflineSaleInput interface
- `apps/mobile/src/db/schema.ts` (lines 124-180) - Tables locales SQLite

#### Phase 3 : Design web

- `apps/web/tailwind.config.js` - Configuration Tailwind actuelle
- `apps/web/src/index.css` - Classes utilitaires CSS
- `docs/design/charte-couleurs.md` - Charte couleurs cible
- `apps/mobile/src/constants/theme.ts` (281 lines) - Thème mobile (source de vérité)
- `apps/web/src/components/Layout/MainLayout.tsx` (258 lines) - Layout principal
- `apps/web/src/pages/Login.tsx` - Styles inline hardcodés
- `apps/web/src/pages/Dashboard.tsx` (740 lines) - Nombreux styles inline
- Les 16 pages web dans `apps/web/src/pages/`

#### Phase 4 : Plateforme admin

- `apps/api/src/modules/admin/admin.controller.ts` (157 lines) - Endpoints admin existants
- `apps/api/src/modules/admin/admin.service.ts` (341 lines) - Logique admin
- `apps/api/src/modules/enterprise/enterprise.controller.ts` (87 lines) - Gestion entreprise
- `apps/api/src/modules/enterprise/enterprise.service.ts` (380 lines) - Logique entreprise
- `apps/api/src/modules/auth/auth.service.ts` - Authentification, vérification au login
- `apps/api/src/common/guards/roles.guard.ts` - Guard RBAC
- `apps/web/src/pages/SuperAdminDashboard.tsx` (169 lines) - Dashboard admin basique
- `apps/web/src/pages/AdminPanel.tsx` (592 lines) - Panel admin existant
- `apps/web/src/App.tsx` - Routes web

#### Phase 5 : Architecture modulaire

- `apps/mobile/src/db/schema.ts` - Schéma SQLite local
- `apps/mobile/src/db/sync.ts` - Moteur de synchronisation
- `apps/mobile/src/db/repositories.ts` - Repositories locaux
- `apps/mobile/src/db/offlineWrite.ts` - Opérations offline
- `apps/api/src/modules/sync/sync.service.ts` - Service sync API
- `apps/api/src/app.module.ts` - Import de tous les modules (hardcodé)
- `packages/core/src/` - Types et schémas partagés

### New Files to Create

#### Phase 1

- `apps/api/prisma/migrations/YYYYMMDD_add_borrowing_limit_to_supplier/migration.sql`

#### Phase 2

- `apps/api/prisma/migrations/YYYYMMDD_add_price_override_to_sale/migration.sql`

#### Phase 3

- `apps/web/src/constants/theme.ts` - Thème centralisé web (miroir du mobile)

#### Phase 4

- `apps/api/src/modules/admin-controls/admin-controls.module.ts`
- `apps/api/src/modules/admin-controls/admin-controls.controller.ts`
- `apps/api/src/modules/admin-controls/admin-controls.service.ts`
- `apps/api/src/modules/admin-controls/dto/block-entity.dto.ts`
- `apps/api/src/modules/audit-logs/audit-logs.module.ts`
- `apps/api/src/modules/audit-logs/audit-logs.controller.ts`
- `apps/api/src/modules/audit-logs/audit-logs.service.ts`
- `apps/api/src/common/guards/block-status.guard.ts`
- `apps/web/src/pages/AuditLogs.tsx`
- `apps/web/src/pages/SystemConfiguration.tsx`

#### Phase 5

- `packages/core/src/modules/registry.ts` - Registre des modules
- `apps/api/src/common/guards/entitlement.guard.ts` - Guard de licence

### Patterns to Follow

**Naming Conventions :**

- Services NestJS : PascalCase + Service suffix (ex: `AdminControlsService`)
- DTOs : PascalCase + Dto suffix (ex: `BlockEntityDto`)
- Guards : PascalCase + Guard suffix (ex: `BlockStatusGuard`)
- Migrations Prisma : format `YYYYMMDDHHMMSS_description`
- Modules web : composants en PascalCase, fichiers en PascalCase

**Error Handling :**

- `BadRequestException` pour validations métier (dépassement limite)
- `ForbiddenException` pour entités bloquées
- `NotFoundException` pour entités introuvables
- Messages en français pour l'utilisateur final

**Data Validation :**

- DTOs avec `class-validator` côté API
- Zod schemas côté `packages/core`
- Validation côté client avant appel API

**Transaction Pattern :**

- `prisma.$transaction()` pour opérations multi-tables
- Vérification de solde + création dans la même transaction

---

## IMPLEMENTATION PLAN

### Phase 1 : Limites de Crédit Client et Emprunt Fournisseur

**Objectif** : Bloquer toute transaction (créance, dette, vente à crédit) qui ferait dépasser la limite configurée.

**Constat actuel :**

- `Customer.credit_limit` existe dans le schéma Prisma (default 0)
- `Supplier.borrowing_limit` N'EXISTE PAS
- Aucune logique de blocage n'est implémentée
- `PaymentMethod.CREDIT` existe dans l'enum mais n'est jamais utilisé (toujours `CASH`)

**Tasks :**

#### 1.1 UPDATE `apps/api/prisma/schema.prisma`

- **IMPLEMENT** : Ajouter `borrowing_limit Int @default(0)` au modèle Supplier (après `address`)
- **PATTERN** : Miroir du champ `credit_limit` existant sur Customer (line 288)
- **VALIDATE** : `cd apps/api && npx prisma validate`

#### 1.2 CREATE migration Prisma

- **IMPLEMENT** : Générer et appliquer la migration pour `borrowing_limit`
- **VALIDATE** : `cd apps/api && npx prisma migrate deploy`

#### 1.3 UPDATE DTOs Supplier

- **IMPLEMENT** : Ajouter `borrowing_limit` (optionnel, int, >=0) dans `CreateSupplierDto` et `UpdateSupplierDto`
- **PATTERN** : Identique à `credit_limit` dans les DTOs Customer
- **FILES** : `apps/api/src/modules/suppliers/dto/create-supplier.dto.ts`, `update-supplier.dto.ts`
- **VALIDATE** : `cd apps/api && pnpm run lint`

#### 1.4 UPDATE `ReceivablesService.create()`

- **IMPLEMENT** : Avant de créer une créance, vérifier que `total_balance_actuel + montant_nouvelle_creance <= customer.credit_limit`. Si `credit_limit == 0`, pas de limite (illimité). Lever `BadRequestException` si dépassement avec message explicite incluant le solde actuel et la limite.
- **PATTERN** : Le calcul de balance existe déjà dans `customers.service.ts` (lines 129-133)
- **GOTCHA** : Un `credit_limit` de 0 signifie "pas de limite" (pas "interdit")
- **VALIDATE** : `cd apps/api && pnpm jest receivables`

#### 1.5 UPDATE `DebtsService.create()`

- **IMPLEMENT** : Même logique pour les dettes fournisseur : `total_balance + montant <= supplier.borrowing_limit`. Si `borrowing_limit == 0`, pas de limite.
- **PATTERN** : Miroir de la logique client
- **VALIDATE** : `cd apps/api && pnpm jest debts`

#### 1.6 UPDATE `SalesService.create()`

- **IMPLEMENT** : Si `payment_method == 'CREDIT'` et `customer_id` fourni, vérifier la limite de crédit client avant de créer la vente. Bloquer si dépassement.
- **GOTCHA** : Actuellement `payment_method` est toujours `'CASH'` (line 322). Il faut accepter `'CREDIT'` depuis le DTO et gérer la logique de créance automatique.
- **VALIDATE** : `cd apps/api && pnpm jest sales`

#### 1.7 UPDATE Mobile `CustomerDetailsScreen.tsx`

- **IMPLEMENT** : Afficher `credit_limit` dans les infos client. Ajouter un indicateur visuel (barre de progression ou badge) montrant `balance / credit_limit`. Ajouter possibilité d'éditer `credit_limit` dans le modal d'édition, même si pas défini à la création.
- **PATTERN** : Utiliser les composants UI existants (`KPICard`, `StatusBadge`)
- **VALIDATE** : Vérification visuelle sur Expo Go

#### 1.8 UPDATE Mobile `SupplierDetailsScreen.tsx`

- **IMPLEMENT** : Afficher `borrowing_limit` dans les infos fournisseur. Indicateur visuel `balance / borrowing_limit`. Modal d'édition du seuil.
- **PATTERN** : Miroir de la modification client
- **VALIDATE** : Vérification visuelle sur Expo Go

#### 1.9 UPDATE Web `CustomerDetails.tsx` et `SupplierDetails.tsx`

- **IMPLEMENT** : Afficher les limites, indicateurs visuels, et champs d'édition côté web
- **PATTERN** : Suivre les patterns existants des pages web
- **VALIDATE** : Vérification visuelle sur localhost:3001

#### 1.10 UPDATE Mobile `SaleScreen.tsx`

- **IMPLEMENT** : Lors du checkout, si le client est sélectionné et que le mode de paiement est "À crédit", vérifier la limite avant de finaliser. Afficher un message d'erreur bloquant si la limite serait dépassée.
- **VALIDATE** : Test manuel sur Expo Go

---

### Phase 2 : Calcul Automatique du Prix Total dans le Panier

**Objectif** : Le total est calculé automatiquement à partir des items du panier. L'utilisateur peut le modifier mais doit laisser un commentaire si le prix vendu diffère du prix attendu.

**Constat actuel :**

- Le total est saisi manuellement dans un champ texte (SaleScreen.tsx line 740)
- Le backend recalcule déjà le total indépendamment (sales.service.ts lines 195-230)
- Aucun champ `price_override_reason` n'existe

**Tasks :**

#### 2.1 UPDATE `apps/api/prisma/schema.prisma`

- **IMPLEMENT** : Ajouter `pricing_notes String?` au modèle Sale (commentaire si prix modifié). Ajouter `expected_total Int?` au modèle Sale (total calculé avant override).
- **VALIDATE** : `cd apps/api && npx prisma validate`

#### 2.2 CREATE migration Prisma

- **IMPLEMENT** : Migration pour les nouveaux champs Sale
- **VALIDATE** : `cd apps/api && npx prisma migrate deploy`

#### 2.3 UPDATE `CreateSaleDto`

- **IMPLEMENT** : Ajouter `pricing_notes?: string` (optionnel) et `expected_total?: number` (optionnel) au DTO
- **FILES** : `apps/api/src/modules/sales/dto/create-sale.dto.ts`
- **VALIDATE** : `cd apps/api && pnpm run lint`

#### 2.4 UPDATE `SalesService.create()`

- **IMPLEMENT** : Si `expected_total` est fourni et diffère de `grand_total` calculé, enregistrer dans `pricing_notes`. Si `pricing_notes` est vide mais qu'il y a un écart, lever un avertissement (pas bloquant, juste log).
- **VALIDATE** : `cd apps/api && pnpm jest sales`

#### 2.5 UPDATE Mobile `SaleScreen.tsx` - Auto-calcul

- **IMPLEMENT** : Remplacer le champ texte `totalPrice` par un affichage calculé automatiquement : `Σ(item.unitPrice × item.quantity)`. Le total se met à jour en temps réel quand le panier change. Afficher le total calculé de manière proéminente dans le modal de paiement.
- **PATTERN** : Utiliser `useMemo` ou `useCallback` pour le calcul réactif
- **GOTCHA** : Gérer le cas où `unitPrice` est undefined (produit sans prix de batch)

#### 2.6 UPDATE Mobile `SaleScreen.tsx` - Override avec traçabilité

- **IMPLEMENT** : Ajouter un toggle "Modifier le prix" sous le total calculé. Si activé, afficher un champ de saisie pour le nouveau total ET un champ "Raison de la modification" obligatoire. Le bouton "Confirmer" est désactivé tant que la raison n'est pas saisie (si le prix a été modifié).
- **VALIDATE** : Vérification visuelle et fonctionnelle sur Expo Go

#### 2.7 UPDATE Mobile `offlineWrite.ts`

- **IMPLEMENT** : Ajouter `pricingNotes?: string` et `expectedTotal?: number` à `OfflineSaleInput`. Les propager dans la création de vente locale et la mutation queue.
- **FILES** : `apps/mobile/src/db/offlineWrite.ts`

#### 2.8 UPDATE Mobile `schema.ts`

- **IMPLEMENT** : Ajouter les colonnes `pricing_notes TEXT` et `expected_total INTEGER` à la table `sales` locale
- **FILES** : `apps/mobile/src/db/schema.ts`
- **GOTCHA** : Prévoir la migration du schéma local (incrémentation de version)

---

### Phase 3 : Alignement Design Web

**Objectif** : Aligner les 16 pages web sur la charte couleurs définie dans `theme.ts` mobile et `charte-couleurs.md`.

**Constat actuel :**

- 8+ pages utilisent des styles inline hardcodés (Login, Dashboard, POS, etc.)
- Pas de système de thème centralisé côté web
- Les couleurs Tailwind sont partiellement configurées mais sous-utilisées
- Gradients contextuels absents (Client/Amber, Fournisseur/Red, Caisse/Purple)

**Tasks :**

#### 3.1 CREATE `apps/web/src/constants/theme.ts`

- **IMPLEMENT** : Créer un fichier de constantes miroir du thème mobile. Inclure : couleurs primaires, secondaires, sémantiques (success, danger, warning, info), couleurs par contexte (clients=amber, fournisseurs=red, caisse=purple), couleurs par rôle (SUPERADMIN=purple, OWNER=red, ADMIN=orange, MANAGER=sky, EMPLOYEE=blue), badges de statut (active, inactive, pending, paid, cancelled).
- **PATTERN** : Structure identique à `apps/mobile/src/constants/theme.ts`

#### 3.2 UPDATE `apps/web/tailwind.config.js`

- **IMPLEMENT** : Compléter la palette de couleurs avec les tokens manquants. Ajouter les gradients contextuels comme classes utilitaires. Ajouter les couleurs de rôle.
- **VALIDATE** : `cd apps/web && pnpm dev` (vérifier que le build Tailwind passe)

#### 3.3 UPDATE `apps/web/src/index.css`

- **IMPLEMENT** : Ajouter les classes utilitaires CSS pour : gradients contextuels (.gradient-customers, .gradient-suppliers, .gradient-cash), badges de rôle (.badge-role-owner, .badge-role-manager, etc.), badges de statut (.badge-status-active, .badge-status-paid, etc.), variantes de cartes (.card-success, .card-danger, .card-warning).

#### 3.4 REFACTOR `Login.tsx` et `LoginPin.tsx`

- **IMPLEMENT** : Remplacer tous les styles inline (`style={{background: 'linear-gradient(135deg, #667eea ...'}}`) par des classes Tailwind utilisant le thème. Appliquer les couleurs primaires de la charte.
- **VALIDATE** : Vérification visuelle sur localhost:3001

#### 3.5 REFACTOR `Dashboard.tsx` (740 lignes)

- **IMPLEMENT** : Remplacer les 150+ références de couleurs inline par des classes Tailwind. Appliquer le gradient produits pour le header. Utiliser les badges de statut pour les indicateurs.
- **GOTCHA** : Fichier volumineux, procéder par sections (header, cards, table, modals)

#### 3.6 REFACTOR Pages Contextuelles

- **IMPLEMENT** : Appliquer les couleurs contextuelles :
  - `Customers.tsx` + `CustomerDetails.tsx` : Thème Amber (clients/créances)
  - `Suppliers.tsx` + `SupplierDetails.tsx` : Thème Red (fournisseurs/dettes)
  - `POS.tsx` : Thème Purple (caisse) avec entrées en vert et sorties en rouge

#### 3.7 REFACTOR Pages Admin et Rapports

- **IMPLEMENT** : Appliquer les couleurs de rôle dans `UserManagement.tsx`. Couleurs admin dans `AdminPanel.tsx`, `SuperAdminDashboard.tsx`. Couleurs rapports dans `BusinessReports.tsx`.

#### 3.8 UPDATE `MainLayout.tsx`

- **IMPLEMENT** : Appliquer le thème au sidebar, top bar, et navigation. Utiliser les icônes avec les couleurs contextuelles appropriées.

---

### Phase 4 : Plateforme Globale d'Administration

**Objectif** : Créer une plateforme d'administration complète permettant au SUPERADMIN de gérer utilisateurs, boutiques, entreprises avec des mécanismes de blocage/déblocage.

**Constat actuel :**

- 10 endpoints admin existent (list shops, delete shop, manage users/devices)
- RBAC avec SUPERADMIN qui bypass tous les contrôles
- Enterprise/Shop/User hierarchy en place
- Pas de mécanisme de blocage
- Pas de logs d'audit
- SuperAdminDashboard très basique (169 lignes)

**Tasks :**

#### 4.1 UPDATE Schema Prisma - Modèles de blocage et audit

- **IMPLEMENT** : Ajouter les champs suivants aux modèles existants :
  - `Shop` : `is_blocked Boolean @default(false)`, `blocked_reason String?`, `blocked_at DateTime?`, `blocked_by String?`
  - `User` : `is_blocked Boolean @default(false)`, `blocked_reason String?`, `blocked_at DateTime?`, `blocked_by String?`
  - `Enterprise` : `is_blocked Boolean @default(false)`, `blocked_reason String?`, `blocked_at DateTime?`, `blocked_by String?`

  Créer un nouveau modèle `AuditLog` avec : `id`, `admin_id` (FK User), `action` (string: BLOCK_SHOP, UNBLOCK_USER, etc.), `entity_type` (USER/SHOP/ENTERPRISE), `entity_id`, `old_value` (Json?), `new_value` (Json?), `reason`, `ip_address`, `created_at`. Indexes sur [admin_id, created_at] et [entity_type, entity_id].

  Créer un modèle `SystemConfig` : `id`, `key` (unique), `value`, `description`, `created_at`, `updated_at`.

- **VALIDATE** : `cd apps/api && npx prisma validate`

#### 4.2 CREATE migration Prisma

- **VALIDATE** : `cd apps/api && npx prisma migrate deploy`

#### 4.3 CREATE module `admin-controls`

- **IMPLEMENT** : Créer le module NestJS `admin-controls` avec les endpoints :
  - `POST /api/admin/shops/:id/block` - Bloquer une boutique (raison obligatoire)
  - `POST /api/admin/shops/:id/unblock` - Débloquer une boutique
  - `POST /api/admin/users/:id/block` - Bloquer un utilisateur (révoque tous les devices)
  - `POST /api/admin/users/:id/unblock` - Débloquer un utilisateur
  - `POST /api/admin/enterprises/:id/block` - Bloquer une entreprise (cascade sur toutes les boutiques)
  - `POST /api/admin/enterprises/:id/unblock` - Débloquer une entreprise
  - `GET /api/admin/audit-logs` - Lister les logs d'audit (filtres : action, entity_type, date_range, admin_id)
  - `GET /api/admin/system/stats` - Statistiques globales enrichies (nb users actifs, boutiques actives, entreprises, users bloqués, etc.)

- **PATTERN** : Suivre la structure existante de `admin.controller.ts` + `admin.service.ts`
- **DEPENDENCIES** : Tous endpoints protégés par `@Roles(Role.SUPERADMIN)`
- **GOTCHA** : Le blocage d'un user doit aussi révoquer ses devices et invalider ses tokens

#### 4.4 CREATE Guard `BlockStatusGuard`

- **IMPLEMENT** : Créer un guard NestJS qui vérifie à chaque requête authentifiée si l'utilisateur, sa boutique, ou son entreprise est bloqué(e). Si bloqué, lever `ForbiddenException` avec message explicatif. Le guard doit : vérifier `user.is_blocked`, vérifier `shop.is_blocked`, vérifier `enterprise.is_blocked` (si rattachée). SUPERADMIN bypass le guard.
- **FILES** : `apps/api/src/common/guards/block-status.guard.ts`
- **GOTCHA** : Ajouter le guard globalement dans `app.module.ts` ou sur chaque controller

#### 4.5 UPDATE `AuthService` - Vérification au login

- **IMPLEMENT** : Dans les méthodes `login()` et `loginWithPin()`, vérifier si l'utilisateur ou sa boutique est bloqué(e) avant d'émettre les tokens. Retourner un message d'erreur explicite.
- **VALIDATE** : `cd apps/api && pnpm jest auth`

#### 4.6 UPDATE Web `api.ts` - Nouveaux endpoints admin

- **IMPLEMENT** : Ajouter les méthodes API client : `blockShop()`, `unblockShop()`, `blockUser()`, `unblockUser()`, `blockEnterprise()`, `unblockEnterprise()`, `getAuditLogs()`, `getEnhancedSystemStats()`
- **FILES** : `apps/web/src/lib/api.ts`

#### 4.7 CREATE Page `SuperAdminDashboard.tsx` (enrichie)

- **IMPLEMENT** : Refondre le dashboard superadmin avec :
  - KPIs : nombre total d'utilisateurs, boutiques, entreprises, entités bloquées
  - Liste des boutiques avec statut (actif/bloqué), dernière activité
  - Liste des entreprises avec nombre de boutiques
  - Actions rapides : bloquer/débloquer depuis le tableau
  - Filtres : par statut (tous/actifs/bloqués), recherche par nom
  - Logs d'audit récents (5 derniers)

#### 4.8 CREATE Page `AuditLogs.tsx`

- **IMPLEMENT** : Page de visualisation des logs d'audit avec :
  - Tableau paginé des actions admin
  - Filtres : type d'action, entité, période, administrateur
  - Détails expandables montrant old_value/new_value
  - Export possible (future)

#### 4.9 UPDATE `App.tsx` - Routes admin

- **IMPLEMENT** : Ajouter les routes pour les nouvelles pages admin, protégées par `requireRole="SUPERADMIN"`
- **FILES** : `apps/web/src/App.tsx`

#### 4.10 UPDATE `MainLayout.tsx` - Navigation admin

- **IMPLEMENT** : Ajouter les entrées de menu pour les nouvelles pages dans la section admin du sidebar

---

### Phase 5 : Architecture Modulaire et Offline-First

**Objectif** : Structurer SWALO en application coeur + modules activables, préparer le système de licences.

**Constat actuel :**

- 19 modules API chargés inconditionnellement dans `app.module.ts`
- Offline-first mobile fonctionnel (SQLite, sync engine, mutation queue)
- 7 entités synchronisées en local
- Pas de registre de modules
- Pas de feature flags
- Pas de système de licences

**Définition des modules :**

**COEUR (toujours actif) :**

- `auth` - Authentification
- `products` - Catalogue produits
- `customers` - Gestion clients (basique)
- `sales` - Transactions de vente
- `cash` - Gestion de caisse (entrées/sorties)
- `inventory` - Suivi de stock (basique)

**ÉTENDU (la plupart des boutiques) :**

- `suppliers` - Gestion fournisseurs
- `payments` - Traitement paiements
- `receivables` - Créances clients
- `debts` - Dettes fournisseurs
- `admin` - Gestion utilisateurs
- `reports` - KPIs et analytiques

**PREMIUM (entreprises/avancé) :**

- `enterprise` - Multi-boutique
- `transfers` - Transferts inter-boutiques
- `invoices` - Facturation formelle
- `notifications` - Notifications email
- `import` - Import bulk
- `packaging-types` - Conditionnements avancés

**Tasks :**

#### 5.1 CREATE `packages/core/src/modules/registry.ts`

- **IMPLEMENT** : Créer le registre des modules avec les définitions :
  - Chaque module a : `code`, `name`, `tier` (CORE/EXTENDED/PREMIUM), `minimumLicenseTier` (STARTER/PROFESSIONAL/ENTERPRISE), `syncableEntities` (liste des entités à synchroniser), `dependencies` (modules pré-requis)
  - Exporter les fonctions : `getModuleDefinition(code)`, `getModulesByTier(tier)`, `getCoreModules()`, `validateModuleDependencies(enabledModules)`
- **PATTERN** : Constantes typées TypeScript, pas de code dynamique

#### 5.2 UPDATE Schema Prisma - Licences

- **IMPLEMENT** : Ajouter au modèle Enterprise : `license_tier String @default("STARTER")`, `licensed_until DateTime?`, `max_shops Int @default(1)`, `max_users_per_shop Int @default(5)`. Ajouter au modèle Shop : `enabled_modules String[] @default(["auth","products","customers","sales","cash","inventory"])`.
- **VALIDATE** : `cd apps/api && npx prisma validate`

#### 5.3 CREATE Guard `EntitlementGuard`

- **IMPLEMENT** : Créer un guard NestJS qui vérifie si le module requis est activé pour la boutique de l'utilisateur. Utiliser un décorateur `@RequireModule('invoices')` sur les controllers. Le guard lit `shop.enabled_modules` et vérifie que le module est dans la liste. SUPERADMIN bypass le guard.
- **FILES** : `apps/api/src/common/guards/entitlement.guard.ts`, `apps/api/src/common/decorators/require-module.decorator.ts`

#### 5.4 UPDATE Controllers API - Décorateurs module

- **IMPLEMENT** : Ajouter `@RequireModule('xxx')` sur les controllers des modules EXTENDED et PREMIUM. Les modules CORE n'ont pas besoin du décorateur.
- **GOTCHA** : Ne pas bloquer l'existant - les boutiques existantes doivent avoir les modules par défaut

#### 5.5 UPDATE Mobile - Sync sélective

- **IMPLEMENT** : Au login mobile, récupérer les `enabled_modules` de la boutique via `GET /api/auth/me`. Stocker dans AsyncStorage. Modifier le `SyncEngine` pour ne synchroniser que les entités des modules activés. Modifier l'initialisation du schéma SQLite pour ne créer que les tables nécessaires.
- **GOTCHA** : Rétrocompatibilité - si `enabled_modules` absent de la réponse API, utiliser la liste complète

#### 5.6 UPDATE Mobile - Navigation conditionnelle

- **IMPLEMENT** : Dans `MainTabNavigator.tsx` et `MoreScreen.tsx`, masquer les onglets/boutons des modules non activés. Un module désactivé ne doit pas apparaître dans la navigation.
- **PATTERN** : Vérifier `enabledModules.includes('module_code')` avant le rendu

#### 5.7 CREATE Page web `ModuleManagement.tsx` (admin)

- **IMPLEMENT** : Page SUPERADMIN pour gérer les modules activés par boutique. Afficher tous les modules disponibles avec leur tier. Permettre l'activation/désactivation par boutique. Afficher les dépendances entre modules.

---

## TESTING STRATEGY

### Unit Tests

**Scope** : Services API (limites de crédit, blocage, entitlements)

**Requirements** :

- Framework : Jest (existant)
- Mocking : Prisma mocké (pattern existant dans les tests)
- Minimum coverage : 80% sur les nouveaux fichiers

**Test Categories :**

- Création de créance avec limite dépassée → `BadRequestException`
- Création de créance avec limite suffisante → Succès
- Création de dette fournisseur avec limite dépassée → `BadRequestException`
- Limite à 0 = pas de limite → Succès
- Vente à crédit avec client au-dessus de la limite → `BadRequestException`
- Blocage user → devices révoqués
- Blocage shop → tous les users de la shop bloqués
- Blocage enterprise → cascade sur toutes les shops
- Login d'un user bloqué → `ForbiddenException`
- Guard EntitlementGuard avec module désactivé → `ForbiddenException`
- Guard EntitlementGuard avec module activé → Passage

**VALIDATION COMMAND** : `cd apps/api && pnpm jest --coverage`

### Integration Tests

**Scope** : Workflows complets (vente à crédit → vérification limite → blocage)

**Test Scenarios :**

- Workflow complet : créer client avec limite → créer créances → atteindre la limite → tentative rejetée
- Workflow admin : bloquer user → vérifier login impossible → débloquer → login réussi
- Workflow vente : panier → auto-total → override prix → vérifier pricing_notes enregistré

**VALIDATION COMMAND** : `cd apps/api && pnpm jest --testPathPattern=integration`

### Edge Cases

- Limite de crédit = 0 (pas de limite, pas "zéro autorisé")
- Client sans créances existantes (solde = 0)
- Montants négatifs (remboursements) - ne doivent pas bloquer
- Vente à crédit sans client sélectionné
- Panier vide → total = 0
- Override de prix à la hausse (augmentation) - doit aussi requérir un commentaire
- Sync offline avec module désactivé entre-temps
- Déblocage d'une entreprise ne débloque que les shops bloquées par cascade (pas celles bloquées individuellement)

---

## VALIDATION COMMANDS

### Level 1 : Syntax & Style

```bash
pnpm run lint
pnpm run format:check
```

### Level 2 : Unit Tests

```bash
cd apps/api && pnpm jest --coverage
cd apps/mobile && pnpm jest
```

### Level 3 : Type Checking

```bash
pnpm run type-check
```

### Level 4 : Full Validation

```bash
pnpm run validate
```

### Level 5 : Manual Validation

**Web :**

1. Ouvrir `http://localhost:3001`
2. Login avec `owner@swalo.com / password123`
3. Naviguer sur chaque page et vérifier les couleurs alignées
4. Aller dans Clients → Détails → Modifier la limite de crédit
5. Aller dans Fournisseurs → Détails → Modifier la limite d'emprunt
6. Vérifier le dashboard admin (si SUPERADMIN)

**Mobile :**

1. Scanner le QR code Expo Go
2. Login avec code boutique `011225` + PIN `0000`
3. Faire une vente → vérifier l'auto-calcul du total
4. Modifier le total → vérifier que le commentaire est requis
5. Aller dans Clients → Détails → Vérifier l'affichage de la limite
6. Créer une créance dépassant la limite → vérifier le blocage

---

## ACCEPTANCE CRITERIA

- [ ] `Supplier.borrowing_limit` ajouté au schéma et migré
- [ ] Création de créance bloquée si dépassement `credit_limit` (client)
- [ ] Création de dette bloquée si dépassement `borrowing_limit` (fournisseur)
- [ ] Vente à crédit bloquée si dépassement limite
- [ ] Limite modifiable dans CustomerDetails et SupplierDetails (mobile + web)
- [ ] Total du panier calculé automatiquement depuis les items
- [ ] Override du prix nécessite un commentaire obligatoire
- [ ] `pricing_notes` et `expected_total` enregistrés côté base de données
- [ ] Thème web centralisé créé et appliqué
- [ ] 16 pages web refactorisées avec classes Tailwind (plus de styles inline)
- [ ] Gradients contextuels appliqués (clients=amber, fournisseurs=red, caisse=purple)
- [ ] Mécanisme de blocage User/Shop/Enterprise fonctionnel
- [ ] `BlockStatusGuard` actif globalement
- [ ] Vérification de blocage au login
- [ ] Logs d'audit pour toutes les actions admin
- [ ] Dashboard SuperAdmin enrichi avec stats et actions
- [ ] Page AuditLogs accessible
- [ ] Registre de modules créé dans `packages/core`
- [ ] `EntitlementGuard` fonctionnel
- [ ] Champs `enabled_modules` ajoutés au schema
- [ ] Navigation mobile conditionnelle selon modules activés
- [ ] Sync sélective selon modules activés
- [ ] Tous les tests passent (`pnpm run validate`)
- [ ] Pas de régression sur les fonctionnalités existantes

---

## COMPLETION CHECKLIST

- [ ] Phase 1 (Limites crédit/emprunt) complète et testée
- [ ] Phase 2 (Auto-total panier + traçabilité) complète et testée
- [ ] Phase 3 (Design web aligné) complète et vérifiée visuellement
- [ ] Phase 4 (Plateforme admin + blocage) complète et testée
- [ ] Phase 5 (Architecture modulaire) complète et testée
- [ ] Toutes les migrations Prisma appliquées
- [ ] Tous les tests unitaires passent (>80% coverage nouveaux fichiers)
- [ ] Lint et type-check passent sans erreur
- [ ] Tests manuels effectués sur mobile et web
- [ ] Pas de styles inline restants dans les pages web refactorisées

---

## PRIORITÉ D'IMPLÉMENTATION RECOMMANDÉE

| Ordre | Phase                            | Raison                                           |
| ----- | -------------------------------- | ------------------------------------------------ |
| 1     | Phase 1 : Limites crédit/emprunt | Impact métier immédiat, changements DB simples   |
| 2     | Phase 2 : Auto-total panier      | UX critique pour les caissiers                   |
| 3     | Phase 4 : Plateforme admin       | Nécessaire pour la gestion en production         |
| 4     | Phase 3 : Design web             | Amélioration visuelle, pas de risque fonctionnel |
| 5     | Phase 5 : Architecture modulaire | Structurant pour le futur, complexité élevée     |

---

## NOTES

- Le `credit_limit` existe déjà sur Customer mais n'est jamais vérifié - c'est une quick win
- Le `borrowing_limit` n'existe pas sur Supplier - nécessite une migration
- Le champ `payment_method` CREDIT existe dans l'enum mais n'est jamais utilisé dans les ventes
- Les 16 pages web totalisent ~7400 lignes de code à refactoriser pour le design
- Le système offline-first mobile est mature (SQLite + sync engine), l'architecture modulaire s'appuie dessus
- La plateforme admin est un prérequis avant le déploiement commercial

<!-- EOF -->
