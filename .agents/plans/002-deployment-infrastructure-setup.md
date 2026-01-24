# Feature: Infrastructure de Déploiement SWALO (Dev/Prod)

## Feature Description

Configuration complète de l'infrastructure de déploiement pour l'application SWALO, un mini-ERP pour boutiques de téléphonie en Afrique Centrale. L'objectif est d'établir deux environnements distincts (développement et production) avec une disponibilité garantie de 6h à 22h, entièrement gratuit pour la phase de test, tout en étant performant et scalable pour une croissance future.

## User Story

En tant que développeur/propriétaire de SWALO,
Je veux déployer mon application avec une architecture robuste et gratuite,
Afin de pouvoir tester en production avec des utilisateurs réels tout en continuant le développement de nouvelles fonctionnalités sans interruption de service.

## Problem Statement

L'application SWALO nécessite:
1. **Disponibilité 6h-22h** : Les boutiques opèrent pendant ces heures
2. **Deux environnements séparés** : Dev pour les évolutions, Prod pour les utilisateurs
3. **Gratuité** : Phase de test sans coût d'infrastructure
4. **Performance** : Temps de réponse acceptable malgré les contraintes gratuites
5. **Cold starts** : Minimiser l'impact des redémarrages à froid sur les free tiers

## Solution Statement

Architecture multi-plateforme optimisée utilisant les meilleurs free tiers disponibles en 2026:

### Stack de Production Recommandé

| Composant | Plateforme | Justification |
|-----------|-----------|---------------|
| **API Backend** | **Render** (Free) | Déjà configuré, 750h/mois suffisantes, keep-alive existant |
| **Base de données** | **Neon PostgreSQL** (Free) | Scale-to-zero, branching dev/prod, 0.5GB gratuit |
| **Web Dashboard** | **Vercel** (Free) | Optimisé React/Vite, CDN global, preview deploys |
| **Mobile App** | **Expo EAS** (Free) | Build cloud gratuit, OTA updates |
| **CI/CD** | **GitHub Actions** (Free) | 2000 min/mois gratuit, déjà configuré |

### Stratégie Anti-Cold-Start

- **Keep-alive cron** : Ping toutes les 14 minutes (< 15min inactivity timeout)
- **Plage horaire** : 5h55 - 22h05 UTC+1 (Afrique Centrale)
- **Warm-up progressif** : Premier ping à 5h55 pour être prêt à 6h

## Feature Metadata

**Feature Type**: Infrastructure/DevOps
**Estimated Complexity**: Medium
**Primary Systems Affected**: CI/CD, Hosting, Database, Monitoring
**Dependencies**: GitHub, Render, Neon, Vercel, Expo

---

## CONTEXT REFERENCES

### Relevant Codebase Files - LIRE AVANT IMPLEMENTATION

- `render.yaml` (lignes 1-42) - Configuration Render existante pour l'API
- `.github/workflows/deploy.yml` (lignes 1-93) - Pipeline CI/CD actuel
- `.github/workflows/keep-alive.yml` (lignes 1-51) - Cron keep-alive existant
- `docker-compose.yml` (lignes 1-89) - Configuration Docker locale
- `.env.development.example` - Template environnement dev
- `.env.production.example` - Template environnement prod
- `turbo.json` - Configuration Turborepo pour le monorepo
- `apps/api/prisma/schema.prisma` - Schéma base de données

### New Files to Create

- `.github/workflows/deploy-production.yml` - Workflow de déploiement production
- `.github/workflows/deploy-staging.yml` - Workflow de déploiement staging/dev
- `.github/workflows/keep-alive-optimized.yml` - Keep-alive optimisé pour disponibilité 6h-22h
- `render.staging.yaml` - Configuration Render pour environnement staging
- `.env.staging.example` - Template environnement staging
- `scripts/health-check.sh` - Script de vérification santé multi-services
- `docs/DEPLOYMENT.md` - Documentation complète de déploiement

### Relevant Documentation - LIRE AVANT IMPLEMENTATION

- [Render Free Tier Documentation](https://docs.render.com/free)
  - Section: Instance hours, sleep behavior, limitations
  - Why: Comprendre les 750h gratuites et le comportement de spin-down

- [Neon Free Tier & Branching](https://neon.com/docs/introduction/plans)
  - Section: Free plan limits, auto-suspend, compute hours
  - Why: Configurer correctement les branches dev/prod

- [Vercel Hobby Plan](https://vercel.com/docs/accounts/plans/hobby)
  - Section: Build minutes, bandwidth, preview deployments
  - Why: Optimiser les déploiements frontend

- [Expo EAS Build Free Tier](https://docs.expo.dev/billing/plans/)
  - Section: Free builds, queue priority, OTA updates
  - Why: Planifier les builds mobile

- [GitHub Actions Free Tier](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions)
  - Section: 2000 minutes/month, storage limits
  - Why: Optimiser les pipelines CI/CD

- [Turborepo Remote Caching](https://turbo.build/docs/core-concepts/remote-caching)
  - Section: Vercel remote cache, configuration
  - Why: Accélérer les builds avec cache partagé

### Patterns to Follow

**Naming Conventions:**
- Branches Git: `main` (prod), `develop` (staging), `feature/*` (dev)
- Environnements: `production`, `staging`, `development`
- Variables d'environnement: `{SERVICE}_{ENV}_{KEY}` format

**Configuration Pattern:**
- Fichiers `.env.{environment}.example` comme templates
- Variables sensibles dans les dashboards des plateformes (jamais en Git)
- Configuration par environnement via GitHub Environments

**CI/CD Pattern:**
- Workflow séparé par environnement
- Déploiement automatique sur `main` → production
- Déploiement automatique sur `develop` → staging
- Preview deployments pour les PRs

**Keep-Alive Pattern:**
- Cron GitHub Actions pour ping régulier
- Retry logic avec backoff exponentiel
- Alertes en cas d'échec (optionnel)

---

## IMPLEMENTATION PLAN

### Phase 1: Configuration Neon (Database)

Configuration de la base de données PostgreSQL serverless avec branching pour séparer les environnements dev et prod.

**Tasks:**
- Créer le projet Neon avec branche `main` pour production
- Créer une branche `dev` depuis `main` pour staging
- Configurer les connection strings pooled pour chaque environnement
- Documenter les URLs de connexion

### Phase 2: Configuration Render (API)

Optimisation du service Render existant et création d'un service staging.

**Tasks:**
- Vérifier et optimiser la configuration `render.yaml` existante
- Créer un service séparé pour staging (optionnel si budget limité)
- Configurer les variables d'environnement par environnement
- Optimiser le build command pour réduire le temps de déploiement

### Phase 3: Configuration Vercel (Web)

Setup du déploiement frontend avec preview deployments.

**Tasks:**
- Lier le projet Vercel au repository GitHub
- Configurer les variables d'environnement (VITE_API_URL par environnement)
- Activer les preview deployments pour les PRs
- Configurer le domaine personnalisé (si disponible)

### Phase 4: Optimisation Keep-Alive

Amélioration du système keep-alive pour garantir la disponibilité 6h-22h.

**Tasks:**
- Modifier le cron pour couvrir spécifiquement 6h-22h (timezone Afrique Centrale)
- Réduire l'intervalle à 14 minutes (sous le seuil de 15min Render)
- Ajouter un warm-up à 5h55 pour être prêt à 6h
- Implémenter des notifications en cas d'échec

### Phase 5: CI/CD Pipeline Optimisé

Refactoring des workflows GitHub Actions pour supporter dev/staging/prod.

**Tasks:**
- Créer des workflows séparés par environnement
- Implémenter le cache Turborepo distant via Vercel
- Optimiser les jobs pour réduire les minutes consommées
- Ajouter des gates de qualité (tests, lint)

### Phase 6: Documentation & Monitoring

Documentation complète et mise en place d'un monitoring basique.

**Tasks:**
- Documenter l'architecture de déploiement
- Créer un guide de setup pour nouveaux développeurs
- Configurer des health checks publics (UptimeRobot gratuit)
- Documenter les procédures de rollback

---

## STEP-BY-STEP TASKS

### TASK 1: CREATE Branche Neon Dev

- **IMPLEMENT**: Créer une branche de développement dans Neon depuis la branche main existante pour isoler les données de test
- **PATTERN**: Utiliser la fonctionnalité de branching Neon pour copier le schéma sans les données
- **DEPENDENCIES**: Compte Neon existant avec projet SWALO
- **GOTCHA**: Les branches Neon partagent les 0.5GB du free tier - surveiller l'usage
- **RESOURCES**:
  - [Neon Branching Guide](https://neon.com/docs/introduction/branching)
  - [Neon Console](https://console.neon.tech)
- **VALIDATE**: `Vérifier que la branche 'dev' apparaît dans la console Neon`
- **TEST_REQUIREMENT**: La connection string de la branche dev doit être différente de main

### TASK 2: UPDATE .env.staging.example

- **IMPLEMENT**: Créer un fichier template pour l'environnement staging avec les variables nécessaires
- **PATTERN**: Suivre le format de `.env.production.example` avec les valeurs staging
- **DEPENDENCIES**: Connection string Neon branche dev
- **GOTCHA**: Ne jamais commiter de vraies credentials - uniquement des placeholders
- **RESOURCES**:
  - `.env.production.example` comme référence
  - [12-Factor App Config](https://12factor.net/config)
- **VALIDATE**: `cat .env.staging.example | grep DATABASE_URL`
- **TEST_REQUIREMENT**: Le fichier contient toutes les variables de `.env.production.example`

### TASK 3: UPDATE .github/workflows/keep-alive.yml

- **IMPLEMENT**: Optimiser le cron keep-alive pour couvrir précisément 6h-22h (UTC+1) avec un intervalle de 14 minutes
- **PATTERN**: Utiliser la syntaxe cron GitHub Actions avec multiple triggers
- **DEPENDENCIES**: Workflow existant fonctionnel
- **GOTCHA**:
  - GitHub Actions utilise UTC, donc ajuster pour UTC+1 (Afrique Centrale)
  - 6h UTC+1 = 5h UTC
  - 22h UTC+1 = 21h UTC
- **RESOURCES**:
  - [GitHub Actions Cron Syntax](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
  - [Crontab Guru](https://crontab.guru/)
- **VALIDATE**: `grep -E "cron:" .github/workflows/keep-alive.yml`
- **TEST_REQUIREMENT**: Le cron couvre 5h-21h UTC avec un ping toutes les 14 minutes

### TASK 4: CREATE .github/workflows/deploy-staging.yml

- **IMPLEMENT**: Créer un workflow de déploiement dédié pour l'environnement staging déclenché par les pushes sur la branche `develop`
- **PATTERN**: Suivre la structure de `deploy.yml` avec les variables staging
- **DEPENDENCIES**: Branche Git `develop`, GitHub Secrets staging
- **GOTCHA**:
  - Utiliser GitHub Environments pour isoler les secrets staging/production
  - Le free tier Render ne permet qu'un seul service - réutiliser pour staging OU créer service séparé
- **RESOURCES**:
  - [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
  - `.github/workflows/deploy.yml` comme référence
- **VALIDATE**: `gh workflow list | grep staging`
- **TEST_REQUIREMENT**: Le workflow se déclenche uniquement sur push vers `develop`

### TASK 5: UPDATE render.yaml

- **IMPLEMENT**: Optimiser la configuration Render pour réduire le temps de démarrage et améliorer la performance
- **PATTERN**: Utiliser les bonnes pratiques Render pour NestJS
- **DEPENDENCIES**: Configuration existante fonctionnelle
- **GOTCHA**:
  - Le free tier a un cold start de ~30-60s après 15min d'inactivité
  - Utiliser `pnpm store prune` pour réduire la taille du build
- **RESOURCES**:
  - [Render Node.js Best Practices](https://docs.render.com/node-best-practices)
  - [Render Blueprint Spec](https://docs.render.com/blueprint-spec)
- **VALIDATE**: `cat render.yaml`
- **TEST_REQUIREMENT**: La configuration build est optimisée avec cache

### TASK 6: CREATE Vercel Project Configuration

- **IMPLEMENT**: Configurer le projet Vercel avec les bons paramètres pour le monorepo et les variables d'environnement par branche
- **PATTERN**: Configuration Vercel pour Turborepo monorepo
- **DEPENDENCIES**: Compte Vercel, Repository GitHub connecté
- **GOTCHA**:
  - Vercel doit pointer vers `apps/web` comme root directory
  - Les preview deployments utilisent automatiquement les variables de preview
- **RESOURCES**:
  - [Vercel Monorepo Guide](https://vercel.com/docs/monorepos)
  - [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- **VALIDATE**: `Vérifier dans le dashboard Vercel que le projet est lié`
- **TEST_REQUIREMENT**: Un push sur une PR génère une preview deployment

### TASK 7: CREATE vercel.json

- **IMPLEMENT**: Ajouter un fichier de configuration Vercel à la racine pour définir le framework et les redirections
- **PATTERN**: Configuration standard Vercel pour Vite + React
- **DEPENDENCIES**: Projet Vercel créé
- **GOTCHA**:
  - `buildCommand` doit inclure la build du package core en premier
  - `outputDirectory` doit pointer vers `apps/web/dist`
- **RESOURCES**:
  - [Vercel Configuration](https://vercel.com/docs/projects/project-configuration)
  - [Vercel Vite Guide](https://vercel.com/guides/deploying-vite-and-react-with-vercel)
- **VALIDATE**: `cat vercel.json`
- **TEST_REQUIREMENT**: Le fichier définit correctement le build pour le monorepo

### TASK 8: UPDATE turbo.json for Remote Caching

- **IMPLEMENT**: Activer le remote caching Turborepo via Vercel pour accélérer les builds CI/CD
- **PATTERN**: Configuration Turborepo avec authentification Vercel
- **DEPENDENCIES**: Compte Vercel, `TURBO_TOKEN` et `TURBO_TEAM` secrets
- **GOTCHA**:
  - Le remote cache est gratuit pour les équipes Hobby
  - Les tokens doivent être configurés dans GitHub Secrets
- **RESOURCES**:
  - [Turborepo Remote Caching](https://turbo.build/docs/core-concepts/remote-caching)
  - [Turbo + GitHub Actions](https://turbo.build/docs/guides/ci-vendors/github-actions)
- **VALIDATE**: `grep -E "remoteCache" turbo.json || echo "Config via env vars"`
- **TEST_REQUIREMENT**: Les builds CI utilisent le cache distant

### TASK 9: UPDATE .github/workflows/deploy.yml

- **IMPLEMENT**: Optimiser le workflow de déploiement production avec cache Turborepo et parallélisation des jobs
- **PATTERN**: GitHub Actions avec Turborepo caching et matrix strategy
- **DEPENDENCIES**: TURBO_TOKEN secret, workflow existant
- **GOTCHA**:
  - Ajouter les variables TURBO_TOKEN et TURBO_TEAM aux secrets
  - Les jobs `deploy-web`, `deploy-mobile`, et `notify-render` peuvent être parallèles
- **RESOURCES**:
  - [Turborepo GitHub Actions Guide](https://turbo.build/docs/guides/ci-vendors/github-actions)
  - [GitHub Actions Caching](https://github.com/actions/cache)
- **VALIDATE**: `pnpm --filter @swalo/api run lint && pnpm --filter @swalo/api run test`
- **TEST_REQUIREMENT**: Le temps de build est réduit avec le cache

### TASK 10: CREATE docs/DEPLOYMENT.md

- **IMPLEMENT**: Documenter l'architecture de déploiement complète, les procédures de setup, et les troubleshooting guides
- **PATTERN**: Documentation technique en français avec diagrammes ASCII
- **DEPENDENCIES**: Toutes les configurations précédentes complétées
- **GOTCHA**:
  - Inclure les étapes manuelles (création comptes, secrets)
  - Ne jamais documenter de vraies credentials
- **RESOURCES**:
  - [Markdown Guide](https://www.markdownguide.org/)
  - CLAUDE.md comme exemple de style
- **VALIDATE**: `cat docs/DEPLOYMENT.md | head -50`
- **TEST_REQUIREMENT**: La documentation couvre setup dev ET prod

### TASK 11: CREATE scripts/health-check.sh

- **IMPLEMENT**: Script bash pour vérifier la santé de tous les services (API, Web, DB) avec output formaté
- **PATTERN**: Script bash avec curl et codes de retour appropriés
- **DEPENDENCIES**: URLs des services déployés
- **GOTCHA**:
  - Gérer les timeouts pour les cold starts
  - Retourner des codes de sortie appropriés pour CI
- **RESOURCES**:
  - [Bash Best Practices](https://bertvv.github.io/cheat-sheets/Bash.html)
- **VALIDATE**: `chmod +x scripts/health-check.sh && ./scripts/health-check.sh`
- **TEST_REQUIREMENT**: Le script retourne 0 si tous les services sont up

### TASK 12: SETUP UptimeRobot Monitoring (Manuel)

- **IMPLEMENT**: Configurer un monitoring externe gratuit pour surveiller la disponibilité des services
- **PATTERN**: Monitoring HTTP avec alertes email
- **DEPENDENCIES**: Compte UptimeRobot gratuit, URLs des services
- **GOTCHA**:
  - Le free tier permet 50 monitors avec 5 minutes d'intervalle
  - Configurer des alertes email en cas de downtime
- **RESOURCES**:
  - [UptimeRobot](https://uptimerobot.com/)
  - [UptimeRobot API](https://uptimerobot.com/api/)
- **VALIDATE**: `Vérifier le dashboard UptimeRobot montre les services en vert`
- **TEST_REQUIREMENT**: Les 3 services (API, Web, DB health) sont monitorés

### TASK 13: CREATE GitHub Environments (Manuel)

- **IMPLEMENT**: Configurer les GitHub Environments pour isoler les secrets et les déploiements par environnement
- **PATTERN**: Environments avec protection rules et secrets dédiés
- **DEPENDENCIES**: Repository GitHub, Admin access
- **GOTCHA**:
  - Les environments sont gratuits sur les repos publics
  - Pour les repos privés, nécessite GitHub Team ou Free pour actions standard
- **RESOURCES**:
  - [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- **VALIDATE**: `gh api repos/{owner}/{repo}/environments`
- **TEST_REQUIREMENT**: Environments `production` et `staging` existent avec leurs secrets

### TASK 14: TEST Full Deployment Pipeline

- **IMPLEMENT**: Exécuter un cycle complet de déploiement pour valider toute la chaîne
- **PATTERN**: Test end-to-end du pipeline CI/CD
- **DEPENDENCIES**: Toutes les configurations précédentes
- **GOTCHA**:
  - Le premier déploiement peut prendre plus de temps (pas de cache)
  - Vérifier chaque étape dans GitHub Actions
- **RESOURCES**:
  - [GitHub Actions Debugging](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/enabling-debug-logging)
- **VALIDATE**: `gh run list --workflow=deploy.yml --limit=1`
- **TEST_REQUIREMENT**: Le workflow complète sans erreur et les services sont accessibles

---

## TESTING STRATEGY

### Unit Tests

**Scope**: Scripts de health-check, configuration validation
**Requirements**:
- Scripts bash retournent les bons codes de sortie
- Configurations YAML/JSON sont valides syntaxiquement
- **VALIDATION COMMAND**: `pnpm run validate`

### Integration Tests

**Scope**: Communication API-Database, Frontend-Backend
**Requirements**:
- L'API répond correctement aux endpoints de santé
- Le frontend peut communiquer avec l'API
- **VALIDATION COMMAND**: `curl -f https://swalo-api.onrender.com/api/health`

### Edge Cases

- **Cold start recovery**: L'API répond après un cold start de 60s max
- **Database wake-up**: Neon se réveille en moins de 500ms
- **Network timeout**: Le frontend gère les timeouts gracieusement
- **CI/CD failure recovery**: Les workflows peuvent être relancés

### Test Resources

- [Render Health Checks](https://docs.render.com/health-checks)
- [Neon Connection Latency](https://neon.com/docs/connect/connection-latency)
- [GitHub Actions Testing](https://docs.github.com/en/actions/learn-github-actions/understanding-github-actions)

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
# Valider les fichiers YAML
yamllint render.yaml .github/workflows/*.yml

# Valider le JSON
jq . turbo.json vercel.json

# Lint du code
pnpm run lint
```

### Level 2: Unit Tests

```bash
# Tests unitaires API
pnpm --filter @swalo/api run test

# Tests unitaires Mobile
pnpm --filter @swalo/mobile run test

# Coverage
pnpm --filter @swalo/api run test:cov
```

### Level 3: Integration Tests

```bash
# Health check API production
curl -f https://swalo-api.onrender.com/api/health

# Health check Web production
curl -f https://swalo-web.vercel.app/

# Test connexion DB (via API)
curl -f https://swalo-api.onrender.com/api/health
```

### Level 4: CI/CD Validation

```bash
# Vérifier le statut des workflows
gh run list --workflow=deploy.yml --status=success

# Vérifier le dernier déploiement
gh run view --workflow=deploy.yml
```

### Level 5: Manual Validation

1. **API Health Check**:
   - Accéder à `https://swalo-api.onrender.com/api/health`
   - Vérifier la réponse JSON avec status "ok"

2. **Web Dashboard**:
   - Accéder à l'URL Vercel
   - Vérifier que la page de login s'affiche
   - Tester la communication avec l'API

3. **Mobile App**:
   - Télécharger le build depuis EAS
   - Vérifier la connexion à l'API
   - Tester le login

4. **Keep-Alive Verification**:
   - Vérifier l'historique des runs GitHub Actions
   - Confirmer les pings toutes les 14 minutes

---

## ACCEPTANCE CRITERIA

- [x] **Deux environnements séparés** : Production (main) et Staging (develop)
- [ ] **Base de données Neon** : Branche main pour prod, branche dev pour staging
- [ ] **API Render** : Déploiement automatique depuis main
- [ ] **Web Vercel** : Preview deployments actifs sur les PRs
- [ ] **Keep-alive optimisé** : Disponibilité 6h-22h UTC+1 garantie
- [ ] **CI/CD fonctionnel** : Tests + Build + Deploy automatisés
- [ ] **Documentation complète** : Guide de setup et troubleshooting
- [ ] **Monitoring externe** : UptimeRobot configuré
- [ ] **Zéro coût** : Tout sur free tiers

---

## COMPLETION CHECKLIST

- [ ] Branche Neon `dev` créée
- [ ] Fichier `.env.staging.example` créé
- [ ] Keep-alive optimisé pour 6h-22h
- [ ] Workflow staging créé
- [ ] Configuration Render optimisée
- [ ] Projet Vercel configuré
- [ ] `vercel.json` créé
- [ ] Remote caching Turborepo activé
- [ ] Workflow production optimisé
- [ ] Documentation déploiement créée
- [ ] Script health-check créé
- [ ] UptimeRobot configuré
- [ ] GitHub Environments configurés
- [ ] Pipeline testé end-to-end

---

## EXTERNAL RESOURCES AND REFERENCES

### Plateformes de Déploiement

| Plateforme | Documentation | Dashboard |
|------------|---------------|-----------|
| Render | [docs.render.com](https://docs.render.com) | [dashboard.render.com](https://dashboard.render.com) |
| Neon | [neon.com/docs](https://neon.com/docs) | [console.neon.tech](https://console.neon.tech) |
| Vercel | [vercel.com/docs](https://vercel.com/docs) | [vercel.com/dashboard](https://vercel.com/dashboard) |
| Expo EAS | [docs.expo.dev](https://docs.expo.dev) | [expo.dev](https://expo.dev) |
| GitHub Actions | [docs.github.com/actions](https://docs.github.com/actions) | GitHub Repository |

### Outils de Monitoring

- [UptimeRobot](https://uptimerobot.com/) - Monitoring gratuit (50 monitors)
- [Better Uptime](https://betterstack.com/better-uptime) - Alternative avec status pages

### Comparatifs et Guides

- [Top PostgreSQL Free Tiers 2026 - Koyeb](https://www.koyeb.com/blog/top-postgresql-database-free-tiers-in-2026)
- [Vercel vs Netlify vs Cloudflare Pages 2026](https://www.digitalapplied.com/blog/vercel-vs-netlify-vs-cloudflare-pages-comparison)
- [Best Node.js Hosting 2026](https://runcloud.io/blog/best-node-js-hosting)
- [Turborepo GitHub Actions Guide](https://turbo.build/docs/guides/ci-vendors/github-actions)

### Pricing Pages

- [Render Pricing](https://render.com/pricing) - Free: 750 instance hours/month
- [Neon Pricing](https://neon.com/pricing) - Free: 0.5GB, 100 CU-hours/month
- [Vercel Pricing](https://vercel.com/pricing) - Hobby: 100GB bandwidth/month
- [Expo Pricing](https://expo.dev/pricing) - Free: Limited builds
- [GitHub Actions](https://docs.github.com/billing/managing-billing-for-github-actions) - Free: 2000 min/month

---

## ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SWALO DEPLOYMENT ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                │
│  │   GitHub    │────▶│  GitHub     │────▶│  Platforms  │                │
│  │ Repository  │     │  Actions    │     │             │                │
│  └─────────────┘     └─────────────┘     └──────┬──────┘                │
│        │                    │                    │                       │
│        │                    │         ┌──────────┴──────────┐           │
│        │                    │         │                     │           │
│  ┌─────▼─────┐       ┌──────▼──────┐  │   ┌─────────────┐   │           │
│  │  Develop  │       │   Tests &   │  │   │   Render    │   │           │
│  │  Branch   │       │   Linting   │  │   │   (API)     │   │           │
│  └─────┬─────┘       └──────┬──────┘  │   └──────┬──────┘   │           │
│        │                    │         │          │          │           │
│        │                    │         │   ┌──────▼──────┐   │           │
│  ┌─────▼─────┐       ┌──────▼──────┐  │   │   Neon      │   │           │
│  │   Main    │       │   Build     │  │   │ PostgreSQL  │   │           │
│  │  Branch   │       │   Cache     │  │   │  (Database) │   │           │
│  └───────────┘       └──────┬──────┘  │   └─────────────┘   │           │
│                             │         │                     │           │
│                      ┌──────▼──────┐  │   ┌─────────────┐   │           │
│                      │   Turbo     │  │   │   Vercel    │   │           │
│                      │   Remote    │  │   │   (Web)     │   │           │
│                      │   Cache     │  │   └─────────────┘   │           │
│                      └─────────────┘  │                     │           │
│                                       │   ┌─────────────┐   │           │
│                                       │   │  Expo EAS   │   │           │
│                                       │   │  (Mobile)   │   │           │
│                                       │   └─────────────┘   │           │
│                                       └─────────────────────┘           │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         MONITORING                               │    │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │    │
│  │  │ Keep-Alive  │    │ UptimeRobot │    │   Alerts    │          │    │
│  │  │   Cron      │    │  Monitors   │    │   (Email)   │          │    │
│  │  │ (14 min)    │    │  (5 min)    │    │             │          │    │
│  │  └─────────────┘    └─────────────┘    └─────────────┘          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## COST ANALYSIS (Free Tier Limits)

| Service | Free Tier Limit | Usage Estimé | Marge |
|---------|-----------------|--------------|-------|
| **Render** | 750 instance hours/mois | ~480h (6h-22h × 30j) | ✅ 270h |
| **Neon** | 100 CU-hours/mois | ~50h (usage modéré) | ✅ 50h |
| **Neon Storage** | 0.5 GB | ~0.1 GB (phase test) | ✅ 0.4 GB |
| **Vercel** | 100 GB bandwidth | ~5 GB | ✅ 95 GB |
| **GitHub Actions** | 2000 min/mois | ~200 min | ✅ 1800 min |
| **Expo EAS** | Builds gratuits | ~10 builds/mois | ✅ OK |

**Total Coût Mensuel: 0 FCFA / 0 EUR**

---

## NOTES

### Décisions d'Architecture

1. **Render vs Fly.io vs Koyeb**: Render choisi car déjà configuré, simple à maintenir, et le keep-alive cron résout le problème de cold start.

2. **Neon vs Supabase**: Neon choisi pour le branching natif (séparation dev/prod) et le scale-to-zero efficace. Supabase offre plus de features (auth, storage) mais SWALO a déjà son propre système d'auth.

3. **Vercel vs Netlify vs Cloudflare Pages**: Vercel choisi pour l'intégration native avec les monorepos et les preview deployments automatiques.

4. **Keep-alive 14 min vs 10 min**: 14 minutes est le sweet spot - sous le seuil de 15 min de Render tout en minimisant les runs GitHub Actions (économie de minutes).

### Limitations Connues

- **Cold start initial**: Le premier utilisateur de la journée à 6h peut avoir un délai de 30-60s si le warm-up échoue
- **Neon wake-up**: ~500ms de latence au premier appel après suspension
- **EAS Build queue**: Les builds gratuits sont low-priority, peuvent prendre plus de temps

### Évolutions Futures

Quand le projet dépassera le free tier:
1. **Render Starter** ($7/mois) - Always-on, plus de RAM
2. **Neon Launch** ($19/mois) - Plus de storage et compute
3. **Vercel Pro** ($20/mois) - Plus de bandwidth et functions

<!-- EOF -->
