# Feature: Harmonisation UI/UX Web = Mobile

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Harmoniser completement la version web (apps/web) avec la version mobile (apps/mobile) pour que les deux aient exactement les memes fonctionnalites et un UI/UX coherent. Le mobile fait reference : la web doit reprendre toutes ses features avec la meme experience utilisateur, adaptee au format desktop (sidebar + contenu principal au lieu de bottom tabs).

## User Story

As a shop owner/employee
I want to use the web and mobile apps interchangeably
So that I have the same features and experience regardless of the platform

## Problem Statement

Actuellement, la web est incomplete par rapport au mobile :

- **Dashboard.tsx** est un placeholder qui sert 5 routes mais n'implemente que la gestion produits
- **POS.tsx** n'est que de la gestion de caisse, pas un vrai point de vente avec panier
- **Pas de SaleScreen** (POS avec panier, multi-prix, FIFO)
- **Pas de HomeScreen** (tableau de bord KPIs)
- **Pas de StockManagement** dedie
- **Pas de ProductCatalog/Details/CatalogHierarchy**
- **Pas de CustomerBalancesSummary / SupplierBalancesSummary**
- **Pas de TransactionHistory**
- **Pas de ShopSwitcher** pour les entreprises multi-boutiques

Le mobile a 27 ecrans, le web en a 13.

## Solution Statement

Creer les pages web manquantes en miroir du mobile, utilisant l'API existante (deja disponible via `apps/web/src/lib/api.ts`) au lieu du SQLite local. Harmoniser le design system (couleurs, composants, patterns) entre les deux plateformes.

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: High
**Primary Systems Affected**: apps/web (majoritairement), apps/web/src/pages/, apps/web/src/components/
**Dependencies**: Toutes les APIs backend sont deja implementees. Aucune nouvelle dependance.

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

**Web (source actuelle) :**

- `apps/web/src/App.tsx` - Router et routes actuelles
- `apps/web/src/pages/Dashboard.tsx` (740 lines) - A remplacer par des pages dediees
- `apps/web/src/pages/POS.tsx` (618 lines) - Gestion caisse actuelle (a renommer CashPage)
- `apps/web/src/pages/Customers.tsx` (477 lines) - Pattern de reference pour pages de liste
- `apps/web/src/pages/CustomerDetails.tsx` (796 lines) - Pattern de reference pour pages de detail
- `apps/web/src/pages/Suppliers.tsx` (447 lines) - Pattern de reference pour pages de liste
- `apps/web/src/pages/SupplierDetails.tsx` (857 lines) - Pattern de reference pour pages de detail
- `apps/web/src/pages/ProductBatches.tsx` (311 lines) - Pattern de reference
- `apps/web/src/pages/BusinessReports.tsx` (595 lines) - Pattern de reference pour rapports
- `apps/web/src/pages/EnterpriseDashboard.tsx` (413 lines) - Pattern de reference
- `apps/web/src/pages/UserManagement.tsx` (440 lines) - Pattern de reference
- `apps/web/src/pages/ShopSettings.tsx` (318 lines) - Pattern de reference
- `apps/web/src/components/Layout/MainLayout.tsx` - Sidebar + layout principal
- `apps/web/src/lib/api.ts` - Client API complet (toutes les APIs sont deja disponibles)
- `apps/web/src/store/authStore.ts` - Zustand auth store
- `apps/web/src/constants/theme.ts` - Theme web actuel

**Mobile (reference a reproduire) :**

- `apps/mobile/src/screens/HomeScreen.tsx` - Dashboard KPIs a reproduire
- `apps/mobile/src/screens/SaleScreen.tsx` - POS avec panier a reproduire
- `apps/mobile/src/screens/CashScreen.tsx` - Gestion caisse complete a reproduire
- `apps/mobile/src/screens/StockManagementScreen.tsx` - Gestion stock a reproduire
- `apps/mobile/src/screens/ProductCatalogScreen.tsx` - Catalogue produits a reproduire
- `apps/mobile/src/screens/ProductDetailsScreen.tsx` - Details produit a reproduire
- `apps/mobile/src/screens/CatalogHierarchyScreen.tsx` - Hierarchie catalogue a reproduire
- `apps/mobile/src/screens/TransactionHistoryScreen.tsx` - Historique transactions a reproduire
- `apps/mobile/src/screens/CustomerBalancesSummaryScreen.tsx` - Resume creances a reproduire
- `apps/mobile/src/screens/SupplierBalancesSummaryScreen.tsx` - Resume dettes a reproduire
- `apps/mobile/src/screens/ShopSwitcherScreen.tsx` - Changement de boutique a reproduire
- `apps/mobile/src/screens/SyncStatusScreen.tsx` - Statut synchro (adapter pour web: indicateur online)
- `apps/mobile/src/constants/theme-v2.ts` - Theme mobile de reference
- `apps/mobile/src/components/ui/` - Composants UI mobile de reference

**Shared :**

- `packages/core/src/` - Schemas Zod partages, types, constantes

### New Files to Create

**Pages (14 nouvelles) :**

- `apps/web/src/pages/Home.tsx` - Dashboard KPIs (miroir HomeScreen mobile)
- `apps/web/src/pages/Sale.tsx` - POS avec panier, multi-prix, FIFO (miroir SaleScreen)
- `apps/web/src/pages/Cash.tsx` - Gestion caisse enrichie (fusion POS.tsx + CashScreen mobile)
- `apps/web/src/pages/Products.tsx` - Liste produits dedie (extraction de Dashboard.tsx)
- `apps/web/src/pages/ProductDetails.tsx` - Detail produit individuel
- `apps/web/src/pages/ProductCatalog.tsx` - Catalogue navigable
- `apps/web/src/pages/CatalogHierarchy.tsx` - Vue hierarchique par famille/type/marque
- `apps/web/src/pages/StockManagement.tsx` - Gestion stock (mouvements, alertes, ajustements)
- `apps/web/src/pages/Inventory.tsx` - Sessions d'inventaire
- `apps/web/src/pages/Receivables.tsx` - Resume global creances clients
- `apps/web/src/pages/Debts.tsx` - Resume global dettes fournisseurs
- `apps/web/src/pages/TransactionHistory.tsx` - Historique complet des transactions
- `apps/web/src/pages/ShopSwitcher.tsx` - Changement de boutique (entreprise multi-shop)

**Composants reutilisables (optionnel - extraire si duplication) :**

- `apps/web/src/components/ui/KPICard.tsx` - Carte KPI reutilisable
- `apps/web/src/components/ui/StatusBadge.tsx` - Badge de statut
- `apps/web/src/components/ui/SearchBar.tsx` - Barre de recherche
- `apps/web/src/components/ui/DateRangePicker.tsx` - Selecteur de periode

### Patterns to Follow

**Naming Conventions:**

- Pages web : PascalCase dans `apps/web/src/pages/`, nommees sans suffixe "Page" (ex: `Home.tsx`, `Sale.tsx`)
- Composants : PascalCase dans `apps/web/src/components/`
- API calls : utiliser les fonctions existantes de `api.ts` (productsApi, cashApi, salesApi, etc.)
- Store : Zustand dans `apps/web/src/store/`

**Error Handling:**

- Pattern existant : try/catch avec console.error + affichage message dans le state
- Voir Customers.tsx et POS.tsx pour le pattern

**Data Validation:**

- Utiliser les schemas Zod de `@swalo/core` quand disponibles
- Validation inline pour les formulaires simples (pattern de POS.tsx)

**State Management:**

- Zustand pour l'auth globale (authStore existant)
- useState local pour les modales, formulaires, donnees de page
- useEffect pour le chargement initial des donnees
- Pattern de rechargement : fonction loadData() appelee dans useEffect et apres les mutations

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation - Design System & Components (2-3 jours)

Harmoniser le theme et creer les composants UI reutilisables.

**Tasks:**

- Aligner le theme web (`theme.ts`) avec le mobile (`theme-v2.ts`) pour les memes couleurs, spacing, radius
- Creer les composants UI reutilisables : KPICard, StatusBadge, SearchBar, DateRangePicker
- Mettre a jour le layout sidebar pour matcher les noms et icones du mobile

### Phase 2: Navigation & Home (1 jour)

Restructurer la navigation et creer la page d'accueil KPIs.

**Tasks:**

- Creer Home.tsx (Dashboard KPIs) comme page d'accueil (`/` route)
- Ajouter toutes les nouvelles routes dans App.tsx
- Mettre a jour le sidebar pour refleter la structure complete
- Renommer/deplacer l'ancien POS en Cash

### Phase 3: Core - Ventes & Caisse (3-4 jours)

Pages critiques pour l'activite quotidienne.

**Tasks:**

- Creer Sale.tsx : POS complet avec panier, recherche produits, multi-prix, selection client, methodes de paiement (cash/credit)
- Ameliorer Cash.tsx : reprendre toutes les features du CashScreen mobile (journal mixte cash+credit, categories entrees/sorties, modales conditionnelles, verification solde)
- Creer TransactionHistory.tsx : historique complet des transactions avec filtres

### Phase 4: Produits & Stock (2-3 jours)

Pages de gestion produits et stock.

**Tasks:**

- Creer Products.tsx : extraction du Dashboard.tsx avec liste complete, recherche, filtres, CRUD
- Creer ProductDetails.tsx : vue detail produit individuel avec batches, mouvements, prix
- Creer ProductCatalog.tsx : catalogue navigable avec vue grille/liste
- Creer CatalogHierarchy.tsx : vue hierarchique famille > type > marque
- Creer StockManagement.tsx : gestion stock (mouvements, alertes stock bas, ajustements)
- Creer Inventory.tsx : sessions d'inventaire

### Phase 5: Creances, Dettes & Bilans (1-2 jours)

Pages financieres dediees.

**Tasks:**

- Creer Receivables.tsx : resume global des creances clients (miroir CustomerBalancesSummaryScreen)
- Creer Debts.tsx : resume global des dettes fournisseurs (miroir SupplierBalancesSummaryScreen)
- Les pages CustomerDetails.tsx et SupplierDetails.tsx existent deja (gardees telles quelles)

### Phase 6: Entreprise & Admin (1 jour)

Fonctionnalites multi-boutique.

**Tasks:**

- Creer ShopSwitcher.tsx : changement de boutique pour utilisateurs multi-shop
- Verifier que EnterpriseDashboard.tsx est complet par rapport au mobile
- Ajouter indicateur boutique active dans le header

### Phase 7: Polish & Cleanup (1 jour)

**Tasks:**

- Supprimer l'ancien Dashboard.tsx (remplace par les pages dediees)
- Renommer POS.tsx en Cash.tsx (ou supprimer si fusionne)
- Tester toutes les pages
- Verifier la navigation sidebar
- Responsive design (desktop + tablette)

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Phase 1: Foundation

#### 1.1 UPDATE `apps/web/src/constants/theme.ts`

- **IMPLEMENT**: Aligner les valeurs du theme web avec theme-v2.ts mobile. Memes couleurs primaires (#0F2A44), spacing (xs:4, sm:8, md:12, lg:16, xl:20, 2xl:24, 3xl:32), border-radius (sm:10, md:14, lg:18), et typography scales. Garder la compatibilite Tailwind existante. Ajouter les constantes manquantes (touch targets, shadows, etc.)
- **PATTERN**: `apps/mobile/src/constants/theme-v2.ts` - copier les valeurs exactes
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

#### 1.2 CREATE `apps/web/src/components/ui/KPICard.tsx`

- **IMPLEMENT**: Composant carte KPI avec props : title, value, subtitle, icon, color, trend (up/down/neutral). Utiliser Tailwind. Miroir du composant KPICard mobile.
- **PATTERN**: `apps/mobile/src/components/ui/KPICard.tsx` pour le design, Tailwind pour le styling web
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

#### 1.3 CREATE `apps/web/src/components/ui/StatusBadge.tsx`

- **IMPLEMENT**: Badge de statut reutilisable avec variantes : success, warning, danger, info, neutral. Props: label, variant, size.
- **PATTERN**: `apps/mobile/src/components/ui/StatusBadge.tsx`
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

#### 1.4 CREATE `apps/web/src/components/ui/SearchBar.tsx`

- **IMPLEMENT**: Barre de recherche avec icone, placeholder, debounce (300ms), bouton clear. Props: placeholder, value, onChange, debounceMs.
- **PATTERN**: Pattern de recherche dans `apps/web/src/pages/Customers.tsx`
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

### Phase 2: Navigation & Home

#### 2.1 CREATE `apps/web/src/pages/Home.tsx`

- **IMPLEMENT**: Dashboard KPIs miroir du HomeScreen mobile. Afficher :
  - Balance de caisse du jour (grande carte hero)
  - 4 cartes KPI : Ventes du jour, Entrees, Sorties, Solde Net
  - Resume creances clients (montant total, nombre actif)
  - Resume dettes fournisseurs (montant total, nombre actif)
  - Top 5 produits du jour
  - Derniere synchro / statut connexion
    Utiliser les APIs : cashApi.getStats(), receivablesApi, debtsApi, productsApi.getStats()
- **PATTERN**: `apps/mobile/src/screens/HomeScreen.tsx` pour le layout, `apps/web/src/pages/BusinessReports.tsx` pour le style web
- **GOTCHA**: Les montants sont en FCFA entier (pas de centimes). Utiliser formatCurrency de @swalo/core
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

#### 2.2 UPDATE `apps/web/src/App.tsx`

- **IMPLEMENT**: Ajouter toutes les nouvelles routes :
  - `/` → Home (nouveau, remplace POS comme page d'accueil)
  - `/sale` → Sale (nouveau POS avec panier)
  - `/cash` → Cash (ancien POS renomme/ameliore)
  - `/products` → Products (nouveau, remplace Dashboard)
  - `/products/:id` → ProductDetails (nouveau)
  - `/product-catalog` → ProductCatalog (nouveau)
  - `/catalog-hierarchy` → CatalogHierarchy (nouveau)
  - `/stock` → StockManagement (nouveau)
  - `/inventory` → Inventory (nouveau)
  - `/receivables` → Receivables (nouveau)
  - `/debts` → Debts (nouveau)
  - `/transactions` → TransactionHistory (nouveau)
  - `/shop-switcher` → ShopSwitcher (nouveau)
    Garder les routes existantes (customers, suppliers, reports, enterprise, admin, settings).
    Supprimer les routes qui pointent vers Dashboard (/sales, /receivables, /debts, /inventory pointant vers Dashboard).
- **PATTERN**: Structure de routes existante dans App.tsx
- **GOTCHA**: Ne pas casser les routes existantes qui fonctionnent (customers, suppliers, reports, enterprise)
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

#### 2.3 UPDATE `apps/web/src/components/Layout/MainLayout.tsx`

- **IMPLEMENT**: Mettre a jour le sidebar pour refleter la nouvelle structure :
  - Accueil (Home) - icone maison
  - Vente (Sale) - icone panier
  - Caisse (Cash) - icone portefeuille
  - Produits (Products) - icone boite
  - Stock (StockManagement) - icone entrepot
  - Clients (Customers) - icone personnes
  - Creances (Receivables) - icone carte credit
  - Fournisseurs (Suppliers) - icone camion
  - Dettes (Debts) - icone argent
  - Rapports (Reports) - icone graphique
  - Historique (TransactionHistory) - icone horloge
  - Section Admin : Entreprises, Utilisateurs, Parametres
    Garder le systeme de sidebar collapsible existant.
- **PATTERN**: Structure existante dans MainLayout.tsx, noms du MainTabNavigator mobile
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

### Phase 3: Core - Ventes & Caisse

#### 3.1 CREATE `apps/web/src/pages/Sale.tsx`

- **IMPLEMENT**: Page POS complete miroir du SaleScreen mobile. Sections :
  - **Gauche (2/3)** : Grille produits avec recherche, filtre categorie, cartes produit avec stock et prix. Badge multi-prix. Badge "dans panier".
  - **Droite (1/3)** : Panier avec ligne items, quantite +/-, suppression. Total automatique. Selection client (dropdown). Selection methode paiement (Cash/Credit). Bouton "Valider la vente".
  - **Modal multi-prix** : Quand un produit a plusieurs prix (batches differents), afficher les options avec prix, quantite dispo, et nombre de batches.
  - **Modal validation** : Resume du panier, client, total, toggle override prix avec raison obligatoire. Boutons confirmer/annuler.
  - **Apres vente** : Bouton generer facture (optionnel).
    Utiliser les APIs : productsApi.getAll(), productBatchesApi, salesApi.create(), cashApi.createEntry() (pour vente cash), receivablesApi (pour vente credit), customersApi.getAll()
- **PATTERN**: `apps/mobile/src/screens/SaleScreen.tsx` pour la logique metier, `apps/web/src/pages/POS.tsx` pour le style web
- **GOTCHA**: Le FIFO est gere cote API. Le front doit envoyer batch_id si multi-prix. Credit desactive si pas de client. Montants FCFA entiers.
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

#### 3.2 CREATE `apps/web/src/pages/Cash.tsx`

- **IMPLEMENT**: Page caisse complete miroir du CashScreen mobile. Reprendre le code de POS.tsx actuel et enrichir :
  - **En-tete** : Solde de caisse actuel (grande carte hero)
  - **Resume du jour** : Entrees, Sorties, Net (3 cartes)
  - **Journal mixte** : Liste des transactions du jour incluant cash ET credit (creances/dettes). Les transactions credit affichees en jaune avec label "(A credit)". Modal detail au clic.
  - **Modale Entree** : Categories (Ventes, Remboursement client, Divers). Mode paiement (Cash/Credit pour Ventes). Si credit : cree une creance, pas une entree cash. Selection client conditionnelle.
  - **Modale Sortie** : Categories (Achats marchandises, Loyers, Reglement fournisseur, Depenses courantes, Divers). Mode paiement (Cash/Credit pour Achats). Si credit : cree une dette, pas une sortie cash. Selection fournisseur conditionnelle. Verification solde suffisant.
    Utiliser les APIs : cashApi, receivablesApi, debtsApi, customersApi, suppliersApi
- **PATTERN**: `apps/mobile/src/screens/CashScreen.tsx` pour la logique complete, `apps/web/src/pages/POS.tsx` pour le code existant a etendre
- **GOTCHA**: Les transactions credit n'impactent PAS le solde cash. Verification solde pour sorties. Note obligatoire pour "Divers".
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

#### 3.3 CREATE `apps/web/src/pages/TransactionHistory.tsx`

- **IMPLEMENT**: Historique complet des transactions avec filtres. Miroir du TransactionHistoryScreen mobile.
  - Filtres : periode (jour/semaine/mois/personnalise), type (tous/entrees/sorties), categorie
  - Liste paginee des transactions avec : date, heure, type, categorie, montant, client/fournisseur, note
  - Modal detail au clic
  - Export (optionnel)
    Utiliser : cashApi.getAll() avec parametres de filtre
- **PATTERN**: `apps/mobile/src/screens/TransactionHistoryScreen.tsx`, `apps/web/src/pages/BusinessReports.tsx` pour les filtres de dates
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

### Phase 4: Produits & Stock

#### 4.1 CREATE `apps/web/src/pages/Products.tsx`

- **IMPLEMENT**: Page produits dediee, extraction du Dashboard.tsx actuel. Liste produits avec :
  - Barre de recherche par nom/SKU
  - Filtre par categorie, famille, marque
  - Statistiques (total produits, stock bas, rupture, valeur stock)
  - Tableau/grille produits : SKU, nom, categorie, prix achat, prix vente, stock actuel, statut, badge multi-prix
  - Bouton creer produit (modale)
  - Clic sur produit → navigation vers ProductDetails
    Utiliser : productsApi.getAll(), productsApi.getStats(), productsApi.getCategories(), productsApi.create()
- **PATTERN**: Code existant dans `apps/web/src/pages/Dashboard.tsx` (extraire le code produits), `apps/mobile/src/screens/ProductCatalogScreen.tsx`
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

#### 4.2 CREATE `apps/web/src/pages/ProductDetails.tsx`

- **IMPLEMENT**: Page detail produit individuel. Miroir du ProductDetailsScreen mobile.
  - Informations produit (nom, SKU, categorie, famille, marque, reference, prix achat/vente, seuil alerte)
  - Stock actuel (total des batches)
  - Liste des batches actifs avec quantite restante, prix, dates
  - Historique des mouvements de stock
  - Boutons : modifier, ajouter batch/stock
    Utiliser : productsApi.getOne(), productBatchesApi.getByProduct(), inventoryApi (si existe)
- **PATTERN**: `apps/mobile/src/screens/ProductDetailsScreen.tsx`, `apps/web/src/pages/ProductBatches.tsx`
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

#### 4.3 CREATE `apps/web/src/pages/CatalogHierarchy.tsx`

- **IMPLEMENT**: Vue hierarchique du catalogue. Miroir du CatalogHierarchyScreen mobile.
  - Navigation par niveaux : Famille → Type d'article → Marque → Produits
  - Compteurs a chaque niveau (nombre de produits)
  - Clic pour descendre dans la hierarchie
  - Breadcrumb pour remonter
    Utiliser : productsApi.getAll() avec groupement cote front
- **PATTERN**: `apps/mobile/src/screens/CatalogHierarchyScreen.tsx`
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

#### 4.4 CREATE `apps/web/src/pages/StockManagement.tsx`

- **IMPLEMENT**: Gestion de stock. Miroir du StockManagementScreen mobile.
  - Liste produits avec niveaux de stock actuels
  - Alertes stock bas (en-dessous du seuil)
  - Produits en rupture
  - Bouton ajouter du stock (reception marchandise → cree un batch)
  - Historique des mouvements de stock
    Utiliser : productsApi, productBatchesApi, inventoryApi (mouvements)
- **PATTERN**: `apps/mobile/src/screens/StockManagementScreen.tsx`
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

### Phase 5: Creances & Dettes

#### 5.1 CREATE `apps/web/src/pages/Receivables.tsx`

- **IMPLEMENT**: Resume global des creances clients. Miroir du CustomerBalancesSummaryScreen mobile.
  - KPI : total creances en cours, nombre de clients concernes, montant total rembourse
  - Liste des creances actives groupees par client avec : nom client, montant du, montant paye, solde restant, statut (PENDING/PARTIAL/PAID)
  - Bouton paiement rapide
  - Clic sur client → navigation vers CustomerDetails existant
    Utiliser : receivablesApi, customersApi
- **PATTERN**: `apps/mobile/src/screens/CustomerBalancesSummaryScreen.tsx`, `apps/web/src/pages/CustomerDetails.tsx`
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

#### 5.2 CREATE `apps/web/src/pages/Debts.tsx`

- **IMPLEMENT**: Resume global des dettes fournisseurs. Miroir du SupplierBalancesSummaryScreen mobile.
  - KPI : total dettes en cours, nombre de fournisseurs concernes, montant total paye
  - Liste des dettes actives groupees par fournisseur avec : nom fournisseur, montant du, montant paye, solde restant, statut
  - Bouton paiement rapide
  - Clic sur fournisseur → navigation vers SupplierDetails existant
    Utiliser : debtsApi, suppliersApi
- **PATTERN**: `apps/mobile/src/screens/SupplierBalancesSummaryScreen.tsx`, `apps/web/src/pages/SupplierDetails.tsx`
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

### Phase 6: Entreprise

#### 6.1 CREATE `apps/web/src/pages/ShopSwitcher.tsx`

- **IMPLEMENT**: Changement de boutique pour utilisateurs d'entreprise multi-shop. Miroir du ShopSwitcherScreen mobile.
  - Liste des boutiques de l'entreprise
  - Boutique active mise en evidence
  - Clic pour changer de boutique (met a jour le token/contexte)
    Utiliser : enterpriseApi.getShops(), authApi (refresh token avec nouveau shop_id)
- **PATTERN**: `apps/mobile/src/screens/ShopSwitcherScreen.tsx`
- **VALIDATE**: `pnpm --filter @swalo/web run lint`

### Phase 7: Cleanup

#### 7.1 REMOVE `apps/web/src/pages/Dashboard.tsx`

- **IMPLEMENT**: Supprimer Dashboard.tsx. Toutes les routes qui pointaient vers Dashboard doivent maintenant pointer vers les pages dediees (Products, Inventory, etc.)
- **GOTCHA**: Verifier qu'aucune import ou reference ne reste dans App.tsx ou MainLayout.tsx
- **VALIDATE**: `pnpm --filter @swalo/web run lint && pnpm --filter @swalo/web run type-check`

#### 7.2 UPDATE Features Catalog

- **IMPLEMENT**: Mettre a jour `docs/specs/features-catalog.md` pour refleter que la web a maintenant toutes les memes fonctionnalites que le mobile. Mettre a jour la matrice de compatibilite.
- **VALIDATE**: Relecture manuelle

---

## TESTING STRATEGY

### Unit Tests

**Scope**: Composants UI reutilisables (KPICard, StatusBadge, SearchBar)
**Requirements**:

- Jest + React Testing Library (deja configure dans le projet)
- Tester le rendu des props, les interactions utilisateur basiques
- **VALIDATION COMMAND**: `pnpm --filter @swalo/web run test`

### Integration Tests

**Scope**: Flux complets de chaque page

- **Sale.tsx** : Ajouter produit au panier → modifier quantite → selectionner client → valider vente
- **Cash.tsx** : Creer entree → verifier journal → creer sortie credit → verifier pas d'impact solde
- **Products.tsx** : Recherche → filtre → creation produit
- **VALIDATION COMMAND**: `pnpm --filter @swalo/web run test`

### Edge Cases

- Panier vide → bouton valider desactive
- Vente credit sans client → erreur
- Sortie superieure au solde → erreur
- Produit sans stock → non affiche dans POS
- Multi-prix → modale de selection obligatoire
- Montant negatif → uniquement role BOSS

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
pnpm --filter @swalo/web run lint
pnpm --filter @swalo/web run type-check
```

**Expected Result**: Zero errors

### Level 2: Tests

```bash
pnpm --filter @swalo/web run test
```

**Expected Result**: All tests pass

### Level 3: Full Monorepo

```bash
pnpm run validate
```

**Expected Result**: All workspaces pass

### Level 4: Manual Validation

- Naviguer dans chaque page via le sidebar
- Tester le POS : ajouter produit, multi-prix, panier, checkout
- Tester la caisse : entree, sortie, credit, journal mixte
- Tester les creances et dettes
- Verifier la navigation produits (liste → detail → batches → hierarchie)
- Verifier le responsive (redimensionner la fenetre)
- Tester avec differents roles (BOSS, MANAGER, EMPLOYEE)

---

## ACCEPTANCE CRITERIA

- [ ] Toutes les pages du mobile ont un equivalent web
- [ ] Le POS web permet de faire une vente complete (panier, multi-prix, client, paiement)
- [ ] La caisse web gere les transactions cash ET credit
- [ ] Le catalogue produits est navigable (liste, detail, hierarchie, batches)
- [ ] Les creances et dettes ont des pages resumees dediees
- [ ] Le sidebar reflte la structure complete
- [ ] Le theme est harmonise (memes couleurs, typographie)
- [ ] 0 erreurs lint, 0 erreurs TypeScript
- [ ] Les pages existantes (Customers, Suppliers, Reports, Enterprise) fonctionnent toujours
- [ ] Features catalog mis a jour

---

## NOTES

**Architecture web vs mobile :**

- Le web utilise les APIs HTTP (api.ts) au lieu du SQLite local
- Pas de mode offline pour le web (pas necessaire)
- Le web a un layout sidebar, le mobile a des bottom tabs
- Les modales web sont plus grandes et peuvent afficher plus d'information
- Le web peut utiliser des tableaux, le mobile utilise des FlatList

**Priorite d'implementation :**

1. Sale.tsx (POS) - critique pour l'activite quotidienne
2. Cash.tsx - critique pour la gestion financiere
3. Home.tsx - important pour la vue d'ensemble
4. Products.tsx + ProductDetails.tsx - important pour la gestion catalogue
5. Le reste est secondaire

**APK Size (mobile) :**

- Ce plan ne touche PAS l'app mobile, donc pas d'impact sur la taille APK
- Le web est une SPA servie par Vite, pas de contrainte de taille

<!-- EOF -->
