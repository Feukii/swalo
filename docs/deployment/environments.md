# SWALO - Environnements

Ce guide décrit la séparation des environnements de développement, staging et production.

## Vue d'ensemble

| Environnement  | Branche Git | Base de données     | API URL                | Déploiement |
| -------------- | ----------- | ------------------- | ---------------------- | ----------- |
| **Local**      | Toutes      | Docker PostgreSQL   | localhost:3000         | Manuel      |
| **Staging**    | `develop`   | Neon (branche dev)  | Preview Vercel         | Automatique |
| **Production** | `main`      | Neon (branche main) | swalo-api.onrender.com | Automatique |

## Environnement Local

### Configuration

- **Base de données**: PostgreSQL via Docker (profile `local`)
- **Fichiers de config**: `.env.development` (non commités)
- **Branche de travail**: `feature/*`, `fix/*`, etc.

### Démarrage

```bash
# Démarrer PostgreSQL
docker compose --profile local up -d postgres

# Démarrer les services
pnpm dev
```

### URLs

| Service       | URL                       |
| ------------- | ------------------------- |
| API           | http://localhost:3000/api |
| Web           | http://localhost:3001     |
| Prisma Studio | http://localhost:5555     |

## Environnement Staging (develop)

### Configuration

- **Base de données**: Neon PostgreSQL - branche `dev`
- **Branche Git**: `develop`
- **Workflow CI**: `.github/workflows/deploy-staging.yml`

### Déploiement

Le déploiement staging est automatique sur push vers `develop`:

1. Tests et lint (bloquants)
2. Build des packages
3. Preview deployment Vercel

### URLs

| Service       | URL                                             |
| ------------- | ----------------------------------------------- |
| Web (preview) | Générée par Vercel (voir PR)                    |
| API           | Utilise la production (même API, DB différente) |

### Secrets GitHub (Environment: staging)

```
DATABASE_URL=<Neon dev branch pooled URL>
JWT_SECRET=<staging secret>
JWT_REFRESH_SECRET=<staging refresh secret>
```

## Environnement Production (main)

### Configuration

- **Base de données**: Neon PostgreSQL - branche `main`
- **Branche Git**: `main` (protégée)
- **Workflow CI**: `.github/workflows/deploy.yml`

### Déploiement

Le déploiement production est automatique sur merge vers `main`:

1. Tests et lint (bloquants)
2. Build des packages
3. Déploiement:
   - API → Render
   - Web → Vercel (production)
   - Mobile → EAS Build

### URLs

| Service    | URL                                       |
| ---------- | ----------------------------------------- |
| API        | https://swalo-api.onrender.com/api        |
| API Health | https://swalo-api.onrender.com/api/health |
| Web        | https://swalo-web.vercel.app              |

### Secrets (Render Dashboard + GitHub)

```
DATABASE_URL=<Neon main branch pooled URL>
JWT_SECRET=<production secret - DIFFÉRENT de staging>
JWT_REFRESH_SECRET=<production refresh secret>
```

## Bases de données Neon

### Structure des branches

```
Projet Neon: swalo-production
├── main (Production)
│   └── Connection: ep-round-union-xxx-pooler.neon.tech
└── dev (Staging/Development)
    └── Connection: ep-xxx-pooler.neon.tech (à créer)
```

### Créer une branche Neon

1. Aller sur [console.neon.tech](https://console.neon.tech)
2. Sélectionner le projet SWALO
3. Onglet "Branches" → "Create branch"
4. Nommer: `dev`
5. Base: `main`
6. Copier la "Pooled connection string"

### Bonnes pratiques

- Toujours utiliser la connection **pooled** pour l'application
- Connection **directe** uniquement pour les migrations
- Les JWT secrets doivent être **différents** entre staging et production

## Variables d'environnement par environnement

### Local (.env.development)

```env
NODE_ENV=development
DATABASE_URL=postgresql://swalo:swalo_password@localhost:5432/swalo_db
JWT_SECRET=dev_jwt_secret_not_for_production
JWT_REFRESH_SECRET=dev_jwt_refresh_secret_not_for_production
VITE_API_URL=http://localhost:3000/api
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

### Staging (GitHub Secrets)

```env
NODE_ENV=staging
DATABASE_URL=postgresql://...@ep-xxx-pooler.neon.tech/neondb?sslmode=require
JWT_SECRET=<unique staging secret>
JWT_REFRESH_SECRET=<unique staging refresh secret>
```

### Production (Render + GitHub Secrets)

```env
NODE_ENV=production
DATABASE_URL=postgresql://...@ep-round-union-pooler.neon.tech/neondb?sslmode=require
JWT_SECRET=<unique production secret>
JWT_REFRESH_SECRET=<unique production refresh secret>
```

## Workflow de release

```
1. Développer sur feature/*
   └─ Commiter et pusher

2. Créer PR vers develop
   └─ CI: Tests + Lint
   └─ Merge si OK

3. Tests sur staging
   └─ Vérifier preview Vercel
   └─ Tester avec DB dev Neon

4. Créer PR de develop vers main
   └─ CI: Tests + Lint
   └─ Review (optionnel pour solo dev)

5. Merge vers main
   └─ Déploiement automatique production
```

## Checklist de déploiement

### Avant merge vers main

- [ ] Tous les tests passent sur develop
- [ ] Preview Vercel fonctionne correctement
- [ ] Migrations testées sur branche Neon dev
- [ ] Pas de données sensibles dans le code
- [ ] Variables d'environnement documentées si nouvelles

### Après déploiement production

- [ ] Health check API OK: `/api/health`
- [ ] Web accessible et fonctionnel
- [ ] Vérifier logs Render pour erreurs
- [ ] Tester fonctionnalités critiques

## Rollback

### Render (API)

1. Dashboard Render → Deploys
2. Sélectionner déploiement précédent
3. Click "Rollback"

### Vercel (Web)

1. Dashboard Vercel → Deployments
2. Hover sur déploiement précédent
3. Click "..." → "Promote to Production"

### Neon (Database)

1. Console Neon → Branches
2. Utiliser Point-in-Time Recovery si besoin
3. Ou restaurer depuis backup manuel

## Ressources

- [Guide de déploiement complet](./guide.md)
- [Guide du workflow de développement](../guides/development-workflow.md)
- [Documentation Neon Branching](https://neon.tech/docs/manage/branches)
