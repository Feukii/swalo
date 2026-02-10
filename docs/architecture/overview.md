# Architecture SWALO

## Vue d'ensemble

SWALO est une application **offline-first** organisée en monorepo avec trois applications principales et des packages partagés.

```
swalo/
├── packages/
│   ├── core/           # Types, schémas Zod, utilitaires partagés
│   ├── ui/             # Composants UI réutilisables (à créer)
│   └── sync/           # Moteur de synchronisation (à créer)
├── apps/
│   ├── api/            # Backend NestJS + PostgreSQL
│   ├── mobile/         # Application React Native + Expo (à créer)
│   └── web/            # Application Web Admin React (à créer)
└── docs/               # Documentation
```

## Package Core (@swalo/core)

### Responsabilités

- Définition des schémas de validation avec Zod
- Types TypeScript partagés
- Utilitaires métier (calculs, devises, dates, validation)

### Structure

```
packages/core/src/
├── schemas/
│   ├── common.ts          # Types de base et enums
│   ├── shop.ts            # Boutiques et utilisateurs
│   ├── product.ts         # Produits et inventaire
│   ├── customer.ts        # Clients
│   ├── supplier.ts        # Fournisseurs
│   ├── sale.ts            # Ventes
│   ├── invoice.ts         # Factures
│   ├── payment.ts         # Paiements
│   ├── cash.ts            # Caisse
│   └── sync.ts            # Synchronisation
├── types/
│   └── index.ts           # Types TypeScript inférés
└── utils/
    ├── currency.ts        # Conversion et formatage des devises
    ├── date.ts            # Manipulation des dates
    ├── validation.ts      # Validation et génération d'IDs
    └── calculations.ts    # Calculs métier
```

### Entités principales

#### Shop & Users

- **Shop** : Boutique avec config (devise, TVA, etc.)
- **User** : Utilisateur avec authentification
- **UserRole** : Rôles par boutique (OWNER, MANAGER, CASHIER)

#### Produits & Inventaire

- **Product** : Produit avec SKU, prix, stock
- **InventoryMovement** : Mouvements de stock (vente, achat, ajustement)
- **InventorySession** : Session d'inventaire physique
- **InventoryCount** : Comptage par produit

#### Clients & Fournisseurs

- **Customer** : Client avec limite de crédit
- **Supplier** : Fournisseur
- **SupplierInvoice** : Facture fournisseur

#### Ventes & Facturation

- **Sale** : Vente avec lignes et paiement
- **SaleItem** : Ligne de vente
- **Invoice** : Facture client
- **InvoiceItem** : Ligne de facture

#### Paiements & Caisse

- **Payment** : Paiement (vente, facture, crédit)
- **CashEntry** : Entrée de caisse
- **CashSession** : Session de caisse (ouverture/clôture)

#### Synchronisation

- **DeviceSyncState** : État de sync par device
- **Mutation** : Mutation à synchroniser
- **SyncPullRequest/Response** : Pull des changements
- **SyncPushRequest/Response** : Push des changements

## Backend API (NestJS)

### Stack technique

- **Framework** : NestJS
- **Base de données** : PostgreSQL (via Supabase)
- **ORM** : Prisma
- **Auth** : JWT avec Passport

### Modules prévus

1. **AuthModule** : Authentification et autorisation
2. **ProductsModule** : CRUD produits
3. **SalesModule** : Gestion des ventes
4. **CustomersModule** : Gestion des clients
5. **SuppliersModule** : Gestion des fournisseurs
6. **InvoicesModule** : Gestion des factures
7. **PaymentsModule** : Gestion des paiements
8. **CashModule** : Gestion de la caisse
9. **InventoryModule** : Gestion de l'inventaire
10. **SyncModule** : Synchronisation offline
11. **ReportsModule** : Rapports et KPIs

### Base de données Prisma

#### Principes

- **IDs** : UUID v4 générés côté client
- **Soft delete** : Champ `deleted` + `deleted_at`
- **Versioning** : Champ `version` incrémental
- **Audit trail** : `created_at`, `updated_at`, `device_id`, `client_op_id`

#### Règles métier

- **Stock** = somme des mouvements (pas de mise à jour directe)
- **Factures validées** = immuables
- **Montants** = stockés en centimes (Int)
- **Dates** = ISO8601 en UTC

## Application Mobile (React Native)

### Stack (à implémenter)

- React Native + Expo
- WatermelonDB (SQLite chiffré avec SQLCipher)
- Zustand (state management)
- React Navigation
- React Native Paper / Tamagui (UI)

### Fonctionnalités clés

- **100% offline** : toutes les opérations métier
- **Sync automatique** : dès que le réseau revient
- **Écrans** : Dashboard, Ventes, Produits, Clients, Fournisseurs, Caisse, Inventaire, Paramètres

## Application Web (React)

### Stack (à implémenter)

- React + TypeScript
- RxDB (IndexedDB)
- TanStack Query
- React Router
- Tailwind CSS + shadcn/ui

### Fonctionnalités clés

- **Multi-boutiques** : gestion centralisée
- **Rapports avancés** : analytics et dashboards
- **Gestion** : produits, utilisateurs, paramètres
- **Import/Export** : CSV, PDF

## Synchronisation

### Stratégie

- **Pull** : Le client demande les changements depuis `lastSyncAt`
- **Push** : Le client envoie ses mutations locales
- **Cursors** : Pour la pagination et la reprise sur erreur
- **Idempotence** : Via `client_op_id` (UUID)

### Gestion des conflits

#### Produits

- **LWW** (Last Writer Wins) par défaut
- Champs protégés (SKU) : conflit si divergence

#### Stock

- Source de vérité = **mouvements**
- Déduplication par `(device_id, client_op_id)`

#### Factures

- **Immuables** après validation
- Rejet si tentative de modification

#### Paiements

- Déduplication par `receipt_ref` ou `client_op_id`

## Principes de sécurité

- **Chiffrement local** : SQLCipher sur mobile
- **JWT** : Tokens courts + refresh tokens
- **Offline auth** : Cache du dernier token valide
- **HTTPS** : Obligatoire pour sync
- **Validation** : Zod côté client et serveur

## Déploiement (cible)

### Gratuit pour 10 boutiques

- **DB + Auth + Storage** : Supabase (free tier)
- **API** : Cloudflare Workers/Pages ou Render (free)
- **Mobile** : Expo EAS (free tier)
- **Web** : Vercel ou Netlify (free tier)

## Prochaines étapes

### Phase 1 : Backend (en cours)

- [x] Structure monorepo
- [x] Package core avec schémas Zod
- [x] Configuration NestJS + Prisma
- [ ] Module Auth (JWT + refresh tokens)
- [ ] Module Products (CRUD + recherche)
- [ ] Module Sales (création vente + mouvements stock)
- [ ] Module Sync (pull/push)

### Phase 2 : Mobile

- [ ] Init Expo + WatermelonDB
- [ ] Schéma SQLite + modèles
- [ ] Moteur de sync client
- [ ] Écrans principaux (Dashboard, Ventes, Produits)
- [ ] Auth offline

### Phase 3 : Web

- [ ] Init React + RxDB
- [ ] Interface multi-boutiques
- [ ] Dashboards et rapports
- [ ] Gestion des utilisateurs

### Phase 4 : Fonctionnalités avancées

- [ ] Génération PDF factures
- [ ] Impression (Bluetooth)
- [ ] Scanner code-barres
- [ ] Export comptable

### Phase 5 : Tests & Déploiement

- [ ] Tests unitaires (>80%)
- [ ] Tests E2E critiques
- [ ] CI/CD
- [ ] Déploiement Supabase + Cloudflare
