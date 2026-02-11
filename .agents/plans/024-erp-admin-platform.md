# Feature: Plateforme d'Administration Generale SWALO ERP

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Construire la plateforme d'administration generale de SWALO - le panneau de controle central depuis lequel l'administrateur ERP peut:

- Creer et gerer les boutiques (CRUD complet)
- Creer et gerer les entreprises multi-boutiques
- Octroyer/modifier/revoquer les licences (STARTER, PROFESSIONAL, ENTERPRISE)
- Gerer les modules actives par boutique
- Gerer les utilisateurs globalement (pas seulement par boutique)
- Visualiser des statistiques avancees et KPIs de la plateforme
- Consulter et exporter les logs d'audit
- Configurer les parametres systeme globaux

## User Story

En tant qu'administrateur de la plateforme SWALO (SUPERADMIN),
Je veux une interface centralisee pour gerer l'ensemble de mon ERP,
Afin de creer des boutiques, attribuer des licences, controler les modules actifs, et suivre l'activite de toutes les boutiques depuis un seul endroit.

## Problem Statement

Actuellement, la plateforme SWALO dispose d'un backend admin quasi-complet (blocking, audit, modules, stats) mais l'interface web d'administration est limitee:

- Pas de CRUD entreprises dans l'UI (seulement blocking)
- Pas de creation de boutique depuis l'admin (uniquement via inscription)
- Pas de gestion de licences (champs en base mais pas d'interface)
- Pas de gestion des modules par boutique dans l'UI
- Pas de vue utilisateurs globale (seulement par boutique)
- Pas d'analytics avancees (pas de graphiques)
- Pas d'export des donnees admin
- Pas de configuration systeme via l'UI

## Solution Statement

Construire une plateforme d'administration complete en 6 phases:

1. **API CRUD manquants** - Entreprises CRUD, boutique creation admin-side, utilisateurs globaux
2. **Gestion des licences** - Interface et API pour octroyer/modifier les tiers de licence
3. **Gestion des modules** - Interface dediee pour activer/desactiver les modules par boutique
4. **Admin Dashboard avance** - Graphiques, analytics, exports
5. **Configuration systeme** - Interface pour les parametres SystemConfig
6. **Securite renforcee** - Token revocation on block, login checks

## Feature Metadata

**Feature Type**: New Capability + Enhancement
**Estimated Complexity**: High
**Primary Systems Affected**: API (admin modules), Web (admin pages), Prisma (migrations mineurs)
**Dependencies**: recharts (graphiques), date-fns (deja installe), xlsx ou csv-stringify (export)

---

## CONTEXT REFERENCES

### Relevant Codebase Files - READ BEFORE IMPLEMENTING

**API - Admin Controllers & Services:**

- `apps/api/src/modules/admin/admin.controller.ts` - Admin endpoints existants (shops list, users, devices, roles)
- `apps/api/src/modules/admin/admin.service.ts` - Service admin (shop CRUD, user management)
- `apps/api/src/modules/admin-controls/admin-controls.controller.ts` - Blocking, audit, modules endpoints
- `apps/api/src/modules/admin-controls/admin-controls.service.ts` - Blocking cascade, audit logging, stats

**API - Auth & Registration:**

- `apps/api/src/modules/auth/auth.service.ts` (lines 40-80) - `register()` et `createShop()` methods
- `apps/api/src/modules/auth/auth.controller.ts` - Registration endpoints
- `apps/api/src/modules/auth/dto/auth.dto.ts` - RegisterDto, CreateShopDto

**API - Guards & Decorators:**

- `apps/api/src/common/guards/block-status.guard.ts` - BlockStatusGuard (APP_GUARD)
- `apps/api/src/common/guards/entitlement.guard.ts` - EntitlementGuard (APP_GUARD)
- `apps/api/src/common/decorators/require-module.decorator.ts` - @RequireModule()
- `apps/api/src/common/guards/roles.guard.ts` - RolesGuard
- `apps/api/src/common/decorators/roles.decorator.ts` - @Roles()
- `apps/api/src/common/decorators/current-user.decorator.ts` - @CurrentUser()
- `apps/api/src/common/enums/role.enum.ts` - Role enum

**API - Schema:**

- `apps/api/prisma/schema.prisma` - Enterprise (lines 11-34), Shop (36-82), User (84-112), AuditLog (848-864), SystemConfig (866-875)

**Web - Pages existantes:**

- `apps/web/src/pages/SuperAdminDashboard.tsx` - Dashboard actuel (KPIs + shops table + blocking)
- `apps/web/src/pages/AuditLogs.tsx` - Logs d'audit avec filtres et pagination
- `apps/web/src/pages/EnterpriseDashboard.tsx` - Dashboard entreprise avec transferts
- `apps/web/src/App.tsx` - Routes et protection par role
- `apps/web/src/components/Layout/MainLayout.tsx` - Navigation sidebar

**Web - API Client:**

- `apps/web/src/lib/api.ts` (lines 632-757) - adminApi namespace complet (18 endpoints)

**Shared:**

- `packages/core/src/modules/registry.ts` - Module definitions, license tiers, dependencies

### New Files to Create

**API:**

- `apps/api/src/modules/admin/dto/create-shop-admin.dto.ts` - DTO pour creation boutique par admin
- `apps/api/src/modules/admin/dto/create-enterprise.dto.ts` - DTO pour creation entreprise
- `apps/api/src/modules/admin/dto/update-enterprise.dto.ts` - DTO pour mise a jour entreprise
- `apps/api/src/modules/admin/dto/update-license.dto.ts` - DTO pour gestion de licence
- `apps/api/src/modules/admin/dto/system-config.dto.ts` - DTO pour config systeme

**Web:**

- `apps/web/src/pages/admin/AdminShops.tsx` - Page CRUD boutiques
- `apps/web/src/pages/admin/AdminEnterprises.tsx` - Page CRUD entreprises
- `apps/web/src/pages/admin/AdminUsers.tsx` - Page gestion utilisateurs globale
- `apps/web/src/pages/admin/AdminModules.tsx` - Page gestion modules par boutique
- `apps/web/src/pages/admin/AdminLicenses.tsx` - Page gestion licences
- `apps/web/src/pages/admin/AdminSystemConfig.tsx` - Page configuration systeme
- `apps/web/src/pages/admin/AdminAnalytics.tsx` - Page analytics avancees

### Patterns to Follow

**Naming Conventions:**

- Controllers: kebab-case pour les routes (`/admin/enterprises`)
- Services: camelCase pour les methodes (`createEnterprise`, `updateLicense`)
- DTOs: PascalCase (`CreateEnterpriseDto`)
- Web pages: PascalCase components (`AdminEnterprises`)
- API client: camelCase namespaces (`adminApi.createEnterprise()`)

**Error Handling:**

- Toutes les erreurs metier en NestJS exceptions (NotFoundException, BadRequestException, ForbiddenException)
- Messages d'erreur en francais pour l'utilisateur final
- Audit log pour chaque action admin sensible (create, update, delete, block, unblock, license change, module change)

**Data Validation:**

- Utiliser class-validator sur tous les DTOs
- Validation cote client dans les formulaires web (required, min/max, formats)
- Prix toujours en entiers FCFA (pas de decimales)

**Audit Logging Pattern:**

- Suivre le pattern de `admin-controls.service.ts` pour chaque action SUPERADMIN
- Enregistrer: admin_id, action (verbe_entite), entity_type, entity_id, old_value, new_value, reason

---

## IMPLEMENTATION PLAN

### Phase 1: API - Enterprise CRUD & Shop Creation Admin

Ajouter les endpoints manquants pour le CRUD complet des entreprises et la creation de boutiques cote admin.

**Tasks:**

- Creer les DTOs pour Enterprise (create, update) et Shop creation admin
- Ajouter les endpoints CRUD Enterprise dans admin.controller.ts
- Ajouter l'endpoint de creation de boutique par SUPERADMIN (sans necessiter d'inscription)
- Ajouter la gestion des licences (update license tier, set expiration, set limits)
- Audit log pour chaque operation

### Phase 2: API - Utilisateurs Globaux & Config Systeme

Ajouter les endpoints pour gestion globale des utilisateurs et configuration systeme.

**Tasks:**

- Endpoint de recherche utilisateurs globale (cross-shop)
- Endpoint CRUD SystemConfig
- Endpoint export audit logs en CSV
- Renforcer les checks de securite (login blocking, token revocation)

### Phase 3: Web - Navigation & Layout Admin

Restructurer la navigation admin pour integrer toutes les nouvelles pages.

**Tasks:**

- Ajouter les nouvelles routes dans App.tsx
- Creer un sous-menu admin dans MainLayout.tsx
- Adapter la sidebar pour afficher toutes les sections admin SUPERADMIN

### Phase 4: Web - Pages CRUD Admin

Creer les pages de gestion pour boutiques, entreprises, licences, modules.

**Tasks:**

- Page AdminShops: liste, creation, edition, suppression, blocking
- Page AdminEnterprises: liste, creation, edition, suppression, blocking, assignation boutiques
- Page AdminLicenses: vue licence par entreprise, modification tier, dates
- Page AdminModules: vue modules par boutique, activation/desactivation
- Page AdminUsers: recherche globale, vue roles multi-shop

### Phase 5: Web - Analytics & Export

Dashboard analytics avance avec graphiques et fonctionnalites d'export.

**Tasks:**

- Installer recharts pour les graphiques
- Page AdminAnalytics: graphiques evolution (shops, users, sales), top boutiques, repartition modules
- Export CSV des audit logs
- Export CSV des listes (shops, users, enterprises)

### Phase 6: Web - Configuration Systeme & Securite

Configuration systeme et ameliorations de securite.

**Tasks:**

- Page AdminSystemConfig: CRUD des parametres SystemConfig
- Verifier blocking au login (shop + enterprise, pas seulement user)
- Ajouter IP address collection dans les audit logs
- Tests E2E pour les nouveaux endpoints

---

## STEP-BY-STEP TASKS

### Phase 1: API - Enterprise CRUD & Shop Creation Admin

#### Task 1.1: CREATE `apps/api/src/modules/admin/dto/create-enterprise.dto.ts`

- **IMPLEMENT**: DTO avec champs: name (required string), owner_id (optional UUID - pour lier un proprietaire existant), license_tier (optional enum STARTER|PROFESSIONAL|ENTERPRISE, default STARTER), max_shops (optional int, default 1), max_users_per_shop (optional int, default 5), licensed_until (optional date string)
- **PATTERN**: Suivre le pattern de `apps/api/src/modules/auth/dto/auth.dto.ts` pour les decorateurs class-validator
- **VALIDATE**: `cd apps/api && npx tsc --noEmit`

#### Task 1.2: CREATE `apps/api/src/modules/admin/dto/update-enterprise.dto.ts`

- **IMPLEMENT**: DTO avec tous les champs optionnels: name, license_tier, max_shops, max_users_per_shop, licensed_until, enabled_modules (pour appliquer a toutes les boutiques)
- **PATTERN**: Suivre PartialType pattern si dispo, sinon @IsOptional sur tous les champs
- **VALIDATE**: `cd apps/api && npx tsc --noEmit`

#### Task 1.3: CREATE `apps/api/src/modules/admin/dto/create-shop-admin.dto.ts`

- **IMPLEMENT**: DTO pour creation de boutique par SUPERADMIN: shop_name (required), shop_code (optional - auto-generate si absent), owner_id (optional UUID - lier a un utilisateur existant), enterprise_id (optional UUID), shop_type (optional enum BOUTIQUE|MAGASIN, default BOUTIQUE), address (optional), phone (optional), email (optional), currency (optional, default XOF), enabled_modules (optional string array)
- **PATTERN**: Similaire a CreateShopDto de auth.dto.ts mais plus complet
- **VALIDATE**: `cd apps/api && npx tsc --noEmit`

#### Task 1.4: CREATE `apps/api/src/modules/admin/dto/update-license.dto.ts`

- **IMPLEMENT**: DTO pour modifier la licence d'une entreprise: license_tier (required enum), licensed_until (optional date), max_shops (optional int), max_users_per_shop (optional int)
- **VALIDATE**: `cd apps/api && npx tsc --noEmit`

#### Task 1.5: UPDATE `apps/api/src/modules/admin/admin.service.ts`

- **IMPLEMENT**: Ajouter les methodes suivantes:
  - `createEnterprise(adminId, dto)` - Creer une enterprise, generer le code, creer audit log (action: CREATE_ENTERPRISE)
  - `getAllEnterprises()` - Liste toutes les entreprises avec count shops, users, licence info
  - `getEnterpriseDetails(id)` - Detail entreprise avec shops et stats
  - `updateEnterprise(id, adminId, dto)` - Mise a jour entreprise, audit log (action: UPDATE_ENTERPRISE)
  - `deleteEnterprise(id, adminId)` - Soft delete enterprise + cascade shops, audit log (action: DELETE_ENTERPRISE)
  - `createShopAdmin(adminId, dto)` - Creer une boutique directement (sans inscription), generer shop_code si absent, creer audit log (action: CREATE_SHOP)
  - `updateLicense(enterpriseId, adminId, dto)` - Mettre a jour le tier de licence, ajuster enabled_modules des boutiques selon le nouveau tier, audit log (action: UPDATE_LICENSE)
  - `addShopToEnterprise(enterpriseId, shopId, adminId)` - Rattacher une boutique a une entreprise, audit log
  - `removeShopFromEnterprise(shopId, adminId)` - Detacher une boutique, audit log
  - `getGlobalUsers(search?, role?, page, limit)` - Recherche globale utilisateurs avec roles et shops
- **PATTERN**: Suivre le pattern d'audit logging de admin-controls.service.ts (creer AuditLog pour chaque action)
- **DEPENDENCIES**: PrismaService (deja injecte)
- **GOTCHA**: Ne pas oublier d'utiliser les transactions Prisma pour les operations cascade (deleteEnterprise). Utiliser `user.userId` (PAS `user.sub`) partout.
- **VALIDATE**: `cd apps/api && npx tsc --noEmit && pnpm test`

#### Task 1.6: UPDATE `apps/api/src/modules/admin/admin.controller.ts`

- **IMPLEMENT**: Ajouter les endpoints:
  - `POST /admin/enterprises` - createEnterprise (SUPERADMIN)
  - `GET /admin/enterprises` - getAllEnterprises (SUPERADMIN)
  - `GET /admin/enterprises/:id` - getEnterpriseDetails (SUPERADMIN)
  - `PUT /admin/enterprises/:id` - updateEnterprise (SUPERADMIN)
  - `DELETE /admin/enterprises/:id` - deleteEnterprise (SUPERADMIN)
  - `POST /admin/shops` - createShopAdmin (SUPERADMIN)
  - `PUT /admin/enterprises/:id/license` - updateLicense (SUPERADMIN)
  - `POST /admin/enterprises/:id/shops/:shopId` - addShopToEnterprise (SUPERADMIN)
  - `DELETE /admin/enterprises/:id/shops/:shopId` - removeShopFromEnterprise (SUPERADMIN)
  - `GET /admin/users/global` - getGlobalUsers (SUPERADMIN)
- **PATTERN**: Suivre le pattern existant du controller (JwtAuthGuard, RolesGuard, @Roles, @CurrentUser ou @Request)
- **GOTCHA**: Utiliser `req.user.userId` (PAS `req.user.sub`). S'assurer que tous les req ont le type `: any`.
- **VALIDATE**: `cd apps/api && npx tsc --noEmit && pnpm test`

#### Task 1.7: CREATE tests unitaires pour les nouveaux endpoints

- **IMPLEMENT**: Creer `apps/api/test/admin-enterprise.spec.ts` avec tests pour:
  - CRUD Enterprise (create, list, detail, update, delete)
  - Create shop admin-side
  - License update
  - Shop assignment to enterprise
  - Global user search
- **PATTERN**: Suivre le pattern de `apps/api/test/fifo-destock.spec.ts` (mock PrismaService)
- **VALIDATE**: `cd apps/api && pnpm test`

### Phase 2: API - SystemConfig & Export

#### Task 2.1: CREATE `apps/api/src/modules/admin/dto/system-config.dto.ts`

- **IMPLEMENT**: DTOs pour SystemConfig:
  - `CreateSystemConfigDto`: key (required, string), value (required, string), description (optional)
  - `UpdateSystemConfigDto`: value (required), description (optional)
- **VALIDATE**: `cd apps/api && npx tsc --noEmit`

#### Task 2.2: UPDATE `apps/api/src/modules/admin/admin.service.ts`

- **IMPLEMENT**: Ajouter les methodes:
  - `getSystemConfigs()` - Liste toutes les configs
  - `getSystemConfig(key)` - Obtenir une config par cle
  - `setSystemConfig(key, value, description, adminId)` - Creer/mettre a jour, audit log
  - `deleteSystemConfig(key, adminId)` - Supprimer, audit log
  - `exportAuditLogs(filters)` - Retourner les audit logs en format CSV (string)
- **VALIDATE**: `cd apps/api && npx tsc --noEmit && pnpm test`

#### Task 2.3: UPDATE `apps/api/src/modules/admin/admin.controller.ts`

- **IMPLEMENT**: Ajouter les endpoints:
  - `GET /admin/system-config` - getSystemConfigs (SUPERADMIN)
  - `GET /admin/system-config/:key` - getSystemConfig (SUPERADMIN)
  - `PUT /admin/system-config/:key` - setSystemConfig (SUPERADMIN)
  - `DELETE /admin/system-config/:key` - deleteSystemConfig (SUPERADMIN)
  - `GET /admin/audit-logs/export` - exportAuditLogs en CSV (SUPERADMIN)
- **VALIDATE**: `cd apps/api && npx tsc --noEmit && pnpm test`

#### Task 2.4: UPDATE `apps/api/src/modules/auth/auth.service.ts`

- **IMPLEMENT**: Dans la methode `login()` et `loginWithPin()`, ajouter les verifications:
  - Verifier si la boutique (shop) est bloquee -> rejeter avec message
  - Verifier si l'entreprise parente est bloquee -> rejeter avec message
  - Actuellement seul le user blocking est verifie au login
- **PATTERN**: Suivre le pattern existant du user blocking check (lines 136-148)
- **GOTCHA**: Le PIN login (`loginWithPin`) doit aussi faire ces verifications
- **VALIDATE**: `cd apps/api && npx tsc --noEmit && pnpm test`

### Phase 3: Web - Navigation & Routes

#### Task 3.1: UPDATE `apps/web/src/lib/api.ts`

- **IMPLEMENT**: Ajouter dans le namespace adminApi les nouveaux endpoints:
  - `createEnterprise(dto)` - POST /admin/enterprises
  - `getAllEnterprises()` - GET /admin/enterprises
  - `getEnterpriseDetails(id)` - GET /admin/enterprises/:id
  - `updateEnterprise(id, dto)` - PUT /admin/enterprises/:id
  - `deleteEnterprise(id)` - DELETE /admin/enterprises/:id
  - `createShopAdmin(dto)` - POST /admin/shops
  - `updateLicense(enterpriseId, dto)` - PUT /admin/enterprises/:id/license
  - `addShopToEnterprise(enterpriseId, shopId)` - POST /admin/enterprises/:id/shops/:shopId
  - `removeShopFromEnterprise(enterpriseId, shopId)` - DELETE /admin/enterprises/:id/shops/:shopId
  - `getGlobalUsers(params)` - GET /admin/users/global
  - `getSystemConfigs()` - GET /admin/system-config
  - `setSystemConfig(key, dto)` - PUT /admin/system-config/:key
  - `deleteSystemConfig(key)` - DELETE /admin/system-config/:key
  - `exportAuditLogs(filters)` - GET /admin/audit-logs/export
- **PATTERN**: Suivre le pattern existant du namespace adminApi dans api.ts (lines 632-757)
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

#### Task 3.2: UPDATE `apps/web/src/App.tsx`

- **IMPLEMENT**: Ajouter les routes admin suivantes (protegees SUPERADMIN):
  - `/admin/shops` -> AdminShops
  - `/admin/enterprises` -> AdminEnterprises
  - `/admin/licenses` -> AdminLicenses
  - `/admin/modules` -> AdminModules
  - `/admin/users-global` -> AdminUsers
  - `/admin/analytics` -> AdminAnalytics
  - `/admin/system-config` -> AdminSystemConfig
- **PATTERN**: Suivre le pattern ProtectedRoute existant avec roles=['SUPERADMIN']
- **GOTCHA**: Lazy load les nouvelles pages avec React.lazy si elles sont lourdes
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

#### Task 3.3: UPDATE `apps/web/src/components/Layout/MainLayout.tsx`

- **IMPLEMENT**: Restructurer la navigation admin en sous-menu:
  - Section "Administration" (SUPERADMIN uniquement) avec icone shield
  - Sous-items: Dashboard, Boutiques, Entreprises, Licences, Modules, Utilisateurs, Analytics, Logs d'audit, Configuration
  - Le sous-menu doit etre collapsible/expandable
- **PATTERN**: Suivre le pattern existant de navigation dans MainLayout
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

### Phase 4: Web - Pages CRUD Admin

#### Task 4.1: CREATE `apps/web/src/pages/admin/AdminShops.tsx`

- **IMPLEMENT**: Page de gestion des boutiques:
  - Tableau avec: nom, code, proprietaire, type (BOUTIQUE/MAGASIN), entreprise rattachee, statut (actif/bloque), modules actifs, date creation
  - Filtres: recherche texte, statut (tous/actifs/bloques), type, entreprise
  - Actions par boutique: editer, bloquer/debloquer, supprimer, gerer modules
  - Bouton "Nouvelle Boutique" -> modal de creation (CreateShopAdmin DTO)
  - Modal de detail boutique avec stats (users, products, sales, revenue)
  - Pagination
- **PATTERN**: Suivre le pattern du SuperAdminDashboard existant pour le tableau et les modals
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

#### Task 4.2: CREATE `apps/web/src/pages/admin/AdminEnterprises.tsx`

- **IMPLEMENT**: Page de gestion des entreprises:
  - Tableau avec: nom, proprietaire, licence tier (badge colore), date expiration, max shops/current shops, max users, statut
  - Filtres: recherche, tier licence, statut
  - Actions: editer, bloquer/debloquer, supprimer, gerer licence
  - Bouton "Nouvelle Entreprise" -> modal creation
  - Modal detail entreprise: liste des boutiques rattachees, stats agregees, historique audit
  - Drag & drop ou boutons pour ajouter/retirer des boutiques
- **PATTERN**: Similaire a AdminShops avec les memes composants UI
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

#### Task 4.3: CREATE `apps/web/src/pages/admin/AdminLicenses.tsx`

- **IMPLEMENT**: Page de gestion des licences:
  - Vue par entreprise avec: tier actuel, date expiration, limites (shops, users)
  - Action: modifier le tier (STARTER -> PROFESSIONAL -> ENTERPRISE)
  - Affichage des modules disponibles selon le tier (utiliser la registry de packages/core)
  - Preview des changements avant validation (modules qui seront ajoutes/retires)
  - Historique des changements de licence (via audit logs filtres)
- **DEPENDENCIES**: Importer les fonctions de `packages/core/src/modules/registry.ts`
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

#### Task 4.4: CREATE `apps/web/src/pages/admin/AdminModules.tsx`

- **IMPLEMENT**: Page de gestion des modules par boutique:
  - Selecteur de boutique (dropdown ou recherche)
  - Grille des 18 modules avec: nom, description, tier (CORE/EXTENDED/PREMIUM), statut (actif/inactif)
  - Toggle on/off pour chaque module (sauf CORE qui sont toujours actifs)
  - Verification des dependances en temps reel (si module A depend de B, griser A si B est desactive)
  - Affichage du tier de licence de l'entreprise et des modules disponibles
  - Sauvegarde en batch (pas un appel API par toggle)
- **DEPENDENCIES**: Importer MODULE_DEFINITIONS et utilitaires depuis `packages/core/src/modules/registry.ts`
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

#### Task 4.5: CREATE `apps/web/src/pages/admin/AdminUsers.tsx`

- **IMPLEMENT**: Page de gestion globale des utilisateurs:
  - Tableau: nom, email, telephone, roles (multi-shop badges), statut (actif/bloque), derniere connexion, appareils
  - Filtres: recherche, role, statut, boutique
  - Actions: bloquer/debloquer, voir details, editer roles
  - Modal detail utilisateur: infos, liste des roles par boutique, appareils connectes, historique (audit logs)
  - Pagination serveur-side
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

### Phase 5: Web - Analytics & Export

#### Task 5.1: Installer recharts

- **IMPLEMENT**: Ajouter recharts comme dependance au workspace web
- **VALIDATE**: `cd apps/web && pnpm add recharts`

#### Task 5.2: CREATE `apps/web/src/pages/admin/AdminAnalytics.tsx`

- **IMPLEMENT**: Dashboard analytics avance:
  - Graphique 1: Evolution du nombre de boutiques dans le temps (ligne)
  - Graphique 2: Evolution du nombre d'utilisateurs (ligne)
  - Graphique 3: Repartition des licences par tier (camembert)
  - Graphique 4: Top 10 boutiques par chiffre d'affaires (barres)
  - Graphique 5: Repartition des modules actives (barres horizontales)
  - KPIs: taux de retention, boutiques actives vs inactives, revenue total plateforme
  - Periode selectionnable (7j, 30j, 90j, 1an)
- **PATTERN**: Utiliser les composants recharts (LineChart, BarChart, PieChart)
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

#### Task 5.3: UPDATE `apps/web/src/pages/AuditLogs.tsx`

- **IMPLEMENT**: Ajouter fonctionnalite d'export:
  - Bouton "Exporter CSV" qui appelle adminApi.exportAuditLogs(filters)
  - Telechargement automatique du fichier CSV
  - Ajouter les filtres manquants: date range (start_date, end_date), admin_id
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

### Phase 6: Web - Configuration Systeme

#### Task 6.1: CREATE `apps/web/src/pages/admin/AdminSystemConfig.tsx`

- **IMPLEMENT**: Page de configuration systeme:
  - Tableau des parametres: cle, valeur, description, date derniere modification
  - Edition inline ou via modal
  - Ajout de nouveaux parametres
  - Suppression avec confirmation
  - Parametres sugeres: MAX_LOGIN_ATTEMPTS, SESSION_TIMEOUT, DEFAULT_CURRENCY, MAINTENANCE_MODE, etc.
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

#### Task 6.2: UPDATE SuperAdminDashboard comme hub central

- **IMPLEMENT**: Transformer le SuperAdminDashboard en hub avec:
  - Liens rapides vers toutes les pages admin (cards cliquables)
  - KPIs principaux (deja existants)
  - Alertes: licences expirant bientot, boutiques inactives, erreurs recentes
  - Widget audit logs recents (deja existant)
  - Widget activite en temps reel (derniers logins, dernieres ventes)
- **PATTERN**: Enrichir le composant existant, ne pas le remplacer
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

---

## TESTING STRATEGY

### Unit Tests

**Scope**: Tous les nouveaux services admin (Enterprise CRUD, License, SystemConfig, Global Users)

**Requirements**:
- Framework: Jest (deja configure)
- Pattern: Mock PrismaService comme dans les tests existants
- Minimum: chaque methode de service testee (happy path + erreurs)

**Test Categories**:
- CRUD Enterprise: create, read, update, delete, cascade delete
- License management: upgrade, downgrade, module adjustment
- Shop creation admin: with/without enterprise, code generation
- Global user search: avec/sans filtres, pagination
- SystemConfig CRUD
- Audit logging verification

**VALIDATION COMMAND**: `cd apps/api && pnpm test`

### Integration Tests (E2E)

**Scope**: Les nouveaux endpoints API

**Requirements**:
- Framework: Jest + Supertest (deja configure)
- Tester l'authentification (SUPERADMIN required)
- Tester les cascades (delete enterprise -> shops)

**VALIDATION COMMAND**: `cd apps/api && pnpm test:e2e`

### Edge Cases

- Creer une entreprise sans proprietaire
- Supprimer une entreprise qui a des boutiques actives avec des ventes
- Changer de tier licence ENTERPRISE -> STARTER (modules premium desactives)
- Bloquer une entreprise dont des boutiques sont individuellement bloquees
- Debloquer une entreprise -> les boutiques bloquees individuellement restent bloquees
- Config systeme: cle en double, valeurs vides
- Global user search avec caracteres speciaux

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
pnpm --filter @swalo/api run lint
pnpm --filter @swalo/web run lint
pnpm --filter @swalo/api run type-check
pnpm --filter @swalo/mobile run type-check
```

**Expected**: 0 errors (warnings acceptables)

### Level 2: Unit Tests

```bash
cd apps/api && pnpm test
cd apps/mobile && pnpm test
```

**Expected**: Tous les tests passent, y compris les nouveaux

### Level 3: Integration Tests

```bash
cd apps/api && pnpm test:e2e
```

**Expected**: Tous les E2E passent

### Level 4: Full Validation

```bash
pnpm run validate
pnpm run format:check
```

**Expected**: Zero erreurs

### Level 5: Manual Validation

**API Testing** (via curl):
1. Login SUPERADMIN -> obtenir token
2. POST /admin/enterprises -> creer entreprise
3. POST /admin/shops -> creer boutique rattachee
4. PUT /admin/enterprises/:id/license -> changer licence
5. GET /admin/enterprises -> verifier la liste
6. GET /admin/users/global -> rechercher utilisateurs
7. GET /admin/system-config -> lister configs
8. PUT /admin/system-config/TEST_KEY -> creer config
9. GET /admin/audit-logs -> verifier les logs de toutes ces actions

**Web Testing** (navigateur localhost:3001):
1. Login SUPERADMIN
2. Naviguer dans chaque page admin
3. Creer une entreprise
4. Creer une boutique rattachee
5. Modifier la licence
6. Gerer les modules
7. Rechercher un utilisateur
8. Exporter les audit logs
9. Modifier une config systeme

---

## ACCEPTANCE CRITERIA

- [ ] CRUD Enterprise complet (API + Web)
- [ ] Creation de boutique admin-side (API + Web)
- [ ] Gestion des licences avec impact sur les modules (API + Web)
- [ ] Gestion des modules par boutique (API + Web)
- [ ] Recherche globale des utilisateurs (API + Web)
- [ ] Configuration systeme (API + Web)
- [ ] Analytics avec graphiques (Web)
- [ ] Export CSV des audit logs (API + Web)
- [ ] Navigation admin complete avec sous-menu
- [ ] Verification blocking au login (shop + enterprise)
- [ ] Audit logging pour toutes les nouvelles actions
- [ ] Tous les tests existants continuent de passer
- [ ] Nouveaux tests unitaires pour chaque service
- [ ] Type-check passe sans erreur
- [ ] Lint passe sans erreur (warnings OK)
- [ ] Prettier format check passe
- [ ] Features catalog mis a jour

---

## COMPLETION CHECKLIST

- [ ] Phase 1 completee (API Enterprise CRUD + Shop creation + License)
- [ ] Phase 2 completee (API SystemConfig + Export + Login security)
- [ ] Phase 3 completee (Web routes + navigation)
- [ ] Phase 4 completee (Web pages CRUD)
- [ ] Phase 5 completee (Web analytics + export)
- [ ] Phase 6 completee (Web config + SuperAdmin hub)
- [ ] Tous les tests passent (`pnpm run validate`)
- [ ] Type-check passe (`pnpm --filter @swalo/api run type-check`)
- [ ] Prettier passe (`pnpm run format:check`)
- [ ] Features catalog mis a jour (`docs/specs/features-catalog.md`)
- [ ] Test manuel API effectue
- [ ] Test manuel Web effectue
- [ ] Aucune regression sur les fonctionnalites existantes

---

## EXTERNAL RESOURCES AND REFERENCES

### Official Documentation
- NestJS Controllers: https://docs.nestjs.com/controllers
- NestJS Guards: https://docs.nestjs.com/guards
- NestJS DTOs & Validation: https://docs.nestjs.com/techniques/validation
- Prisma CRUD: https://www.prisma.io/docs/concepts/components/prisma-client/crud
- Prisma Transactions: https://www.prisma.io/docs/concepts/components/prisma-client/transactions
- Recharts: https://recharts.org/en-US/api
- React Router: https://reactrouter.com/en/main
- Tailwind CSS: https://tailwindcss.com/docs

### Internal Resources
- Module Registry: `packages/core/src/modules/registry.ts`
- Admin Controls Service (pattern): `apps/api/src/modules/admin-controls/admin-controls.service.ts`
- Audit Log pattern: search "AuditLog" in admin-controls service
- Existing SuperAdmin Dashboard: `apps/web/src/pages/SuperAdminDashboard.tsx`
- API Client pattern: `apps/web/src/lib/api.ts` (adminApi namespace)
- Schema reference: `apps/api/prisma/schema.prisma`

---

## NOTES

**Decisions architecturales:**

1. **Pas de nouvelle migration Prisma** - Tous les champs necessaires existent deja (Enterprise avec license_tier, max_shops, etc. / Shop avec enabled_modules / AuditLog / SystemConfig). On utilise `prisma db push` si besoin de sync.

2. **Reutilisation du module admin existant** - Plutot que creer un nouveau module, on enrichit `admin.controller.ts` et `admin.service.ts` existants pour eviter la fragmentation.

3. **Audit logging systematique** - Chaque action admin sensible genere un AuditLog. Cela sert a la fois de journal de bord et de feature pour le SUPERADMIN.

4. **Module registry comme source de verite** - La registry dans `packages/core` definit les modules et leurs tiers. Le web importe cette registry pour afficher les options de modules coherentes.

5. **Pas de systeme de paiement** - La gestion des licences est manuelle (SUPERADMIN modifie le tier). L'integration de paiement est hors scope pour cette iteration.

6. **Export CSV cote serveur** - L'export est genere par l'API (pas par le frontend) pour gerer les gros volumes sans surcharger le navigateur.

**Risques:**

- La complexite de la cascade blocking (Enterprise -> Shops) necessite des tests thorough
- L'ajout de recharts augmente la taille du bundle web (mitiger avec lazy loading)
- La recherche globale utilisateurs peut etre lente sur de gros volumes (pagination obligatoire)

<!-- EOF -->
