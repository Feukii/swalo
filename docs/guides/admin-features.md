# SWALO - Fonctionnalités d'Administration

Ce document décrit toutes les fonctionnalités d'administration implémentées dans SWALO, y compris la gestion des utilisateurs, le contrôle des appareils, et les horaires de travail.

## Table des Matières

- [Architecture](#architecture)
- [Rôles et Permissions](#rôles-et-permissions)
- [Gestion des Appareils](#gestion-des-appareils)
- [Horaires de Travail](#horaires-de-travail)
- [Endpoints API](#endpoints-api)
- [Interface Web](#interface-web)
- [Application Mobile](#application-mobile)
- [Synchronisation Supabase](#synchronisation-supabase)

## Demarrage rapide (admin panel local)

Prerequis:

- Node.js + pnpm
- PostgreSQL local ou Neon
- Docker (optionnel)

Etapes:

```bash
pnpm install
```

```bash
cd apps/api
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
pnpm run start:dev
```

```bash
cd apps/web
pnpm run dev
```

Acces:

- API: http://localhost:3000
- Web: http://localhost:5173

Connexion superadmin:

- URL: http://localhost:5173/login/admin
- Creer un superadmin via Prisma Studio ou script si besoin.

## Architecture

### Composants Backend

```
apps/api/src/modules/
├── admin/
│   ├── admin.module.ts          # Module NestJS
│   ├── admin.controller.ts      # Endpoints REST API
│   └── admin.service.ts         # Logique métier
├── auth/
│   ├── roles.decorator.ts       # Décorateur @Roles()
│   ├── roles.guard.ts           # Garde d'accès basée sur les rôles
│   └── auth.service.ts          # Authentification + validation des appareils
└── ...
```

### Schéma de Base de Données

#### Table `user_devices`

Nouvelle table pour suivre les appareils utilisés par les employés.

```prisma
model UserDevice {
  id            String    @id @default(uuid())
  user_id       String
  shop_id       String
  device_id     String    @db.VarChar(255) // ID unique de l'appareil
  device_name   String?   @db.VarChar(255) // Nom lisible (ex: "iPhone 12")
  device_type   String?   @db.VarChar(50)  // "mobile", "web", "tablet"
  last_login_at DateTime?
  is_active     Boolean   @default(true)   // Peut être révoqué par admin
  revoked_at    DateTime?
  revoked_by    String?   // ID de l'admin qui a révoqué
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt

  @@unique([user_id, shop_id, device_id])
  @@index([user_id, shop_id])
  @@map("user_devices")
}
```

#### Extensions de `user_roles`

Ajout de champs pour gérer les horaires de travail.

```prisma
model UserRole {
  // ... champs existants
  work_start_time   String?   @db.VarChar(5)  // Format "HH:mm" (ex: "07:00")
  work_end_time     String?   @db.VarChar(5)  // Format "HH:mm" (ex: "20:00")
  work_days         String?                   // JSON: ["MON","TUE",...,"SAT"]
}
```

## Rôles et Permissions

### Hiérarchie des Rôles

```
SUPERADMIN (Niveau le plus élevé)
    ↓
ADMIN / OWNER / MANAGER (Administrateurs de boutique)
    ↓
EMPLOYEE / CASHIER (Employés)
```

### Permissions par Rôle

| Fonctionnalité                   | SUPERADMIN | ADMIN/OWNER/MANAGER  | EMPLOYEE/CASHIER |
| -------------------------------- | ---------- | -------------------- | ---------------- |
| Voir toutes les boutiques        | ✅         | ❌                   | ❌               |
| Voir statistiques système        | ✅         | ❌                   | ❌               |
| Voir utilisateurs de sa boutique | ✅         | ✅                   | ❌               |
| Gérer les rôles d'utilisateurs   | ✅         | ✅ (sauf SUPERADMIN) | ❌               |
| Voir/révoquer appareils          | ✅         | ✅ (sa boutique)     | ❌               |
| Configurer horaires de travail   | ✅         | ✅                   | ❌               |
| Désactiver utilisateurs          | ✅         | ✅                   | ❌               |
| Opérations quotidiennes (caisse) | ✅         | ✅                   | ✅               |
| Voir rapports agrégés            | ✅         | ✅                   | ❌               |

### Implémentation du Contrôle d'Accès

**Décorateur `@Roles()`** - `auth/roles.decorator.ts`

```typescript
@Roles(Role.ADMIN, Role.SUPERADMIN)
async getShopUsers(@Request() req: any) {
  // ...
}
```

**Garde `RolesGuard`** - `auth/roles.guard.ts`

- Vérifie que l'utilisateur a l'un des rôles requis
- SUPERADMIN a accès à tout
- Mapping automatique des rôles (OWNER → ADMIN, CASHIER → EMPLOYEE)

## Gestion des Appareils

### Fonctionnalités

#### 1. Liaison Appareil-Utilisateur (Device Binding)

**Pour les employés (EMPLOYEE):**

- Un code PIN ne peut être utilisé que sur **un seul appareil** à la fois
- Premier login : l'appareil est automatiquement enregistré
- Tentative de connexion depuis un autre appareil : **REFUSÉE**
- Message d'erreur: "Ce code PIN est déjà utilisé sur un autre appareil"

**Pour les admins/propriétaires:**

- Peuvent se connecter depuis plusieurs appareils
- Pas de restriction de liaison d'appareil

#### 2. Identification d'Appareil

**Web (React):**

```typescript
// Génération ou récupération de l'ID d'appareil
let deviceId = localStorage.getItem('device_id');
if (!deviceId) {
  deviceId = crypto.randomUUID();
  localStorage.setItem('device_id', deviceId);
}
```

**Mobile (React Native + Expo):**

```typescript
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

// ID stocké de manière sécurisée
let deviceId = await SecureStore.getItemAsync('device_id');
if (!deviceId) {
  deviceId = generateUUID();
  await SecureStore.setItemAsync('device_id', deviceId);
}

// Informations d'appareil
const deviceInfo = {
  device_id: deviceId,
  device_name: `${Device.modelName} ${Device.osName} ${Device.osVersion}`,
  device_type: Device.deviceType === Device.DeviceType.TABLET ? 'tablet' : 'mobile',
};
```

#### 3. Gestion par les Admins

Les admins peuvent:

- **Voir tous les appareils** d'un utilisateur
- **Voir le statut** (actif/révoqué)
- **Voir la dernière connexion** de chaque appareil
- **Révoquer l'accès** d'un appareil spécifique
- **Révoquer tous les appareils** d'un utilisateur (sauf l'appareil actuel)

### Flux d'Authentification avec Appareil

```
1. Utilisateur entre son code PIN
   ↓
2. API reçoit: {pin_code, device_id, device_name, device_type}
   ↓
3. Validation du code PIN
   ↓
4. Si EMPLOYEE:
   - Vérifier si appareil enregistré
   - Si OUI et actif → Connexion OK
   - Si OUI et révoqué → REFUSÉ
   - Si NON → Vérifier si d'autres appareils actifs
     - Si OUI → REFUSÉ (un seul appareil permis)
     - Si NON → Enregistrer nouvel appareil + Connexion OK
   ↓
5. Retourner JWT token
```

## Horaires de Travail

### Configuration

**Format des horaires:**

```typescript
{
  work_start_time: "08:00",  // HH:mm (24h)
  work_end_time: "18:00",    // HH:mm (24h)
  work_days: '["MON","TUE","WED","THU","FRI","SAT"]'  // JSON array
}
```

**Jours disponibles:**

- MON (Lundi)
- TUE (Mardi)
- WED (Mercredi)
- THU (Jeudi)
- FRI (Vendredi)
- SAT (Samedi)
- SUN (Dimanche)

### Validation à la Connexion

Lors de l'authentification avec PIN, le système vérifie:

1. **Jour de la semaine**
   - Si le jour actuel n'est pas dans `work_days` → REFUSÉ
   - Message: "Accès refusé : hors jour de travail"

2. **Heure de la journée**
   - Si heure actuelle < `work_start_time` → REFUSÉ
   - Si heure actuelle > `work_end_time` → REFUSÉ
   - Message: "Accès refusé : hors horaires de travail"

### Exemple de Configuration

**Horaire standard (Lun-Sam, 7h-20h):**

```json
{
  "work_start_time": "07:00",
  "work_end_time": "20:00",
  "work_days": "[\"MON\",\"TUE\",\"WED\",\"THU\",\"FRI\",\"SAT\"]"
}
```

**Horaire à temps partiel (Mar-Jeu, 14h-22h):**

```json
{
  "work_start_time": "14:00",
  "work_end_time": "22:00",
  "work_days": "[\"TUE\",\"WED\",\"THU\"]"
}
```

## Endpoints API

### Super Admin (SUPERADMIN uniquement)

#### `GET /admin/shops`

Liste toutes les boutiques du système.

**Réponse:**

```json
[
  {
    "id": "uuid",
    "name": "Boutique ABC",
    "code": "ABC123",
    "owner": {
      "id": "uuid",
      "display_name": "Jean Dupont",
      "email": "jean@example.com",
      "phone": "+243999999999"
    },
    "_count": {
      "user_roles": 5,
      "products": 120,
      "sales": 450,
      "customers": 80,
      "suppliers": 12
    },
    "created_at": "2025-01-15T10:00:00Z"
  }
]
```

#### `GET /admin/shops/:shopId`

Détails d'une boutique avec tous ses utilisateurs.

#### `GET /admin/stats/system`

Statistiques globales du système.

**Réponse:**

```json
{
  "totalShops": 15,
  "totalUsers": 87,
  "activeShops": 14,
  "totalSales": 5420,
  "totalProducts": 3240
}
```

### Admin/Owner/Manager

#### `GET /admin/users`

Liste tous les utilisateurs de la boutique.

**Réponse:**

```json
[
  {
    "role": "EMPLOYEE",
    "work_start_time": "08:00",
    "work_end_time": "18:00",
    "work_days": "[\"MON\",\"TUE\",\"WED\",\"THU\",\"FRI\"]",
    "user": {
      "id": "uuid",
      "display_name": "Marie Martin",
      "email": "marie@example.com",
      "phone": "+243888888888",
      "pin_code": "1234",
      "is_active": true,
      "devices": [
        {
          "id": "uuid",
          "device_id": "abc-123-def",
          "device_name": "Samsung Galaxy S21",
          "device_type": "mobile",
          "last_login_at": "2025-01-20T14:30:00Z",
          "is_active": true,
          "created_at": "2025-01-15T09:00:00Z"
        }
      ]
    }
  }
]
```

#### `GET /admin/users/:userId/devices`

Liste tous les appareils d'un utilisateur.

#### `DELETE /admin/devices/:deviceId`

Révoque l'accès d'un appareil spécifique.

**Réponse:**

```json
{
  "id": "uuid",
  "is_active": false,
  "revoked_at": "2025-01-20T15:00:00Z",
  "revoked_by": "admin_user_id"
}
```

#### `POST /admin/users/:userId/revoke-devices`

Révoque tous les appareils d'un utilisateur sauf celui spécifié.

**Body:**

```json
{
  "currentDeviceId": "device-to-keep"
}
```

#### `PUT /admin/users/:userId/role`

Met à jour le rôle et/ou les horaires de travail.

**Body:**

```json
{
  "role": "MANAGER",
  "work_start_time": "09:00",
  "work_end_time": "17:00",
  "work_days": "[\"MON\",\"TUE\",\"WED\",\"THU\",\"FRI\"]"
}
```

**Restrictions:**

- Seuls les SUPERADMIN peuvent créer/modifier des SUPERADMIN
- Les admins ne peuvent pas modifier leur propre rôle

#### `DELETE /admin/users/:userId`

Désactive l'accès d'un utilisateur à la boutique.

**Actions:**

- Révoque tous les appareils de l'utilisateur
- Marque le user_role comme supprimé (soft delete)
- L'utilisateur ne peut plus se connecter à cette boutique

**Restrictions:**

- Un utilisateur ne peut pas se désactiver lui-même

## Interface Web

### Pages Créées

#### 1. Super Admin Dashboard

**Route:** `/admin/dashboard`
**Accès:** SUPERADMIN uniquement

**Fonctionnalités:**

- Statistiques système (boutiques, utilisateurs, ventes, produits)
- Liste de toutes les boutiques
- Informations des propriétaires
- Compteurs par boutique

**Fichier:** `apps/web/src/pages/SuperAdminDashboard.tsx`

#### 2. Gestion des Utilisateurs

**Route:** `/admin/users`
**Accès:** ADMIN, OWNER, MANAGER, SUPERADMIN

**Fonctionnalités:**

- Liste des utilisateurs de la boutique
- Badge de rôle coloré par utilisateur
- Nombre d'appareils actifs/total
- Horaires de travail affichés
- Modal de modification du rôle et des horaires
- Modal de visualisation/révocation des appareils
- Sélecteur de jours de travail (checkboxes)
- Inputs pour les heures de début/fin

**Fichier:** `apps/web/src/pages/UserManagement.tsx`

### Navigation

Le menu de navigation affiche dynamiquement les liens admin selon le rôle:

```typescript
// SUPERADMIN voit
- 👑 Admin Dashboard (/admin/dashboard)
- 👤 Gestion Utilisateurs (/admin/users)

// ADMIN/OWNER/MANAGER voient
- 👤 Gestion Utilisateurs (/admin/users)

// EMPLOYEE ne voit aucun lien admin
```

**Fichier:** `apps/web/src/components/Layout/MainLayout.tsx`

### Protection des Routes

Routes protégées avec vérification de rôle:

```tsx
<Route
  path="/admin/dashboard"
  element={
    <ProtectedRoute requireRole="SUPERADMIN">
      <MainLayout>
        <SuperAdminDashboard />
      </MainLayout>
    </ProtectedRoute>
  }
/>
```

**Fichier:** `apps/web/src/components/ProtectedRoute.tsx`

## Application Mobile

### Écrans Créés

#### UserManagementScreen

**Navigation:** Accessible via menu admin (ADMIN, OWNER, MANAGER, SUPERADMIN)

**Fonctionnalités:**

- Liste des utilisateurs avec avatar et badges de rôle
- Affichage des horaires de travail
- Nombre d'appareils actifs/total
- Bouton pour voir les appareils
- Pull-to-refresh
- Alert dialog pour voir les détails des appareils

**Fichier:** `apps/mobile/src/screens/UserManagementScreen.tsx`

### Génération d'ID d'Appareil

**Utilitaire:** `apps/mobile/src/lib/deviceInfo.ts`

**Fonctions:**

- `getDeviceId()`: Génère ou récupère l'ID unique de l'appareil
- `getDeviceInfo()`: Retourne ID, nom et type d'appareil
- Stockage sécurisé avec `expo-secure-store`
- Persistance entre les lancements de l'app

### API Client

**Fichier:** `apps/mobile/src/lib/api.ts`

Ajout de:

- `adminApi.getShopUsers()`
- `adminApi.getUserDevices(userId)`
- `adminApi.revokeDevice(deviceId)`
- `adminApi.updateUserRole(userId, data)`
- `adminApi.deactivateUser(userId)`

## Synchronisation Supabase

### Scripts de Migration

**Dossier:** `docs/supabase/`

#### Fichiers:

1. **`01_user_devices_migration.sql`**
   - Crée la table `user_devices`
   - Ajoute les colonnes d'horaires à `user_roles`
   - Configure RLS (Row Level Security)
   - Crée les index et contraintes
   - Configure les triggers pour `updated_at`
   - Définit les permissions

2. **`README.md`**
   - Guide d'installation complet
   - Exemples de configuration
   - Tests à effectuer
   - Procédure de rollback

### Politiques RLS

**Pour `user_devices`:**

```sql
-- Les utilisateurs peuvent voir leurs propres appareils
CREATE POLICY "Users can view their own devices" ON user_devices
  FOR SELECT USING (auth.uid()::TEXT = user_id);

-- Les admins peuvent voir tous les appareils de leur boutique
CREATE POLICY "Admins can view all devices in their shop" ON user_devices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()::TEXT
        AND ur.shop_id = user_devices.shop_id
        AND ur.role IN ('ADMIN', 'OWNER', 'MANAGER')
    )
  );

-- Les admins peuvent gérer les appareils de leur boutique
CREATE POLICY "Admins can manage devices in their shop" ON user_devices
  FOR ALL USING (...) WITH CHECK (...);

-- Les superadmins ont accès complet
CREATE POLICY "Superadmins can view all devices" ON user_devices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()::TEXT
        AND ur.role = 'SUPERADMIN'
    )
  );
```

### Application de la Migration

```bash
# 1. Se connecter à Supabase Dashboard
# 2. Aller dans SQL Editor
# 3. Copier le contenu de 01_user_devices_migration.sql
# 4. Exécuter le script
# 5. Vérifier les résultats avec les requêtes de vérification incluses
```

## Tests

### Test de Liaison d'Appareil

```bash
# 1. Premier login (appareil 1) - devrait réussir
curl -X POST http://localhost:3000/api/auth/pin \
  -H "Content-Type: application/json" \
  -d '{
    "pin_code": "1234",
    "device_id": "device-1",
    "device_name": "iPhone 12",
    "device_type": "mobile"
  }'

# 2. Login depuis un autre appareil - devrait échouer
curl -X POST http://localhost:3000/api/auth/pin \
  -H "Content-Type: application/json" \
  -d '{
    "pin_code": "1234",
    "device_id": "device-2",
    "device_name": "Android Phone",
    "device_type": "mobile"
  }'
# Erreur attendue: "Ce code PIN est déjà utilisé sur un autre appareil"
```

### Test d'Horaires de Travail

```bash
# 1. Configurer horaires (admin)
curl -X PUT http://localhost:3000/api/admin/users/{userId}/role \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "work_start_time": "08:00",
    "work_end_time": "17:00",
    "work_days": "[\"MON\",\"TUE\",\"WED\",\"THU\",\"FRI\"]"
  }'

# 2. Tenter connexion hors horaires - devrait échouer
# (tester un samedi ou en dehors de 8h-17h)
```

### Test de Révocation d'Appareil

```bash
# 1. Voir les appareils
curl -X GET http://localhost:3000/api/admin/users/{userId}/devices \
  -H "Authorization: Bearer {admin_token}"

# 2. Révoquer un appareil
curl -X DELETE http://localhost:3000/api/admin/devices/{deviceId} \
  -H "Authorization: Bearer {admin_token}"

# 3. Tenter connexion avec appareil révoqué - devrait échouer
curl -X POST http://localhost:3000/api/auth/pin \
  -H "Content-Type: application/json" \
  -d '{
    "pin_code": "1234",
    "device_id": "device-revoque",
    ...
  }'
# Erreur attendue: "Cet appareil a été révoqué"
```

## Configuration Environnement

### Variables d'Environnement

```env
# API
DATABASE_URL="postgresql://user:password@localhost:5432/swalo_db"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="24h"

# Supabase (optionnel)
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
```

## Résumé des Fichiers Modifiés/Créés

### Backend (API)

- ✅ `apps/api/prisma/schema.prisma` - Ajout UserDevice et colonnes horaires
- ✅ `apps/api/prisma/migrations/20251029000000_add_user_devices_and_work_schedule/migration.sql`
- ✅ `apps/api/src/modules/admin/admin.module.ts` - Nouveau
- ✅ `apps/api/src/modules/admin/admin.controller.ts` - Nouveau
- ✅ `apps/api/src/modules/admin/admin.service.ts` - Nouveau
- ✅ `apps/api/src/modules/auth/roles.decorator.ts` - Nouveau
- ✅ `apps/api/src/modules/auth/roles.guard.ts` - Nouveau
- ✅ `apps/api/src/modules/auth/auth.service.ts` - Modifié (device binding + horaires)
- ✅ `apps/api/src/modules/auth/dto/auth.dto.ts` - Modifié (device fields)

### Frontend Web

- ✅ `apps/web/src/App.tsx` - Ajout routes admin
- ✅ `apps/web/src/components/ProtectedRoute.tsx` - Ajout support rôles
- ✅ `apps/web/src/components/Layout/MainLayout.tsx` - Menu dynamique
- ✅ `apps/web/src/lib/api.ts` - Ajout adminApi + device_id
- ✅ `apps/web/src/pages/UserManagement.tsx` - Nouveau
- ✅ `apps/web/src/pages/SuperAdminDashboard.tsx` - Nouveau
- ✅ `apps/web/src/store/authStore.ts` - Pas modifié (déjà OK)

### Application Mobile

- ✅ `apps/mobile/App.tsx` - Ajout UserManagementScreen
- ✅ `apps/mobile/src/lib/deviceInfo.ts` - Nouveau
- ✅ `apps/mobile/src/lib/api.ts` - Ajout adminApi + device_id
- ✅ `apps/mobile/src/screens/UserManagementScreen.tsx` - Nouveau

### Documentation

- ✅ `docs/supabase/01_user_devices_migration.sql` - Nouveau
- ✅ `docs/supabase/README.md` - Nouveau
- ✅ `docs/ADMIN_FEATURES.md` - Ce document

## Prochaines Étapes

1. **Tester toutes les fonctionnalités**
   - Device binding pour employés
   - Horaires de travail
   - Gestion des appareils par admin
   - Modification des rôles

2. **Déployer sur Supabase**
   - Appliquer les migrations SQL
   - Vérifier les RLS policies
   - Tester avec database cloud

3. **Améliorer l'UX mobile**
   - Ajouter navigation vers UserManagement depuis menu
   - Implémenter édition des horaires sur mobile
   - Ajouter gestion des rôles sur mobile

4. **Monitoring et Logs**
   - Logger les révocations d'appareils
   - Logger les modifications de rôles
   - Alertes pour tentatives de connexion bloquées

5. **Documentation utilisateur**
   - Guide pour les propriétaires de boutique
   - Guide pour les employés
   - FAQ sur la gestion des appareils

## Support

Pour toute question ou problème:

1. Vérifier les logs de l'API
2. Vérifier que les migrations sont appliquées
3. Vérifier les permissions RLS sur Supabase
4. Consulter ce document pour la référence complète
