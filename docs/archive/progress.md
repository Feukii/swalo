# Journal de progression SWALO

## Session 1 - 11 octobre 2025

### ✅ Ce qui a été réalisé

#### 1. Architecture du projet (100%)

- ✅ Monorepo Turbo + pnpm configuré
- ✅ Structure des dossiers créée
- ✅ Configuration Git (main + dev branches)
- ✅ .gitignore, prettier, tsconfig
- ✅ Documentation complète (README, ARCHITECTURE, GETTING_STARTED, STATUS)

#### 2. Package @swalo/core (100%)

- ✅ 10 fichiers de schémas Zod créés
  - common.ts (types de base, enums)
  - shop.ts (boutiques, utilisateurs, rôles)
  - product.ts (produits, mouvements inventaire)
  - customer.ts (clients, crédits)
  - supplier.ts (fournisseurs, factures fournisseurs)
  - sale.ts (ventes, lignes de vente)
  - invoice.ts (factures, lignes de facture)
  - payment.ts (paiements)
  - cash.ts (caisse, sessions)
  - sync.ts (synchronisation)
- ✅ Types TypeScript générés
- ✅ 4 fichiers d'utilitaires
  - currency.ts (conversions, formatage, calculs)
  - date.ts (manipulation dates ISO8601)
  - validation.ts (UUID, SKU, normalisation)
  - calculations.ts (totaux, marges, taxes)

#### 3. Backend API NestJS (80%)

- ✅ Configuration NestJS complète
- ✅ Module Prisma avec service global
- ✅ Schéma Prisma PostgreSQL complet (20+ modèles)
- ✅ **Module Auth implémenté à 100%**
  - AuthService avec bcrypt
  - JWT + Refresh tokens
  - Stratégies Passport (Local, JWT, JWT-Refresh)
  - Guards (JwtAuthGuard, LocalAuthGuard, RolesGuard)
  - Décorateurs (@CurrentUser, @Roles)
  - DTOs de validation
  - Endpoints :
    - POST /api/auth/register (inscription)
    - POST /api/auth/login (connexion)
    - POST /api/auth/refresh (refresh token)
    - GET /api/auth/me (profil utilisateur)
- ✅ Module Products (squelette de base)
  - Service avec findAll, findOne
  - Controller avec routes protégées
- ✅ Modules squelettes créés
  - SalesModule
  - CustomersModule
  - SuppliersModule
  - InvoicesModule
  - PaymentsModule
  - CashModule
  - InventoryModule
  - SyncModule
  - ReportsModule

### 📊 Statistiques

| Métrique       | Valeur       |
| -------------- | ------------ |
| Commits locaux | 3            |
| Fichiers créés | 50+          |
| Lignes de code | ~4000        |
| Schémas Zod    | 10           |
| Modèles Prisma | 20+          |
| Modules NestJS | 11           |
| Tests          | 0 (à écrire) |

### 🎯 Prochaines priorités

#### Phase immédiate (1-2 jours)

1. **Résoudre GitHub** : Pousser le code sur le dépôt distant
2. **Module Products complet**
   - CRUD complet (Create, Read, Update, Delete)
   - Recherche par SKU/nom/catégorie
   - Calcul stock en temps réel (agrégation mouvements)
   - Import CSV basique
3. **Module Sales**
   - Création de vente avec items
   - Calculs automatiques (totaux, taxes)
   - Génération mouvements de stock
   - Support tous les modes de paiement

#### Phase 2 (3-5 jours)

4. **Module Sync**
   - POST /sync/pull (delta depuis lastSyncAt)
   - POST /sync/push (mutations client)
   - Gestion cursors et pagination
   - Résolution conflits par entité
5. **Tests unitaires**
   - Tests Auth (login, register, JWT)
   - Tests Products (CRUD)
   - Tests Sales (création, calculs)

#### Phase 3 (1 semaine)

6. **Application Mobile React Native**
   - Init Expo + WatermelonDB
   - Schéma SQLite
   - Écrans de base (Dashboard, Ventes, Produits)
   - Moteur sync client

### 🔧 Configuration requise

Pour continuer le développement, vous devez :

1. **Installer les dépendances**

   ```bash
   pnpm install
   ```

2. **Configurer la base de données**
   - Créer un compte Supabase gratuit OU installer PostgreSQL
   - Copier `apps/api/.env.example` vers `apps/api/.env`
   - Renseigner `DATABASE_URL`

3. **Générer Prisma et migrer**

   ```bash
   cd apps/api
   pnpm prisma:generate
   pnpm prisma:migrate
   ```

4. **Lancer le serveur**
   ```bash
   pnpm dev
   ```

### 📝 Notes importantes

#### Fonctionnalités Auth implémentées

- ✅ Inscription avec création automatique de boutique
- ✅ Login avec sélection de boutique (si multi-boutiques)
- ✅ JWT avec expiration configurable
- ✅ Refresh tokens pour renouveler l'accès
- ✅ Protection des routes avec guards
- ✅ Gestion des rôles (OWNER, MANAGER, CASHIER)
- ✅ Décorateur @CurrentUser pour récupérer l'utilisateur courant
- ✅ Hash des mots de passe avec bcrypt (10 rounds)

#### Architecture Auth

```
Client
  ↓
POST /api/auth/login
  ↓
AuthController.login()
  ↓
AuthService.login()
  ↓
- Valide credentials (bcrypt)
- Vérifie accès boutique
- Génère JWT + Refresh Token
  ↓
Retourne: { user, shop, role, access_token, refresh_token }
```

#### Utilisation dans les autres modules

```typescript
@Controller('products')
@UseGuards(JwtAuthGuard) // Protection par JWT
export class ProductsController {
  @Get()
  @Roles(Role.OWNER, Role.MANAGER) // Restriction par rôle
  findAll(@CurrentUser() user: any) {
    // user = { userId, shopId }
    return this.productsService.findAll(user.shopId);
  }
}
```

### 🐛 Problèmes connus

1. **GitHub push échoue** - Token invalide ou expiré
   - Solution : Utiliser GitHub Desktop ou régénérer le token

2. **Modules non implémentés** - Uniquement Auth et Products (partiel) fonctionnels
   - Les autres modules sont des squelettes vides

### 🎓 Apprentissages

- Architecture offline-first nécessite réflexion poussée sur sync
- Zod excellent pour validation côté client ET serveur
- Prisma très puissant pour modéliser relations complexes
- NestJS structure bien le code avec modules/services/controllers
- JWT + Refresh tokens = pattern standard pour auth moderne

---

**Dernière mise à jour** : 11 octobre 2025 - 20h30
**Prochaine session** : Implémenter Products complet + résoudre GitHub
