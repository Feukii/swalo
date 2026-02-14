# Identifiants de test SWALO

## Boutiques disponibles

| Code Boutique | Nom | Entreprise | Seed |
| ------------- | --- | ---------- | ---- |
| `011225` | SWALO Boutique 01 | ENT-SWALO | `seed.ts` |
| `251225` | SWALO Boutique 02 | ENT-SWALO | `seed.ts` |
| `010126` | Boutique Test 010126 | - | `seed-test-shop.ts` |
| `042026` | Boutique 042026 | - | `seed-shops-042026-122026.ts` |
| `122026` | Boutique 122026 | - | `seed-shops-042026-122026.ts` |

---

## Connexion Mobile (Code Boutique + PIN)

### Boutique 011225 / 251225 (seed principal)

| Role | Code PIN | Utilisateur |
| ------------ | -------- | ------------------- |
| **BOSS** | `0000` | Proprietaire Test |
| **MANAGER** | `9999` | Admin Test |
| **MANAGER** | `2222` | Manager Test |
| **EMPLOYEE** | `1234` | Employe Test |

### Boutique 010126 (seed test-shop)

| Role | Code PIN | Utilisateur |
| --------- | -------- | -------------------- |
| **OWNER** | `0126` | Test Owner 010126 |

### Boutique 042026 (seed shops-042026-122026)

| Role | Code PIN | Utilisateur |
| --------- | -------- | -------------- |
| **OWNER** | `0426` | Owner 042026 |

### Boutique 122026 (seed shops-042026-122026)

| Role | Code PIN | Utilisateur |
| --------- | -------- | -------------- |
| **OWNER** | `1226` | Owner 122026 |

---

## Connexion Web (Email / Mot de passe)

| Compte | Email | Mot de passe | Role | Boutique |
| --------------- | ----------------------- | -------------- | ---------- | ------------ |
| Proprietaire | `owner@swalo.com` | `password123` | BOSS | 011225 + 251225 |
| Test 010126 | `test010126@swalo.com` | `test123` | OWNER | 010126 |
| Owner 042026 | `shop042026@swalo.com` | `swalo2026` | OWNER | 042026 |
| Owner 122026 | `shop122026@swalo.com` | `swalo2026` | OWNER | 122026 |

---

## Connexion Web Admin (Plateforme d'administration)

URL : `http://localhost:3004` (dev) ou domaine de production

| Compte | Email | Mot de passe |
| --------------- | ------------------------- | ---------------- |
| **Super Admin** | `superadmin@swalo.com` | `superadmin123` |

Le SUPERADMIN a acces a toutes les boutiques et bypass les guards BlockStatus et Entitlement.

---

## Permissions par role

### BOSS / OWNER (0000, 0126, 0426, 1226)

- Toutes les permissions
- Corrections avec montants negatifs
- Gestion utilisateurs
- Administration boutique
- Bilans et rapports

### MANAGER (9999, 2222)

- Gestion caisse
- Gestion clients/fournisseurs
- Bilans et rapports
- Administration (role 9999 = MANAGER)
- Pas de corrections negatives

### EMPLOYEE (1234)

- Gestion caisse
- Consultation clients/fournisseurs
- Pas de bilans et rapports
- Pas d'administration
- Pas de corrections negatives

### SUPERADMIN (web-admin uniquement)

- Acces total a toutes les boutiques
- Bypass BlockStatusGuard et EntitlementGuard
- Gestion des entreprises et licences

---

## Donnees de test par boutique

### Boutique 011225 (seed principal)

- 3 produits (Coque iPhone 13, Chargeur USB-C, Ecouteurs Bluetooth)
- Conditionnements par defaut (Piece, Carton, Douzaine, etc.)

### Boutique 010126 (seed test-shop)

- 11 produits avec prix et stock initial
- 5 clients (Diallo, Sow, Ndiaye, Fall, Ba)
- 3 fournisseurs (Tech Import, Africa Electronics, Mobile Accessoires)
- 9 entrees de caisse (105 000 FCFA entrees, 130 000 FCFA sorties)
- 3 creances clients (1 partiellement payee)
- 2 dettes fournisseurs (1 partiellement payee)

### Boutiques 042026 / 122026 (seed shops)

- 27 produits chacune (glasses, chargeurs, kit bluetooth, cartes memoires)
- Prix a 0 (a definir)

---

## Commandes seed

```bash
# Seed principal (boutiques 011225, 251225 + superadmin)
cd apps/api && pnpm prisma:seed

# Boutique de test 010126 (donnees completes)
cd apps/api && npx ts-node prisma/seed-test-shop.ts

# Boutiques 042026 et 122026 (avec produits)
cd apps/api && npx ts-node prisma/seed-shops-042026-122026.ts
```

## Validite des codes PIN

Les codes PIN sont valides pour **1 an** a partir de la date du seed.
