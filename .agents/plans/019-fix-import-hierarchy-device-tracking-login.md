# Plan 019: Correction import, hiérarchie, traçabilité appareils et connexion boutique

## Contexte

Suite au plan 015, plusieurs fonctionnalités ne fonctionnent pas correctement dans l'application mobile:
1. **Import CSV/Excel**: L'import de catalogue ne fonctionne pas
2. **Création hiérarchie produits**: La création manuelle de familles/types/marques ne fonctionne pas
3. **Traçabilité appareils**: Le suivi des appareils n'est pas automatique pour tous les rôles
4. **Connexion boutique**: Impossibilité de se connecter avec un code boutique créé

## Analyse des problèmes

### 1. Import CSV/Excel - Diagnostic

**Problème potentiel**: L'endpoint `/api/import/catalog/preview` et `/api/import/catalog/confirm` existent et sont correctement câblés mais peuvent échouer silencieusement.

**Fichiers analysés**:
- `apps/api/src/modules/import/import.service.ts` - Service fonctionnel avec mapping colonnes français
- `apps/api/src/modules/import/import.controller.ts` - Endpoints protégés par `@Roles(Role.OWNER, Role.MANAGER)`
- `apps/mobile/src/screens/ProductCatalogScreen.tsx` - UI d'import avec DocumentPicker
- `apps/mobile/src/lib/api.ts:465-478` - `importApi.previewCatalog()` et `confirmCatalog()`

**Causes possibles**:
- Le rôle de l'utilisateur n'est pas OWNER ou MANAGER
- Le fichier base64 n'est pas correctement encodé
- Erreur de parsing côté API non remontée à l'utilisateur
- Timeout de l'API (cold start Render)

### 2. Création manuelle hiérarchie - Diagnostic

**Problème potentiel**: Les champs famille, type d'article, marque et référence sont bien présents dans le formulaire de création produit (`ProductCatalogScreen.tsx:1070-1205`) mais la création peut échouer.

**Fichiers analysés**:
- `apps/api/src/modules/products/products.controller.ts:79-100` - Endpoints `getFamilies`, `getBrands`, `getArticleTypes` existent
- `apps/mobile/src/lib/api.ts:600-626` - API `productsApi.getFilters()` et `batchUpdateHierarchy()` existent
- `apps/api/src/modules/products/products.service.ts:275-370` - Services de récupération hiérarchie

**Problème identifié**: La hiérarchie n'est pas "créée" de manière autonome - elle est déduite des produits existants. Le formulaire permet de saisir de nouvelles valeurs (famille, type, marque) qui seront créées lors de la sauvegarde du produit.

**UI existante**: Le formulaire montre un bouton "Créer [nouvelle valeur]" quand l'utilisateur tape une valeur qui n'existe pas encore (`ProductCatalogScreen.tsx:1133-1141`).

### 3. Traçabilité appareils - Diagnostic

**Problème identifié**: Le tracking des appareils ne se fait **que pour le rôle EMPLOYEE** (`auth.service.ts:246`).

```typescript
// Ligne 246 de auth.service.ts
if (deviceInfo && userRole.role === 'EMPLOYEE') {
```

Les OWNER et MANAGER ne sont pas trackés, donc ils n'apparaissent pas dans l'administration.

### 4. Connexion code boutique - Diagnostic

**Problème potentiel**: L'utilisateur a créé une boutique via l'API web (`POST /api/auth/create-shop`) mais:
1. Le PIN généré n'a pas été noté
2. Le code boutique ou le PIN n'est pas correct
3. L'utilisateur essaie le PIN avec le mauvais code boutique

**Flow analysé** (`auth.service.ts:368-445`):
- `createShop()` génère un code boutique 6 chiffres aléatoire
- Génère un PIN propriétaire 4 chiffres aléatoire
- Crée l'utilisateur propriétaire et le rôle OWNER
- Retourne `shop.code` et `owner.pin_code` dans la réponse

**Vérification nécessaire**: Confirmer que la boutique existe en base et que le PIN est correct.

---

## Plan d'action

### Phase 1: Debugging et amélioration des erreurs

#### Tâche 1.1: Améliorer le logging de l'import

**Fichier**: `apps/api/src/modules/import/import.controller.ts`

- Ajouter des logs détaillés pour le debugging
- Retourner des messages d'erreur plus explicites

#### Tâche 1.2: Améliorer la gestion d'erreur mobile

**Fichier**: `apps/mobile/src/screens/ProductCatalogScreen.tsx`

- Améliorer l'affichage des erreurs d'import
- Ajouter un log de debug pour le contenu base64

### Phase 2: Étendre la traçabilité appareils à tous les rôles

#### Tâche 2.1: Modifier le tracking pour OWNER et MANAGER

**Fichier**: `apps/api/src/modules/auth/auth.service.ts`

**Modification** (ligne 246):
```typescript
// AVANT
if (deviceInfo && userRole.role === 'EMPLOYEE') {

// APRÈS
if (deviceInfo) {
  // Tous les rôles sont trackés, mais restriction appareil unique seulement pour EMPLOYEE
  const restrictToSingleDevice = userRole.role === 'EMPLOYEE';
```

**Logique**:
- EMPLOYEE: restriction à 1 seul appareil (comportement actuel)
- OWNER/MANAGER: tracking sans restriction (peuvent se connecter depuis plusieurs appareils)

### Phase 3: Vérification connexion boutique

#### Tâche 3.1: Ajouter un endpoint de vérification boutique

**Fichier**: `apps/api/src/modules/auth/auth.controller.ts`

Ajouter un endpoint public pour vérifier si un code boutique existe:
```typescript
@Get('verify-shop/:code')
async verifyShop(@Param('code') code: string) {
  // Retourne si la boutique existe (sans exposer de données sensibles)
}
```

#### Tâche 3.2: Script de diagnostic connexion

Créer un script pour vérifier en base:
- La boutique existe avec le code donné
- L'utilisateur propriétaire existe
- Le PIN est correct

### Phase 4: Validation

#### Tâche 4.1: Tests manuels

1. Tester l'import CSV avec un fichier de test
2. Tester la création d'un produit avec nouvelle famille
3. Tester la connexion depuis différents appareils
4. Vérifier le tracking dans l'administration

---

## Implémentation détaillée

### Tâche 2.1: Modification du tracking appareils

**Fichier**: `apps/api/src/modules/auth/auth.service.ts`

```typescript
// Remplacer les lignes 245-299 par:

// Enregistrer/mettre à jour l'appareil pour tous les utilisateurs (traçabilité)
if (deviceInfo) {
  // Vérifier si cet appareil est déjà enregistré
  const existingDevice = await this.prisma.userDevice.findUnique({
    where: {
      user_id_shop_id_device_id: {
        user_id: user.id,
        shop_id: shop.id,
        device_id: deviceInfo.device_id,
      },
    },
  });

  if (existingDevice) {
    if (!existingDevice.is_active) {
      throw new UnauthorizedException(
        'Cet appareil a été révoqué. Contactez votre administrateur.'
      );
    }
    // Mettre à jour la date de dernière connexion
    await this.prisma.userDevice.update({
      where: { id: existingDevice.id },
      data: { last_login_at: new Date() },
    });
  } else {
    // Pour EMPLOYEE uniquement: vérifier restriction appareil unique
    if (userRole.role === 'EMPLOYEE') {
      const activeDevices = await this.prisma.userDevice.findMany({
        where: {
          user_id: user.id,
          shop_id: shop.id,
          is_active: true,
        },
      });

      if (activeDevices.length > 0) {
        throw new UnauthorizedException(
          'Ce code PIN est déjà utilisé sur un autre appareil. Un seul appareil est autorisé par employé.'
        );
      }
    }

    // Enregistrer le nouvel appareil
    await this.prisma.userDevice.create({
      data: {
        user_id: user.id,
        shop_id: shop.id,
        device_id: deviceInfo.device_id,
        device_name: deviceInfo.device_name,
        device_type: deviceInfo.device_type || 'mobile',
        last_login_at: new Date(),
        is_active: true,
      },
    });
  }
}
```

---

## Commandes de validation

```bash
# Lint
pnpm run lint

# Tests API
cd apps/api && pnpm test

# Tests Mobile
cd apps/mobile && pnpm test

# Validation complète
pnpm run validate
```

---

## Critères d'acceptation

- [ ] L'import CSV fonctionne avec colonnes françaises et anglaises
- [ ] La création de produit avec nouvelle famille/type/marque fonctionne
- [ ] Tous les appareils (OWNER, MANAGER, EMPLOYEE) sont trackés
- [ ] Restriction appareil unique maintenue pour EMPLOYEE uniquement
- [ ] La connexion avec code boutique et PIN fonctionne
- [ ] Tous les tests passent

---

## Notes

### Pour débugger la connexion boutique

L'utilisateur doit vérifier:
1. Le code boutique (6 chiffres) retourné lors de la création
2. Le PIN propriétaire (4 chiffres) retourné lors de la création

Si les codes ont été perdus, il faut:
1. Vérifier en base via Prisma Studio: `cd apps/api && pnpm prisma:studio`
2. Chercher la boutique par nom dans la table `Shop`
3. Trouver l'owner_id puis le PIN dans la table `User`
