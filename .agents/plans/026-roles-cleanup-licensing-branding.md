# Feature: Nettoyage roles, enterprise obligatoire, licensing admin, branding

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Plan couvrant 6 axes :

1. Fix de la page Shops dans web-admin (champs mal mappes)
2. **Entreprise obligatoire** : toute boutique DOIT appartenir a une entreprise (plus de standalone)
3. Simplification des roles a 3 courants (EMPLOYEE, MANAGER, BOSS) + 1 admin (SUPERADMIN)
4. Gestion des licences et modules depuis la plateforme admin exclusivement
5. Creation d'entreprise exclusive a la plateforme admin
6. Affichage branding "Entreprise - Boutique" partout + logo entreprise

## User Story

En tant qu'administrateur plateforme SWALO,
je veux que chaque boutique appartienne obligatoirement a une entreprise,
gerer les entreprises, licences et modules depuis une interface admin separee,
afin de piloter mon business avec des roles simplifies et un branding coherent.

## Problem Statement

- La page Shops dans web-admin ne fonctionne pas (champs frontend != champs API)
- `enterprise_id` est optionnel sur Shop => boutiques orphelines sans entreprise
- 6 roles differents creent de la confusion (OWNER, MANAGER, CASHIER, ADMIN, EMPLOYEE, SUPERADMIN)
- Les modules peuvent etre actives sans respecter la licence
- Les entreprises peuvent etre creees en dehors de la plateforme admin
- Le nom de l'entreprise n'apparait nulle part dans l'app boutique ni sur les factures
- Pas de champ logo sur Enterprise

## Solution Statement

- Corriger le mapping des champs dans AdminShops.tsx
- **Rendre enterprise_id REQUIRED** sur Shop (migration + creation enterprise par defaut pour shops orphelines)
- Reduire les roles a 3 + SUPERADMIN avec migration DB
- Ajouter validation licence-modules et creation entreprise exclusive admin
- Inclure les infos entreprise dans auth/me et afficher "Entreprise - Boutique" partout
- Ajouter champ logo_url sur Enterprise

## Feature Metadata

**Feature Type**: Refactor + Enhancement
**Estimated Complexity**: High
**Primary Systems Affected**: API (schema, auth, admin, enterprise, all controllers), Web, Web-Admin, Mobile
**Dependencies**: Aucune nouvelle dependance externe

---

## CONTEXT REFERENCES

### Relevant Codebase Files

**Schema & Models:**

- `apps/api/prisma/schema.prisma` (lines 11-34: Enterprise, 36-82: Shop, 773-780: Role enum, 114-130: UserRole)

**Admin Controllers:**

- `apps/api/src/modules/admin/admin.controller.ts` - 16 endpoints SUPERADMIN
- `apps/api/src/modules/admin/admin.service.ts` - Enterprise CRUD, Shop creation, License, System Config
- `apps/api/src/modules/admin-controls/admin-controls.controller.ts` - Block/Unblock, Audit logs, Module management
- `apps/api/src/modules/admin-controls/admin-controls.service.ts` - Block/Unblock logic

**Enterprise Module (a simplifier):**

- `apps/api/src/modules/enterprise/enterprise.controller.ts` - POST /enterprises accessible OWNER (a supprimer)
- `apps/api/src/modules/enterprise/enterprise.service.ts` - create(), addShop(), removeShop(), deleteEnterprise()

**Auth (shop creation flows - CRITIQUES):**

- `apps/api/src/modules/auth/auth.service.ts` - register() line ~94 cree shop SANS enterprise_id, createShop() line ~464 cree shop SANS enterprise_id
- `apps/api/src/modules/auth/auth.controller.ts` - Endpoints auth

**Guards:**

- `apps/api/src/common/guards/roles.guard.ts` - Guard principal
- `apps/api/src/modules/auth/roles.guard.ts` - Guard avec mapping roles
- `apps/api/src/common/guards/entitlement.guard.ts` - Verification modules
- `apps/api/src/common/guards/block-status.guard.ts` - Verifie enterprise_id conditionnel (a simplifier)

**Module Registry:**

- `packages/core/src/modules/registry.ts` - Definitions modules, tiers, getAvailableModulesForLicense()

**Frontend Web-Admin:**

- `apps/web-admin/src/pages/AdminShops.tsx` - Page shops cassee (champs shop_name, shop_code, block_reason)
- `apps/web-admin/src/pages/AdminEnterprises.tsx` - Gestion entreprises
- `apps/web-admin/src/lib/api.ts` - Client API admin
- `apps/web-admin/src/store/authStore.ts` - Store auth admin

**Frontend Web:**

- `apps/web/src/components/Layout/MainLayout.tsx` (line 125: shop?.name dans sidebar)
- `apps/web/src/store/authStore.ts` - Store auth boutique
- `apps/web/src/lib/api.ts` - Client API boutique (a nettoyer: enterpriseApi.create)
- `apps/web/src/pages/EnterpriseDashboard.tsx` - Dashboard entreprise (retirer creation)
- `apps/web/src/pages/CreateShop.tsx` - Auto-inscription boutique (a revoir ou supprimer)

**Frontend Mobile:**

- `apps/mobile/src/utils/auth.ts` - canAccessAdmin(), canAccessReports()
- `apps/mobile/src/utils/invoiceTemplate.ts` (line 105: shop.name dans factures)
- `apps/mobile/src/screens/` - Ecrans avec checks de roles hardcodes

**Seed & Scripts:**

- `apps/api/prisma/seed.ts` - Cree 2 shops SANS enterprise
- `apps/api/scripts/create-superadmin.ts` - Cree shop admin SANS enterprise

**All Controllers with @Roles (77 occurrences):**

- `apps/api/src/modules/products/products.controller.ts`
- `apps/api/src/modules/sales/sales.controller.ts`
- `apps/api/src/modules/customers/customers.controller.ts`
- `apps/api/src/modules/suppliers/suppliers.controller.ts`
- `apps/api/src/modules/cash/cash.controller.ts`
- `apps/api/src/modules/inventory/inventory.controller.ts`
- `apps/api/src/modules/receivables/receivables.controller.ts`
- `apps/api/src/modules/debts/debts.controller.ts`
- `apps/api/src/modules/reports/reports.controller.ts`
- `apps/api/src/modules/transfers/transfers.service.ts`
- `apps/api/src/modules/pin-invites/pin-invites.controller.ts`

### New Files to Create

- `apps/api/prisma/migrations/XXXXXX_enterprise_required_simplify_roles/migration.sql` - Migration enterprise required + roles + logo

### Patterns to Follow

**Naming Conventions:**

- Roles: EMPLOYEE, MANAGER, BOSS, SUPERADMIN (anglais, UPPER_SNAKE)
- Champs Prisma: snake_case
- Frontend: role === 'BOSS' (string comparison)

**Error Handling:**

- Prisma exceptions transformees par HttpExceptionFilter
- NotFoundException, BadRequestException, ForbiddenException depuis @nestjs/common

**Guard Pattern:**

- @Roles(Role.BOSS, Role.MANAGER) sur les endpoints
- SUPERADMIN bypass dans tous les guards

---

## IMPLEMENTATION PLAN

### Phase 1: Fix page Shops web-admin (Quick Win)

Corriger le mapping des champs dans AdminShops.tsx pour correspondre a l'API :

- `name` (pas `shop_name`), `code` (pas `shop_code`)
- `blocked_reason` (pas `block_reason`)
- `owner.display_name` (pas `owner_name`)
- `_count.user_roles` (pas `_count.users`)
- Verifier que getAllShops dans admin.service.ts inclut owner et enterprise

### Phase 2: Enterprise obligatoire (CHANGEMENT FONDAMENTAL)

**Principe** : `enterprise_id` sur Shop passe de `String?` a `String` (REQUIRED). Toute boutique DOIT appartenir a une entreprise. Plus de shop standalone.

**Strategie de migration :**

1. Creer une entreprise par defaut pour les shops orphelines existants (migration SQL)
2. Rendre `enterprise_id` NOT NULL dans le schema
3. Adapter tous les flux de creation de shop :
   - `auth.register()` : auto-creer enterprise + shop ensemble
   - `auth.createShop()` : exiger enterprise_id OU supprimer ce flow (creation exclusive admin)
   - `admin.createShopAdmin()` : enterprise_id devient obligatoire
4. Supprimer `removeShopFromEnterprise()` (une boutique ne peut plus etre "detachee")
5. `deleteEnterprise()` : supprimer les shops ou les reassigner, pas les mettre a null
6. Simplifier les null-checks enterprise_id dans : block-status.guard, auth.service, transfers.service

**Decision architecturale - Creation de boutique :**

- **Web-admin (SUPERADMIN)** : Seul endroit ou creer entreprise + boutique
- **auth.register()** : Supprime - on ne peut plus creer de shop en self-service. Un SUPERADMIN cree l'entreprise et la boutique, puis invite les utilisateurs
- **auth.createShop()** : Supprime - meme raison
- **CreateShop.tsx (web)** : Page supprimee
- **Alternative** : Si on veut garder l'auto-inscription, register() auto-cree une enterprise avec licence STARTER

### Phase 3: Simplification des roles (3 + SUPERADMIN)

**Nouveau mapping :**
| Ancien | Nouveau | Signification |
|--------|---------|--------------|
| EMPLOYEE | EMPLOYEE | Employe de base (ventes, consultation) |
| CASHIER | EMPLOYEE | Fusionne avec EMPLOYEE |
| MANAGER | MANAGER | Gestionnaire de boutique (gestion complete) |
| ADMIN | MANAGER | Fusionne avec MANAGER |
| OWNER | BOSS | Patron (vue multi-boutiques, toutes permissions) |
| SUPERADMIN | SUPERADMIN | Admin plateforme (web-admin uniquement) |

**Etapes :**

1. Modifier l'enum Role dans schema.prisma : EMPLOYEE, MANAGER, BOSS, SUPERADMIN
2. Creer migration SQL qui convertit les roles existants
3. Mettre a jour TOUS les @Roles() dans les 16 controllers API
4. Mettre a jour le role mapping guard (roles.guard.ts)
5. Mettre a jour toutes les verifications frontend (web, web-admin, mobile)
6. Mettre a jour le seed.ts

### Phase 4: Licensing et modules exclusifs admin

**Etapes :**

1. Ajouter validation dans updateShopModules() : verifier que modules sont autorises par licence
2. Ajouter auto-sync dans updateLicense() : ajuster modules quand licence change
3. Supprimer creation enterprise du module enterprise.controller.ts (garder lecture seule)
4. Supprimer enterpriseApi.create() du client web
5. Retirer le bouton "Creer entreprise" de EnterpriseDashboard.tsx
6. S'assurer que AdminEnterprises dans web-admin est la seule interface de creation

### Phase 5: Branding "Entreprise - Boutique" + Logo

**Etapes :**

1. Ajouter `logo_url String?` au modele Enterprise dans schema.prisma
2. Modifier auth.service.ts getUserWithRoles() pour inclure enterprise dans la reponse
3. Modifier login() et loginWithPin() pour inclure enterprise
4. Mettre a jour auth stores (web, web-admin, mobile) avec interface enterprise
5. Afficher "Entreprise - Boutique" TOUJOURS (plus conditionnel car enterprise est obligatoire) :
   - Web MainLayout.tsx (sidebar + header)
   - Mobile header/navigation
   - Invoice template (mobile)
6. Ajouter champ logo_url dans le formulaire AdminEnterprises (web-admin)
7. Si logo_url present, afficher le logo dans les en-tetes

### Phase 6: Verification et nettoyage

1. Type-check toutes les apps
2. Tests unitaires
3. Mettre a jour features-catalog.md

---

## STEP-BY-STEP TASKS

### Phase 1: Fix AdminShops.tsx

#### Task 1.1: UPDATE `apps/web-admin/src/pages/AdminShops.tsx`

- **IMPLEMENT**: Corriger l'interface Shop pour correspondre aux champs API reels
  - `shop_name` -> `name`, `shop_code` -> `code`
  - `block_reason` -> `blocked_reason`
  - `owner_name` -> utiliser `owner?: { display_name: string }`
  - `_count.users` -> `_count.user_roles`
  - Ajouter `enterprise?: { id: string; name: string; code: string }` dans l'interface
- **PATTERN**: Comparer avec SuperAdminDashboard.tsx dans web-admin qui utilise deja les bons champs
- **VALIDATE**: `cd apps/web-admin && npx tsc --noEmit`

#### Task 1.2: UPDATE `apps/api/src/modules/admin/admin.service.ts` - getAllShops()

- **IMPLEMENT**: S'assurer que getAllShops inclut owner (display_name) et enterprise (name, code) dans le select
- **VALIDATE**: `curl -s GET /api/admin/shops` retourne owner et enterprise

### Phase 2: Enterprise obligatoire

#### Task 2.1: UPDATE `apps/api/prisma/schema.prisma` - Shop model

- **IMPLEMENT**:
  - Changer `enterprise_id String?` en `enterprise_id String`
  - Changer `enterprise Enterprise?` en `enterprise Enterprise`
  - Garder l'index `@@index([enterprise_id])`
- **GOTCHA**: Faire la migration APRES avoir cree les entreprises par defaut

#### Task 2.2: CREATE migration SQL

- **IMPLEMENT**: Migration en 3 etapes dans le meme fichier :
  1. **Creer une entreprise par defaut** pour chaque shop orphelin :
     ```sql
     -- Pour chaque shop sans enterprise_id, creer une enterprise auto
     INSERT INTO enterprises (id, code, name, owner_id, license_tier, max_shops, max_users_per_shop, created_at, updated_at, version)
     SELECT
       gen_random_uuid(),
       'ENT-' || s.code,
       s.name,
       s.owner_id,
       'STARTER',
       1,
       5,
       NOW(),
       NOW(),
       1
     FROM shops s WHERE s.enterprise_id IS NULL AND s.deleted = false;
     ```
  2. **Assigner les shops orphelins** a leur enterprise auto-creee :
     ```sql
     UPDATE shops s SET enterprise_id = e.id
     FROM enterprises e
     WHERE e.code = 'ENT-' || s.code
     AND s.enterprise_id IS NULL;
     ```
  3. **Rendre la colonne NOT NULL** :
     ```sql
     ALTER TABLE shops ALTER COLUMN enterprise_id SET NOT NULL;
     ```
- **GOTCHA**: Gerer le cas ou `code` = 'ENT-xxx' existe deja dans enterprises (peu probable mais ajouter un ON CONFLICT)
- **VALIDATE**: `cd apps/api && npx prisma db push` ou `npx prisma migrate dev`

#### Task 2.3: UPDATE `apps/api/src/modules/auth/auth.service.ts` - register()

- **IMPLEMENT**: Modifier register() pour auto-creer une enterprise en meme temps que le shop :
  ```typescript
  // 1. Creer l'enterprise
  const enterprise = await tx.enterprise.create({
    data: {
      code: `ENT-${dto.shop_code}`,
      name: dto.shop_name,
      owner_id: user.id,
      license_tier: 'STARTER',
      max_shops: 1,
      max_users_per_shop: 5,
    },
  });
  // 2. Creer le shop rattache
  const shop = await tx.shop.create({
    data: {
      code: dto.shop_code,
      name: dto.shop_name,
      currency: dto.currency || 'XOF',
      owner_id: user.id,
      enterprise_id: enterprise.id,
    },
  });
  ```
- **GOTCHA**: Verifier l'unicite du code enterprise
- **VALIDATE**: `cd apps/api && npx tsc --noEmit`

#### Task 2.4: UPDATE `apps/api/src/modules/auth/auth.service.ts` - createShop()

- **IMPLEMENT**: Modifier createShop() pour exiger un enterprise_id :
  - Ajouter `enterprise_id` au DTO CreateShopDto (required)
  - Verifier que l'enterprise existe et n'est pas supprimee
  - Verifier que l'enterprise n'a pas atteint sa limite de boutiques (max_shops)
  - Passer enterprise_id dans shop.create()
- **ALTERNATIVE**: Supprimer completement createShop() si la creation est reservee a l'admin
- **VALIDATE**: `cd apps/api && npx tsc --noEmit`

#### Task 2.5: UPDATE `apps/api/src/modules/admin/admin.service.ts` - createShopAdmin()

- **IMPLEMENT**:
  - Rendre `enterprise_id` obligatoire dans CreateShopAdminDto (retirer @IsOptional)
  - Supprimer le `if (dto.enterprise_id)` conditionnel - toujours connecter l'enterprise
  - Verifier que l'enterprise n'a pas atteint max_shops
- **VALIDATE**: `cd apps/api && npx tsc --noEmit`

#### Task 2.6: UPDATE `apps/api/src/modules/admin/admin.service.ts` - deleteEnterprise()

- **IMPLEMENT**: Au lieu de mettre `enterprise_id: null` sur les shops (impossible maintenant), soit :
  - Option A : Empecher la suppression si l'enterprise a encore des shops actifs
  - Option B : Supprimer (soft-delete) les shops en cascade
  - **Recommande : Option A** (plus sur, l'admin doit d'abord supprimer/reassigner les shops)
- **VALIDATE**: Test API : supprimer enterprise avec shops -> erreur 400

#### Task 2.7: UPDATE `apps/api/src/modules/enterprise/enterprise.service.ts` - removeShop()

- **IMPLEMENT**: Supprimer la methode `removeShopFromEnterprise()` (ou la transformer en `moveShopToEnterprise()` qui reassigne)
  - Meme chose pour les endpoints DELETE /enterprises/:id/shops/:shopId
  - Un shop ne peut plus etre "detache" d'une enterprise, seulement deplace vers une autre
- **GOTCHA**: Supprimer aussi l'endpoint dans enterprise.controller.ts
- **VALIDATE**: `cd apps/api && npx tsc --noEmit`

#### Task 2.8: SIMPLIFY null-checks enterprise_id dans tout le code API

- **IMPLEMENT**: Supprimer les verifications conditionnelles devenues inutiles :
  - `apps/api/src/common/guards/block-status.guard.ts` : `if (shop?.enterprise_id)` -> toujours vrai, simplifier
  - `apps/api/src/modules/auth/auth.service.ts` : `if (userRole.shop.enterprise_id)` -> toujours vrai, simplifier
  - `apps/api/src/modules/transfers/transfers.service.ts` : `if (!sourceShop.enterprise_id || !targetShop.enterprise_id)` -> jamais vrai, supprimer la condition
  - `apps/api/src/modules/enterprise/enterprise.service.ts` : Nettoyer les conditions sur enterprise_id null
- **VALIDATE**: `cd apps/api && npx tsc --noEmit`

#### Task 2.9: UPDATE `apps/api/prisma/seed.ts`

- **IMPLEMENT**: Creer une enterprise AVANT les shops, puis rattacher les shops :
  ```typescript
  const enterprise = await prisma.enterprise.upsert({
    where: { code: 'ENT-SWALO' },
    update: {},
    create: {
      code: 'ENT-SWALO',
      name: 'SWALO Entreprise Test',
      owner_id: owner.id,
      license_tier: 'PROFESSIONAL',
      max_shops: 10,
      max_users_per_shop: 20,
    },
  });
  // Puis dans chaque shop.create: enterprise_id: enterprise.id
  ```
- **VALIDATE**: `cd apps/api && pnpm prisma:seed`

#### Task 2.10: UPDATE `apps/api/scripts/create-superadmin.ts`

- **IMPLEMENT**: Creer une enterprise admin avant le shop admin :
  ```typescript
  const adminEnterprise = await prisma.enterprise.upsert({
    where: { code: 'ADMIN-ENT' },
    update: {},
    create: { code: 'ADMIN-ENT', name: 'Swalo Administration', owner_id: user.id, ... },
  });
  // Shop avec enterprise_id: adminEnterprise.id
  ```
- **VALIDATE**: Script fonctionne sans erreur

#### Task 2.11: UPDATE ou SUPPRIMER `apps/web/src/pages/CreateShop.tsx`

- **DECISION**: Si l'auto-inscription reste possible via register(), garder cette page mais la modifier pour creer enterprise + shop
- **SI SUPPRESSION**: Retirer la route et les imports dans App.tsx
- **SI CONSERVATION**: Ajouter un champ "Nom entreprise" dans le formulaire (ou utiliser le nom de boutique comme nom d'enterprise par defaut)
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

#### Task 2.12: UPDATE `apps/web-admin/src/pages/AdminShops.tsx` - creation form

- **IMPLEMENT**: Rendre le select enterprise obligatoire (plus optionnel) dans le formulaire de creation de shop
- **VALIDATE**: `cd apps/web-admin && npx tsc --noEmit`

### Phase 3: Roles

#### Task 3.1: UPDATE `apps/api/prisma/schema.prisma`

- **IMPLEMENT**: Modifier enum Role : remplacer OWNER/MANAGER/CASHIER/ADMIN/EMPLOYEE/SUPERADMIN par EMPLOYEE/MANAGER/BOSS/SUPERADMIN
- **GOTCHA**: Ne pas oublier de gerer la migration des donnees existantes

#### Task 3.2: ADD to migration SQL (meme fichier que Task 2.2)

- **IMPLEMENT**: Migration qui :
  1. Convertit CASHIER -> EMPLOYEE, ADMIN -> MANAGER, OWNER -> BOSS dans user_roles
  2. Convertit dans pin_invites si applicable
  3. Modifie l'enum Role pour ne garder que EMPLOYEE, MANAGER, BOSS, SUPERADMIN
- **GOTCHA**: Sur PostgreSQL, modifier un enum require un ALTER TYPE avec renommage
- **VALIDATE**: `cd apps/api && npx prisma migrate dev`

#### Task 3.3: UPDATE tous les controllers API (16 fichiers, ~77 decorateurs)

- **IMPLEMENT**: Remplacer les roles dans chaque @Roles() :
  - `Role.OWNER` -> `Role.BOSS`
  - `Role.CASHIER` -> `Role.EMPLOYEE`
  - `Role.ADMIN` -> `Role.MANAGER`
  - Garder `Role.MANAGER` et `Role.EMPLOYEE` et `Role.SUPERADMIN` inchanges
- **FICHIERS**: admin.controller.ts, products.controller.ts, sales.controller.ts, customers.controller.ts, suppliers.controller.ts, cash.controller.ts, inventory.controller.ts, receivables.controller.ts, debts.controller.ts, reports.controller.ts, transfers.controller.ts, pin-invites.controller.ts, enterprise.controller.ts, auth.controller.ts, admin-controls.controller.ts
- **VALIDATE**: `cd apps/api && npx tsc --noEmit`

#### Task 3.4: UPDATE `apps/api/src/modules/auth/roles.guard.ts`

- **IMPLEMENT**: Supprimer le mapping de compatibilite OWNER->ADMIN, CASHIER->EMPLOYEE. Simplifier : juste verifier si le role de l'utilisateur est dans les roles requis ou si SUPERADMIN
- **VALIDATE**: `cd apps/api && npx tsc --noEmit`

#### Task 3.5: UPDATE `apps/api/src/common/guards/roles.guard.ts`

- **IMPLEMENT**: Meme simplification que Task 3.4 si necessaire
- **VALIDATE**: `cd apps/api && npx tsc --noEmit`

#### Task 3.6: UPDATE frontend web - toutes les verifications de roles

- **IMPLEMENT**: Rechercher et remplacer dans apps/web/src/ :
  - `'OWNER'` -> `'BOSS'`
  - `'CASHIER'` -> `'EMPLOYEE'` (si utilise)
  - `'ADMIN'` -> `'MANAGER'` (attention aux contextes)
- **FICHIERS**: MainLayout.tsx, ProtectedRoute.tsx, App.tsx, ShopSettings.tsx, BusinessReports.tsx, POS.tsx, EnterpriseDashboard.tsx
- **GOTCHA**: Ne pas confondre 'ADMIN' (role) avec 'admin' (route path)
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

#### Task 3.7: UPDATE frontend web-admin

- **IMPLEMENT**: Verifier les references de roles dans web-admin (normalement que SUPERADMIN)
- **VALIDATE**: `cd apps/web-admin && npx tsc --noEmit`

#### Task 3.8: UPDATE frontend mobile

- **IMPLEMENT**: Rechercher et remplacer dans apps/mobile/src/ :
  - `'OWNER'` -> `'BOSS'`
  - `'CASHIER'` -> `'EMPLOYEE'`
  - `'ADMIN'` -> `'MANAGER'`
  - Mettre a jour utils/auth.ts: canAccessAdmin(), canAccessReports()
- **VALIDATE**: `cd apps/mobile && npx tsc --noEmit`

#### Task 3.9: UPDATE `apps/api/prisma/seed.ts` (roles)

- **IMPLEMENT**: Remplacer les roles dans le seed :
  - role: 'OWNER' -> role: 'BOSS'
  - role: 'ADMIN' -> role: 'MANAGER'
  - role: 'CASHIER' -> role: 'EMPLOYEE'
- **VALIDATE**: `cd apps/api && pnpm prisma:seed`

### Phase 4: Licensing et entreprise exclusive admin

#### Task 4.1: UPDATE `apps/api/src/modules/admin-controls/admin-controls.service.ts`

- **IMPLEMENT**: Dans updateShopModules(), ajouter validation :
  - Charger le shop avec son enterprise (enterprise_id est maintenant garanti non-null)
  - Recuperer licence tier de l'enterprise
  - Utiliser getAvailableModulesForLicense() du registry
  - Rejeter les modules non autorises par la licence
  - Valider les dependances entre modules
- **PATTERN**: Utiliser packages/core/src/modules/registry.ts pour getAvailableModulesForLicense()
- **VALIDATE**: Test API avec modules non-autorises -> doit retourner 400

#### Task 4.2: UPDATE `apps/api/src/modules/admin/admin.service.ts` - updateLicense()

- **IMPLEMENT**: Apres modification de la licence, auto-ajuster les modules de toutes les boutiques :
  - Charger toutes les boutiques de l'entreprise
  - Pour chaque boutique, filtrer enabled_modules par les modules autorises par le nouveau tier
  - Sauvegarder et auditer chaque changement
- **VALIDATE**: Changer licence PROFESSIONAL -> STARTER doit retirer les modules premium des boutiques

#### Task 4.3: UPDATE `apps/api/src/modules/enterprise/enterprise.controller.ts`

- **IMPLEMENT**: Supprimer POST /enterprises (creation) et DELETE /enterprises/:id/shops/:shopId (detachment). Garder uniquement les GET (lecture) pour que les BOSS puissent voir leur entreprise
- **GOTCHA**: Garder les endpoints de lecture (GET) et les liens shop-enterprise

#### Task 4.4: UPDATE `apps/web/src/lib/api.ts`

- **IMPLEMENT**: Supprimer enterpriseApi.create() du client API web
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

#### Task 4.5: UPDATE `apps/web/src/pages/EnterpriseDashboard.tsx`

- **IMPLEMENT**: Retirer tout bouton/formulaire de creation d'entreprise. Ne garder que la vue lecture des informations enterprise + liste boutiques
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

### Phase 5: Branding

#### Task 5.1: UPDATE `apps/api/prisma/schema.prisma` - Enterprise model

- **IMPLEMENT**: Ajouter `logo_url String?` au modele Enterprise (inclus dans la migration de Phase 2)
- **VALIDATE**: `cd apps/api && npx prisma db push`

#### Task 5.2: UPDATE `apps/api/src/modules/auth/auth.service.ts` - getUserWithRoles()

- **IMPLEMENT**: Modifier la requete Prisma pour inclure enterprise dans le shop :
  - Dans user_roles include, ajouter: shop: { include: { enterprise: { select: { id, code, name, logo_url } } } }
  - Retourner enterprise dans la reponse de getMe()
  - Faire de meme dans login(), loginWithPin(), switchShop()
- **NOTE**: enterprise n'est PLUS nullable (toujours present car enterprise_id est required)
- **VALIDATE**: `curl GET /api/auth/me` retourne enterprise dans shop

#### Task 5.3: UPDATE `apps/web/src/store/authStore.ts`

- **IMPLEMENT**: Ajouter interface Enterprise { id, code, name, logo_url? } et l'inclure dans le state du store. Peupler depuis la reponse login/getMe. Enterprise est TOUJOURS present (non nullable)
- **VALIDATE**: `cd apps/web && npx tsc --noEmit`

#### Task 5.4: UPDATE `apps/web/src/components/Layout/MainLayout.tsx`

- **IMPLEMENT**: Afficher TOUJOURS le nom combine dans le sidebar et le header :
  - Format : "{enterprise.name} - {shop.name}" (plus de cas conditionnel)
  - Si logo_url : afficher le logo dans le header a cote du nom
- **VALIDATE**: Visuellement verifier dans le navigateur

#### Task 5.5: UPDATE mobile auth store et navigation

- **IMPLEMENT**: Stocker enterprise dans AsyncStorage avec shop. Afficher le nom combine "{enterprise.name} - {shop.name}" dans le header de navigation mobile. Enterprise est TOUJOURS present
- **VALIDATE**: `cd apps/mobile && npx tsc --noEmit`

#### Task 5.6: UPDATE `apps/mobile/src/utils/invoiceTemplate.ts`

- **IMPLEMENT**: Modifier le template de facture :
  - Header : afficher "Enterprise Name" en titre, "Shop Name" en sous-titre (TOUJOURS)
  - Si logo_url : afficher le logo en haut de la facture
  - Footer : "{enterprise.name} - {shop.name} - {shop.code}"
- **VALIDATE**: Generer une facture de test et verifier le rendu

#### Task 5.7: UPDATE `apps/web-admin/src/pages/AdminEnterprises.tsx`

- **IMPLEMENT**: Ajouter champ logo_url dans le formulaire de creation/edition d'entreprise (champ texte URL pour l'instant, upload de fichier en version future)
- **VALIDATE**: Creer une entreprise avec logo_url, verifier que ca se sauvegarde

#### Task 5.8: UPDATE DTOs admin

- **IMPLEMENT**: Ajouter logo_url? dans CreateEnterpriseDto et UpdateEnterpriseDto
- **VALIDATE**: `cd apps/api && npx tsc --noEmit`

### Phase 6: Verification

#### Task 6.1: Type-check toutes les apps

- **VALIDATE**:
  - `cd apps/api && npx tsc --noEmit`
  - `cd apps/web && npx tsc --noEmit`
  - `cd apps/web-admin && npx tsc --noEmit`
  - `cd apps/mobile && npx tsc --noEmit`

#### Task 6.2: Tests unitaires API

- **VALIDATE**: `cd apps/api && pnpm test`

#### Task 6.3: Lint

- **VALIDATE**: `pnpm --filter @swalo/api run lint` (0 errors)

#### Task 6.4: UPDATE `docs/specs/features-catalog.md`

- **IMPLEMENT**:
  - Mettre a jour la section roles (3 + SUPERADMIN au lieu de 6)
  - Ajouter section branding entreprise-boutique
  - Ajouter section validation licence-modules
  - Documenter le changement enterprise obligatoire
  - Ajouter changelog entry pour Plan 026

#### Task 6.5: Seed et test en grandeur nature

- **VALIDATE**:
  - `cd apps/api && pnpm prisma:seed`
  - Demarrer les 3 apps et tester le flux complet

---

## TESTING STRATEGY

### Unit Tests

- Tests existants doivent passer apres modification des roles (adapter les mocks)
- Verifier que la migration des roles et enterprise ne casse pas les tests FIFO, refund, etc.

### Integration Tests

- Login avec chaque role (EMPLOYEE, MANAGER, BOSS, SUPERADMIN)
- Creation entreprise depuis admin uniquement
- Attribution licence -> verification modules auto
- Auth/me retourne TOUJOURS enterprise avec shop
- register() cree enterprise + shop ensemble

### Edge Cases

- **Plus de shop sans enterprise** : migration assigne tous les orphelins
- Changement de licence PROFESSIONAL -> STARTER : modules premium retires
- Utilisateur avec roles dans plusieurs boutiques : migration correcte
- Enterprise sans logo_url : affichage gracieux (nom seul, pas de logo)
- Suppression enterprise avec shops actifs : doit etre refuse (erreur 400)
- register() avec code enterprise qui existe deja : generer un code unique

---

## VALIDATION COMMANDS

### Level 1: Syntax & Types

```
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
cd apps/web-admin && npx tsc --noEmit
cd apps/mobile && npx tsc --noEmit
```

### Level 2: Lint

```
pnpm --filter @swalo/api run lint
pnpm --filter @swalo/mobile run lint
```

### Level 3: Tests

```
pnpm --filter @swalo/api run test
pnpm --filter @swalo/mobile run test
```

### Level 4: Live Tests

```
# API endpoints
curl POST /api/auth/login (SUPERADMIN)
curl GET /api/auth/me -> enterprise TOUJOURS present dans response
curl POST /api/admin/enterprises (creation)
curl POST /api/admin/shops (enterprise_id obligatoire)
curl PUT /api/admin/enterprises/:id/license (licence)
curl GET /api/admin/shops -> verifier enterprise present partout

# Register flow
curl POST /api/auth/register -> enterprise auto-creee avec shop

# Web-admin
Ouvrir http://localhost:3002
Login superadmin@swalo.com / superadmin123
Naviguer vers Boutiques -> enterprise affiche pour chaque shop
Naviguer vers Entreprises -> creer une entreprise avec logo_url
Creer une boutique -> enterprise obligatoire

# Web boutique
Ouvrir http://localhost:3001
Login avec PIN
Verifier header : "Enterprise - Boutique"
```

---

## ACCEPTANCE CRITERIA

- [ ] Page Shops dans web-admin fonctionne (liste, creation, block/unblock)
- [ ] **enterprise_id est NOT NULL** sur la table shops (schema + migration)
- [ ] **Aucune boutique sans entreprise** dans la base de donnees
- [ ] register() cree automatiquement une enterprise + shop ensemble
- [ ] createShopAdmin() exige un enterprise_id
- [ ] Suppression enterprise avec shops actifs = erreur 400
- [ ] removeShopFromEnterprise() supprime ou remplace par moveShopToEnterprise()
- [ ] Seulement 4 roles dans le systeme : EMPLOYEE, MANAGER, BOSS, SUPERADMIN
- [ ] Migration DB convertit les anciens roles sans perte de donnees
- [ ] Tous les @Roles() dans les controllers utilisent les nouveaux roles
- [ ] Frontend (web, mobile, web-admin) utilise les nouveaux noms de roles
- [ ] Modules ne peuvent etre actives que si la licence le permet
- [ ] Changement de licence ajuste automatiquement les modules des boutiques
- [ ] Entreprise ne peut etre creee que depuis web-admin (SUPERADMIN)
- [ ] Auth/me retourne TOUJOURS l'objet enterprise (id, name, code, logo_url) dans shop
- [ ] Header web affiche TOUJOURS "Entreprise - Boutique"
- [ ] Facture mobile affiche TOUJOURS le nom d'entreprise + logo si disponible
- [ ] Tous les type-checks passent (0 erreurs)
- [ ] Tous les tests passent
- [ ] features-catalog.md mis a jour

---

## NOTES

**Ordre de priorite** : Phase 1 (quick win) -> Phase 2 (enterprise obligatoire - CRITIQUE) -> Phase 3 (roles) -> Phase 4 (licensing) -> Phase 5 (branding) -> Phase 6 (verification)

**Points de vigilance** :

- La migration enterprise obligatoire est la plus delicate : il faut creer les entreprises par defaut AVANT de rendre la colonne NOT NULL
- La migration des roles PostgreSQL enum est delicate (ALTER TYPE ... RENAME VALUE)
- Certains controleurs importent RolesGuard depuis des chemins differents (auth/roles.guard vs common/guards/roles.guard)
- Le seed doit etre mis a jour AVANT de re-seeder
- L'affichage logo_url est un simple champ URL pour l'instant (pas d'upload de fichier)
- Le mobile stocke le role dans l'objet user dans AsyncStorage -> migration implicite au re-login

**Impact sur les utilisateurs existants** :

- Au prochain login, l'ancien role est lu depuis la DB (deja migre)
- Pas de token invalidation necessaire car le role est lu depuis la DB dans jwt.strategy.ts, pas du token
- Les PIN existants continueront a fonctionner
- Les shops existants sans enterprise auront ete assignes a une enterprise auto-creee par la migration
- Aucune donnee perdue : la migration est purement additive (creation d'entreprises) puis constrainte (NOT NULL)

**Changement fondamental enterprise obligatoire - Resume :**

- Schema : `enterprise_id String?` -> `enterprise_id String` (required)
- Migration : creation d'entreprises par defaut pour shops orphelins
- register() : auto-cree enterprise + shop
- createShopAdmin() : enterprise_id obligatoire
- deleteEnterprise() : refuse si shops actifs existent
- removeShopFromEnterprise() : supprime (remplacer par moveShopToEnterprise si necessaire)
- Tous les null-checks sur enterprise_id : supprimes (toujours present)
- Branding : toujours "Enterprise - Boutique", plus conditionnel

<!-- EOF -->
