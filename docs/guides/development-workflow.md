# Guide du Workflow de Développement SWALO

Ce guide décrit le workflow de développement pour SWALO, de l'environnement local au déploiement en production.

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SWALO WORKFLOW DE DÉVELOPPEMENT                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Développement Local                                                 │
│  ├─ Docker PostgreSQL (profile: local)                             │
│  ├─ API: http://localhost:3000                                     │
│  ├─ Web: http://localhost:3001                                     │
│  └─ Mobile: Expo Dev Server                                        │
│       │                                                             │
│       ▼                                                             │
│  Branche develop (Staging)                                          │
│  ├─ Push déclenche CI/CD automatique                               │
│  ├─ Tests + Lint bloquants                                         │
│  └─ Preview deployments Vercel                                     │
│       │                                                             │
│       ▼                                                             │
│  Branche main (Production)                                          │
│  ├─ Merge via Pull Request                                         │
│  ├─ Déploiement automatique                                        │
│  └─ API: Render, Web: Vercel, Mobile: EAS                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 1. Configuration de l'Environnement Local

### Prérequis

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker et Docker Compose
- Git

### Installation initiale

```bash
# Cloner le repository
git clone https://github.com/Feukii/swalo.git
cd swalo

# Installer les dépendances
pnpm install

# Copier les fichiers d'environnement
cp .env.example .env.development
cp apps/api/.env.example apps/api/.env.development
cp apps/mobile/.env.example apps/mobile/.env.development
cp apps/web/.env.example apps/web/.env.development
```

### Démarrer l'environnement de développement

```bash
# 1. Démarrer PostgreSQL via Docker
docker compose --profile local up -d postgres

# 2. Appliquer les migrations Prisma
cd apps/api
DATABASE_URL="postgresql://swalo:swalo_password@localhost:5432/swalo_db" npx prisma migrate dev
cd ../..

# 3. (Optionnel) Seeder la base de données
cd apps/api
DATABASE_URL="postgresql://swalo:swalo_password@localhost:5432/swalo_db" npx prisma db seed
cd ../..

# 4. Démarrer tous les services
pnpm dev
```

### URLs de développement local

| Service | URL |
|---------|-----|
| API | http://localhost:3000/api |
| API Health | http://localhost:3000/api/health |
| Web Dashboard | http://localhost:3001 |
| Prisma Studio | http://localhost:5555 |

## 2. Structure des Branches

### Branches principales

| Branche | Environnement | Déploiement |
|---------|--------------|-------------|
| `main` | Production | Automatique → Render/Vercel/EAS |
| `develop` | Staging | Automatique → Vercel Preview |

### Branches de travail

- `feature/*` - Nouvelles fonctionnalités
- `fix/*` - Corrections de bugs
- `hotfix/*` - Corrections urgentes pour production

### Workflow de branche

```bash
# 1. Se placer sur develop
git checkout develop
git pull origin develop

# 2. Créer une branche de travail
git checkout -b feature/ma-nouvelle-fonctionnalite

# 3. Développer et commiter
git add .
git commit -m "feat: description de la fonctionnalité"

# 4. Pousser et créer une PR vers develop
git push origin feature/ma-nouvelle-fonctionnalite
# → Créer PR vers develop sur GitHub

# 5. Après merge dans develop et validation
# → Créer PR de develop vers main pour mise en production
```

## 3. Commandes Utiles

### Développement

```bash
# Démarrer tous les services
pnpm dev

# Démarrer un service spécifique
pnpm --filter @swalo/api dev
pnpm --filter @swalo/web dev
cd apps/mobile && npx expo start
```

### Base de données

```bash
# Migrations
cd apps/api
pnpm prisma:migrate     # Créer/appliquer migrations en dev
pnpm prisma:studio      # Interface visuelle de la BDD

# Seed (ATTENTION: vérifie NODE_ENV)
pnpm prisma:seed
```

### Validation

```bash
# Linter + Tests
pnpm run validate

# Linter seul
pnpm run lint

# Tests seuls
pnpm run test

# Tests d'un package
pnpm --filter @swalo/api run test
pnpm --filter @swalo/mobile run test
```

## 4. Variables d'Environnement

### Structure des fichiers

```
swalo/
├── .env.development          # Racine (Docker + variables globales)
├── apps/
│   ├── api/.env.development  # Variables API
│   ├── mobile/.env.development # Variables Mobile
│   └── web/.env.development  # Variables Web
```

### Variables importantes

| Variable | Description | Dev Local | Production |
|----------|-------------|-----------|------------|
| `DATABASE_URL` | URL PostgreSQL | localhost:5432 | Neon (pooled) |
| `JWT_SECRET` | Secret JWT | dev_secret | Secret sécurisé |
| `NODE_ENV` | Environnement | development | production |
| `VITE_API_URL` | URL API (web) | localhost:3000 | Render URL |
| `EXPO_PUBLIC_API_URL` | URL API (mobile) | IP locale | Render URL |

## 5. CI/CD

### Workflow sur develop

1. Push sur `develop` déclenche `.github/workflows/deploy-staging.yml`
2. Tests et lint (bloquants)
3. Build de tous les packages
4. Déploiement preview sur Vercel

### Workflow sur main

1. PR mergée dans `main` déclenche `.github/workflows/deploy.yml`
2. Tests et lint (bloquants)
3. Build de tous les packages
4. Déploiement:
   - API → Render
   - Web → Vercel (production)
   - Mobile → EAS Build

## 6. Bonnes Pratiques

### Commits

Utiliser les conventions de commit:
- `feat:` Nouvelle fonctionnalité
- `fix:` Correction de bug
- `docs:` Documentation
- `style:` Formatage (pas de changement de code)
- `refactor:` Refactoring
- `test:` Ajout de tests
- `chore:` Maintenance

### Pull Requests

1. Toujours créer une PR (pas de push direct sur `main`)
2. Attendre que les checks CI passent
3. Demander une review si équipe > 1
4. Merger uniquement si tous les checks sont verts

### Sécurité

- Ne JAMAIS commiter les fichiers `.env` (non-example)
- Utiliser des JWT secrets différents par environnement
- Le seed ne fonctionne PAS en production (protection intégrée)

## 7. Troubleshooting

### Docker PostgreSQL ne démarre pas

```bash
# Vérifier si un autre service utilise le port 5432
netstat -an | grep 5432

# Redémarrer Docker
docker compose --profile local down
docker compose --profile local up -d postgres
```

### Erreur de connexion Prisma

```bash
# Vérifier que PostgreSQL est accessible
docker compose ps

# Régénérer le client Prisma
cd apps/api
npx prisma generate
```

### Mobile ne se connecte pas à l'API

1. Vérifier que l'API tourne sur le bon port
2. Pour appareil physique: utiliser l'IP de la machine (pas localhost)
3. Mettre à jour `EXPO_PUBLIC_API_URL` avec l'IP correcte

## 8. Ressources

- [Documentation Prisma](https://www.prisma.io/docs)
- [Documentation Expo](https://docs.expo.dev)
- [Documentation NestJS](https://docs.nestjs.com)
- [Guide de déploiement](./deployment/guide.md)
- [Configuration des environnements](./deployment/environments.md)
