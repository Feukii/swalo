# Documentation SWALO

## Vue d'ensemble

SWALO est une application de gestion commerciale complète destinée aux petites et moyennes entreprises. Elle offre une solution tout-en-un pour gérer les ventes, les stocks, les clients, les fournisseurs et la trésorerie.

---

## Fonctionnalités principales

### 1. Gestion des ventes (Point de Vente - POS)

**Fonctionnalités :**
- Interface de caisse intuitive pour les ventes
- Gestion du panier avec ajout/suppression de produits
- Calcul automatique des totaux
- Support des remises
- Plusieurs modes de paiement (espèces, mobile money, carte)
- Impression de reçus
- Historique des ventes

**Rôles autorisés :** Tous les utilisateurs connectés

### 2. Gestion de la caisse

**Fonctionnalités :**
- Suivi du solde de caisse en temps réel
- Enregistrement des entrées de caisse :
  - Vente
  - Remboursement client
  - Autre
- Enregistrement des sorties de caisse :
  - Achat
  - Règlement fournisseur
  - Dépenses
  - Divers
- Journal quotidien des opérations
- Statistiques journalières (entrées, sorties, solde net)

**Rôles autorisés :** OWNER, ADMIN, MANAGER

### 3. Gestion des stocks

**Fonctionnalités :**
- Catalogue de produits
- Ajout/modification/suppression de produits
- Gestion des catégories
- Suivi des quantités en stock
- Alertes de stock faible
- Historique des mouvements de stock
- Codes-barres
- Prix d'achat et prix de vente

**Rôles autorisés :**
- Consultation : Tous
- Modification : OWNER, ADMIN, MANAGER
- Suppression : OWNER, ADMIN

### 4. Gestion des clients

**Fonctionnalités :**
- Fiche client complète (nom, prénom, téléphone, email, adresse)
- Historique des achats
- Gestion des créances (dettes clients)
- Enregistrement des paiements
- Création directe de créances (sans passer par la caisse)
- Statistiques par client
- Remboursements

**Rôles autorisés :**
- Consultation : Tous
- Modification : OWNER, ADMIN, MANAGER
- Suppression : OWNER, ADMIN
- Création de créances : OWNER, ADMIN, MANAGER

### 5. Gestion des fournisseurs

**Fonctionnalités :**
- Fiche fournisseur complète
- Historique des achats
- Gestion des dettes (dettes envers fournisseurs)
- Enregistrement des paiements
- Création directe de dettes (sans passer par la caisse)
- Statistiques par fournisseur

**Rôles autorisés :**
- Consultation : Tous
- Modification : OWNER, ADMIN, MANAGER
- Suppression : OWNER, ADMIN
- Création de dettes : OWNER, ADMIN, MANAGER

### 6. Gestion des créances et dettes

**Créances (argent dû par les clients) :**
- Création de créances
- Enregistrement de paiements partiels ou complets
- Statuts : EN ATTENTE, PARTIEL, PAYÉ, ANNULÉ
- Historique des paiements
- Statistiques globales

**Dettes (argent dû aux fournisseurs) :**
- Création de dettes
- Enregistrement de paiements partiels ou complets
- Statuts : EN ATTENTE, PARTIEL, PAYÉ, ANNULÉ
- Historique des paiements
- Statistiques globales

**Rôles autorisés :**
- Création : OWNER, ADMIN, MANAGER
- Consultation : Tous
- Annulation : OWNER, ADMIN, MANAGER
- Suppression : OWNER, ADMIN

### 7. Tableau de bord (Dashboard)

**Fonctionnalités :**
- Vue d'ensemble de l'activité
- Statistiques de ventes (jour, semaine, mois)
- Graphiques d'évolution
- Produits les plus vendus
- Alertes de stock
- Résumé de trésorerie
- KPIs principaux

**Rôles autorisés :** Tous

### 8. Gestion des utilisateurs

**Fonctionnalités :**
- Création de comptes utilisateurs
- Attribution de rôles
- Désactivation/activation de comptes
- Gestion des permissions
- Authentification par code PIN (mobile)
- Authentification par email/mot de passe (web)

**Rôles disponibles :**
- **SUPERADMIN** : Accès complet à toute la plateforme
- **OWNER** : Propriétaire de la boutique, tous les droits sur sa boutique
- **ADMIN** : Administrateur, la plupart des droits
- **MANAGER** : Gérant, droits de gestion limités
- **EMPLOYEE** : Employé, droits de consultation et vente uniquement

**Rôles autorisés :** OWNER, SUPERADMIN

### 9. Rapports et statistiques

**Fonctionnalités :**
- Rapports de ventes
- Rapports de trésorerie
- Rapports de stock
- Rapports de créances/dettes
- Export de données
- Filtres par période

**Rôles autorisés :** OWNER, ADMIN, MANAGER

### 10. Panel d'administration (SUPERADMIN)

**Fonctionnalités :**
- Gestion multi-boutiques
- Création de nouvelles boutiques
- Vue d'ensemble de toutes les boutiques
- Statistiques globales de la plateforme
- Gestion des utilisateurs SUPERADMIN

**Rôles autorisés :** SUPERADMIN uniquement

---

## Charte graphique

> 📌 **Note** : L'application utilise un système de thème centralisé (`apps/mobile/src/constants/theme.ts`) basé sur Tailwind CSS pour garantir la cohérence visuelle.

### Palette de couleurs harmonisée

**Couleurs primaires - Identité de marque :**
- **Bleu primaire** : `#0ea5e9` (Sky Blue 500) - Navigation, éléments principaux, boutons d'action
- **Bleu foncé** : `#0284c7` (Sky Blue 600) - Dégradés, accents
- **Violet secondaire** : `#8b5cf6` (Violet 500) - Caisse, accents secondaires
- **Violet foncé** : `#7c3aed` (Violet 600) - Dégradés violets

**Couleurs sémantiques - Signification fonctionnelle :**
- **Succès (Vert)** :
  - Principal : `#10b981` (Emerald 500) - Paiements reçus, soldes positifs
  - Foncé : `#059669` (Emerald 600) - Dégradés
  - Fond : `#dcfce7` (Emerald 100) - Badges actifs
  - Texte : `#16a34a` (Green 600) - Texte sur fond clair

- **Danger (Rouge)** :
  - Principal : `#ef4444` (Red 500) - Erreurs, suppressions
  - Foncé : `#dc2626` (Red 600) - Dégradés
  - Très foncé : `#b91c1c` (Red 700) - Dettes fournisseurs
  - Fond : `#fee2e2` (Red 100) - Badges inactifs
  - Texte : `#dc2626` (Red 600) - Texte sur fond clair

- **Attention (Amber/Orange)** :
  - Principal : `#f59e0b` (Amber 500) - Alertes, créances clients
  - Foncé : `#d97706` (Amber 600) - Dégradés
  - Fond : `#fef3c7` (Amber 100) - Badges partiels
  - Texte : `#92400e` (Amber 800) - Texte sur fond clair

- **Information (Bleu)** :
  - Principal : `#3b82f6` (Blue 500) - Messages informatifs
  - Foncé : `#2563eb` (Blue 600) - Dégradés
  - Fond : `#dbeafe` (Blue 100) - Badges en attente
  - Texte : `#1e40af` (Blue 800) - Texte sur fond clair

**Couleurs contextuelles - Modules spécifiques :**

*Clients / Créances (Receivables)* - Thème Amber/Orange :
- Solde avec dette : Gradient `['#f59e0b', '#d97706']` (Amber)
- Solde payé : Gradient `['#10b981', '#059669']` (Vert)
- Créer créance : Amber
- Recevoir paiement : Vert

*Fournisseurs / Dettes (Debts)* - Thème Rouge :
- Solde avec dette : Gradient `['#ef4444', '#dc2626']` (Rouge)
- Solde payé : Gradient `['#10b981', '#059669']` (Vert)
- Créer dette : Rouge
- Payer fournisseur : Vert

*Gestion de caisse (Cash)* - Thème Violet/Vert/Rouge :
- Header : Gradient `['#8b5cf6', '#7c3aed']` (Violet)
- Entrées : Gradient `['#10b981', '#059669']` (Vert)
- Sorties : Gradient `['#ef4444', '#dc2626']` (Rouge)

**Couleurs neutres - Arrière-plans et textes :**
- **Blanc** : `#ffffff` - Fond des cartes
- **Gris très clair** : `#f9fafb` (Gray 50) - Fond de page principal
- **Gris clair** : `#f3f4f6` (Gray 100) - Fond plus foncé
- **Bordures** : `#e5e7eb` (Gray 200)
- **Bordures foncées** : `#d1d5db` (Gray 300)
- **Désactivé** : `#9ca3af` (Gray 400)

**Hiérarchie de textes :**
- **Primaire** : `#111827` (Gray 900) - Titres principaux
- **Secondaire** : `#374151` (Gray 700) - Sous-titres, labels
- **Tertiaire** : `#6b7280` (Gray 500) - Texte d'aide
- **Désactivé** : `#9ca3af` (Gray 400) - Texte désactivé
- **Inverse** : `#ffffff` - Texte sur fonds sombres

**Rôles utilisateurs - Couleurs d'identification :**
- **SUPERADMIN** : `#9333ea` (Purple 600) - Badge violet
- **OWNER** : `#dc2626` (Red 600) - Badge vert (actif)
- **ADMIN** : `#ea580c` (Orange 600) - Badge amber
- **MANAGER** : `#0284c7` (Sky 600) - Badge indigo
- **EMPLOYEE** : `#2563eb` (Blue 600) - Badge bleu

### Typographie

**Police principale :** System Font (native à chaque plateforme)
- iOS : San Francisco
- Android : Roboto
- Web : System UI

**Tailles de police :**
- Titres principaux : 24-32px, Bold
- Titres secondaires : 18-20px, Bold
- Titres de cartes : 16-18px, SemiBold (600)
- Texte normal : 14-16px, Regular
- Texte secondaire : 12-14px, Regular
- Petits textes : 10-12px, Regular

### Éléments visuels

**Cartes :**
- Fond blanc (`#ffffff`)
- Bordures arrondies : 12-20px
- Ombre légère : `shadowOpacity: 0.1, shadowRadius: 4-8`
- Padding interne : 16-24px

**Boutons :**
- **Boutons primaires** : Dégradés LinearGradient avec couleurs fonctionnelles
- **Boutons secondaires** : Fond gris clair avec texte gris foncé
- Bordures arrondies : 12-16px
- Padding : 12-16px
- Texte : 14-16px, SemiBold

**Badges de statut :**
- Bordures arrondies : 8-12px
- Padding : 6-12px horizontal, 4-6px vertical
- Texte : 10-12px, SemiBold
- Couleurs selon le statut :
  - Actif : Fond vert clair, texte vert
  - Inactif : Fond rouge clair, texte rouge
  - En attente : Fond bleu clair, texte bleu
  - Partiel : Fond jaune clair, texte jaune

**Icônes :**
- Émojis pour une interface conviviale et colorée
- Taille : 20-48px selon le contexte
- Utilisés dans les en-têtes, boutons et cartes

**Modals :**
- Fond semi-transparent : `rgba(0, 0, 0, 0.5)`
- Contenu : Fond blanc, arrondis 24px en haut
- Header : LinearGradient avec couleur contextuelle
- Hauteur max : 80% de l'écran

### Espacements

**Marges et paddings standards :**
- Petit : 8px
- Moyen : 12-16px
- Grand : 20-24px
- Très grand : 32-40px

**Gaps (espacement entre éléments) :**
- Entre éléments : 8-12px
- Entre sections : 16-20px
- Entre cartes : 16px

---

## Architecture technique

### Stack technologique

**Frontend Mobile (React Native + Expo) :**
- **Framework** : React Native avec Expo SDK
- **Langage** : TypeScript
- **Navigation** : React Navigation
- **État local** : React Hooks (useState, useEffect)
- **Stockage local** : AsyncStorage (@react-native-async-storage/async-storage)
- **Composants UI** :
  - expo-linear-gradient (dégradés)
  - react-native-safe-area-context (zones sûres)
  - @expo/vector-icons (icônes)
- **HTTP Client** : Fetch API native

**Frontend Web :**
- **Framework** : React.js
- **Langage** : TypeScript
- **Routing** : React Router
- **État** : React Hooks
- **Styling** : CSS Modules / Styled Components
- **Build** : Webpack

**Backend (NestJS) :**
- **Framework** : NestJS
- **Langage** : TypeScript
- **Base de données** : PostgreSQL
- **ORM** : Prisma
- **Authentification** : JWT (JSON Web Tokens)
- **Validation** : class-validator, class-transformer
- **Documentation API** : Swagger/OpenAPI (potentiel)

**Base de données (PostgreSQL) :**
- **SGBD** : PostgreSQL 14+
- **Hébergement** : Neon (cloud PostgreSQL)
- **Migrations** : Prisma Migrate
- **Schéma** : Géré par Prisma ORM

**Infrastructure :**
- **Backend API** : Render.com (déploiement automatique)
- **Mobile App** : Expo EAS (build et distribution)
- **CI/CD** : GitHub Actions
- **Monitoring API** : Keep-alive workflow (ping toutes les 30 min)

### Architecture globale

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTS (Frontend)                        │
├──────────────────────┬──────────────────────────────────────┤
│   Mobile App         │        Web App                        │
│   (React Native)     │        (React)                        │
│                      │                                       │
│   - Expo             │        - React Router                 │
│   - TypeScript       │        - TypeScript                   │
│   - AsyncStorage     │        - LocalStorage                 │
└──────────────────────┴──────────────────────────────────────┘
                              │
                              │ HTTPS / REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API                               │
│                    (NestJS)                                  │
├─────────────────────────────────────────────────────────────┤
│  Controllers:                                                │
│  - AuthController (authentification)                         │
│  - UsersController (utilisateurs)                            │
│  - ShopsController (boutiques)                               │
│  - ProductsController (produits)                             │
│  - CustomersController (clients)                             │
│  - SuppliersController (fournisseurs)                        │
│  - SalesController (ventes)                                  │
│  - ReceivablesController (créances)                          │
│  - DebtsController (dettes)                                  │
│  - CashController (caisse)                                   │
│                                                               │
│  Guards & Middleware:                                        │
│  - JwtAuthGuard (vérification JWT)                           │
│  - RolesGuard (vérification des rôles)                       │
│                                                               │
│  Services:                                                   │
│  - Business logic pour chaque module                         │
│  - Interaction avec Prisma                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Prisma ORM
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                DATABASE (PostgreSQL)                         │
├─────────────────────────────────────────────────────────────┤
│  Tables principales:                                         │
│  - User (utilisateurs)                                       │
│  - Shop (boutiques)                                          │
│  - Product (produits)                                        │
│  - Category (catégories)                                     │
│  - Customer (clients)                                        │
│  - Supplier (fournisseurs)                                   │
│  - Sale (ventes)                                             │
│  - SaleItem (lignes de vente)                                │
│  - Receivable (créances)                                     │
│  - ReceivablePayment (paiements de créances)                 │
│  - Debt (dettes)                                             │
│  - DebtPayment (paiements de dettes)                         │
│  - CashEntry (opérations de caisse)                          │
│                                                               │
│  Relations:                                                  │
│  - User → Shop (many-to-one)                                 │
│  - Product → Category (many-to-one)                          │
│  - Sale → Customer (many-to-one)                             │
│  - SaleItem → Product (many-to-one)                          │
│  - Receivable → Customer (many-to-one)                       │
│  - Debt → Supplier (many-to-one)                             │
└─────────────────────────────────────────────────────────────┘
```

### Modèle de données simplifié

**User** (Utilisateur)
- id, email, password_hash, first_name, last_name
- role (SUPERADMIN, OWNER, ADMIN, MANAGER, EMPLOYEE)
- pin_code (pour mobile)
- shop_id → Shop
- is_active, created_at, updated_at

**Shop** (Boutique)
- id, name, address, phone, email
- created_at, updated_at
- users → User[]

**Product** (Produit)
- id, name, description, barcode
- purchase_price, selling_price
- stock_quantity, min_stock_quantity
- category_id → Category
- shop_id → Shop
- is_active, created_at, updated_at

**Customer** (Client)
- id, name, first_name, phone, email, address
- shop_id → Shop
- is_active, created_at, updated_at
- receivables → Receivable[]

**Supplier** (Fournisseur)
- id, name, first_name, phone, email, address
- shop_id → Shop
- is_active, created_at, updated_at
- debts → Debt[]

**Sale** (Vente)
- id, total_amount, paid_amount, change_amount
- payment_method (CASH, MOBILE_MONEY, CARD, CREDIT)
- customer_id → Customer
- user_id → User (vendeur)
- shop_id → Shop
- created_at
- items → SaleItem[]

**Receivable** (Créance)
- id, amount, balance, paid_amount
- status (PENDING, PARTIAL, PAID, CANCELLED)
- description, notes
- customer_id → Customer
- shop_id → Shop
- created_at, updated_at
- payments → ReceivablePayment[]

**Debt** (Dette)
- id, amount, balance, paid_amount
- status (PENDING, PARTIAL, PAID, CANCELLED)
- description, notes
- supplier_id → Supplier
- shop_id → Shop
- created_at, updated_at
- payments → DebtPayment[]

**CashEntry** (Opération de caisse)
- id, amount, type (IN, OUT)
- category (Vente, Achat, Remboursement, Dépenses, etc.)
- note, reference
- user_id → User
- shop_id → Shop
- created_at

### Sécurité

**Authentification :**
- JWT (JSON Web Tokens) avec expiration
- Refresh tokens pour renouvellement
- Code PIN à 4 chiffres (mobile) stocké hashé (bcrypt)
- Mot de passe (web) hashé avec bcrypt

**Autorisation :**
- Guards NestJS pour vérifier les JWT
- RolesGuard pour contrôle d'accès basé sur les rôles
- Décorateurs @Roles() sur les endpoints
- Vérification du shop_id dans les requêtes (isolation des données)

**Protection des données :**
- HTTPS obligatoire
- Variables d'environnement pour les secrets
- Pas de données sensibles en frontend
- Validation des entrées (DTOs avec class-validator)
- Sanitization des données

**Isolation multi-tenant :**
- Chaque Shop a ses propres données
- Filtrage automatique par shop_id
- SUPERADMIN peut accéder à toutes les boutiques
- Autres utilisateurs limités à leur boutique

### API REST

**Format des réponses :**
```json
{
  "id": "uuid",
  "data": { ... },
  "created_at": "ISO 8601 date",
  "updated_at": "ISO 8601 date"
}
```

**Format des erreurs :**
```json
{
  "statusCode": 400,
  "message": "Description de l'erreur",
  "error": "Bad Request"
}
```

**Endpoints principaux :**
- `POST /api/auth/login` - Connexion (email/password)
- `POST /api/auth/pin` - Connexion par PIN (mobile)
- `GET /api/products` - Liste des produits
- `POST /api/sales` - Créer une vente
- `GET /api/customers/:id` - Détails d'un client
- `POST /api/receivables` - Créer une créance
- `POST /api/receivables/:id/payments` - Ajouter un paiement
- `GET /api/cash/balance` - Solde de caisse
- `POST /api/cash/entries` - Créer une opération de caisse

**Authentification des requêtes :**
```
Authorization: Bearer <jwt_token>
```

### Workflow de développement

**Branches Git :**
- `main` : Production stable
- `develop` : Développement en cours
- `feature/*` : Nouvelles fonctionnalités
- `fix/*` : Corrections de bugs

**Déploiement :**
1. Commit sur `main` → Deploy automatique sur Render
2. Backend redémarre automatiquement
3. Mobile : Build EAS puis publication

**CI/CD (GitHub Actions) :**
- Keep-alive : Ping API toutes les 30 minutes
- Tests automatiques (à venir)
- Linting et formatage (à venir)

---

## Points forts de l'application

1. **Interface intuitive** : Design moderne avec émojis et couleurs claires
2. **Multi-plateforme** : Mobile (iOS/Android) et Web
3. **Multi-utilisateurs** : Gestion des rôles et permissions
4. **Temps réel** : Synchronisation automatique des données
5. **Hors ligne** : Capacité de fonctionner en mode déconnecté (mobile)
6. **Sécurisé** : Authentification JWT, isolation des données
7. **Évolutif** : Architecture modulaire NestJS
8. **Moderne** : Technologies récentes et maintenues

---

## Évolutions futures possibles

- Mode hors ligne complet avec synchronisation
- Notifications push
- Rapports PDF personnalisés
- Import/export de données (CSV, Excel)
- Intégration avec systèmes de paiement mobile money
- Scanner de codes-barres
- Gestion des promotions et remises
- Multi-devises
- Support multilingue
- Application de reporting avancé
- API publique pour intégrations tierces

---

**Version du document :** 1.1
**Dernière mise à jour :** 27 décembre 2025
**Auteur :** Généré par Claude Code

### Changelog

**v1.1 - 27 décembre 2025**
- Ajout du système de thème centralisé
- Harmonisation complète de la palette de couleurs
- Documentation des couleurs contextuelles par module
- Clarification de la hiérarchie sémantique des couleurs
- Ajout des gradients spécifiques pour chaque contexte

**v1.0 - 27 décembre 2024**
- Documentation initiale de l'application
