# SWALO - État d'avancement du projet

**Date de création** : 11 octobre 2025
**Version** : 0.1.0 (MVP en cours)
**Statut global** : ✅ Architecture initialisée, backend en configuration

> Note: Les modules de synchronisation/offline d?crits dans la documentation sont encore en d?veloppement actif.

---

## ✅ Ce qui a été fait

### 1. Structure du projet (Monorepo)

✅ **Monorepo avec Turbo + pnpm**

- Configuration Turbo pour le build et les tâches
- Workspaces pnpm pour la gestion des dépendances
- Structure complète des dossiers (packages + apps)

✅ **Configuration Git**

- Repository initialisé
- Branches `main` (stable) et `dev` créées
- `.gitignore` configuré
- Commits initiaux effectués

✅ **Configuration générale**

- Prettier pour le formatage
- TypeScript configuré pour tous les packages
- Scripts npm globaux (dev, build, test, lint)

### 2. Package Core (@swalo/core)

✅ **Schémas Zod complets** pour toutes les entités :

- Shop, User, UserRole
- Product, InventoryMovement, InventorySession, InventoryCount
- Customer, Supplier, SupplierInvoice
- Sale, SaleItem, Invoice, InvoiceItem
- Payment, CashEntry, CashSession
- DeviceSyncState, Mutation, SyncPull/Push

✅ **Types TypeScript** générés automatiquement depuis Zod

✅ **Utilitaires métier** :

- `currency.ts` : Conversion centimes/devise, formatage, calculs
- `date.ts` : Manipulation dates ISO8601, comparaisons
- `validation.ts` : Génération UUID, validation SKU, normalisation email/phone
- `calculations.ts` : Calculs de totaux, marges, TVA

### 3. Backend API (NestJS)

✅ **Structure NestJS** :

- Configuration NestJS complète
- Module principal (AppModule)
- Module Prisma global
- Point d'entrée (main.ts) avec CORS et validation

✅ **Schéma Prisma PostgreSQL** :

- 20+ modèles de données définis
- Relations complètes entre entités
- Index optimisés pour les requêtes
- Support du soft-delete et versioning
- Enums pour les statuts et types

✅ **Modules déclarés** (squelettes à implémenter) :

- AuthModule
- ProductsModule
- SalesModule
- CustomersModule
- SuppliersModule
- InvoicesModule
- PaymentsModule
- CashModule
- InventoryModule
- SyncModule
- ReportsModule

✅ **Configuration** :

- Fichier `.env.example` avec toutes les variables
- Support PostgreSQL local et Supabase
- Configuration JWT préparée

### 4. Documentation

✅ **ARCHITECTURE.md** :

- Vue d'ensemble complète du système
- Description de tous les packages et apps
- Stratégie de synchronisation détaillée
- Gestion des conflits par entité
- Plan de déploiement

✅ **GETTING_STARTED.md** :

- Guide d'installation pas à pas
- Configuration PostgreSQL/Supabase
- Scripts de développement
- Workflow Git

✅ **README.md** :

- Présentation du projet
- Features principales
- Stack technique
- Structure du monorepo

---

## 🚧 En cours / À faire

### Phase 1 : Backend Core (priorité haute)

#### À implémenter immédiatement

1. **Module Auth** (critique)
   - [ ] Service d'authentification avec bcrypt
   - [ ] Stratégie JWT + Refresh tokens
   - [ ] Guards pour les routes protégées
   - [ ] Décorateurs pour les rôles (OWNER, MANAGER, CASHIER)
   - [ ] Endpoints : `/auth/login`, `/auth/refresh`, `/auth/logout`

2. **Module Products** (MVP)
   - [ ] CRUD complet (Create, Read, Update, Delete)
   - [ ] Recherche par SKU, nom, catégorie
   - [ ] Validation unicité SKU par boutique
   - [ ] Calcul du stock en temps réel (agrégation des mouvements)
   - [ ] Endpoints : `/products/*`

3. **Module Sales** (MVP)
   - [ ] Création de vente avec items
   - [ ] Calculs automatiques (totaux, taxes, remises)
   - [ ] Création automatique des mouvements de stock
   - [ ] Support paiement cash/crédit/carte/mobile
   - [ ] Endpoints : `/sales/*`

4. **Module Sync** (critique pour offline)
   - [ ] Endpoint `/sync/pull` (pull changements serveur)
   - [ ] Endpoint `/sync/push` (push mutations client)
   - [ ] Gestion des cursors pour pagination
   - [ ] Déduplication par `client_op_id`
   - [ ] Résolution des conflits par entité

### Phase 2 : Autres modules backend

5. **Module Customers**
   - [ ] CRUD clients
   - [ ] Calcul du solde crédit (ventes - paiements)
   - [ ] Alertes dépassement limite

6. **Module Suppliers**
   - [ ] CRUD fournisseurs
   - [ ] Factures fournisseurs
   - [ ] Calcul soldes fournisseurs

7. **Module Invoices**
   - [ ] Création facture depuis vente
   - [ ] Génération numéro séquentiel
   - [ ] Immutabilité après validation
   - [ ] Génération PDF (à implémenter plus tard)

8. **Module Payments**
   - [ ] Enregistrement paiements
   - [ ] Déduplication par receipt_ref
   - [ ] Historique paiements

9. **Module Cash**
   - [ ] Ouverture/Clôture caisse
   - [ ] Entrées/Sorties hors ventes
   - [ ] Rapprochement caisse

10. **Module Inventory**
    - [ ] Sessions d'inventaire
    - [ ] Comptage produits
    - [ ] Ajustements automatiques

11. **Module Reports**
    - [ ] KPIs (CA, marges, top produits)
    - [ ] Rapports par période
    - [ ] Export CSV

### Phase 3 : Applications clientes

12. **Application Mobile (React Native + Expo)**
    - [ ] Init projet Expo
    - [ ] Configuration WatermelonDB (SQLite)
    - [ ] Schéma SQLite mirror du backend
    - [ ] Moteur de synchronisation client
    - [ ] Écrans : Dashboard, Ventes, Produits, Clients, Caisse
    - [ ] Auth offline (cache token)
    - [ ] Chiffrement SQLCipher

13. **Application Web (React)**
    - [ ] Init projet React + Vite
    - [ ] Configuration RxDB (IndexedDB)
    - [ ] Interface multi-boutiques
    - [ ] Dashboards et rapports
    - [ ] Gestion utilisateurs et rôles
    - [ ] Import/Export CSV

### Phase 4 : Tests & Déploiement

14. **Tests**
    - [ ] Tests unitaires services (>80% coverage)
    - [ ] Tests d'intégration API
    - [ ] Tests E2E scénarios critiques
    - [ ] Seed data pour tests

15. **CI/CD**
    - [ ] GitHub Actions (lint, test, build)
    - [ ] Déploiement automatique

16. **Déploiement**
    - [ ] Supabase (DB + Auth + Storage)
    - [ ] Cloudflare Workers/Pages (API)
    - [ ] Expo EAS (Mobile)
    - [ ] Vercel/Netlify (Web)

---

## 📋 Checklist avant première utilisation

### Développeur

- [ ] Installer Node.js >= 18
- [ ] Installer pnpm >= 8
- [ ] Cloner le repo
- [ ] `pnpm install`
- [ ] Créer compte Supabase (ou installer PostgreSQL)
- [ ] Configurer `.env` dans `apps/api/`
- [ ] `cd apps/api && pnpm prisma:generate`
- [ ] `pnpm prisma:migrate`
- [ ] `pnpm dev`

### Prochaines actions immédiates

1. **Implémenter le module Auth** pour sécuriser l'API
2. **Implémenter le module Products** pour avoir des données
3. **Implémenter le module Sales** pour tester le flux complet
4. **Implémenter le module Sync** pour valider l'approche offline-first

---

## 🎯 Objectifs MVP (Version 1.0)

### Fonctionnalités minimales

✅ Définies dans le cahier des charges :

- Ventes offline avec calculs automatiques
- Gestion produits (CRUD + stock)
- Clients avec crédit
- Fournisseurs de base
- Caisse (ouverture/clôture)
- Facturation simple
- Dashboard KPIs offline
- Synchronisation bidirectionnelle
- Auth + rôles

### Critères de succès MVP

- [ ] Un vendeur peut créer une vente **offline** en < 30 secondes
- [ ] Le stock est toujours à jour (basé sur les mouvements)
- [ ] La sync fonctionne sans perte de données
- [ ] Les conflits sont résolus de manière déterministe
- [ ] L'app fonctionne pour 10 boutiques à coût ~0€

---

## 📊 Métriques projet

| Métrique           | Valeur                         |
| ------------------ | ------------------------------ |
| **Commits**        | 2                              |
| **Branches**       | 2 (main, dev)                  |
| **Packages**       | 1 (@swalo/core)                |
| **Apps**           | 1 (api, squelette)             |
| **Schémas Zod**    | 10 fichiers                    |
| **Modèles Prisma** | 20+                            |
| **Modules NestJS** | 11 (déclarés, non implémentés) |
| **Lignes de code** | ~2600                          |
| **Tests**          | 0 (à écrire)                   |
| **Coverage**       | 0%                             |

---

## 🔗 Ressources

- [Cahier des charges](../cahier_des_charges_technique_swalo_offline_first_oriente_ia_codeuse.md)
- [Architecture](./ARCHITECTURE.md)
- [Guide de démarrage](./GETTING_STARTED.md)
- [README](../README.md)

---

## 📝 Notes importantes

### Principes à respecter

1. **Offline-first** : Toujours implémenter la logique offline d'abord
2. **Pas de mise à jour directe du stock** : Toujours passer par des mouvements
3. **Factures immuables** : Une facture validée ne peut être modifiée
4. **Montants en centimes** : Pour éviter les erreurs de précision
5. **UUID côté client** : Pour permettre la création offline
6. **Idempotence** : Chaque mutation a un `client_op_id` unique

### Décisions techniques

- **Monorepo** : Pour partager le code entre apps
- **Zod** : Pour validation runtime côté client et serveur
- **Prisma** : Pour l'ORM avec migrations versionnées
- **WatermelonDB** : Pour SQLite offline sur mobile
- **RxDB** : Pour IndexedDB offline sur web
- **NestJS** : Pour l'API backend structurée

---

**Dernière mise à jour** : 11 octobre 2025
**Par** : Claude Code
**Statut** : Prêt pour développement des modules backend
