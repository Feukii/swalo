# Guide de Déploiement SWALO

Ce document décrit l'architecture de déploiement complète de SWALO, un mini-ERP pour boutiques de téléphonie en Afrique Centrale.

## Architecture de Déploiement

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SWALO - ARCHITECTURE DE DÉPLOIEMENT                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  GitHub Repository                                                       │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐   │
│  │    main     │────▶│   GitHub    │────▶│      PRODUCTION         │   │
│  │   branch    │     │   Actions   │     │                         │   │
│  └─────────────┘     └──────┬──────┘     │  ┌─────────────────┐    │   │
│                             │            │  │   Render (API)  │    │   │
│  ┌─────────────┐            │            │  │   Free Tier     │    │   │
│  │   develop   │────────────┤            │  └────────┬────────┘    │   │
│  │   branch    │            │            │           │             │   │
│  └─────────────┘            │            │  ┌────────▼────────┐    │   │
│                             │            │  │   Neon (DB)     │    │   │
│                      ┌──────▼──────┐     │  │   main branch   │    │   │
│                      │   Vercel    │     │  └─────────────────┘    │   │
│                      │   (Web)     │     │                         │   │
│                      └─────────────┘     │  ┌─────────────────┐    │   │
│                                          │  │   Expo EAS      │    │   │
│                                          │  │   (Mobile)      │    │   │
│                                          │  └─────────────────┘    │   │
│                                          └─────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         MONITORING                               │    │
│  │  - Keep-alive cron (14min) : 6h-22h UTC+1                       │    │
│  │  - UptimeRobot : Surveillance externe (5min)                    │    │
│  │  - Health checks : /api/health                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Stack Technique

| Composant           | Plateforme      | Plan  | Limite Gratuite      |
| ------------------- | --------------- | ----- | -------------------- |
| **API Backend**     | Render          | Free  | 750h/mois            |
| **Base de données** | Neon PostgreSQL | Free  | 0.5GB, 100 CU-h/mois |
| **Web Dashboard**   | Vercel          | Hobby | 100GB bandwidth/mois |
| **Mobile App**      | Expo EAS        | Free  | Builds limités       |
| **CI/CD**           | GitHub Actions  | Free  | 2000 min/mois        |

## Environnements

### Production

- **Branche Git** : `main`
- **API URL** : `https://swalo-api-prod.onrender.com`
- **Web URL** : `https://swalo-web.vercel.app` (ou domaine personnalisé)
- **Database** : Neon branche `main`

### Staging (Optionnel)

- **Branche Git** : `develop`
- **API URL** : `https://swalo-api-staging.onrender.com` (si configuré)
- **Web URL** : Preview deployments Vercel
- **Database** : Neon branche `dev`

---

## Configuration Initiale

### 1. Neon (Base de données)

1. Créer un compte sur [console.neon.tech](https://console.neon.tech)
2. Créer un nouveau projet "swalo-production"
3. Noter la **Pooled connection string** :
   ```
   postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```
4. (Optionnel) Créer une branche `dev` pour le staging :
   - Aller dans "Branches" > "Create branch"
   - Nommer "dev", basée sur "main"
   - Cette branche aura sa propre connection string

### 2. Render (API Backend)

1. Créer un compte sur [render.com](https://render.com)
2. Connecter le repository GitHub
3. Créer un "Blueprint" depuis `render.yaml`
4. Configurer les variables d'environnement dans le Dashboard :
   - `DATABASE_URL` : Connection string Neon (pooled)
   - `JWT_SECRET` : Générer avec `openssl rand -base64 32`
   - `JWT_REFRESH_SECRET` : Générer avec `openssl rand -base64 32`

5. Récupérer le **Deploy Hook** pour GitHub Actions :
   - Settings > Deploy Hook > Copy URL
   - Ajouter comme secret GitHub : `RENDER_DEPLOY_HOOK`

### 3. Vercel (Web Dashboard)

1. Créer un compte sur [vercel.com](https://vercel.com)
2. Importer le repository GitHub
3. Configurer le projet :
   - **Framework** : Vite
   - **Root Directory** : `.` (racine)
   - **Build Command** : `pnpm turbo build --filter=@swalo/web`
   - **Output Directory** : `apps/web/dist`

4. Variables d'environnement :
   - `VITE_API_URL` : `https://swalo-api-prod.onrender.com/api`

5. Récupérer les secrets pour GitHub Actions :
   - Settings > Tokens > Create
   - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

### 4. Expo EAS (Mobile)

1. Créer un compte sur [expo.dev](https://expo.dev)
2. Installer EAS CLI : `npm install -g eas-cli`
3. Login : `eas login`
4. Configurer le projet :
   ```bash
   cd apps/mobile
   eas build:configure
   ```
5. Récupérer le token pour GitHub Actions :
   - Account Settings > Access Tokens > Create
   - Ajouter comme secret GitHub : `EXPO_TOKEN`

### 5. GitHub Actions

Configurer les secrets dans le repository :

**Repository Secrets** (Settings > Secrets > Actions) :

```
RENDER_DEPLOY_HOOK=https://api.render.com/deploy/...
VERCEL_TOKEN=xxx
VERCEL_ORG_ID=xxx
VERCEL_PROJECT_ID=xxx
EXPO_TOKEN=xxx
TURBO_TOKEN=xxx (optionnel, pour remote caching)
```

**Repository Variables** :

```
TURBO_TEAM=your-team-name
VITE_API_URL=https://swalo-api-prod.onrender.com/api
```

**Environments** (Settings > Environments) :

- Créer `production` avec protection rules
- Créer `staging` pour les preview deployments

---

## Workflows CI/CD

### Déploiement Production (`deploy.yml`)

Déclenché sur push vers `main` :

1. **Test** : Lint + Build de tous les packages
2. **deploy-web** : Déploiement Vercel en production
3. **deploy-mobile** : Build EAS
4. **notify-render** : Trigger du déploiement API

### Déploiement Staging (`deploy-staging.yml`)

Déclenché sur push vers `develop` :

1. **Test** : Lint + Build
2. **deploy-web-staging** : Preview deployment Vercel
3. **notify-render-staging** : Déploiement API staging (si configuré)

### Keep-Alive (`keep-alive.yml`)

Ping automatique de l'API toutes les 14 minutes de 6h à 22h (UTC+1) :

- Warm-up à 5h55 pour être prêt à 6h
- Retry logic pour gérer les cold starts
- Couvre les heures d'ouverture des boutiques en Afrique Centrale

---

## Déploiement Rapide (30 min)

### 1) Mobile (EAS)

```bash
npm install -g eas-cli
eas login
cd apps/mobile
eas build:configure
eas build -p android --profile production
```

Mettez à jour `apps/mobile/app.json` ou `app.config.ts` pour pointer vers l'API de prod.

### 2) Web (Vercel)

- Importer le repo dans Vercel
- Build command: `pnpm turbo build --filter=@swalo/web`
- Output directory: `apps/web/dist`
- Variable: `VITE_API_URL=https://<votre-api>/api`

### 3) API (Render)

- Importer le repo, Render détecte `render.yaml`
- Ajouter `DATABASE_URL` (Neon pooled)
- Ajouter `JWT_SECRET` et `JWT_REFRESH_SECRET`
- Deploy

### 4) Database Neon

1. Créer un projet Neon (prod)
2. Récupérer deux URLs:
   - direct (migrations)
   - pooled (runtime)
3. Exécuter les migrations:

```bash
cd apps/api
DATABASE_URL="<direct>" npx prisma migrate deploy
```

---

## Gestion des Cold Starts

Le free tier Render met l'API en veille après 15 minutes d'inactivité. Solutions :

1. **Keep-alive cron** (automatique) :
   - Ping toutes les 14 minutes pendant les heures d'ouverture
   - Warm-up matinal avant 6h

2. **Timeout côté client** :
   - Mobile/Web : 30s timeout pour le premier appel
   - Retry automatique (3 tentatives)

3. **Neon wake-up** :
   - ~500ms de latence au premier appel
   - Connection pooling (PgBouncer) pour réduire l'impact

---

## Docker (Local ou Serveur)

```bash
cp .env.docker .env
docker-compose up -d
```

Services exposés:

- Web: http://localhost
- API: http://localhost:3000/api

---

## Monitoring

### UptimeRobot (Recommandé)

1. Créer un compte gratuit sur [uptimerobot.com](https://uptimerobot.com)
2. Ajouter des monitors :
   - **API Health** : `https://swalo-api-prod.onrender.com/api/health`
   - **Web Dashboard** : URL Vercel
3. Configurer les alertes email

### Health Checks

Script local pour vérifier tous les services :

```bash
./scripts/health-check.sh
```

Endpoints à monitorer :

- API : `GET /api/health` → `{"status": "ok"}`
- Web : `GET /` → HTTP 200

---

## Procédures

### Déploiement Manuel

**API** :

```bash
# Via Render Dashboard
# Ou via deploy hook
curl -X POST "$RENDER_DEPLOY_HOOK"
```

**Web** :

```bash
# Via Vercel CLI
cd apps/web
vercel --prod
```

**Mobile** :

```bash
cd apps/mobile
eas build --platform all --profile production
eas build:download --platform android --latest
```

Option locale (Android Studio requis):

```bash
npx expo run:android --variant release
```

### Rollback

**Render** :

1. Dashboard > Deploys
2. Sélectionner un déploiement précédent
3. Click "Rollback"

**Vercel** :

1. Dashboard > Deployments
2. Hover sur un déploiement précédent
3. Click "..." > "Promote to Production"

**Neon** :

1. Les branches permettent de revenir à un état précédent
2. Ou utiliser le Point-in-Time Recovery (PITR)

### Migrations Database

```bash
# Générer une migration
cd apps/api
pnpm prisma migrate dev --name "description"

# Appliquer en production (via Render)
# Les migrations sont appliquées automatiquement au démarrage
# Ou manuellement :
DATABASE_URL="$PROD_URL" pnpm prisma migrate deploy
```

---

## Troubleshooting

### L'API ne répond pas

1. Vérifier le statut sur [status.render.com](https://status.render.com)
2. Vérifier les logs dans Render Dashboard
3. Attendre le cold start (~30-60s)
4. Vérifier la connexion Neon

### Erreur de connexion à la database

1. Vérifier que `DATABASE_URL` utilise la connection **pooled**
2. Vérifier que Neon n'est pas suspendu (console.neon.tech)
3. Vérifier le SSL : `?sslmode=require`

### Build échoué sur Vercel

1. Vérifier les logs de build
2. S'assurer que `pnpm-lock.yaml` est à jour
3. Vérifier les variables d'environnement

### Keep-alive ne fonctionne pas

1. Vérifier l'historique des runs GitHub Actions
2. Vérifier que le cron est dans les heures UTC correctes
3. Vérifier que l'URL de l'API est correcte

---

## Coûts et Limites

### Free Tier Suffisant Pour

- ~480h d'uptime API/mois (6h-22h × 30j)
- ~100 utilisateurs actifs
- ~10 000 requêtes/jour
- ~0.1GB de données

### Quand Upgrader

Signes qu'il faut passer à un plan payant :

- Dépassement des 750h Render (monitoring externe 24/7 nécessaire)
- Database > 0.5GB
- Temps de réponse > 2s régulièrement
- Besoin de toujours-on (pas de cold starts)

### Plans Recommandés pour Scale

| Service        | Plan     | Prix                          | Gain |
| -------------- | -------- | ----------------------------- | ---- |
| Render Starter | $7/mois  | Always-on, plus de RAM        |
| Neon Launch    | $19/mois | 10GB storage, plus de compute |
| Vercel Pro     | $20/mois | Plus de bandwidth, analytics  |

---

## Checklist Rapide

- [ ] Tests OK (web + API)
- [ ] Migrations appliquées sur prod
- [ ] Variables d'env vérifiées
- [ ] Health check OK: `/api/health`
- [ ] Keep-alive configuré
- [ ] Monitoring externe configuré

---

## CI/CD Secrets (Résumé)

Secrets fréquents:

- `EXPO_TOKEN`
- `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`
- `RENDER_DEPLOY_HOOK`
- `TURBO_TOKEN` (optionnel)

---

## Contacts et Support

- **Render** : [community.render.com](https://community.render.com)
- **Neon** : [neon.tech/docs](https://neon.tech/docs)
- **Vercel** : [vercel.com/docs](https://vercel.com/docs)
- **Expo** : [docs.expo.dev](https://docs.expo.dev)
