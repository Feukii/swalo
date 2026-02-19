# SWALO - Catalogue Exhaustif des Fonctionnalités

> **Dernière mise à jour** : 2026-02-19
> **Version application** : 1.0.0
> **Branche** : develop
>
> **Ce fichier DOIT être mis à jour à chaque ajout ou modification de fonctionnalité.**

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Authentification & Gestion des utilisateurs](#2-authentification--gestion-des-utilisateurs)
3. [Catalogue produits & Inventaire](#3-catalogue-produits--inventaire)
4. [Ventes & Facturation](#4-ventes--facturation)
5. [Gestion de caisse](#5-gestion-de-caisse)
6. [Clients & Créances](#6-clients--créances)
7. [Fournisseurs & Dettes](#7-fournisseurs--dettes)
8. [Rapports & Analytiques](#8-rapports--analytiques)
9. [Mode Offline & Synchronisation](#9-mode-offline--synchronisation)
10. [Entreprise & Multi-boutique](#10-entreprise--multi-boutique)
11. [Notifications & Communication](#11-notifications--communication)
12. [Administration système](#12-administration-système)
13. [Import & Export de données](#13-import--export-de-données)
14. [Design & Interface utilisateur](#14-design--interface-utilisateur)
15. [Architecture technique transversale](#15-architecture-technique-transversale)
16. [Fonctionnalités planifiées (non implémentées)](#16-fonctionnalités-planifiées-non-implémentées)
17. [Matrice de compatibilité par plateforme](#17-matrice-de-compatibilité-par-plateforme)
18. [Classification modulaire](#18-classification-modulaire)

---

## 1. Vue d'ensemble

**SWALO** est un mini-ERP de commerce de détail conçu pour les boutiques d'accessoires téléphoniques en Afrique Centrale. Il fonctionne en mode **offline-first** et cible toute entreprise de commerce, du petit commerçant à la PME.

### Stack technique

| Composant       | Technologie                              | Port local       |
| --------------- | ---------------------------------------- | ---------------- |
| **API**         | NestJS + Prisma (PostgreSQL)             | `localhost:3000` |
| **Web**         | React + Vite + Tailwind CSS              | `localhost:3001` |
| **Mobile**      | React Native + Expo                      | Expo Dev Server  |
| **Base locale** | SQLite (expo-sqlite)                     | Embarquée        |
| **Shared**      | TypeScript + Zod (`@swalo/core`)         | Package NPM      |
| **BDD**         | PostgreSQL 16 (Docker local / Neon prod) | `localhost:5432` |

### Monnaie

Tous les montants sont stockés en **entiers FCFA** (francs CFA). Aucune décimale n'est nécessaire pour cette monnaie.

---

## 2. Authentification & Gestion des utilisateurs

### 2.1 Connexion par email/mot de passe

| Propriété         | Valeur                                                                      |
| ----------------- | --------------------------------------------------------------------------- |
| **Description**   | Authentification standard par email et mot de passe avec tokens JWT         |
| **Plateformes**   | Web                                                                         |
| **Module**        | Coeur                                                                       |
| **Endpoint**      | `POST /api/auth/login`                                                      |
| **Fichiers clés** | `apps/api/src/modules/auth/auth.service.ts`, `apps/web/src/pages/Login.tsx` |

- L'utilisateur saisit son email (ou téléphone) et mot de passe
- Un token d'accès (24h) et un token de rafraîchissement (7d) sont émis
- Le token est stocké dans `localStorage` (web)

### 2.2 Connexion par PIN (mobile)

| Propriété         | Valeur                                                                              |
| ----------------- | ----------------------------------------------------------------------------------- |
| **Description**   | Authentification mobile rapide : code boutique (6 chiffres) + code PIN (4 chiffres) |
| **Plateformes**   | Mobile, Web (alternatif)                                                            |
| **Module**        | Coeur                                                                               |
| **Endpoint**      | `POST /api/auth/pin`                                                                |
| **Fichiers clés** | `apps/mobile/src/screens/LoginPinScreen.tsx`, `apps/web/src/pages/LoginPin.tsx`     |

- Le caissier saisit le code de sa boutique puis son PIN personnel
- Le device est enregistré automatiquement (device_id, device_name, device_type)
- Tokens JWT identiques au login email

### 2.3 Rafraîchissement de token

| Propriété       | Valeur                                                                       |
| --------------- | ---------------------------------------------------------------------------- |
| **Description** | Renouvellement automatique du token d'accès via le token de rafraîchissement |
| **Plateformes** | Mobile, Web                                                                  |
| **Module**      | Coeur                                                                        |
| **Endpoint**    | `POST /api/auth/refresh`                                                     |

- Le token d'accès expire après 24h
- Le client utilise le refresh token pour en obtenir un nouveau
- Déconnexion automatique si le refresh token expire (7 jours)

### 2.4 Inscription et création de boutique

| Propriété       | Valeur                                                  |
| --------------- | ------------------------------------------------------- |
| **Description** | Créer un compte propriétaire avec sa première boutique  |
| **Plateformes** | Web, API                                                |
| **Module**      | Coeur                                                   |
| **Endpoints**   | `POST /api/auth/register`, `POST /api/auth/create-shop` |

- `register` : crée un utilisateur + boutique + rôle OWNER
- `create-shop` : création rapide admin avec code boutique et PIN auto-générés

### 2.5 Vérification de boutique

| Propriété       | Valeur                                                             |
| --------------- | ------------------------------------------------------------------ |
| **Description** | Vérifier l'existence d'une boutique par son code (endpoint public) |
| **Plateformes** | Mobile, Web                                                        |
| **Module**      | Coeur                                                              |
| **Endpoint**    | `GET /api/auth/verify-shop/:code`                                  |

### 2.6 Profil utilisateur

| Propriété       | Valeur                                                           |
| --------------- | ---------------------------------------------------------------- |
| **Description** | Récupérer les informations du profil connecté (user, shop, rôle) |
| **Plateformes** | Mobile, Web                                                      |
| **Module**      | Coeur                                                            |
| **Endpoint**    | `GET /api/auth/me`                                               |

### 2.7 Rôles et permissions (RBAC)

| Propriété         | Valeur                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| **Description**   | Système de rôles hiérarchiques contrôlant l'accès aux fonctionnalités                            |
| **Plateformes**   | Mobile, Web, API                                                                                 |
| **Module**        | Coeur                                                                                            |
| **Fichiers clés** | `apps/api/src/common/guards/roles.guard.ts`, `apps/api/src/common/decorators/roles.decorator.ts` |

| Rôle         | Niveau     | Accès                                                                  |
| ------------ | ---------- | ---------------------------------------------------------------------- |
| `SUPERADMIN` | Plateforme | Accès total à toutes les boutiques et fonctions système                |
| `BOSS`       | Boutique   | Propriétaire, gestion complète, corrections de montants négatifs       |
| `MANAGER`    | Boutique   | Gestion du personnel, produits, caisse, rapports, admin boutique       |
| `EMPLOYEE`   | Boutique   | Opérations de base (ventes, caisse, inventaire, clients, fournisseurs) |

> **Plan 026** : Simplification de 6 rôles à 4. `OWNER` renommé `BOSS`, `ADMIN` fusionné dans `MANAGER`, `CASHIER` fusionné dans `EMPLOYEE`.

Chaque rôle est attribué **par boutique** via le modèle `UserRole`. Un utilisateur peut avoir des rôles différents dans des boutiques différentes.

### 2.8 Suivi des appareils (Device Tracking)

| Propriété       | Valeur                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Description** | Enregistrement et gestion des appareils connectés par utilisateur                                                      |
| **Plateformes** | Mobile (enregistrement), Web (gestion)                                                                                 |
| **Module**      | Coeur                                                                                                                  |
| **Modèle**      | `UserDevice` (user_id, shop_id, device_id, device_name, device_type, last_login_at, is_active, revoked_at, revoked_by) |

- Chaque connexion PIN enregistre le device automatiquement
- Un admin peut lister les devices d'un utilisateur
- Révocation individuelle ou en masse des devices
- Contrainte unique : `[user_id, shop_id, device_id]`

### 2.9 Modification du code boutique

| Propriété       | Valeur                                                            |
| --------------- | ----------------------------------------------------------------- |
| **Description** | Le propriétaire peut modifier le code à 6 chiffres de sa boutique |
| **Plateformes** | Mobile, Web                                                       |
| **Module**      | Coeur                                                             |
| **Endpoint**    | `PATCH /api/auth/shop-code`                                       |

- Nécessite la confirmation par PIN du propriétaire

### 2.10 Changement de boutique

| Propriété         | Valeur                                                          |
| ----------------- | --------------------------------------------------------------- |
| **Description**   | Un utilisateur multi-boutique peut basculer entre ses boutiques |
| **Plateformes**   | Mobile, Web                                                     |
| **Module**        | Coeur                                                           |
| **Endpoints**     | `POST /api/auth/switch-shop`, `GET /api/auth/accessible-shops`  |
| **Fichiers clés** | `apps/mobile/src/screens/ShopSwitcherScreen.tsx`                |

### 2.11 Système d'invitations PIN

| Propriété       | Valeur                                                       |
| --------------- | ------------------------------------------------------------ |
| **Description** | Générer des codes PIN d'invitation pour de nouveaux employés |
| **Plateformes** | Mobile, Web, API                                             |
| **Module**      | Coeur                                                        |
| **Endpoints**   | `POST/GET /api/pin-invites`, `GET /api/pin-invites/stats`    |

- Création d'un PIN avec rôle, nom d'affichage, dates de validité
- Suivi du statut (utilisé, expiré, actif)
- Révocation possible

### 2.12 Horaires de travail

| Propriété       | Valeur                                                                |
| --------------- | --------------------------------------------------------------------- |
| **Description** | Définir les jours et heures de travail par employé                    |
| **Plateformes** | Web, API                                                              |
| **Module**      | Étendu (admin)                                                        |
| **Champs**      | `work_days` (JSON), `work_start_time`, `work_end_time` sur `UserRole` |

---

## 3. Catalogue produits & Inventaire

### 3.1 Gestion des produits (CRUD)

| Propriété         | Valeur                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Description**   | Créer, lire, modifier, supprimer des produits dans le catalogue                                                          |
| **Plateformes**   | Mobile, Web, API                                                                                                         |
| **Module**        | Coeur                                                                                                                    |
| **Endpoints**     | `GET/POST/PUT/DELETE /api/products`                                                                                      |
| **Fichiers clés** | `apps/api/src/modules/products/`, `apps/web/src/pages/Dashboard.tsx`, `apps/mobile/src/screens/ProductCatalogScreen.tsx` |

Chaque produit contient :

- Identifiants : `sku` (unique par boutique), `barcode`, `reference`
- Classification : `category`, `family`, `article_type`, `brand`
- Prix : `cost_price` (achat), `sell_price` (vente), `tax_rate`
- Stock : `alert_threshold` (seuil d'alerte stock bas)
- Métadonnées : `unit`, `description`, `image_url`, `is_active`

### 3.2 Hiérarchie produits (Famille / Marque / Type)

| Propriété         | Valeur                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Description**   | Classification hiérarchique des produits avec filtrage en cascade                                                        |
| **Plateformes**   | Mobile, Web, API                                                                                                         |
| **Module**        | Coeur                                                                                                                    |
| **Endpoints**     | `GET /api/products/families`, `GET /api/products/brands`, `GET /api/products/article-types`, `GET /api/products/filters` |
| **Fichiers clés** | `apps/mobile/src/screens/CatalogHierarchyScreen.tsx`                                                                     |

- Famille → Marque → Type d'article
- Filtrage en cascade : sélectionner une famille filtre les marques et types disponibles
- Mise à jour en masse : `POST /api/products/batch-update-hierarchy`

### 3.3 Recherche et filtres produits

| Propriété       | Valeur                                                                   |
| --------------- | ------------------------------------------------------------------------ |
| **Description** | Rechercher des produits par nom, SKU, code-barres avec filtres multiples |
| **Plateformes** | Mobile (local + API), Web, API                                           |
| **Module**      | Coeur                                                                    |
| **Endpoint**    | `GET /api/products?search=...&category=...&is_active=...`                |

- Recherche fuzzy sur nom, SKU, code-barres
- Filtres par catégorie, famille, marque, type d'article, statut actif/inactif
- Tri par nom, prix, date de création

### 3.4 Alertes stock bas

| Propriété       | Valeur                                                                |
| --------------- | --------------------------------------------------------------------- |
| **Description** | Identifier les produits dont le stock est inférieur au seuil d'alerte |
| **Plateformes** | Mobile, Web, API                                                      |
| **Module**      | Coeur                                                                 |
| **Endpoint**    | `GET /api/products/low-stock`                                         |

- Chaque produit a un `alert_threshold` configurable
- L'endpoint retourne les produits en dessous du seuil

### 3.5 Statistiques produits

| Propriété       | Valeur                                                        |
| --------------- | ------------------------------------------------------------- |
| **Description** | KPIs du catalogue : nombre total, actifs, valeur d'inventaire |
| **Plateformes** | Mobile, Web, API                                              |
| **Module**      | Coeur                                                         |
| **Endpoint**    | `GET /api/products/stats`                                     |

### 3.6 Lots de stock (Stock Batches) & FIFO

| Propriété         | Valeur                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description**   | Gestion du stock par lots avec déstockage FIFO (First In, First Out)                                                                                        |
| **Plateformes**   | Mobile, Web, API                                                                                                                                            |
| **Module**        | Coeur                                                                                                                                                       |
| **Endpoints**     | `POST /api/inventory/batches`, `GET /api/inventory/products/:id/batches`, `POST /api/inventory/sale-fifo`, `POST /api/inventory/sale-from-batch`            |
| **Fichiers clés** | `apps/api/src/modules/inventory/inventory.service.ts`, `apps/web/src/pages/ProductBatches.tsx`, `apps/mobile/src/screens/products/ProductBatchesScreen.tsx` |
| **Modèle**        | `StockBatch` (quantity, remaining_quantity, cost_price, sell_price, price_valid_from, price_valid_until)                                                    |

- Chaque réception de marchandise crée un lot avec son prix d'achat et de vente
- Le déstockage FIFO consomme automatiquement les lots les plus anciens
- Possibilité de vendre depuis un lot spécifique (multi-prix)
- Suivi de `remaining_quantity` pour chaque lot

### 3.7 Multi-prix (prix par lot)

| Propriété         | Valeur                                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| **Description**   | Un même produit peut avoir plusieurs prix de vente selon les lots en stock |
| **Plateformes**   | Mobile, Web, API                                                           |
| **Module**        | Coeur                                                                      |
| **Endpoint**      | `GET /api/products/:id/prices`                                             |
| **Fichiers clés** | `apps/mobile/src/screens/SaleScreen.tsx` (modal de sélection de prix)      |

- Si un produit a des lots avec des prix différents, le caissier choisit quel prix appliquer
- L'API retourne les prix disponibles groupés par valeur avec les quantités totales
- Indicateur visuel "multi-prix" sur la liste des produits
- Modal de sélection avec : prix, quantité disponible, nombre de lots

### 3.8 Mouvements d'inventaire

| Propriété       | Valeur                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **Description** | Tracer tous les mouvements de stock (entrées, sorties, ajustements)                                      |
| **Plateformes** | Mobile, Web, API                                                                                         |
| **Module**      | Coeur                                                                                                    |
| **Endpoints**   | `POST /api/inventory/movements`, `POST /api/inventory/stock-in`, `POST /api/inventory/sale-out`          |
| **Modèle**      | `InventoryMovement` (type: SALE/PURCHASE/ADJUSTMENT/INVENTORY, qty, reason, ref_type, ref_id, unit_cost) |

- Chaque mouvement référence la source (vente, achat, ajustement, inventaire)
- Historique complet par produit consultable

### 3.9 Types de conditionnement

| Propriété       | Valeur                                                                                |
| --------------- | ------------------------------------------------------------------------------------- |
| **Description** | Définir les unités de conditionnement des produits (pièce, carton, pack...)           |
| **Plateformes** | Web, API                                                                              |
| **Module**      | Étendu                                                                                |
| **Endpoints**   | `GET/POST/PUT/DELETE /api/packaging-types`, `POST /api/packaging-types/init-defaults` |
| **Modèle**      | `PackagingType` (name, symbol, is_default)                                            |

- Conditionnements par défaut initialisables par boutique
- Chaque boutique peut personnaliser ses conditionnements

---

## 4. Ventes & Facturation

### 4.1 Point de vente (POS)

| Propriété         | Valeur                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------- |
| **Description**   | Créer une vente avec un panier de produits, un client optionnel, et un mode de paiement |
| **Plateformes**   | Mobile, Web, API                                                                        |
| **Module**        | Coeur                                                                                   |
| **Endpoint**      | `POST /api/sales`                                                                       |
| **Fichiers clés** | `apps/mobile/src/screens/SaleScreen.tsx`, `apps/web/src/pages/POS.tsx`                  |

**Flux de vente :**

1. Rechercher et ajouter des produits au panier
2. Si multi-prix : choisir le prix/lot pour chaque produit
3. Optionnel : sélectionner un client
4. Choisir le mode de paiement : `CASH` ou `CREDIT`
5. Confirmer la vente

**Champs de la vente :**

- `subtotal`, `discount`, `tax_total`, `net_total`, `grand_total`
- `paid_total`, `change` (rendu monnaie)
- `payment_method` : CASH, CARD, MOBILE, CREDIT
- `status` : DRAFT, COMPLETED, CANCELLED
- `device_id`, `client_op_id` : pour idempotence offline

**Chaque article (SaleItem) contient :**

- `product_id`, `product_name`, `sku`, `qty`, `unit_price`
- `discount`, `tax_rate`, `subtotal`, `tax_total`, `total`
- `batch_id` : lot de stock utilisé (pour traçabilité FIFO)

### 4.2 Gestion du panier

| Propriété       | Valeur                                                                |
| --------------- | --------------------------------------------------------------------- |
| **Description** | Ajouter/supprimer des produits, modifier les quantités dans le panier |
| **Plateformes** | Mobile, Web                                                           |
| **Module**      | Coeur                                                                 |

- Ajout par recherche ou scan (futur)
- Modification de quantité par article
- Suppression d'articles
- Affichage du sous-total en temps réel

### 4.3 Remises

| Propriété       | Valeur                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| **Description** | Appliquer des remises au niveau article ou au niveau global de la vente |
| **Plateformes** | Mobile, Web, API                                                        |
| **Module**      | Coeur                                                                   |

- Remise par article : champ `discount` sur `SaleItem` (montant en FCFA)
- Remise globale : champ `discount` sur `Sale` (montant en FCFA)
- Le backend recalcule tous les totaux après application

### 4.4 Annulation de vente

| Propriété       | Valeur                                             |
| --------------- | -------------------------------------------------- |
| **Description** | Annuler une vente complète (restauration du stock) |
| **Plateformes** | Mobile, Web, API                                   |
| **Module**      | Coeur                                              |
| **Endpoint**    | `PUT /api/sales/:id/cancel`                        |
| **Rôles**       | BOSS, MANAGER                                      |

### 4.5 Historique des ventes

| Propriété       | Valeur                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| **Description** | Consulter l'historique des ventes avec filtres et recherche             |
| **Plateformes** | Mobile, Web, API                                                        |
| **Module**      | Coeur                                                                   |
| **Endpoint**    | `GET /api/sales?customer_id=...&status=...&start_date=...&end_date=...` |

### 4.6 Statistiques de ventes

| Propriété       | Valeur                                                    |
| --------------- | --------------------------------------------------------- |
| **Description** | KPIs : nombre de ventes, chiffre d'affaires, ticket moyen |
| **Plateformes** | Mobile, Web, API                                          |
| **Module**      | Coeur                                                     |
| **Endpoint**    | `GET /api/sales/stats`                                    |

### 4.7 Facturation (création depuis vente)

| Propriété       | Valeur                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | Générer une facture formelle à partir d'une vente existante                                                                                                       |
| **Plateformes** | Mobile, Web, API                                                                                                                                                  |
| **Module**      | Premium (invoices)                                                                                                                                                |
| **Endpoints**   | `POST /api/invoices/from-sale/:saleId`, `GET /api/invoices`, `GET /api/invoices/:id`, `PUT /api/invoices/:id/cancel`                                              |
| **Modèle**      | `Invoice` (number: SHOP-YYYY-####, status: DRAFT/ISSUED/PAID/CANCELLED, issue_date, due_date, subtotal, tax_total, grand_total, paid_total, balance_due, pdf_url) |

- Numérotation séquentielle automatique par boutique
- Facture liée à la vente et au client
- Statuts : Brouillon → Émise → Payée / Annulée

### 4.8 Génération PDF de facture

| Propriété         | Valeur                                                                              |
| ----------------- | ----------------------------------------------------------------------------------- |
| **Description**   | Générer un PDF de la facture pour impression ou envoi                               |
| **Plateformes**   | Mobile                                                                              |
| **Module**        | Premium (invoices)                                                                  |
| **Fichiers clés** | `apps/mobile/src/utils/pdfGenerator.ts`, `apps/mobile/src/utils/invoiceTemplate.ts` |

- Template HTML converti en PDF via `expo-print`
- Inclut : logo boutique, détails client, liste articles, totaux, mentions légales

### 4.9 Déstockage automatique à la vente

| Propriété       | Valeur                                                                     |
| --------------- | -------------------------------------------------------------------------- |
| **Description** | Le stock est automatiquement déduit selon la méthode FIFO lors d'une vente |
| **Plateformes** | Mobile (offline), API                                                      |
| **Module**      | Coeur                                                                      |

- Si `batch_id` spécifié : déduction du lot choisi
- Sinon : FIFO automatique (lots les plus anciens en premier)
- Validation : empêche la survente (stock insuffisant)
- Fonctionne en mode offline via le repository local `deductFIFO()`

### 4.10 Auto-calcul du total panier avec traçabilité prix

| Propriété         | Valeur                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description**   | Le total du panier est automatiquement calculé à partir de la somme des (quantité x prix unitaire) de chaque article. Le vendeur peut activer un override pour modifier le total final, mais doit obligatoirement saisir un commentaire justificatif (`pricing_notes`). Le total attendu (`expected_total`) est stocké pour audit. |
| **Plateformes**   | Mobile, API                                                                                                                                                                                                                                                                                                                        |
| **Module**        | Coeur                                                                                                                                                                                                                                                                                                                              |
| **Champs**        | `Sale.expected_total` (Int), `Sale.pricing_notes` (String)                                                                                                                                                                                                                                                                         |
| **Fichiers clés** | `SaleScreen.tsx` (toggle override + computed total), `sales.service.ts` (stocke les champs), `create-sale.dto.ts`                                                                                                                                                                                                                  |
| **Statut**        | **Implémenté** (Plan 023 - Phase 2)                                                                                                                                                                                                                                                                                                |

### 4.11 Vente à crédit (CREDIT payment method)

| Propriété         | Valeur                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description**   | Permettre de créer une vente avec `payment_method: CREDIT`. Le montant n'est pas payé immédiatement mais crée automatiquement une créance client (`ClientReceivable`). La limite de crédit est vérifiée avant validation. |
| **Plateformes**   | Mobile, API                                                                                                                                                                                                               |
| **Module**        | Coeur + Étendu (receivables)                                                                                                                                                                                              |
| **Fichiers clés** | `sales.service.ts` (auto-création receivable), `create-sale.dto.ts` (payment_method CREDIT)                                                                                                                               |
| **Statut**        | **Implémenté** (Plan 023 - Phase 1)                                                                                                                                                                                       |

---

## 5. Gestion de caisse

### 5.1 Entrées de caisse (Cash IN)

| Propriété         | Valeur                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| **Description**   | Enregistrer une entrée d'argent en caisse                              |
| **Plateformes**   | Mobile, Web, API                                                       |
| **Module**        | Coeur                                                                  |
| **Endpoint**      | `POST /api/cash/entries` (type: IN)                                    |
| **Fichiers clés** | `apps/mobile/src/screens/CashScreen.tsx`, `apps/web/src/pages/POS.tsx` |

Catégories prédéfinies : Vente, Paiement client, Remboursement fournisseur, Apport personnel, Divers

### 5.2 Sorties de caisse (Cash OUT)

| Propriété       | Valeur                                       |
| --------------- | -------------------------------------------- |
| **Description** | Enregistrer une sortie d'argent de la caisse |
| **Plateformes** | Mobile, Web, API                             |
| **Module**      | Coeur                                        |
| **Endpoint**    | `POST /api/cash/entries` (type: OUT)         |

Catégories prédéfinies : Achat marchandise, Paiement fournisseur, Remboursement client, Charges/frais, Retrait personnel, Divers

### 5.3 Achat de marchandise (lié fournisseur)

| Propriété       | Valeur                                                            |
| --------------- | ----------------------------------------------------------------- |
| **Description** | Enregistrer un achat de marchandise avec lien vers le fournisseur |
| **Plateformes** | Mobile, Web, API                                                  |
| **Module**      | Coeur                                                             |
| **Endpoint**    | `POST /api/cash/merchandise-purchase`                             |

- Crée une sortie de caisse catégorisée "Achat marchandise"
- Lie automatiquement au fournisseur sélectionné
- Peut créer une dette fournisseur si paiement différé

### 5.4 Solde de caisse

| Propriété       | Valeur                                                     |
| --------------- | ---------------------------------------------------------- |
| **Description** | Consulter le solde actuel de la caisse (entrées - sorties) |
| **Plateformes** | Mobile, Web, API                                           |
| **Module**      | Coeur                                                      |
| **Endpoint**    | `GET /api/cash/balance`                                    |

### 5.5 Statistiques de caisse

| Propriété       | Valeur                                                      |
| --------------- | ----------------------------------------------------------- |
| **Description** | KPIs : total entrées, total sorties, solde net, par période |
| **Plateformes** | Mobile, Web, API                                            |
| **Module**      | Coeur                                                       |
| **Endpoint**    | `GET /api/cash/stats?start_date=...&end_date=...`           |

### 5.6 Historique des mouvements de caisse

| Propriété       | Valeur                                                             |
| --------------- | ------------------------------------------------------------------ |
| **Description** | Lister toutes les entrées/sorties avec filtres par type et période |
| **Plateformes** | Mobile, Web, API                                                   |
| **Module**      | Coeur                                                              |
| **Endpoint**    | `GET /api/cash/entries?type=IN&start_date=...&end_date=...`        |

### 5.7 Corrections (montants négatifs)

| Propriété       | Valeur                                                                           |
| --------------- | -------------------------------------------------------------------------------- |
| **Description** | Les propriétaires peuvent saisir des montants négatifs pour corriger des erreurs |
| **Plateformes** | Mobile                                                                           |
| **Module**      | Coeur                                                                            |
| **Rôles**       | BOSS uniquement                                                                  |

---

## 6. Clients & Créances

### 6.1 Gestion des clients (CRUD)

| Propriété         | Valeur                                                                            |
| ----------------- | --------------------------------------------------------------------------------- |
| **Description**   | Créer, modifier, supprimer, rechercher des clients                                |
| **Plateformes**   | Mobile, Web, API                                                                  |
| **Module**        | Coeur                                                                             |
| **Endpoints**     | `GET/POST/PUT/DELETE /api/customers`                                              |
| **Fichiers clés** | `apps/mobile/src/screens/CustomersScreen.tsx`, `apps/web/src/pages/Customers.tsx` |

Champs client : `name`, `first_name`, `phone`, `email`, `address`, `credit_limit`, `notes`, `is_active`, `email_notifications_enabled`

### 6.2 Fiche client détaillée

| Propriété         | Valeur                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------- |
| **Description**   | Page complète avec profil, solde, historique des transactions, actions                        |
| **Plateformes**   | Mobile, Web                                                                                   |
| **Module**        | Coeur                                                                                         |
| **Fichiers clés** | `apps/mobile/src/screens/CustomerDetailsScreen.tsx`, `apps/web/src/pages/CustomerDetails.tsx` |

Affiche :

- Informations personnelles
- Solde total (créances en cours)
- KPIs : total créances, total payé, nombre de ventes
- Historique des transactions (créances, paiements, remboursements, ventes)
- Actions : créer créance, recevoir paiement, rembourser

### 6.3 Créances client (Receivables)

| Propriété       | Valeur                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | Enregistrer et suivre les montants que les clients doivent à la boutique                                                           |
| **Plateformes** | Mobile, Web, API                                                                                                                   |
| **Module**      | Étendu (receivables)                                                                                                               |
| **Endpoints**   | `POST/GET /api/receivables`, `GET /api/receivables/stats`, `POST /api/receivables/:id/payments`, `PUT /api/receivables/:id/cancel` |
| **Modèle**      | `ClientReceivable` (amount, paid_amount, balance, status: PENDING/PARTIAL/PAID/CANCELLED)                                          |

- Montants négatifs acceptés (pour les corrections/remboursements)
- Statut automatique : PENDING → PARTIAL → PAID
- Chaque paiement crée un `ClientReceivablePayment` avec lien vers l'entrée de caisse

### 6.4 Paiements de créance

| Propriété       | Valeur                                                        |
| --------------- | ------------------------------------------------------------- |
| **Description** | Enregistrer un paiement partiel ou total d'une créance client |
| **Plateformes** | Mobile, Web, API                                              |
| **Module**      | Étendu (receivables)                                          |
| **Endpoint**    | `POST /api/receivables/:id/payments`                          |

- Le solde est recalculé automatiquement
- Le statut passe à PARTIAL ou PAID selon le montant

### 6.5 Remboursement client

| Propriété       | Valeur                                                                         |
| --------------- | ------------------------------------------------------------------------------ |
| **Description** | Rembourser un client qui a un solde négatif (la boutique lui doit de l'argent) |
| **Plateformes** | Mobile, Web, API                                                               |
| **Module**      | Étendu                                                                         |
| **Endpoint**    | `POST /api/customers/:id/refund`                                               |
| **Rôles**       | BOSS, MANAGER, EMPLOYEE                                                        |

- Crée une sortie de caisse automatique
- Met à jour le solde du client

### 6.6 Détection et fusion de doublons

| Propriété       | Valeur                                                           |
| --------------- | ---------------------------------------------------------------- |
| **Description** | Identifier les clients avec des noms similaires et les fusionner |
| **Plateformes** | Web, API                                                         |
| **Module**      | Étendu                                                           |
| **Endpoints**   | `GET /api/customers/duplicates`, `POST /api/customers/merge`     |
| **Rôles**       | BOSS, MANAGER                                                    |

### 6.7 Limite de crédit client (avec enforcement)

| Propriété         | Valeur                                                                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description**   | Plafond de crédit par client avec blocage actif. Si `credit_limit > 0`, les créances ne peuvent pas dépasser la limite. Si `credit_limit = 0`, pas de limite. Affichage avec jauge de progression (Mobile + Web). |
| **Plateformes**   | Mobile, Web, API                                                                                                                                                                                                  |
| **Module**        | Coeur                                                                                                                                                                                                             |
| **Champ**         | `Customer.credit_limit` (Int, défaut 0)                                                                                                                                                                           |
| **Fichiers clés** | `receivables.service.ts` (enforcement), `sales.service.ts` (credit sales), `CustomerDetailsScreen.tsx` (jauge), `CustomerDetails.tsx` (jauge web)                                                                 |
| **Statut**        | **Implémenté** (Plan 023 - Phase 1)                                                                                                                                                                               |

### 6.8 Récapitulatif des soldes clients

| Propriété       | Valeur                                                      |
| --------------- | ----------------------------------------------------------- |
| **Description** | Vue d'ensemble de tous les soldes clients (qui doit quoi)   |
| **Plateformes** | Mobile                                                      |
| **Module**      | Étendu                                                      |
| **Fichier**     | `apps/mobile/src/screens/CustomerBalancesSummaryScreen.tsx` |

---

## 7. Fournisseurs & Dettes

### 7.1 Gestion des fournisseurs (CRUD)

| Propriété         | Valeur                                                                            |
| ----------------- | --------------------------------------------------------------------------------- |
| **Description**   | Créer, modifier, supprimer, rechercher des fournisseurs                           |
| **Plateformes**   | Mobile, Web, API                                                                  |
| **Module**        | Étendu (suppliers)                                                                |
| **Endpoints**     | `GET/POST/PUT/DELETE /api/suppliers`                                              |
| **Fichiers clés** | `apps/mobile/src/screens/SuppliersScreen.tsx`, `apps/web/src/pages/Suppliers.tsx` |

Champs fournisseur : `name`, `first_name`, `phone`, `email`, `address`, `notes`, `is_active`, `borrowing_limit`

### 7.2 Limite d'emprunt fournisseur (avec enforcement)

| Propriété         | Valeur                                                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description**   | Plafond d'emprunt par fournisseur avec blocage actif. Si `borrowing_limit > 0`, les dettes ne peuvent pas dépasser la limite. Si `borrowing_limit = 0`, pas de limite. Affichage avec jauge de progression (Mobile + Web). |
| **Plateformes**   | Mobile, Web, API                                                                                                                                                                                                           |
| **Module**        | Étendu (suppliers/debts)                                                                                                                                                                                                   |
| **Champ**         | `Supplier.borrowing_limit` (Int, défaut 0)                                                                                                                                                                                 |
| **Fichiers clés** | `debts.service.ts` (enforcement), `SupplierDetailsScreen.tsx` (jauge), `SupplierDetails.tsx` (jauge web)                                                                                                                   |
| **Statut**        | **Implémenté** (Plan 023 - Phase 1)                                                                                                                                                                                        |

### 7.3 Fiche fournisseur détaillée

| Propriété         | Valeur                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------- |
| **Description**   | Page complète avec profil, solde, historique des transactions, actions                        |
| **Plateformes**   | Mobile, Web                                                                                   |
| **Module**        | Étendu                                                                                        |
| **Fichiers clés** | `apps/mobile/src/screens/SupplierDetailsScreen.tsx`, `apps/web/src/pages/SupplierDetails.tsx` |

### 7.3 Dettes fournisseur

| Propriété       | Valeur                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| **Description** | Enregistrer et suivre les montants que la boutique doit aux fournisseurs                                   |
| **Plateformes** | Mobile, Web, API                                                                                           |
| **Module**      | Étendu (debts)                                                                                             |
| **Endpoints**   | `POST/GET /api/debts`, `GET /api/debts/stats`, `POST /api/debts/:id/payments`, `PUT /api/debts/:id/cancel` |
| **Modèle**      | `SupplierDebt` (amount, paid_amount, balance, status: PENDING/PARTIAL/PAID/CANCELLED)                      |

### 7.4 Paiements de dette

| Propriété       | Valeur                                                           |
| --------------- | ---------------------------------------------------------------- |
| **Description** | Enregistrer un paiement partiel ou total d'une dette fournisseur |
| **Plateformes** | Mobile, Web, API                                                 |
| **Module**      | Étendu (debts)                                                   |
| **Endpoint**    | `POST /api/debts/:id/payments`                                   |

### 7.5 Réclamation de remboursement fournisseur

| Propriété       | Valeur                                                               |
| --------------- | -------------------------------------------------------------------- |
| **Description** | Réclamer un remboursement quand la boutique a surpayé un fournisseur |
| **Plateformes** | Mobile, Web, API                                                     |
| **Module**      | Étendu                                                               |
| **Endpoint**    | `POST /api/suppliers/:id/claim-refund`                               |
| **Rôles**       | BOSS, MANAGER                                                        |

### 7.6 Détection et fusion de doublons fournisseurs

| Propriété       | Valeur                                                                |
| --------------- | --------------------------------------------------------------------- |
| **Description** | Identifier les fournisseurs avec des noms similaires et les fusionner |
| **Plateformes** | Web, API                                                              |
| **Module**      | Étendu                                                                |
| **Endpoints**   | `GET /api/suppliers/duplicates`, `POST /api/suppliers/merge`          |

### 7.7 Récapitulatif des soldes fournisseurs

| Propriété       | Valeur                                                      |
| --------------- | ----------------------------------------------------------- |
| **Description** | Vue d'ensemble de toutes les dettes fournisseurs            |
| **Plateformes** | Mobile                                                      |
| **Module**      | Étendu                                                      |
| **Fichier**     | `apps/mobile/src/screens/SupplierBalancesSummaryScreen.tsx` |

---

## 8. Rapports & Analytiques

### 8.1 Dashboard KPI (accueil)

| Propriété         | Valeur                                                                       |
| ----------------- | ---------------------------------------------------------------------------- |
| **Description**   | Tableau de bord avec les indicateurs clés du jour                            |
| **Plateformes**   | Mobile, Web                                                                  |
| **Module**        | Coeur                                                                        |
| **Fichiers clés** | `apps/mobile/src/screens/HomeScreen.tsx`, `apps/web/src/pages/Dashboard.tsx` |

KPIs affichés : solde de caisse, entrées/sorties du jour, nombre de ventes, chiffre d'affaires

### 8.2 Rapports de gestion

| Propriété         | Valeur                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Description**   | Rapports détaillés par période : flux de caisse, clients, fournisseurs                                                                                                                                 |
| **Plateformes**   | Mobile, Web, API                                                                                                                                                                                       |
| **Module**        | Étendu (reports)                                                                                                                                                                                       |
| **Fichiers clés** | `apps/api/src/modules/reports/reports.controller.ts`, `apps/api/src/modules/reports/reports.service.ts`, `apps/mobile/src/screens/BusinessReportsScreen.tsx`, `apps/web/src/pages/BusinessReports.tsx` |

**Endpoints API** :

- `GET /reports/sales` - Rapport des ventes (total, CA, ticket moyen, ventilation par mode de paiement)
- `GET /reports/stock` - Rapport du stock (produits actifs, alertes, quantité et valeur totale)
- `GET /reports/cash` - Rapport de trésorerie (entrées, sorties, solde, créances/dettes en cours)
- `GET /reports/overview` - Vue d'ensemble consolidée (sales + stock + cash)

Tous les endpoints acceptent `?start_date=` et `?end_date=` pour le filtrage par période.
Accès : BOSS, MANAGER (SUPERADMIN bypass).

Sections disponibles :

- **Flux de caisse** : entrées, sorties, solde net par période
- **Répartition par catégorie** : ventilation des entrées/sorties
- **Clients** : top débiteurs, clients à rembourser, total créances
- **Fournisseurs** : top créanciers, fournisseurs à rembourser, total dettes
- **Statistiques période** : créances créées, paiements reçus

### 8.3 Sélection de période

| Propriété       | Valeur                                                                             |
| --------------- | ---------------------------------------------------------------------------------- |
| **Description** | Filtrer les rapports par période (aujourd'hui, semaine, mois, année, personnalisé) |
| **Plateformes** | Mobile, Web, API                                                                   |
| **Module**      | Étendu                                                                             |

### 8.4 Historique des transactions

| Propriété       | Valeur                                                   |
| --------------- | -------------------------------------------------------- |
| **Description** | Journal complet de toutes les transactions avec filtrage |
| **Plateformes** | Mobile                                                   |
| **Module**      | Étendu                                                   |
| **Fichier**     | `apps/mobile/src/screens/TransactionHistoryScreen.tsx`   |

---

## 9. Mode Offline & Synchronisation

### 9.1 Base de données locale (SQLite)

| Propriété         | Valeur                                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| **Description**   | Réplication locale des données critiques pour fonctionnement sans internet |
| **Plateformes**   | Mobile uniquement                                                          |
| **Module**        | Coeur                                                                      |
| **Fichiers clés** | `apps/mobile/src/db/schema.ts`, `apps/mobile/src/db/repositories.ts`       |
| **Technologie**   | Expo SQLite (expo-sqlite v16) avec mode WAL                                |

**Entités synchronisées localement (21) :**

- `products` - Catalogue produits
- `stock_batches` - Lots de stock (FIFO)
- `packaging_types` - Types d'emballage
- `customers` - Clients
- `suppliers` - Fournisseurs
- `sales` - Ventes
- `sale_items` - Articles de vente
- `cash_entries` - Entrées/sorties de caisse
- `cash_sessions` - Sessions de caisse
- `inventory_movements` - Mouvements de stock
- `inventory_sessions` - Sessions d'inventaire
- `inventory_counts` - Comptages d'inventaire
- `client_receivables` - Créances clients
- `client_receivable_payments` - Paiements de créances
- `supplier_debts` - Dettes fournisseurs
- `supplier_debt_payments` - Paiements de dettes
- `supplier_invoices` - Factures fournisseurs
- `supplier_invoice_items` - Articles de factures fournisseurs
- `payments` - Paiements génériques
- `invoices` - Factures
- `invoice_items` - Articles de factures

Chaque enregistrement local possède des métadonnées de sync :

- `_sync_status` : synced | pending | conflict
- `_server_id` : identifiant côté serveur
- `_last_synced_at` : dernier horodatage de sync

### 9.2 Opérations offline

| Propriété       | Valeur                                              |
| --------------- | --------------------------------------------------- |
| **Description** | CRUD complet offline pour toutes les entités métier |
| **Plateformes** | Mobile                                              |
| **Module**      | Coeur                                               |
| **Fichier**     | `apps/mobile/src/db/offlineWrite.ts`                |

**22+ opérations offline implémentées :**

1. **Vente offline** (`createSaleOffline`) : crée la vente + articles + déstocke en FIFO localement
2. **Entrée de caisse offline** (`createCashEntryOffline`) : enregistre l'entrée/sortie localement
3. **Lot de stock offline** (`createStockBatchOffline`) : crée le lot + mouvement d'inventaire
4. **Produit CRUD offline** (`createProductOffline`, `updateProductOffline`, `deleteProductOffline`)
5. **Client CRUD offline** (`createCustomerOffline`, `updateCustomerOffline`, `deleteCustomerOffline`)
6. **Fournisseur CRUD offline** (`createSupplierOffline`, `updateSupplierOffline`, `deleteSupplierOffline`)
7. **Créance offline** (`createReceivableOffline`, `payReceivableOffline`)
8. **Dette fournisseur offline** (`createSupplierDebtOffline`, `paySupplierDebtOffline`)
9. **Paiement offline** (`createPaymentOffline`)
10. **Session de caisse offline** (`openCashSessionOffline`, `closeCashSessionOffline`)
11. **Facture offline** (`createInvoiceOffline`)
12. **Inventaire offline** (`startInventorySessionOffline`, `addInventoryCountOffline`, `completeInventorySessionOffline`)

Chaque opération :

- Génère un `client_op_id` unique pour l'idempotence
- Est mise en file d'attente (`_mutation_queue`) avec priorité automatique
- Déclenche une tentative de sync si le réseau est disponible

### 9.3 Moteur de synchronisation

| Propriété         | Valeur                                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| **Description**   | Synchronisation bidirectionnelle automatique entre le mobile et le serveur |
| **Plateformes**   | Mobile ↔ API                                                              |
| **Module**        | Coeur                                                                      |
| **Fichiers clés** | `apps/mobile/src/db/sync.ts`, `apps/api/src/modules/sync/sync.service.ts`  |

**Mécanisme Push (local → serveur) :**

- Défile jusqu'à 100 mutations en attente
- Les regroupe par type d'entité
- Envoie au serveur avec device_id et historique
- Gère les conflits de version et l'idempotence
- `POST /api/sync/push`

**Mécanisme Pull (serveur → local) :**

- Interroge le serveur pour les changements depuis `last_sync_at`
- Upsert en masse dans le SQLite local
- Met à jour le curseur pour la sync incrémentale
- Jusqu'à 500 enregistrements par entité
- `POST /api/sync/pull`

### 9.4 Sync automatique

| Propriété       | Valeur                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| **Description** | La synchronisation se déclenche automatiquement toutes les 60 secondes et à chaque retour de connexion |
| **Plateformes** | Mobile                                                                                                 |
| **Module**      | Coeur                                                                                                  |

- Intervalle adaptatif : 60s (normal), 5min (batterie < 30%)
- Détection de connectivité via `expo-network`
- Sync immédiate au retour de connexion
- File d'attente prioritaire : sales/cash (1) > créances/dettes (2) > référence (3)
- Événements : `sync_start`, `sync_complete`, `sync_error`, `connectivity_change`, `pending_count_change`

### 9.5 Gestion des conflits

| Propriété         | Valeur                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------- |
| **Description**   | Détecter et résoudre les conflits quand le même enregistrement est modifié offline et online |
| **Plateformes**   | Mobile                                                                                       |
| **Module**        | Coeur                                                                                        |
| **Fichiers clés** | `apps/mobile/src/screens/SyncConflictsScreen.tsx`                                            |

- Détection basée sur le champ `version` (concurrence optimiste)
- Conflits stockés dans `_sync_conflicts`
- **Auto-résolution** pour données de référence (produits, clients, fournisseurs) : Last-Write-Wins (serveur)
- **Résolution manuelle** pour données financières (ventes, caisse, créances, dettes)
- Champ `auto_resolved` pour traçabilité des résolutions automatiques
- Interface dédiée pour visualiser et résoudre les conflits manuels

### 9.6 Indicateur offline

| Propriété         | Valeur                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| **Description**   | Afficher l'état de connexion et le nombre d'opérations en attente                              |
| **Plateformes**   | Mobile                                                                                         |
| **Module**        | Coeur                                                                                          |
| **Fichiers clés** | `apps/mobile/src/screens/SyncStatusScreen.tsx`, `apps/mobile/src/components/OfflineBanner.tsx` |

- Bannière visible quand offline
- Compteur de mutations en attente
- Horodatage de la dernière synchronisation réussie
- Statut de sync en temps réel

### 9.7 Idempotence des opérations

| Propriété       | Valeur                                                                          |
| --------------- | ------------------------------------------------------------------------------- |
| **Description** | Garantir qu'une opération n'est exécutée qu'une seule fois même en cas de retry |
| **Plateformes** | Mobile, API                                                                     |
| **Module**      | Coeur                                                                           |

- Contrainte unique `[device_id, client_op_id]` sur les tables critiques
- Format : `{prefix}_{device_id}_{timestamp}_{random}`
- Le serveur détecte les doublons et retourne "applied" sans re-traitement

### 9.8 Authentification PIN offline

| Propriété         | Valeur                                                                          |
| ----------------- | ------------------------------------------------------------------------------- |
| **Description**   | Login par PIN sans connexion internet via cache local                           |
| **Plateformes**   | Mobile                                                                          |
| **Module**        | Coeur                                                                           |
| **Fichiers clés** | `apps/mobile/src/db/authCache.ts`, `apps/mobile/src/screens/LoginPinScreen.tsx` |

- Cache du hash bcrypt du PIN dans la table `auth_cache` (SQLite)
- TTL de 7 jours (aligné sur le refresh token)
- Stockage du rôle et modules activés pour RBAC offline
- Requiert au moins un login online initial pour peupler le cache
- Indicateur visuel "Mode hors-ligne" en cas de login offline

### 9.9 Rapports & KPIs offline

| Propriété         | Valeur                                                                        |
| ----------------- | ----------------------------------------------------------------------------- |
| **Description**   | Rapports et indicateurs calculés localement via requêtes SQLite agrégées      |
| **Plateformes**   | Mobile                                                                        |
| **Module**        | Coeur                                                                         |
| **Fichiers clés** | `apps/mobile/src/db/reports.ts`, `apps/mobile/src/hooks/useOfflineReports.ts` |

- Ventes journalières (total, nombre, cash vs crédit, moyenne)
- Flux de trésorerie (entrées/sorties, net, par catégorie)
- Rapport stock (valeur totale, ruptures, alertes)
- Créances et dettes (solde, actives, payées)
- Top produits et clients par chiffre d'affaires
- Indicateur de fraîcheur des données (vert < 10min, orange < 1h, rouge > 1h)
- Auto-rafraîchissement après synchronisation (debounce 5s)

### 9.10 Rétention et maintenance des données

| Propriété         | Valeur                                                |
| ----------------- | ----------------------------------------------------- |
| **Description**   | Purge automatique des données anciennes synchronisées |
| **Plateformes**   | Mobile                                                |
| **Module**        | Coeur                                                 |
| **Fichiers clés** | `apps/mobile/src/db/maintenance.ts`                   |

- Purge des enregistrements transactionnels synchronisés de plus de 90 jours
- Tables purgées : sales, sale_items, cash_entries, inventory_movements, payments, invoices
- Tables jamais purgées : products, customers, suppliers, stock_batches (données de référence)
- Protection des enregistrements avec mutations en attente
- Exécution quotidienne automatique après la première synchronisation réussie

---

## 10. Entreprise & Multi-boutique

### 10.1 Gestion des entreprises

| Propriété       | Valeur                                                          |
| --------------- | --------------------------------------------------------------- |
| **Description** | Créer et gérer des organisations regroupant plusieurs boutiques |
| **Plateformes** | Web, API                                                        |
| **Module**      | Premium (enterprise)                                            |
| **Endpoints**   | `GET/POST/PUT/DELETE /api/enterprises`                          |
| **Modèle**      | `Enterprise` (code, name, owner_id)                             |
| **Fichier web** | `apps/web/src/pages/EnterpriseDashboard.tsx`                    |

### 10.2 Association boutique ↔ entreprise

| Propriété       | Valeur                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Description** | Ajouter ou retirer une boutique d'une entreprise                                                                 |
| **Plateformes** | Web, API                                                                                                         |
| **Module**      | Premium (enterprise)                                                                                             |
| **Endpoints**   | `POST /api/enterprises/:id/shops`, `DELETE /api/enterprises/:id/shops/:shopId`, `GET /api/enterprises/:id/shops` |

### 10.3 Statistiques consolidées entreprise

| Propriété       | Valeur                                                 |
| --------------- | ------------------------------------------------------ |
| **Description** | KPIs agrégés sur toutes les boutiques d'une entreprise |
| **Plateformes** | Web, API                                               |
| **Module**      | Premium (enterprise)                                   |
| **Endpoint**    | `GET /api/enterprises/:id/stats`                       |

### 10.4 Transferts inter-boutiques

| Propriété          | Valeur                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| **Description**    | Transférer du stock entre boutiques d'une même entreprise                                                |
| **Plateformes**    | Mobile, Web, API                                                                                         |
| **Module**         | Premium (transfers)                                                                                      |
| **Endpoints**      | `POST/GET /api/transfers`, `PUT /api/transfers/:id/{confirm,ship,receive,cancel}`                        |
| **Modèle**         | `InterShopTransfer` (source_shop_id, target_shop_id, status: DRAFT/CONFIRMED/SHIPPED/RECEIVED/CANCELLED) |
| **Fichier mobile** | `apps/mobile/src/screens/TransfersScreen.tsx`                                                            |

**Workflow de transfert :**

1. **DRAFT** : création avec liste de produits et quantités
2. **CONFIRMED** : validation + déduction du stock source (FIFO)
3. **SHIPPED** : marquage comme expédié
4. **RECEIVED** : réception + ajout du stock dans la boutique cible
5. **CANCELLED** : annulation possible à tout moment

---

## 11. Notifications & Communication

### 11.1 Résumés mensuels par email

| Propriété         | Valeur                                                                      |
| ----------------- | --------------------------------------------------------------------------- |
| **Description**   | Envoi automatique d'un récapitulatif mensuel aux propriétaires de boutiques |
| **Plateformes**   | API (CRON)                                                                  |
| **Module**        | Premium (notifications)                                                     |
| **Endpoint**      | `POST /api/notifications/monthly-summary/trigger` (déclenchement manuel)    |
| **Fichiers clés** | `apps/api/src/modules/notifications/notifications.scheduler.ts`             |

- CRON : 1er du mois à 08:00 UTC
- Contenu : KPIs du mois, ventes, créances, dettes
- Opt-in par client via `email_notifications_enabled`

### 11.2 Configuration email par client

| Propriété       | Valeur                                                        |
| --------------- | ------------------------------------------------------------- |
| **Description** | Activer/désactiver les notifications email pour chaque client |
| **Plateformes** | Mobile, Web, API                                              |
| **Module**      | Premium (notifications)                                       |
| **Champ**       | `Customer.email_notifications_enabled` (Boolean)              |

---

## 12. Administration système

### 12.1 Dashboard SuperAdmin

| Propriété         | Valeur                                                                            |
| ----------------- | --------------------------------------------------------------------------------- |
| **Description**   | Vue d'ensemble de toutes les boutiques du système (SUPERADMIN uniquement)         |
| **Plateformes**   | Web                                                                               |
| **Module**        | Étendu (admin)                                                                    |
| **Fichiers clés** | `apps/web/src/pages/SuperAdminDashboard.tsx`, `apps/web/src/pages/AdminPanel.tsx` |

- Liste de toutes les boutiques avec nombre d'utilisateurs
- Statistiques système globales
- Actions : voir détails, supprimer boutique

### 12.2 Statistiques système

| Propriété       | Valeur                        |
| --------------- | ----------------------------- |
| **Description** | KPIs globaux de la plateforme |
| **Plateformes** | Web, API                      |
| **Module**      | Étendu (admin)                |
| **Endpoint**    | `GET /api/admin/stats/system` |
| **Rôles**       | SUPERADMIN                    |

### 12.3 Gestion des utilisateurs par boutique

| Propriété         | Valeur                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Description**   | Lister, modifier les rôles, désactiver les utilisateurs d'une boutique                      |
| **Plateformes**   | Mobile, Web, API                                                                            |
| **Module**        | Étendu (admin)                                                                              |
| **Endpoints**     | `GET /api/admin/users`, `PUT /api/admin/users/:id/role`, `DELETE /api/admin/users/:id`      |
| **Fichiers clés** | `apps/web/src/pages/UserManagement.tsx`, `apps/mobile/src/screens/UserManagementScreen.tsx` |

- Modification du rôle avec horaires de travail
- Désactivation d'accès (impossible de se désactiver soi-même)

### 12.4 Gestion des devices

| Propriété       | Valeur                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| **Description** | Voir et révoquer les appareils connectés par utilisateur                                                        |
| **Plateformes** | Web, API                                                                                                        |
| **Module**      | Étendu (admin)                                                                                                  |
| **Endpoints**   | `GET /api/admin/users/:id/devices`, `DELETE /api/admin/devices/:id`, `POST /api/admin/users/:id/revoke-devices` |

### 12.5 Paramètres de boutique

| Propriété         | Valeur                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------- |
| **Description**   | Modifier les informations de la boutique (nom, adresse, téléphone, email, devise)       |
| **Plateformes**   | Web, Mobile                                                                             |
| **Module**        | Coeur                                                                                   |
| **Fichiers clés** | `apps/web/src/pages/ShopSettings.tsx`, `apps/mobile/src/screens/ShopSettingsScreen.tsx` |

### 12.6 Suppression de boutique

| Propriété       | Valeur                                          |
| --------------- | ----------------------------------------------- |
| **Description** | Supprimer une boutique du système (soft delete) |
| **Plateformes** | Web, API                                        |
| **Module**      | Étendu (admin)                                  |
| **Endpoint**    | `DELETE /api/admin/shops/:shopId`               |
| **Rôles**       | SUPERADMIN                                      |

### 12.7 Blocage/Déblocage utilisateurs, boutiques, entreprises

| Propriété         | Valeur                                                                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description**   | Bloquer/débloquer des utilisateurs, boutiques ou entreprises avec raison obligatoire. Le blocage d'une entreprise cascade vers ses boutiques. L'auth vérifie le statut de blocage. Un guard global (`BlockStatusGuard`) bloque les requêtes des utilisateurs/boutiques/entreprises bloqués. |
| **Plateformes**   | Web, API                                                                                                                                                                                                                                                                                    |
| **Module**        | Étendu (admin-controls)                                                                                                                                                                                                                                                                     |
| **Endpoints**     | `POST /api/admin-controls/shops/:id/block`, `POST /api/admin-controls/shops/:id/unblock`, etc. pour users et enterprises                                                                                                                                                                    |
| **Fichiers clés** | `admin-controls.controller.ts`, `admin-controls.service.ts`, `block-status.guard.ts`, `SuperAdminDashboard.tsx`                                                                                                                                                                             |
| **Rôles**         | SUPERADMIN                                                                                                                                                                                                                                                                                  |
| **Statut**        | **Implémenté** (Plan 023 - Phase 4)                                                                                                                                                                                                                                                         |

### 12.8 Logs d'audit

| Propriété         | Valeur                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description**   | Historique paginé de toutes les actions administratives (blocage, déblocage, modification modules). Filtrable par action et type d'entité. Détails avant/après en JSON extensible. |
| **Plateformes**   | Web, API                                                                                                                                                                           |
| **Module**        | Étendu (admin-controls)                                                                                                                                                            |
| **Endpoints**     | `GET /api/admin-controls/audit-logs`                                                                                                                                               |
| **Fichiers clés** | `admin-controls.service.ts`, `AuditLogs.tsx`                                                                                                                                       |
| **Modèle**        | `AuditLog` (action, entity_type, entity_id, old_value, new_value, reason, admin_id)                                                                                                |
| **Rôles**         | SUPERADMIN                                                                                                                                                                         |
| **Statut**        | **Implémenté** (Plan 023 - Phase 4)                                                                                                                                                |

### 12.9 Gestion des modules par boutique

| Propriété         | Valeur                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Description**   | Activer/désactiver des modules pour une boutique. Les modules désactivés retournent une erreur 403 via l'`EntitlementGuard`. |
| **Plateformes**   | Web, API                                                                                                                     |
| **Module**        | Étendu (admin-controls)                                                                                                      |
| **Endpoints**     | `GET /api/admin-controls/shops/:id/modules`, `POST /api/admin-controls/shops/:id/modules`                                    |
| **Fichiers clés** | `admin-controls.service.ts`, `entitlement.guard.ts`, `require-module.decorator.ts`                                           |
| **Rôles**         | SUPERADMIN                                                                                                                   |
| **Statut**        | **Implémenté** (Plan 023 - Phase 5)                                                                                          |

### 12.10 CRUD Entreprises (plateforme admin)

| Propriété         | Valeur                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Description**   | Créer, lister, modifier, supprimer des entreprises. Gestion de licence, rattachement boutiques, historique d'audit. |
| **Plateformes**   | Web, API                                                                                                            |
| **Module**        | Étendu (admin)                                                                                                      |
| **Endpoints**     | `POST/GET /api/admin/enterprises`, `GET/PUT/DELETE /api/admin/enterprises/:id`                                      |
| **Fichiers clés** | `admin.service.ts`, `admin.controller.ts`, `apps/web-admin/src/pages/AdminEnterprises.tsx`                          |
| **Rôles**         | SUPERADMIN                                                                                                          |
| **Statut**        | **Implémenté** (Plan 024, déplacé Plan 025)                                                                         |

### 12.11 Création de boutique (admin-side)

| Propriété         | Valeur                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| **Description**   | Créer une boutique depuis la plateforme admin avec code auto-généré, création propriétaire avec PIN, modules |
| **Plateformes**   | Web Admin, API                                                                                               |
| **Module**        | Étendu (admin)                                                                                               |
| **Endpoint**      | `POST /api/admin/shops`                                                                                      |
| **Fichiers clés** | `admin.service.ts`, `apps/web-admin/src/pages/AdminShops.tsx`                                                |
| **Rôles**         | SUPERADMIN                                                                                                   |
| **Statut**        | **Implémenté** (Plan 024)                                                                                    |

### 12.12 Gestion des licences

| Propriété         | Valeur                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| **Description**   | Modifier licence (STARTER/PROFESSIONAL/ENTERPRISE), date d'expiration, limites boutiques/utilisateurs |
| **Plateformes**   | Web, API                                                                                              |
| **Endpoint**      | `PUT /api/admin/enterprises/:id/license`                                                              |
| **Fichiers clés** | `admin.service.ts`, `AdminEnterprises.tsx`                                                            |
| **Rôles**         | SUPERADMIN                                                                                            |
| **Statut**        | **Implémenté** (Plan 024)                                                                             |

### 12.13 Rattachement boutique-entreprise

| Propriété       | Valeur                                                                          |
| --------------- | ------------------------------------------------------------------------------- |
| **Description** | Rattacher/détacher boutique d'une entreprise avec vérification limite max_shops |
| **Plateformes** | Web, API                                                                        |
| **Endpoints**   | `POST/DELETE /api/admin/enterprises/:id/shops/:shopId`                          |
| **Rôles**       | SUPERADMIN                                                                      |
| **Statut**      | **Implémenté** (Plan 024)                                                       |

### 12.14 Utilisateurs globaux

| Propriété         | Valeur                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------- |
| **Description**   | Vue paginée de tous les utilisateurs avec recherche, filtre par rôle, assignations shops |
| **Plateformes**   | Web, API                                                                                 |
| **Endpoint**      | `GET /api/admin/users/global?search=&role=&page=&limit=`                                 |
| **Fichiers clés** | `admin.service.ts`, `apps/web-admin/src/pages/AdminGlobalUsers.tsx`                      |
| **Rôles**         | SUPERADMIN                                                                               |
| **Statut**        | **Implémenté** (Plan 024)                                                                |

### 12.15 Configuration système (clé-valeur)

| Propriété         | Valeur                                                                               |
| ----------------- | ------------------------------------------------------------------------------------ |
| **Description**   | Gestion CRUD de paramètres système globaux clé-valeur, toutes modifications auditées |
| **Plateformes**   | Web, API                                                                             |
| **Endpoints**     | `GET/PUT/DELETE /api/admin/system-config/:key`                                       |
| **Fichiers clés** | `admin.service.ts`, `apps/web-admin/src/pages/AdminConfig.tsx`                       |
| **Rôles**         | SUPERADMIN                                                                           |
| **Statut**        | **Implémenté** (Plan 024)                                                            |

### 12.16 Export logs d'audit (CSV)

| Propriété       | Valeur                                                                              |
| --------------- | ----------------------------------------------------------------------------------- |
| **Description** | Exporter logs d'audit en CSV avec filtres par action, type d'entité, plage de dates |
| **Plateformes** | Web, API                                                                            |
| **Endpoint**    | `GET /api/admin/audit-logs/export`                                                  |
| **Rôles**       | SUPERADMIN                                                                          |
| **Statut**      | **Implémenté** (Plan 024)                                                           |

### 12.17 Application Web Admin indépendante

| Propriété          | Valeur                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Description**    | Application web séparée (`apps/web-admin`) pour l'administration plateforme SWALO, indépendante de l'app boutique  |
| **Plateformes**    | Web Admin (port 3002)                                                                                              |
| **Module**         | Premium (admin)                                                                                                    |
| **Pages**          | Login, Dashboard KPIs, Entreprises, Boutiques, Utilisateurs, Logs d'audit, Configuration, Statistiques système     |
| **Fichiers clés**  | `apps/web-admin/src/App.tsx`, `AdminLayout.tsx`, `authStore.ts`, `api.ts`                                          |
| **Rôles**          | SUPERADMIN exclusivement (rejet au login si non-SUPERADMIN)                                                        |
| **Particularités** | Sidebar sombre, tokens séparés (`admin_access_token`), branding "SWALO Admin", login email/mot de passe uniquement |
| **Statut**         | **Implémenté** (Plan 025)                                                                                          |

---

## 13. Import & Export de données

### 13.1 Import catalogue produits (CSV/Excel)

| Propriété       | Valeur                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| **Description** | Importer un catalogue produit complet depuis un fichier CSV ou Excel   |
| **Plateformes** | Web, API                                                               |
| **Module**      | Premium (import)                                                       |
| **Endpoints**   | `POST /api/import/catalog/preview`, `POST /api/import/catalog/confirm` |
| **Rôles**       | BOSS, MANAGER                                                          |

**Processus en 2 étapes :**

1. **Preview** : upload du fichier, mapping des colonnes, validation, détection des doublons
2. **Confirm** : exécution de l'import après validation

- Mapping automatique des colonnes
- Détection de doublons SKU
- Validation des données (types, formats, valeurs)
- Rapport d'erreurs détaillé

---

## 14. Design & Interface utilisateur

### 14.1 Thème mobile

| Propriété       | Valeur                                                 |
| --------------- | ------------------------------------------------------ |
| **Description** | Système de design centralisé pour l'application mobile |
| **Plateformes** | Mobile                                                 |
| **Fichier**     | `apps/mobile/src/constants/theme-v2.ts`                |

- Couleurs primaires : Bleu Petrole / Navy (#0F2A44)
- Couleurs sémantiques : succès (#1EB980), danger (rouge), avertissement (ambre), info (bleu)
- Couleurs par contexte : clients (ambre), fournisseurs (rouge), caisse (violet)
- Couleurs par rôle utilisateur
- Tokens d'espacement, typographie, ombres, rayons de bordure

### 14.2 Composants UI mobile réutilisables

| Propriété       | Valeur                              |
| --------------- | ----------------------------------- |
| **Description** | Bibliothèque de composants partagés |
| **Plateformes** | Mobile                              |
| **Répertoire**  | `apps/mobile/src/components/ui/`    |

Composants : `ScreenHeader`, `KPICard`, `ListItem`, `SearchableSelect`, `BalanceIndicator`, `StatusBadge`, `TransactionDetailModal`, `DateRangePicker`, `ProductCard`, `IconButton`, `OfflineBanner`, `ErrorBoundary`

### 14.3 Thème web (Tailwind) - Harmonisé avec mobile

| Propriété       | Valeur                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------- |
| **Description** | Configuration Tailwind CSS harmonisée avec le thème mobile (palette Navy #0F2A44, succès #1EB980) |
| **Plateformes** | Web                                                                                               |
| **Fichiers**    | `apps/web/tailwind.config.js`, `apps/web/src/index.css`, `apps/web/src/components/ui/Logo.tsx`    |
| **Statut**      | **Implémenté** (Plan 029) - Toutes les pages utilisent la palette Navy harmonisée avec le mobile  |

- Palette primaire Navy : 50 (#EEF5FB) .. 900 (#0F2A44) - identique au mobile
- Succès : #1EB980 (identique mobile)
- Logo SWALO (SVG/PNG) partagé entre web et mobile
- Classes CSS : `.btn-*`, `.card`, `.badge-*`, `.input`, `.text-gradient`, `.glass`, `.spinner`

### 14.3b Composant Logo web

| Propriété       | Valeur                                                                   |
| --------------- | ------------------------------------------------------------------------ |
| **Description** | Composant Logo réutilisable avec variantes icon/full et tailles sm/md/lg |
| **Plateformes** | Web                                                                      |
| **Fichier**     | `apps/web/src/components/ui/Logo.tsx`                                    |
| **Statut**      | **Implémenté** (Plan 029)                                                |

- Utilisé dans la sidebar (MainLayout), la page de connexion (LoginPin), la page de création de boutique

### 14.4 Navigation mobile (5 onglets)

| Propriété       | Valeur                                              |
| --------------- | --------------------------------------------------- |
| **Description** | Navigation principale par onglets en bas de l'écran |
| **Plateformes** | Mobile                                              |
| **Fichier**     | `apps/mobile/src/navigation/MainTabNavigator.tsx`   |

| Onglet  | Écran                   | Icône        |
| ------- | ----------------------- | ------------ |
| Accueil | `HomeScreen`            | Maison       |
| Caisse  | `CashScreen`            | Portefeuille |
| Vente   | `SaleScreen`            | Panier       |
| Stock   | `StockManagementScreen` | Boîte        |
| Plus    | `MoreScreen`            | Menu         |

### 14.5 Layout web (sidebar + top bar) - Module-aware

| Propriété       | Valeur                                                                                  |
| --------------- | --------------------------------------------------------------------------------------- |
| **Description** | Interface web avec sidebar filtrant les modules selon la licence (grisés si non inclus) |
| **Plateformes** | Web                                                                                     |
| **Fichiers**    | `apps/web/src/components/Layout/MainLayout.tsx`, `apps/web/src/hooks/useModules.ts`     |
| **Statut**      | **Implémenté** (Plan 029)                                                               |

Chaque item de navigation est associé a un module. Si le module n'est pas inclus dans la licence :

- L'item est affiché en gris (opacity-40) avec un cadenas
- Un tooltip indique "Licence X - Module non inclus"
- Le clic est desactivé

Éléments de navigation sidebar :

- Accueil, Vente (sales), Caisse (cash), Historique (sales), Produits (products), Catalogue (products), Stock (inventory), Clients (customers), Creances (receivables), Fournisseurs (suppliers), Dettes (debts), Rapports (reports), Entreprises (enterprise)
- Section admin (conditionnel BOSS/MANAGER) : Gestion Utilisateurs

---

## 15. Architecture technique transversale

### 15.1 Multi-tenancy (isolation par boutique)

| Propriété       | Valeur                                                              |
| --------------- | ------------------------------------------------------------------- |
| **Description** | Toutes les données sont isolées par boutique via le champ `shop_id` |
| **Plateformes** | API                                                                 |
| **Module**      | Coeur                                                               |

- Le `shop_id` est extrait du JWT à chaque requête
- Tous les endpoints filtrent automatiquement par boutique
- Impossible d'accéder aux données d'une autre boutique (sauf SUPERADMIN)

### 15.2 Soft delete (suppression logique)

| Propriété       | Valeur                                                                                  |
| --------------- | --------------------------------------------------------------------------------------- |
| **Description** | Les enregistrements ne sont jamais physiquement supprimés, mais marqués comme supprimés |
| **Plateformes** | API, Mobile (local)                                                                     |
| **Module**      | Coeur                                                                                   |
| **Champs**      | `deleted: Boolean`, `deleted_at: DateTime?` sur toutes les entités                      |

### 15.3 Versioning (concurrence optimiste)

| Propriété       | Valeur                                                                     |
| --------------- | -------------------------------------------------------------------------- |
| **Description** | Champ `version` sur toutes les entités mutables pour détecter les conflits |
| **Plateformes** | API, Mobile                                                                |
| **Module**      | Coeur                                                                      |
| **Champ**       | `version: Int @default(1)`                                                 |

### 15.4 Gestion d'erreurs globale

| Propriété       | Valeur                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| **Description** | Filtre d'exceptions global qui standardise toutes les réponses d'erreur |
| **Plateformes** | API                                                                     |
| **Module**      | Coeur                                                                   |
| **Fichier**     | `apps/api/src/common/filters/http-exception.filter.ts`                  |

Erreurs Prisma mappées :

- P2002 (contrainte unique) → 409 Conflict
- P2003 (clé étrangère) → 400 Bad Request
- P2025 (non trouvé) → 404 Not Found

### 15.5 Client API avec retry

| Propriété       | Valeur                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| **Description** | Client HTTP Axios avec retry automatique et gestion des erreurs réseau |
| **Plateformes** | Mobile, Web                                                            |
| **Module**      | Coeur                                                                  |
| **Fichiers**    | `apps/mobile/src/lib/api.ts`, `apps/web/src/lib/api.ts`                |

- 3 tentatives avec délai de 2 secondes
- Timeout de 30 secondes (pour le cold start du serveur gratuit)
- Déconnexion automatique sur réponse 401
- Token JWT ajouté automatiquement aux requêtes

### 15.6 Health check

| Propriété       | Valeur                                     |
| --------------- | ------------------------------------------ |
| **Description** | Endpoint de vérification de santé de l'API |
| **Plateformes** | API                                        |
| **Module**      | Coeur                                      |
| **Endpoint**    | `GET /api/health`                          |

---

## 16. Fonctionnalités planifiées (non implémentées)

> Ces fonctionnalités sont prévues dans le plan 023 ou identifiées comme besoins futurs.

| Fonctionnalité                  | Description                                        | Priorité | Plan  |
| ------------------------------- | -------------------------------------------------- | -------- | ----- |
| **Alertes stock bas par email** | Notification quand un produit passe sous le seuil  | Basse    | Futur |
| **Rappels de paiement**         | Relance automatique des créances impayées          | Basse    | Futur |
| **Scan code-barres**            | Scanner pour ajouter des produits au panier        | Moyenne  | Futur |
| **Imprimante ticket**           | Impression de tickets de caisse                    | Moyenne  | Futur |
| **Notifications WhatsApp**      | Envoi de notifications via WhatsApp                | Basse    | Futur |
| **Multi-devises**               | Support de plusieurs monnaies                      | Basse    | Futur |
| **Mode tablette**               | Interface optimisée pour tablettes                 | Moyenne  | Futur |
| **Mode offline web**            | IndexedDB pour le fonctionnement web sans internet | Basse    | Futur |
| **Projections financières**     | Prévisions basées sur l'historique                 | Basse    | Futur |

---

## 17. Matrice de compatibilité par plateforme

| Fonctionnalité             | Mobile | Web | API | Offline |
| -------------------------- | :----: | :-: | :-: | :-----: |
| Login email/mot de passe   |   -    |  X  |  X  |    -    |
| Login PIN                  |   X    |  X  |  X  |    X    |
| Gestion produits (CRUD)    |   X    |  X  |  X  |    X    |
| Stock batches & FIFO       |   X    |  X  |  X  |    X    |
| Multi-prix                 |   X    |  X  |  X  |    X    |
| Ventes (POS)               |   X    |  X  |  X  |    X    |
| Facturation PDF            |   X    |  -  |  X  |    X    |
| Gestion de caisse          |   X    |  X  |  X  |    X    |
| Clients (CRUD)             |   X    |  X  |  X  |    X    |
| Créances & paiements       |   X    |  X  |  X  |    X    |
| Fournisseurs (CRUD)        |   X    |  X  |  X  |    X    |
| Dettes & paiements         |   X    |  X  |  X  |    X    |
| Rapports & KPIs            |   X    |  X  |  X  |    X    |
| Synchronisation            |   X    |  -  |  X  |    X    |
| Résolution conflits        |   X    |  -  |  X  |    -    |
| Entreprise multi-shop      |   -    |  X  |  X  |    -    |
| Transferts inter-boutiques |   X    |  X  |  X  |    -    |
| Email notifications        |   -    |  -  |  X  |    -    |
| Import CSV/Excel           |   -    |  X  |  X  |    -    |
| Admin système (SUPERADMIN) |   -    |  X  |  X  |    -    |
| Gestion utilisateurs       |   X    |  X  |  X  |    -    |
| Gestion devices            |   -    |  X  |  X  |    -    |
| PIN invites                |   X    |  X  |  X  |    -    |
| Paramètres boutique        |   X    |  X  |  X  |    -    |

**Légende :** X = Supporté | - = Non supporté

---

## 18. Classification modulaire

### Modules COEUR (toujours actifs)

> Ces modules constituent le socle minimal de l'application. Ils ne peuvent pas être désactivés.

| Module      | Description                                        | Entités principales           |
| ----------- | -------------------------------------------------- | ----------------------------- |
| `auth`      | Authentification PIN + email, JWT, device tracking | User, UserRole, UserDevice    |
| `products`  | Catalogue, hiérarchie, recherche                   | Product                       |
| `sales`     | Transactions de vente, panier                      | Sale, SaleItem                |
| `cash`      | Entrées/sorties, solde                             | CashEntry                     |
| `inventory` | Stock, lots FIFO, mouvements                       | StockBatch, InventoryMovement |
| `customers` | Gestion clients basique                            | Customer                      |

### Modules ÉTENDUS (la plupart des boutiques)

> Activés par défaut pour les boutiques standard. Peuvent être désactivés pour les très petits commerces.

| Module        | Description                    | Entités principales                       |
| ------------- | ------------------------------ | ----------------------------------------- |
| `suppliers`   | Gestion fournisseurs           | Supplier                                  |
| `receivables` | Créances clients, paiements    | ClientReceivable, ClientReceivablePayment |
| `debts`       | Dettes fournisseurs, paiements | SupplierDebt, SupplierDebtPayment         |
| `payments`    | Traitement des paiements       | Payment                                   |
| `admin`       | Gestion utilisateurs, devices  | (utilise User, UserRole, UserDevice)      |
| `reports`     | KPIs, analytiques              | (agrégations sur toutes les entités)      |
| `pin-invites` | Invitations PIN employés       | PinInvite                                 |

### Modules PREMIUM (entreprises / avancé)

> Activables selon le plan de licence. Destinés aux PME et entreprises de taille moyenne.

| Module            | Description                   | Entités principales                      |
| ----------------- | ----------------------------- | ---------------------------------------- |
| `enterprise`      | Multi-boutique, organisations | Enterprise                               |
| `transfers`       | Transferts inter-boutiques    | InterShopTransfer, InterShopTransferItem |
| `invoices`        | Facturation formelle, PDF     | Invoice, InvoiceItem                     |
| `notifications`   | Emails mensuels, alertes      | (utilise Customer, Shop)                 |
| `import`          | Import bulk CSV/Excel         | (utilise Product)                        |
| `packaging-types` | Conditionnements avancés      | PackagingType                            |

### Plans de licence

| Plan             | Modules inclus                                    | Nb  | Cible                       |
| ---------------- | ------------------------------------------------- | --- | --------------------------- |
| **STARTER**      | Coeur + Étendu                                    | 12  | Petit commerçant individuel |
| **PROFESSIONAL** | Coeur + Étendu + Premium (sauf packaging-types)   | 17  | Boutique avec employés      |
| **ENTERPRISE**   | Tous les modules                                  | 18  | PME multi-boutiques         |

> Le système d'activation de modules est **implémenté** (Plan 023 - Phase 5, complété Plan 029). Le champ `enabled_modules` sur Shop contrôle les modules actifs. L'`EntitlementGuard` (APP_GUARD global) vérifie que le module requis est activé avant chaque requête. Si `enabled_modules` est vide, tous les modules sont autorisés (rétrocompatibilité). Les contrôleurs décorés avec `@RequireModule()` : `suppliers`, `debts`, `receivables`, `transfers`, `invoices`, `import`, `enterprise`, `notifications`, `packaging-types`. Le registre des modules est dans `packages/core/src/modules/registry.ts`.
>
> **Plan 029** : L'`EntitlementGuard` retourne un code structuré `MODULE_DISABLED` avec le nom du module dans la réponse 403. Les frontends (web + mobile) interceptent ce code pour afficher un message contextuel. La réponse d'authentification (`/auth/me`, `/auth/pin`) inclut désormais `enabled_modules` et `license_tier`. Le web affiche les modules non inclus en gris dans la sidebar avec un cadenas. Le mobile affiche une alerte avec le nom du module et le tier de licence.
>
> **Plan 026** : Validation licence active. `updateShopModules()` vérifie que les modules demandés sont autorisés par le `license_tier` de l'entreprise via `getAvailableModulesForLicense()`. Validation des dépendances inter-modules via `validateModuleDependencies()`. `updateLicense()` auto-synchronise les modules des boutiques lors d'un downgrade (supprime les modules non autorisés par le nouveau tier).

### Entreprise obligatoire (Plan 026)

Chaque boutique (`Shop`) est **obligatoirement rattachée** à une entreprise (`Enterprise`). Le champ `enterprise_id` est `NOT NULL`. La création d'une boutique (inscription ou admin) crée automatiquement une entreprise si nécessaire. Une boutique ne peut jamais être "détachée", seulement déplacée d'une entreprise à une autre (`moveShopToEnterprise`). L'entreprise ne peut pas être supprimée si elle contient des boutiques actives. L'entreprise porte un champ `logo_url` optionnel.

### Branding "Entreprise - Boutique" (Plan 026)

Les réponses d'authentification (`login`, `loginWithPin`, `getMe`) incluent l'objet `enterprise` avec `{ id, code, name, logo_url }`. L'interface web affiche "Entreprise - Boutique" dans la sidebar utilisateur. Le mobile stocke l'entreprise dans AsyncStorage via le hook `useCurrentUser()`.

---

## Historique des mises à jour

| Date       | Description                                                                                                                                                                                                                                                                                                                                                           | Auteur      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 2026-02-19 | Fix 9 bugs mobile: migration SQLite v5 (packaging_type_id, expected_total, pricing_notes), fix Text rendering stock, credit limit enforcement (PENDING+PARTIAL) sur SaleScreen/CustomerDetailsScreen/CashScreen, import CSV reel via expo-document-picker, messages conflits sync humanises, modules desactives regroupes dans MoreScreen, refresh licence au focus, auto-sync au focus HomeScreen. Correction table licences dans features-catalog (STARTER = Coeur + Etendu, pas Coeur uniquement) | Claude Code |
| 2026-02-16 | Plan 029: Harmonisation Web/Mobile - Palette Navy (#0F2A44) sur web, logo SWALO, module gating frontend (sidebar grisée + cadenas), 6 contrôleurs API décorés @RequireModule, auth retourne enabled_modules/license_tier, erreur 403 MODULE_DISABLED structurée, fix POS.tsx bug montant FCFA (\*100 retiré), fix SQLite auth_cache NOT NULL, detail modal caisse web | Claude Code |
| 2026-02-14 | Plan 027: Full offline autonomy - 21 entites synchees (vs 7), 22+ operations offline, auth PIN offline, rapports SQLite locaux, sync prioritaire (sales > debts > reference), intervalles adaptatifs (batterie), auto-resolution conflits (LWW reference, manuel financier), retention donnees 90j, indicateur fraicheur sur HomeScreen/BusinessReportsScreen         | Claude Code |
| 2026-02-10 | Plan 026: Rôles simplifiés (6→4: EMPLOYEE, MANAGER, BOSS, SUPERADMIN), enterprise_id obligatoire sur Shop, validation licence dans updateShopModules, auto-sync modules au changement licence, branding "Entreprise - Boutique" dans auth + UI, logo_url sur Enterprise                                                                                               | Claude Code |
| 2026-02-10 | Plan 025: Application web admin indépendante (`apps/web-admin`) - Séparation complète de l'admin plateforme en app dédiée port 3002, tokens séparés, login SUPERADMIN exclusif, sidebar sombre, nettoyage pages admin de apps/web                                                                                                                                     | Claude Code |
| 2026-02-10 | Plan 024: Plateforme admin ERP - Enterprise CRUD, Shop creation, License management, Global Users, SystemConfig, Audit export, 4 pages web admin                                                                                                                                                                                                                      | Claude Code |
| 2026-02-09 | Plan 023: Credit limits enforcement, borrowing limits, auto-cart total, admin blocking/audit, modular architecture                                                                                                                                                                                                                                                    | Claude Code |
| 2026-02-09 | Création initiale - inventaire complet de toutes les fonctionnalités                                                                                                                                                                                                                                                                                                  | Claude Code |

<!-- EOF -->
