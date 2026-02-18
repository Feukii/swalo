# Changelog

Toutes les modifications notables de SWALO sont documentees dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et le projet respecte le [Versioning Semantique](https://semver.org/lang/fr/).

> **Convention de version** : `MAJEUR.MINEUR.CORRECTIF`
>
> - **MAJEUR** : changements incompatibles (breaking changes)
> - **MINEUR** : nouvelles fonctionnalites (retrocompatibles)
> - **CORRECTIF** : corrections de bugs (retrocompatibles)

---

## [1.1.0] - 2026-02-19

### Ajoute

- Module rapports consolides (`/reports/sales`, `/reports/stock`, `/reports/cash`, `/reports/overview`)
- Tests d'integration : inscription, ventes a credit, block/unblock, limite de credit, changement code boutique
- Correction du crash serveur lors de la generation de factures PDF (fonts pdfmake en mode webpack)
- Correction du crash serveur lors du trigger de notifications email (templates en mode webpack)
- Tests d'integration idempotents (detection dynamique du code boutique, balance auto-top-up)

### Statistiques

- **166 tests d'integration** (100% de reussite)
- **104 tests unitaires** backend
- **140 endpoints API** repartis sur 20 controleurs

---

## [1.0.0] - 2026-02-18

Premiere version stable de SWALO. Mini-ERP complet avec 136 endpoints API,
application mobile offline-first, et dashboard web harmonise.

### Fonctionnalites principales

#### Authentification & Utilisateurs

- Connexion email/mot de passe (Web)
- Connexion PIN rapide (Mobile + Web) : code boutique 6 chiffres + PIN 4 chiffres
- Tokens JWT (access 24h + refresh 7d)
- Inscription et creation de boutique
- Verification de boutique par code (endpoint public)
- Profil utilisateur (GET /auth/me)
- RBAC simplifie a 4 roles : SUPERADMIN, BOSS, MANAGER, EMPLOYEE
- Suivi des appareils (device tracking) avec revocation
- Modification du code boutique
- Changement de boutique (multi-shop)
- Systeme d'invitations PIN pour employes
- Horaires de travail par employe

#### Catalogue Produits & Inventaire

- CRUD produits complet avec SKU, code-barres, categories
- Hierarchie produits (Famille / Marque / Type d'article) avec filtrage en cascade
- Recherche et filtres multi-criteres
- Alertes stock bas configurables par produit
- Statistiques produits (KPIs catalogue)
- Lots de stock (Stock Batches) avec destockage FIFO automatique
- Multi-prix par lot (selection du prix a la vente)
- Mouvements d'inventaire traces (SALE, PURCHASE, ADJUSTMENT, INVENTORY)
- Types de conditionnement personnalisables (9 types par defaut)

#### Ventes & Facturation

- Point de vente (POS) complet : panier, client, paiement
- Gestion du panier (ajout, modification quantite, suppression)
- Remises par article et globales
- Annulation de vente avec restauration du stock
- Historique des ventes avec filtres
- Statistiques de ventes (CA, ticket moyen, nombre de ventes)
- Facturation depuis vente avec numerotation sequentielle (SHOP-YYYY-####)
- Generation PDF de facture (Mobile via expo-print, API via pdfmake)
- Destockage automatique FIFO a la vente
- Auto-calcul du total avec override justifie (pricing_notes)
- Vente a credit avec creation automatique de creance

#### Gestion de Caisse

- Entrees de caisse (Cash IN) avec categories predefinies
- Sorties de caisse (Cash OUT) avec categories predefinies
- Achat de marchandise lie fournisseur
- Solde de caisse en temps reel
- Statistiques de caisse par periode
- Historique des mouvements avec filtres
- Corrections (montants negatifs, BOSS uniquement)

#### Clients & Creances

- CRUD clients complet
- Fiche client detaillee (profil, solde, historique, KPIs)
- Creances client (PENDING/PARTIAL/PAID/CANCELLED)
- Paiements de creances avec suivi progressif
- Limite de credit configurable (0 = illimite)
- Remboursements clients
- Detection de doublons et fusion

#### Fournisseurs & Dettes

- CRUD fournisseurs complet
- Fiche fournisseur detaillee
- Dettes fournisseur avec suivi des paiements
- Reclamation de remboursement fournisseur
- Detection de doublons et fusion

#### Rapports & Analytiques

- Dashboard KPI (accueil) : CA, ventes, solde caisse, creances
- Rapports de gestion (ventes, stock, tresorerie)
- Selection de periode personnalisable
- Historique des transactions

#### Mode Offline & Synchronisation

- Base de donnees locale SQLite (21 entites synchronisees)
- 22+ operations offline (ventes, caisse, stock, clients, fournisseurs, creances, dettes, factures, inventaire)
- Moteur de synchronisation bidirectionnel (push/pull)
- Sync automatique (reseau, batterie, timer)
- Gestion des conflits (server-wins avec log)
- Indicateur offline dans l'UI
- Idempotence des operations (client_op_id)
- Authentification PIN offline (cache local)
- Rapports & KPIs offline
- Retention et maintenance des donnees (pruning automatique 90j)

#### Entreprise & Multi-boutique

- Gestion des entreprises (CRUD)
- Association boutique - entreprise
- Statistiques consolidees par entreprise
- Transferts inter-boutiques (creation, expedition, reception, annulation)

#### Notifications

- Resumes mensuels par email
- Configuration email par client

#### Administration Systeme

- Dashboard SuperAdmin
- Statistiques systeme
- Gestion des utilisateurs par boutique (CRUD, roles)
- Gestion des devices (listing, revocation)
- Parametres de boutique
- Suppression de boutique
- Blocage/Deblocage (utilisateurs, boutiques, entreprises)
- Logs d'audit
- Gestion des modules par boutique (activation/desactivation)
- CRUD Entreprises (plateforme admin)
- Gestion des licences (STARTER, PROFESSIONAL, ENTERPRISE)
- Configuration systeme (cle-valeur)
- Export logs d'audit (CSV)

#### Import & Export

- Import catalogue produits (CSV/Excel) avec preview et confirmation
- Mapping colonnes francais/anglais

#### Design & Interface Utilisateur

- Theme mobile unifie (theme-v2.ts)
- Composants UI mobile reutilisables
- Theme web harmonise avec mobile (Tailwind)
- Logo Swalo integre
- Navigation mobile 5 onglets
- Layout web sidebar + top bar (module-aware)

#### Architecture Technique

- Multi-tenancy (isolation par shop_id via JWT)
- Soft delete (suppression logique)
- Versioning (concurrence optimiste)
- Gestion d'erreurs globale
- Client API avec retry (3 tentatives, timeout 30s)
- Health check endpoint
- Guards globaux : BlockStatusGuard, EntitlementGuard
- Systeme modulaire avec @RequireModule() et registre de modules
- 3 tiers de licence : STARTER (6 modules), PROFESSIONAL, ENTERPRISE

### Plateformes

| Composant  | Technologie                    |
| ---------- | ------------------------------ |
| API        | NestJS + Prisma (PostgreSQL)   |
| Web        | React + Vite + Tailwind CSS    |
| Mobile     | React Native + Expo            |
| Base local | SQLite (expo-sqlite)           |
| Shared     | TypeScript + Zod (@swalo/core) |

### Statistiques

- **136 endpoints API** repartis sur 19 controleurs
- **21 entites** synchronisees offline
- **22+ operations** offline
- **4 roles** RBAC (SUPERADMIN, BOSS, MANAGER, EMPLOYEE)
- **18 modules** repartis en 3 tiers de licence
- **104 tests unitaires** backend (9 suites)

---

## Historique de developpement

### Plans implementes

| Plan | Description                                     | Commit(s)          |
| ---- | ----------------------------------------------- | ------------------ |
| 013  | Corrections balances clients                    | `4327948`          |
| 014  | Extension corrections aux fournisseurs          | `6022a95`          |
| 023  | FIFO, multi-prix, credit, auto-calcul panier    | `fb828cc..ecb08be` |
| 024  | Facturation, notifications, enterprise, offline | `cc0d3ea`          |
| 025  | Packaging types, PDF factures                   | `65c1ce1`          |
| 026  | Admin plateforme, architecture modulaire        | `e46a589`          |
| 027  | Autonomie offline complete (5 phases)           | `68773aa..069d42c` |
| 028  | Harmonisation web/mobile UI (8 pages)           | `41bb27e`          |
| 029  | Harmonisation finale, module gating, bugfix     | `e2f8441..b950cf8` |

---

<!-- Modele pour les futures releases -->
<!--
## [X.Y.Z] - YYYY-MM-DD

### Ajoute
- Nouvelles fonctionnalites

### Modifie
- Modifications de fonctionnalites existantes

### Corrige
- Corrections de bugs

### Supprime
- Fonctionnalites supprimees

### Securite
- Corrections de vulnerabilites
-->
