# Comptes & Environnements (Dev / Prod)

> Source de vérité pour la **stratégie de comptes** et la **séparation des environnements**.
> Mise en place : tout est **recréé à neuf** sur un nouveau compte. Deux environnements
> (**dev** et **prod**) cohabitent, totalement séparés.

---

## 1. Stratégie de comptes (adresses email)

Deux adresses Gmail, deux rôles **distincts** — ne pas les mélanger :

| Adresse | Usage | Détails |
| --- | --- | --- |
| **arielfeukii@gmail.com** | **Tous les comptes de services tiers** | Compte propriétaire/maître pour : GitHub, **Render**, **Neon**, **Vercel** (web + web‑admin), **Expo / EAS**, et tout autre service d'infra. Un seul compte par service, créé avec cette adresse. |
| **swalo.sarl@gmail.com** | **Système de notification par email (SMTP)** uniquement | Adresse expéditrice des emails applicatifs (relances, mouvements de dette). Utilise un **mot de passe d'application Gmail** (validation en 2 étapes requise). Voir `apps/api/.env` (`SMTP_*`) et la note mémoire `email-smtp-config`. |

**Règles :**
- `swalo.sarl@gmail.com` ne sert **pas** à créer des comptes de services tiers.
- `arielfeukii@gmail.com` ne sert **pas** à l'envoi d'emails applicatifs.
- Activer la **2FA** sur les deux comptes Gmail.

---

## 2. Deux environnements qui cohabitent

Mapping branche → environnement (inchangé) :

| | **DEV** | **PROD** |
| --- | --- | --- |
| Branche Git | `develop` | `main` (protégée) |
| Workflow CI | `.github/workflows/deploy-staging.yml` | `.github/workflows/deploy.yml` |
| Base de données | Neon — branche `dev` | Neon — branche `main` |
| API (Render) | service **dev** dédié | service **prod** dédié |
| Web (Vercel) | déploiement **dev** | déploiement **prod** |
| Web‑admin (Vercel) | déploiement **dev** | déploiement **prod** |
| Mobile (EAS) | profil `preview` / `development` → API dev | profil `production` → API prod |
| Données | données de test OK | **vierge** au départ, pas de seed de test |

> Le **local** (PC + branche Neon `dev`) reste l'environnement de développement quotidien ;
> l'**API dev cloud** sert à tester comme en prod sans toucher à la prod.

---

## 3. Matrice détaillée par service

### Neon (PostgreSQL)
- **1 projet** `swalo` (compte arielfeukii), **2 branches** : `main` (prod) et `dev`.
- Toujours utiliser la **pooled connection string** pour l'app ; la **directe** seulement pour les migrations.
- JWT secrets **différents** entre dev et prod.

### Render (API NestJS)
- **2 services** Web Service Node :
  - `swalo-api-dev`  → branche `develop`, `DATABASE_URL` = Neon `dev`.
  - `swalo-api-prod` → branche `main`,    `DATABASE_URL` = Neon `main`.
- Build : `pnpm install && pnpm --filter @swalo/api build` · Start : `node apps/api/dist/main.js` (cf. `render.yaml`).
- Variables d'env dans le **dashboard Render** (jamais dans git).

### Vercel (Web client + Web‑admin)
- 2 projets : `swalo-web` et `swalo-web-admin` (ou un projet avec déploiements prod/preview).
- `VITE_API_URL` pointe vers l'API **dev** (déploiements develop/preview) ou **prod** (production).

### Expo / EAS (Mobile)
- `apps/mobile/eas.json` : profils
  - `development` / `preview` → `EXPO_PUBLIC_API_URL` = API **dev**.
  - `production` → `EXPO_PUBLIC_API_URL` = API **prod**.
- Local (Expo Go) : `apps/mobile/.env.development` → `EXPO_PUBLIC_API_URL=http://<IP_LAN>:3000/api`.

### SMTP (notifications)
- Compte `swalo.sarl@gmail.com` + mot de passe d'application.
- Mêmes variables `SMTP_*` à définir sur **chaque** API (dev et prod) — voir §4.

---

## 4. Variables d'environnement par environnement

> Aucune URL/secret en dur dans le code : tout via env (Render/Vercel) ou variables/secrets GitHub Actions.

**API (Render env / `.env` local)**
```
NODE_ENV=production|development
DATABASE_URL=<Neon pooled, par environnement>
JWT_SECRET=<unique par env>
JWT_REFRESH_SECRET=<unique par env>
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
ALLOWED_ORIGINS=<origines web/web-admin de l'env, séparées par des virgules>
# SMTP (notifications) — compte swalo.sarl@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=swalo.sarl@gmail.com
SMTP_PASS=<mot de passe d'application Gmail>
SMTP_FROM="Swalo" <swalo.sarl@gmail.com>
```

**Web / Web‑admin (Vercel env)** : `VITE_API_URL=<URL API de l'env>`

**Mobile** : `EXPO_PUBLIC_API_URL` (via profils EAS / `.env.development`)

**GitHub Actions** : utiliser des *Environments* GitHub (`dev`, `prod`) avec leurs **secrets** (DATABASE_URL, JWT_*, tokens Render/Vercel/EAS) et **variables** (`DEV_API_URL`, `PROD_API_URL`, etc.). Objectif : les workflows ne contiennent **aucune** URL en dur.

---

## 5. Conventions de nommage (proposées)

| Ressource | Dev | Prod |
| --- | --- | --- |
| Render | `swalo-api-dev` | `swalo-api-prod` |
| API URL | `https://swalo-api-dev.onrender.com/api` | `https://swalo-api-prod.onrender.com/api` (ou domaine custom) |
| Vercel web | `swalo-web` (preview) | `swalo-web` (prod) |
| Vercel web‑admin | `swalo-web-admin` (preview) | `swalo-web-admin` (prod) |
| Neon | projet `swalo`, branche `dev` | projet `swalo`, branche `main` |
| EAS profil | `preview` | `production` |

---

## 6. Checklist de création (ordre conseillé)

1. **Gmail** : confirmer les 2 comptes (arielfeukii, swalo.sarl) + 2FA ; générer le **mot de passe d'application** sur swalo.sarl.
2. **GitHub** (arielfeukii) : repo + 2 *Environments* (`dev`, `prod`) avec secrets/variables.
3. **Neon** (arielfeukii) : projet `swalo` → branches `main` + `dev` ; récupérer les pooled URLs.
4. **Render** (arielfeukii) : créer `swalo-api-dev` (branche develop) et `swalo-api-prod` (branche main) ; renseigner les env (dont `SMTP_*`).
5. **Vercel** (arielfeukii) : importer `apps/web` et `apps/web-admin` ; définir `VITE_API_URL` par env.
6. **EAS** (arielfeukii) : `eas login` ; configurer les profils dev/prod.
7. **Migrations** : `prisma migrate deploy` sur **chaque** base (dev puis prod).
8. **Health checks** : `/api/health` dev + prod ; web/web‑admin accessibles.
9. **Brancher les workflows** sur les bons services (variables GitHub), supprimer toute URL en dur.

---

## 7. Où vivent les secrets

- **Jamais dans git** (`apps/api/.env` est gitignored).
- **Render** : dashboard → Environment.
- **Vercel** : project → Settings → Environment Variables.
- **GitHub Actions** : Settings → Environments → secrets/variables.
- **EAS** : `eas secret` / profil.

---

## 8. À faire côté repo (quand les ressources existent)

- Rendre `eas.json`, `deploy.yml`, `deploy-staging.yml`, `render.yaml`, `vercel.json` **agnostiques** : remplacer les `swalo-api.onrender.com` en dur par des variables GitHub (`DEV_API_URL` / `PROD_API_URL`).
- Ajouter `apps/web/.env.example` et `apps/web-admin/.env.example`.
- Mettre `docs/deployment/environments.md` à jour (il décrit l'ancien setup mono‑API).

> Voir aussi : `docs/deployment/environments.md`, `docs/deployment/guide.md`, note mémoire `email-smtp-config`.
</content>
