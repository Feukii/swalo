# SWALO — Cahier des Charges Fonctionnel & Technique Unifié
**Version : 2.0 – Novembre 2025**
**Langue : Français**
**Auteur : Ariel FEUKENG**

---

## 0. Principes directeurs

> **But :** fournir à une IA développeur (Claude/GPT) et à l'équipe SWALO une spécification complète pour générer un **mini-ERP retail**, extensible et utilisable par **10 boutiques** à **coût infrastructure minimal**.

1. **Architecture actuelle** :
   - Stockage local : **Prisma + PostgreSQL** (backend), **AsyncStorage** (mobile).
   - Base de données centralisée avec synchronisation temps réel.

2. **Backend** : **NestJS + PostgreSQL + Docker**
   - API REST complète avec authentification JWT.
   - Docker Compose pour orchestration des services.
   - Prisma ORM pour gestion de la base de données.

3. **Monolithe modulaire** :
   - Backend NestJS avec modules : auth, cash, customers, suppliers, users, shops.
   - Frontend web et mobile partageant le package `@swalo/core` pour types et utilitaires.

4. **Sécurité & confidentialité** :
   - Auth par **code PIN à 4 chiffres** (employés).
   - Auth par **email/mot de passe** (admin/superadmin).
   - JWT pour authentification API.
   - Contrôle d'accès basé sur les rôles (RBAC).

5. **UX mobile-first** :
   - Interface simplifiée avec autocomplete pour recherche rapide.
   - Gestion de caisse en 2-3 actions maximum.
   - Design cohérent entre web et mobile.

6. **Stack technique actuelle** :
   - **Mobile** : React Native + Expo.
   - **Web** : React + Vite + Tailwind CSS.
   - **Backend** : NestJS + Prisma + PostgreSQL.
   - **Shared** : Package `@swalo/core` (TypeScript).

---

## 1. Contexte et vision

Les boutiques d'accessoires téléphoniques en Afrique de l'Ouest fonctionnent encore majoritairement avec des carnets papier.
SWALO vise à **numériser ces flux** (ventes, dettes, paiements, inventaires) à travers une application simple, fluide et accessible.

### Vision
- Un outil mobile-first, fiable et adapté au terrain africain.
- Extensible en ERP complet (ventes, achats, inventaires, compta légère).
- Base de données centralisée pour dashboard et rapports.

### Objectifs V1 (En cours)
- ✅ Gérer les entrées et sorties de caisse.
- ✅ Suivre les créances clients et dettes fournisseurs.
- ✅ Authentification multi-rôles avec contrôle d'accès.
- ✅ Interface web et mobile avec parité fonctionnelle.
- ✅ Rapports d'activité et bilans financiers.
- 🔄 Gestion des stocks et inventaires (à venir).
- 🔄 Système de facturation complet (à venir).

---

## 2. Profils et rôles utilisateurs

| Rôle | Description | Accès |
|------|--------------|-------|
| **SUPERADMIN** | Responsable plateforme | Accès à toutes les boutiques, création de comptes, supervision globale. Dashboard dédié. |
| **OWNER** (Propriétaire) | Responsable d'une boutique | Accès complet : caisse, créances, dettes, bilans, gestion employés. Peut corriger les montants négatifs. |
| **MANAGER** | Superviseur intermédiaire | Accès aux rapports, validation des opérations, gestion partielle des utilisateurs. |
| **ADMIN** | Administrateur boutique | Gestion des paramètres boutique, utilisateurs, configuration. |
| **EMPLOYEE** (Employé) | Utilisateur opérationnel | Entrées/sorties de caisse uniquement. Accès restreint aux fonctionnalités avancées. |

### Authentification (Implémenté)
- **Connexion PIN (4 chiffres)** pour EMPLOYEE.
- **Connexion email/mot de passe** pour ADMIN, OWNER, MANAGER, SUPERADMIN.
- JWT avec access token (7 jours) et refresh token.
- Middleware de contrôle d'accès par rôle sur toutes les routes protégées.
- Menu contextuel avec options basées sur le rôle de l'utilisateur.

---

## 3. Modules fonctionnels (État actuel)

### 3.1 Gestion de la Caisse ✅ (Implémenté)

**Interface "Ma Caisse" (Mobile & Web)** :
- Affichage du **solde de caisse** en temps réel (grande carte violette).
- **Boutons d'action** :
  - ↗️ **Entrée** (vert) : Ajouter de l'argent en caisse.
  - ↙️ **Sortie** (rouge) : Retirer de l'argent de la caisse.

**Catégories d'entrées** :
- Ventes
- Remboursement client
- Divers (commentaire obligatoire, min. 5 caractères)

**Catégories de sorties** :
- Achats Marchandises
- Loyers
- Règlement fournisseur
- Dépenses courantes
- Divers (commentaire obligatoire, min. 5 caractères)

**Fonctionnalités** :
- Recherche autocomplete pour clients/fournisseurs (recherche par nom ou prénom, max 5 résultats).
- Journal des opérations du jour avec affichage des détails.
- Statistiques quotidiennes : Total entrées, Total sorties, Solde net.
- Validation frontend et backend pour catégorie "Divers".
- **Correction d'erreurs** : Les propriétaires (OWNER) peuvent saisir des montants négatifs pour corriger des erreurs.

**API** :
- `GET /api/cash/balance` - Obtenir le solde actuel.
- `GET /api/cash/stats` - Statistiques de caisse (entrées, sorties, net).
- `GET /api/cash/entries` - Historique des opérations avec filtres (date, type).
- `POST /api/cash/entries` - Créer une nouvelle entrée/sortie.

### 3.2 Créances Clients ✅ (Implémenté)

**Gestion des clients** :
- CRUD complet (Create, Read, Update, Delete).
- Informations : nom, prénom, téléphone, adresse, notes.
- Statut actif/inactif.
- Calcul automatique du solde de créances.

**Système de créances** :
- Enregistrement de créances avec montant et description.
- Paiements partiels ou complets.
- Historique complet des transactions par client.
- Affichage du solde restant dû.

**API** :
- `GET /api/customers` - Liste des clients avec filtres.
- `POST /api/customers` - Créer un client.
- `GET /api/customers/:id` - Détails d'un client.
- `PATCH /api/customers/:id` - Modifier un client.
- `DELETE /api/customers/:id` - Supprimer un client.
- `GET /api/receivables` - Liste des créances.
- `POST /api/receivables` - Créer une créance.
- `POST /api/receivables/:id/payments` - Enregistrer un paiement.

### 3.3 Dettes Fournisseurs ✅ (Implémenté)

**Gestion des fournisseurs** :
- CRUD complet similaire aux clients.
- Informations : nom, prénom, téléphone, adresse, notes.
- Statut actif/inactif.
- Calcul automatique du solde de dettes.

**Système de dettes** :
- Enregistrement de dettes avec montant et description.
- Règlements partiels ou complets.
- Historique complet des transactions par fournisseur.
- Affichage du solde restant à payer.

**API** :
- `GET /api/suppliers` - Liste des fournisseurs.
- `POST /api/suppliers` - Créer un fournisseur.
- `GET /api/suppliers/:id` - Détails d'un fournisseur.
- `PATCH /api/suppliers/:id` - Modifier un fournisseur.
- `DELETE /api/suppliers/:id` - Supprimer un fournisseur.
- `GET /api/debts` - Liste des dettes.
- `POST /api/debts` - Créer une dette.
- `POST /api/debts/:id/payments` - Enregistrer un règlement.

### 3.4 Dashboard & Bilans ✅ (Implémenté)

**Bilans & Rapports** (accès OWNER, MANAGER, ADMIN, SUPERADMIN) :

**Sommaire financier** :
- Total créances clients (à recevoir).
- Total dettes fournisseurs (à payer).
- Solde net (créances - dettes).

**Chiffre d'affaires par période** :
- Aujourd'hui / Cette semaine / Ce mois / Cette année.
- Total entrées et sorties.
- Résultat net avec indicateur visuel (positif/négatif).
- Nombre d'opérations.

**Visualisations** :
- Graphique comparatif entrées/sorties (barres horizontales).
- Répartition des entrées par catégorie (%).
- Répartition des sorties par catégorie (%).

**Historique des opérations** :
- Liste complète avec filtres par période.
- Affichage des détails : catégorie, montant, date, client/fournisseur, note.
- Option "Voir plus" pour historique complet.

### 3.5 Gestion des Utilisateurs ✅ (Implémenté)

**Fonctionnalités** :
- Création d'utilisateurs avec attribution de rôle.
- Génération automatique de code PIN pour employés.
- Modification des informations utilisateur.
- Désactivation/suppression d'utilisateurs.
- Liste des utilisateurs avec filtres par rôle et statut.

**Contrôle d'accès** :
- Menu paramètres visible uniquement pour OWNER, ADMIN, MANAGER, SUPERADMIN.
- Option "Utilisateurs" accessible selon le rôle.
- Option "Admin" (dashboard superadmin) visible uniquement pour SUPERADMIN.

**API** :
- `GET /api/users` - Liste des utilisateurs.
- `POST /api/users` - Créer un utilisateur.
- `GET /api/users/:id` - Détails d'un utilisateur.
- `PATCH /api/users/:id` - Modifier un utilisateur.
- `DELETE /api/users/:id` - Supprimer un utilisateur.

### 3.6 Interface Mobile (React Native + Expo) ✅

**Écrans implémentés** :
- **LoginPinScreen** : Authentification par code PIN à 4 chiffres.
- **POSScreen** (Ma Caisse) : Interface principale de gestion de caisse.
- **CustomersScreen** : Liste et gestion des clients.
- **CustomerDetailsScreen** : Détails, créances et paiements d'un client.
- **SuppliersScreen** : Liste et gestion des fournisseurs.
- **SupplierDetailsScreen** : Détails, dettes et règlements d'un fournisseur.
- **BusinessReportsScreen** : Rapports et bilans financiers.

**Fonctionnalités UX** :
- Navigation par onglets (Tab Navigation).
- Gradient design (LinearGradient).
- Autocomplete pour recherche clients/fournisseurs.
- Splash screen avec logo SWALO.
- SafeAreaView pour compatibilité multi-devices.

### 3.7 Interface Web (React + Vite + Tailwind) ✅

**Pages implémentées** :
- **/login** : Authentification PIN (employés).
- **/login/admin** : Authentification email/password (admin).
- **/pos** (Ma Caisse) : Gestion de caisse identique au mobile.
- **/customers** : Gestion des clients.
- **/customers/:id** : Détails client avec créances.
- **/suppliers** : Gestion des fournisseurs.
- **/suppliers/:id** : Détails fournisseur avec dettes.
- **/reports** : Bilans & Rapports.
- **/admin/users** : Gestion des utilisateurs.
- **/admin/dashboard** : Dashboard superadmin.

**Design** :
- Layout responsive avec sidebar navigation.
- Composants réutilisables (MainLayout, ProtectedRoute).
- Tailwind CSS pour styling cohérent.
- Autocomplete pour recherche (identique au mobile).

### 3.8 Package Partagé (@swalo/core) ✅

**Contenu** :
- Types TypeScript partagés entre frontend et backend.
- Utilitaires de formatage (currency, date).
- Constantes métier (cashCategories, MIN_NOTE_LENGTH).
- Schémas de validation.

**Fichiers clés** :
- `packages/core/src/constants/cashCategories.ts` : Catégories de caisse + validation.
- `packages/core/src/utils/currency.ts` : Formatage des montants.
- `packages/core/src/utils/date.ts` : Formatage des dates.
- `packages/core/src/types/` : Interfaces TypeScript.

---

## 4. Priorisation (MoSCoW) - Mise à jour

| Catégorie | Modules concernés | État |
|------------|------------------|------|
| **Must (MVP)** | Caisse, Créances, Dettes, Auth PIN/Email, Bilans | ✅ **Implémenté** |
| **Should (V1)** | Gestion Utilisateurs, Dashboard Superadmin, Corrections montants négatifs | ✅ **Implémenté** |
| **Could (V2)** | Gestion Stocks, Facturation PDF, Inventaire | 🔄 **En cours** |
| **Won't (Later)** | IA prédictive, Intégrations bancaires, e-commerce, Mode offline | 📅 **Planifié** |

---

## 5. Règles métier clés

1. **Créances / dettes** toujours liées à des opérations de caisse.
2. **Validation "Divers"** : commentaire obligatoire (min 5 caractères).
3. **Recherche autocomplete** : max 5 résultats, recherche par nom ou prénom.
4. **Corrections d'erreurs** : Seuls les OWNER peuvent saisir des montants négatifs.
5. **Contrôle d'accès** : Routes et fonctionnalités filtrées selon le rôle utilisateur.
6. **Catégories de caisse** : Définies dans `@swalo/core` pour cohérence multi-plateforme.
7. **Solde de caisse** : Calculé en temps réel (somme entrées - somme sorties).
8. **Statut clients/fournisseurs** : Peut être actif/inactif sans suppression définitive.

---

## 6. Architecture technique actuelle

### 6.1 Vue d'ensemble

| Couche | Techno | Description |
|---------|--------|-------------|
| **Mobile** | React Native + Expo 54.0.23 | App native iOS/Android avec AsyncStorage. |
| **Web** | React 19.1.0 + Vite + Tailwind CSS | Dashboard web responsive. |
| **Backend** | NestJS 10.3.3 + Prisma 5.11.0 | API REST avec modules métier. |
| **Base de données** | PostgreSQL 16 | Base centralisée avec Prisma ORM. |
| **Shared** | @swalo/core (workspace:*) | Types, constantes, utilitaires partagés. |
| **Container** | Docker + Docker Compose | Orchestration services (postgres, api, web). |

### 6.2 Structure du projet (Monorepo)

```
swalo/
├── apps/
│   ├── api/          # Backend NestJS
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── cash/
│   │   │   │   ├── customers/
│   │   │   │   ├── suppliers/
│   │   │   │   ├── receivables/
│   │   │   │   ├── debts/
│   │   │   │   └── users/
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── Dockerfile
│   ├── mobile/       # React Native
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   ├── lib/
│   │   │   └── store/
│   │   ├── assets/
│   │   │   └── logo.svg
│   │   └── app.config.ts
│   └── web/          # React Web
│       ├── src/
│       │   ├── pages/
│       │   ├── components/
│       │   ├── lib/
│       │   └── store/
│       └── Dockerfile
└── packages/
    └── core/         # Shared package
        └── src/
            ├── constants/
            ├── types/
            └── utils/
```

### 6.3 Communication

- **API REST** sur port 3000 (backend).
- **Web frontend** sur port 80 (Nginx).
- **Mobile** : Expo dev sur port 8081 + Metro Bundler.
- **Base de données** : PostgreSQL sur port 5432.

### 6.4 Authentification JWT

**Flow actuel** :
1. Utilisateur se connecte (PIN ou email/password).
2. Backend génère access_token (JWT, expire 7 jours) + refresh_token.
3. Frontend stocke tokens (AsyncStorage mobile, localStorage web).
4. Chaque requête API inclut `Authorization: Bearer <token>`.
5. Middleware vérifie token + rôle avant accès aux routes protégées.

**Implémentation** :
- `@nestjs/jwt` pour génération/validation tokens.
- `@nestjs/passport` avec stratégie JWT.
- Guards personnalisés pour contrôle de rôles.

---

## 7. Modèle de données (Prisma Schema)

### 7.1 Tables principales (implémentées)

**User** :
```prisma
model User {
  id           String   @id @default(uuid())
  email        String?  @unique
  phone        String?  @unique
  display_name String
  password_hash String?
  pin_hash      String?
  role         Role     @default(EMPLOYEE)
  shop_id      String
  shop         Shop     @relation(fields: [shop_id], references: [id])
  is_active    Boolean  @default(true)
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
}
```

**Shop** :
```prisma
model Shop {
  id         String   @id @default(uuid())
  code       String   @unique
  name       String
  currency   String   @default("XOF")
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
  users      User[]
  cash_entries CashEntry[]
  customers  Customer[]
  suppliers  Supplier[]
}
```

**CashEntry** :
```prisma
model CashEntry {
  id          String   @id @default(uuid())
  shop_id     String
  shop        Shop     @relation(fields: [shop_id], references: [id])
  type        CashEntryType // IN, OUT, OPENING, CLOSING
  category    String?
  amount      Int
  note        String?
  cashier_id  String
  cashier     User     @relation(fields: [cashier_id], references: [id])
  supplier_id String?
  supplier    Supplier? @relation(fields: [supplier_id], references: [id])
  customer_id String?
  customer    Customer? @relation(fields: [customer_id], references: [id])
  device_id   String   @default("web")
  client_op_id String?
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  deleted     Boolean  @default(false)
  deleted_at  DateTime?
  version     Int      @default(1)
}
```

**Customer** :
```prisma
model Customer {
  id            String   @id @default(uuid())
  shop_id       String
  shop          Shop     @relation(fields: [shop_id], references: [id])
  name          String
  first_name    String?
  phone         String?
  address       String?
  notes         String?
  is_active     Boolean  @default(true)
  total_balance Int      @default(0)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  receivables   Receivable[]
  cash_entries  CashEntry[]
}
```

**Supplier** :
```prisma
model Supplier {
  id            String   @id @default(uuid())
  shop_id       String
  shop          Shop     @relation(fields: [shop_id], references: [id])
  name          String
  first_name    String?
  phone         String?
  address       String?
  notes         String?
  is_active     Boolean  @default(true)
  total_balance Int      @default(0)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  debts         Debt[]
  cash_entries  CashEntry[]
}
```

**Receivable** (Créances) :
```prisma
model Receivable {
  id          String   @id @default(uuid())
  customer_id String
  customer    Customer @relation(fields: [customer_id], references: [id])
  amount      Int
  description String?
  status      PaymentStatus @default(PENDING)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  payments    ReceivablePayment[]
}
```

**Debt** (Dettes) :
```prisma
model Debt {
  id          String   @id @default(uuid())
  supplier_id String
  supplier    Supplier @relation(fields: [supplier_id], references: [id])
  amount      Int
  description String?
  status      PaymentStatus @default(PENDING)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  payments    DebtPayment[]
}
```

### 7.2 Enums

```prisma
enum Role {
  EMPLOYEE
  ADMIN
  MANAGER
  OWNER
  SUPERADMIN
}

enum CashEntryType {
  IN
  OUT
  OPENING
  CLOSING
}

enum PaymentStatus {
  PENDING
  PARTIAL
  PAID
}
```

---

## 8. API REST (Documentation)

### 8.1 Authentification

| Endpoint | Méthode | Description | Accès |
|----------|---------|-------------|-------|
| `/api/auth/pin` | POST | Auth par code PIN | Public |
| `/api/auth/login` | POST | Auth email/password | Public |
| `/api/auth/refresh` | POST | Refresh access token | Authentifié |
| `/api/auth/logout` | POST | Déconnexion | Authentifié |

### 8.2 Caisse

| Endpoint | Méthode | Description | Accès |
|----------|---------|-------------|-------|
| `/api/cash/balance` | GET | Solde de caisse actuel | Authentifié |
| `/api/cash/stats` | GET | Statistiques (entrées, sorties, net) | Authentifié |
| `/api/cash/entries` | GET | Historique avec filtres (date, type) | Authentifié |
| `/api/cash/entries` | POST | Créer entrée/sortie | Authentifié |

### 8.3 Clients & Créances

| Endpoint | Méthode | Description | Accès |
|----------|---------|-------------|-------|
| `/api/customers` | GET | Liste clients | Authentifié |
| `/api/customers` | POST | Créer client | Authentifié |
| `/api/customers/:id` | GET | Détails client | Authentifié |
| `/api/customers/:id` | PATCH | Modifier client | Authentifié |
| `/api/customers/:id` | DELETE | Supprimer client | Admin+ |
| `/api/receivables` | GET | Liste créances | Authentifié |
| `/api/receivables` | POST | Créer créance | Authentifié |
| `/api/receivables/:id/payments` | POST | Paiement créance | Authentifié |

### 8.4 Fournisseurs & Dettes

| Endpoint | Méthode | Description | Accès |
|----------|---------|-------------|-------|
| `/api/suppliers` | GET | Liste fournisseurs | Authentifié |
| `/api/suppliers` | POST | Créer fournisseur | Authentifié |
| `/api/suppliers/:id` | GET | Détails fournisseur | Authentifié |
| `/api/suppliers/:id` | PATCH | Modifier fournisseur | Authentifié |
| `/api/suppliers/:id` | DELETE | Supprimer fournisseur | Admin+ |
| `/api/debts` | GET | Liste dettes | Authentifié |
| `/api/debts` | POST | Créer dette | Authentifié |
| `/api/debts/:id/payments` | POST | Règlement dette | Authentifié |

### 8.5 Utilisateurs

| Endpoint | Méthode | Description | Accès |
|----------|---------|-------------|-------|
| `/api/users` | GET | Liste utilisateurs | Admin+ |
| `/api/users` | POST | Créer utilisateur | Admin+ |
| `/api/users/:id` | GET | Détails utilisateur | Admin+ |
| `/api/users/:id` | PATCH | Modifier utilisateur | Admin+ |
| `/api/users/:id` | DELETE | Supprimer utilisateur | Owner+ |

---

## 9. Sécurité

### 9.1 Authentification
- **JWT HS256** avec secret configuré via variables d'environnement.
- **Expiration** : 7 jours (access token), 30 jours (refresh token).
- **PIN hashé** : Argon2id ou bcrypt (12 rounds).
- **Password hashé** : bcrypt (12 rounds).

### 9.2 Autorisation
- **Guards NestJS** pour vérification de rôle sur chaque route.
- **Decorator personnalisé** `@Roles()` pour définir les rôles autorisés.
- **Middleware frontend** : ProtectedRoute vérifie rôle avant affichage.

### 9.3 Validation
- **class-validator** sur tous les DTOs backend.
- **Validation conditionnelle** pour champs "Divers" (commentaire obligatoire).
- **Validation frontend** avant envoi des requêtes.

### 9.4 Protection des données
- Variables d'environnement pour secrets (JWT_SECRET, DATABASE_URL).
- Pas de stockage de mots de passe en clair.
- Tokens stockés de manière sécurisée (AsyncStorage/localStorage).

---

## 10. UX / UI & Charte Graphique

### 10.1 Identité visuelle

**Nom** : SWALO
**Logo** : Disponible en SVG dans `apps/mobile/assets/logo.svg`
**Slogan** : "Gérez votre commerce en toute simplicité"

**Palette actuelle** :
- **Primaire** : #667eea (Violet/Bleu)
- **Secondaire** : #764ba2 (Violet foncé)
- **Succès** : #10b981 (Vert)
- **Danger** : #ef4444 (Rouge)
- **Info** : #0ea5e9 (Bleu ciel)
- **Gris** : Échelle Tailwind (gray-50 à gray-900)

**Typographie** :
- Mobile : System font (San Francisco iOS, Roboto Android)
- Web : Inter / System UI

### 10.2 Composants UI

**Mobile** :
- LinearGradient pour headers
- SafeAreaView pour zones sûres
- Modal pour formulaires
- Picker pour sélection catégories
- TextInput avec autocomplete pour recherche
- TouchableOpacity pour boutons

**Web** :
- Tailwind CSS utility-first
- Composants réutilisables (MainLayout, ProtectedRoute)
- Input avec dropdown autocomplete
- Cards pour affichage données
- Responsive design (mobile, tablet, desktop)

### 10.3 Navigation

**Mobile** :
- Tab Navigation (React Navigation)
- Stack Navigation pour détails
- Icônes : émojis natifs (🏠, 👥, 🏭, 💰, 📊)

**Web** :
- Sidebar navigation avec React Router
- Menu dropdown pour paramètres
- Breadcrumbs pour navigation hiérarchique

---

## 11. Fonctionnalités récentes (Novembre 2025)

### 11.1 Autocomplete unifié
- ✅ Remplacement des champs séparés (recherche + select) par un champ unique.
- ✅ Suggestions en temps réel (max 5 résultats).
- ✅ Recherche par nom ou prénom.
- ✅ Design cohérent mobile et web.

### 11.2 Nouvelles catégories de caisse
- ✅ Catégories définies dans `@swalo/core` pour cohérence.
- ✅ Validation obligatoire pour "Divers" (commentaire min 5 caractères).
- ✅ Frontend et backend synchronisés.

### 11.3 Système de rapports amélioré
- ✅ Sommaire financier (créances, dettes, solde net).
- ✅ Répartition par catégorie (graphiques).
- ✅ Filtres par période (jour, semaine, mois, année).
- ✅ Historique complet des opérations.

### 11.4 Correction d'erreurs pour propriétaires
- ✅ Montants négatifs autorisés uniquement pour rôle OWNER.
- ✅ Message informatif dans l'interface.
- ✅ Permet correction d'erreurs de saisie.

### 11.5 Logo et splash screen
- ✅ Logo SVG créé avec identité visuelle.
- ✅ Configuration splash screen Expo.
- ✅ Fond violet (#667eea) cohérent avec charte.

---

## 12. Roadmap et Prochaines étapes

### Phase 2 (Q1 2026) - Gestion des stocks
- [ ] Module produits (CRUD complet).
- [ ] Suivi des mouvements de stock.
- [ ] Alertes de rupture de stock.
- [ ] Inventaire physique vs théorique.

### Phase 3 (Q2 2026) - Facturation
- [ ] Génération de factures (brouillon → validée → réglée).
- [ ] Numérotation automatique locale.
- [ ] Export PDF avec logo boutique.
- [ ] Envoi par email/WhatsApp.

### Phase 4 (Q3 2026) - Mode offline
- [ ] SQLite local (mobile) avec WatermelonDB.
- [ ] IndexedDB (web) avec RxDB.
- [ ] Synchronisation bidirectionnelle.
- [ ] Résolution de conflits.

### Phase 5 (Q4 2026) - Fonctionnalités avancées
- [ ] Multi-boutiques pour superadmin.
- [ ] Dashboard analytics avancé.
- [ ] Import/export CSV.
- [ ] Imprimante Bluetooth (tickets).
- [ ] Rappels automatiques (dettes, créances).

---

## 13. Tests et Qualité

### État actuel
- ✅ Validation manuelle des fonctionnalités.
- ✅ Tests API via curl/Postman.
- ✅ Tests d'intégration manuel (flux complets).

### À implémenter
- [ ] Tests unitaires (Jest) pour backend.
- [ ] Tests composants (React Testing Library).
- [ ] Tests E2E (Playwright/Cypress).
- [ ] CI/CD (GitHub Actions).
- [ ] Linting automatique (ESLint, Prettier).

---

## 14. Déploiement

### Environnement de développement
- **Backend** : `npm run dev` (port 3000)
- **Web** : `npm run dev` (port 5173)
- **Mobile** : `npx expo start` (port 8081)
- **Base de données** : Docker PostgreSQL (port 5432)

### Docker Compose (Actuel)
```yaml
services:
  postgres:
    image: postgres:16
    ports: [5432:5432]

  api:
    build: ./apps/api
    ports: [3000:3000]
    depends_on: [postgres]

  web:
    build: ./apps/web
    ports: [80:80]
    depends_on: [api]
```

### Production (À venir)
- **Backend** : Render / Railway / Fly.io
- **Base de données** : Supabase / Neon / Render PostgreSQL
- **Web** : Vercel / Cloudflare Pages / Netlify
- **Mobile** : Expo EAS Build + App Store / Play Store

---

## 15. Annexes

### 15.1 Variables d'environnement

**Backend (.env)** :
```env
DATABASE_URL=postgresql://user:password@localhost:5432/swalo_db
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

**Mobile (app.config.ts)** :
```typescript
extra: {
  apiUrl: process.env.API_URL || 'http://localhost:3000'
}
```

**Web (.env)** :
```env
VITE_API_URL=http://localhost:3000
```

### 15.2 Commandes utiles

**Installation** :
```bash
pnpm install
```

**Développement** :
```bash
# Backend
cd apps/api && npm run dev

# Web
cd apps/web && npm run dev

# Mobile
cd apps/mobile && npx expo start

# Docker (tous services)
docker-compose up -d
```

**Base de données** :
```bash
# Migrations
npx prisma migrate dev

# Seed
npm run prisma:seed

# Studio
npx prisma studio
```

**Build** :
```bash
# Backend
cd apps/api && npm run build

# Web
cd apps/web && npm run build

# Mobile
cd apps/mobile && eas build
```

---

## 16. Glossaire

- **CRUD** : Create, Read, Update, Delete
- **DTO** : Data Transfer Object
- **EAS** : Expo Application Services
- **JWT** : JSON Web Token
- **ORM** : Object-Relational Mapping
- **PIN** : Personal Identification Number
- **RBAC** : Role-Based Access Control
- **REST** : Representational State Transfer
- **UX** : User Experience
- **UI** : User Interface

---

**Fin du document**
*Dernière mise à jour : Novembre 2025*
