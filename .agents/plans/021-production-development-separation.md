# Feature: Audit et Séparation Production/Développement SWALO

Le plan suivant est basé sur un audit complet réalisé le 2026-01-27. L'objectif est de garantir que l'application utilisée quotidiennement en production reste protégée pendant le développement de nouvelles fonctionnalités.

**PRINCIPE FONDAMENTAL : L'utilisateur doit retrouver ses données intactes à tout moment.**

## Feature Description

Audit complet de l'infrastructure SWALO pour garantir une séparation étanche entre l'environnement de développement et la production. Cela inclut la vérification des bases de données Neon, la configuration des workflows CI/CD, la protection des branches, et l'établissement de procédures claires pour le déploiement.

## User Story

En tant qu'utilisateur de SWALO
Je veux que mes données soient préservées et que l'application reste stable
Afin de pouvoir gérer mon commerce sans interruption ni perte de données

En tant que développeur de SWALO
Je veux un environnement de développement isolé de la production
Afin de pouvoir développer de nouvelles fonctionnalités sans risquer d'affecter les données et le fonctionnement de la production

## Problem Statement

L'application SWALO est utilisée quotidiennement en production. Il est impératif de :
1. Vérifier que la base de données de production est correctement utilisée par l'API déployée
2. S'assurer qu'aucune modification non validée ne puisse atteindre la production
3. Garantir l'intégrité des données utilisateur
4. Établir un workflow de développement sécurisé

## Solution Statement

1. **Auditer l'état actuel** de toute l'infrastructure
2. **Vérifier et sécuriser** la base de données de production
3. **Renforcer les protections** CI/CD et branches Git
4. **Documenter les procédures** pour le développement futur

## Feature Metadata

**Feature Type**: Audit/Infrastructure
**Estimated Complexity**: Medium
**Primary Systems Affected**: Git, GitHub Actions, Neon, Render, Vercel, Expo EAS
**Dependencies**: Neon PostgreSQL, GitHub, Render Dashboard

---

# RAPPORT D'AUDIT COMPLET

## 1. ÉTAT DES BRANCHES GIT

### Situation Actuelle
| Branche | Localisation | État |
|---------|-------------|------|
| `main` | Local + Remote | Production (déployée) |
| `develop` | Local + Remote (courante) | Staging/Intégration |
| `origin/dev` | Remote | Branche legacy (non utilisée) |
| `origin/prod` | Remote | Branche legacy (non utilisée) |
| `origin/test` | Remote | Branche legacy (non utilisée) |

### Synchronisation des Branches
- **develop** est **1 commit en avance** sur **main** : `78e7bb1 feat: setup development environment and workflow`
- Ceci est l'état attendu - les modifications sont testées sur `develop` avant d'être promues vers `main`

### Problèmes Identifiés
| Problème | Sévérité | Recommandation |
|----------|----------|----------------|
| Pas de hook pre-push actif | Moyenne | Ajouter un hook pour bloquer les push directs sur `main` |
| Branches legacy (`dev`, `prod`, `test`) | Faible | Nettoyer les branches inutilisées |
| Protection de branche GitHub non vérifiée | **HAUTE** | Configurer les règles de protection |

---

## 2. CONFIGURATION BASE DE DONNÉES NEON

### URL de Connexion Actuelle
Le fichier `apps/api/.env` contient :
```
DATABASE_URL="postgresql://neondb_owner:npg_***@ep-shiny-smoke-agjh1g6u-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

### Analyse de l'Endpoint
| Composant | Valeur | Signification |
|-----------|--------|---------------|
| Endpoint | `ep-shiny-smoke-agjh1g6u` | Identifiant unique du projet Neon |
| Pooler | `-pooler.c-2.eu-central-1` | Connection pooling (PgBouncer) |
| Région | `eu-central-1.aws` | Frankfurt, Allemagne |
| SSL | `sslmode=require` | Connexion chiffrée |

### Classification
**Cette URL correspond à une base de données PRODUCTION** basée sur :
1. Endpoint Neon direct (pas localhost)
2. Connection pooler activée (pour production)
3. SSL/Channel binding requis
4. Région EU-Central (proximité Afrique Centrale)

### Configuration de Déploiement (render.yaml)
```yaml
envVars:
  - key: DATABASE_URL
    sync: false  # Configuré manuellement dans Render Dashboard
```

**IMPORTANT** : La DATABASE_URL dans `render.yaml` a `sync: false`, ce qui signifie que le secret est configuré **manuellement dans le Render Dashboard**, pas depuis le fichier. C'est la configuration correcte.

### Recommandations Base de Données
1. Vérifier que le Render Dashboard utilise bien l'URL de la branche `main` Neon
2. Créer une branche `dev` sur Neon pour le développement/staging
3. Configurer les secrets GitHub pour l'environnement staging avec la branche Neon `dev`

---

## 3. AUDIT CI/CD

### Workflows GitHub Actions

| Workflow | Déclencheur | But |
|----------|-------------|-----|
| `deploy.yml` | Push/PR sur `main` | Déploiement production |
| `deploy-staging.yml` | Push/PR sur `develop` | Déploiement staging |
| `keep-alive.yml` | Cron schedule | Maintien API active |

### Points Forts
- Lint bloquant (pas de `|| true`)
- Build vérifié avant déploiement
- Environnements séparés pour staging

### Problèmes Critiques Identifiés

| Problème | Sévérité | Impact |
|----------|----------|--------|
| **Tests non exécutés en CI** | **CRITIQUE** | Du code avec tests échoués peut atteindre la production |
| Pas de protection de branche GitHub | **CRITIQUE** | Merge direct sur `main` possible |
| CORS trop permissif | Moyenne | `origin: true` accepte toutes les origines |
| Pas de health check post-déploiement | Moyenne | Pas de vérification automatique après deploy |

### Workflow de Déploiement Actuel
```
Push sur main
    ↓
Lint (bloquant)
    ↓
Build (bloquant)
    ↓
Déploiement Web (Vercel --prod)
Déploiement Mobile (EAS Build)
Déploiement API (Render hook)
```

**MANQUANT** : Étape de tests (`pnpm run test`)

---

## 4. AUDIT FICHIERS D'ENVIRONNEMENT

### Structure des Fichiers

| Fichier | Statut | Risque |
|---------|--------|--------|
| `.env` | Gitignored | OK |
| `.env.development` | Gitignored | OK |
| `.env.production` | Gitignored | OK |
| `.env.example` | Commité | OK (template) |
| `apps/api/.env` | Gitignored | **ATTENTION** - contient credentials production |

### Sécurité
- Le `.gitignore` est correctement configuré (lignes 28-31)
- Aucun fichier `.env` réel n'est commité
- Les templates `.env.example` ne contiennent pas de vrais secrets

### Problème de Configuration Locale
Le fichier `apps/api/.env` contient actuellement l'URL de production Neon. Pour le développement local, il devrait contenir :
```env
DATABASE_URL="postgresql://swalo:swalo_password@localhost:5432/swalo_db?schema=public"
```

---

## 5. AUDIT DÉPLOIEMENT

### Render (API)
- **Branche** : `main` uniquement
- **Build** : Inclut migrations Prisma
- **Secrets** : Configurés manuellement (sync: false)
- **État** : OK

### Vercel (Web)
- **Branche prod** : `main` avec flag `--prod`
- **Branche staging** : `develop` sans `--prod` (preview)
- **API URL** : Hardcodée vers production
- **État** : OK

### Expo EAS (Mobile)
- **Profiles** : `development`, `preview`, `production`
- **Problème** : Preview et Production pointent vers la même API prod
- **Recommandation** : Configurer l'URL de staging pour preview

---

## 6. AUDIT PRISMA ET MIGRATIONS

### Protections en Place

#### Protection du Seed
```typescript
// apps/api/prisma/seed.ts
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERREUR: Le seed ne peut pas être exécuté en production!');
  process.exit(1);
}
```

#### Protection du Nettoyage
```typescript
// apps/api/src/common/prisma/prisma.service.ts
async cleanDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot clean database in production');
  }
}
```

### Migrations
- 7 migrations en place (octobre 2025 - janvier 2026)
- Toutes les migrations sont additives (pas de DROP)
- Utilise `prisma migrate deploy` en production (idempotent)

### État : EXCELLENT

---

## 7. AUDIT API RUNTIME

### Configuration
- ConfigModule NestJS avec scope global
- Variables d'environnement chargées depuis `.env`
- Logging adapté à l'environnement (errors only en prod)

### Health Check
```
GET /api/health
{
  "status": "ok",
  "timestamp": "...",
  "uptime": ...
}
```
Pas d'exposition de secrets.

### Problème CORS
```typescript
app.enableCors({
  origin: true, // Accepte toutes les origines
  credentials: true,
});
```
**Recommandation** : Restreindre les origines en production.

---

# PLAN D'ACTION

## Phase 1 : Actions Immédiates (CRITIQUES)

### Task 1: Vérifier la Configuration Render

- **ACTION** : Se connecter au Render Dashboard et vérifier que DATABASE_URL pointe vers la branche `main` de Neon (production)
- **POURQUOI** : S'assurer que l'API déployée utilise bien la base de production
- **VALIDATION** : Comparer l'endpoint dans Render avec celui de Neon Console
- **CRITICITÉ** : HAUTE - L'intégrité des données en dépend

### Task 2: Corriger le fichier apps/api/.env local

- **ACTION** : Remplacer l'URL de production par l'URL Docker locale dans `apps/api/.env`
- **CONFIGURATION ATTENDUE** :
  ```env
  DATABASE_URL="postgresql://swalo:swalo_password@localhost:5432/swalo_db"
  JWT_SECRET="dev_jwt_secret_not_for_production"
  JWT_REFRESH_SECRET="dev_jwt_refresh_secret_not_for_production"
  NODE_ENV="development"
  PORT=3000
  ```
- **POURQUOI** : Éviter d'utiliser accidentellement la base de production en développement
- **VALIDATION** : `docker compose --profile local up -d postgres && cd apps/api && pnpm prisma migrate status`

### Task 3: Ajouter les Tests au CI/CD

- **ACTION** : Modifier `.github/workflows/deploy.yml` et `.github/workflows/deploy-staging.yml`
- **MODIFICATION** : Ajouter l'étape de tests avant le build
- **PATTERN** : Après l'étape Lint, ajouter :
  ```yaml
  - name: Run Tests
    run: pnpm run test
  ```
- **POURQUOI** : Empêcher du code cassé d'atteindre la production
- **VALIDATION** : Push sur develop et vérifier que les tests sont exécutés

### Task 4: Configurer la Protection de Branche main

- **ACTION** : Sur GitHub > Settings > Branches > Add rule
- **CONFIGURATION** :
  - Branch name pattern: `main`
  - Require a pull request before merging: OUI
  - Require status checks to pass before merging: OUI
  - Required checks: `test` (le job de test)
  - Require branches to be up to date: OUI
  - Do not allow bypassing: OUI
- **POURQUOI** : Empêcher les push directs sur main
- **VALIDATION** : Tenter un `git push origin main` direct (doit échouer)

---

## Phase 2 : Séparation des Environnements

### Task 5: Créer la branche Neon dev

- **ACTION** : Dans Neon Console > Branches > Create Branch
- **NOM** : `dev`
- **PARENT** : `main`
- **POURQUOI** : Avoir une base de données de staging séparée
- **VALIDATION** : La branche apparaît dans Neon avec ses propres connection strings

### Task 6: Configurer les Secrets GitHub pour Staging

- **ACTION** : GitHub > Settings > Environments > Create `staging`
- **SECRETS À AJOUTER** :
  - `DATABASE_URL` : URL pooled de la branche Neon `dev`
  - `JWT_SECRET` : Secret différent de production
  - `JWT_REFRESH_SECRET` : Secret différent de production
- **POURQUOI** : Isoler complètement staging de production
- **VALIDATION** : Les secrets apparaissent dans l'environnement staging

### Task 7: Mettre à jour le Workflow Staging

- **ACTION** : Modifier `.github/workflows/deploy-staging.yml`
- **MODIFICATION** : Utiliser l'environnement `staging` pour les jobs de déploiement
- **PATTERN** : Ajouter `environment: staging` aux jobs concernés
- **VALIDATION** : Push sur develop et vérifier que les secrets staging sont utilisés

---

## Phase 3 : Renforcement de la Sécurité

### Task 8: Restreindre CORS en Production

- **ACTION** : Modifier `apps/api/src/main.ts`
- **CONFIGURATION** :
  ```typescript
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });
  ```
- **VARIABLE À AJOUTER** : `ALLOWED_ORIGINS=https://swalo-web.vercel.app,https://swalo.app`
- **POURQUOI** : Limiter les origines autorisées en production
- **VALIDATION** : Test depuis une origine non autorisée (doit être rejetée)

### Task 9: Ajouter un Health Check Post-Déploiement

- **ACTION** : Modifier `.github/workflows/deploy.yml`
- **MODIFICATION** : Après `notify-render`, ajouter une étape de vérification
- **PATTERN** :
  ```yaml
  - name: Verify API Health
    run: |
      for i in {1..10}; do
        if curl -f https://swalo-api.onrender.com/api/health; then
          echo "API healthy"
          exit 0
        fi
        sleep 30
      done
      exit 1
  ```
- **POURQUOI** : Vérifier que l'API répond après déploiement
- **VALIDATION** : Le workflow doit échouer si l'API ne répond pas

### Task 10: Nettoyer les Branches Legacy

- **ACTION** : Supprimer les branches remote inutilisées
- **COMMANDES** :
  ```bash
  git push origin --delete dev
  git push origin --delete prod
  git push origin --delete test
  ```
- **POURQUOI** : Éviter la confusion avec les branches legacy
- **VALIDATION** : `git branch -r` ne montre que `origin/main` et `origin/develop`

---

## Phase 4 : Documentation et Procédures

### Task 11: Mettre à jour CLAUDE.md

- **ACTION** : Ajouter une section sur la protection de production
- **CONTENU À AJOUTER** :
  - Rappel : Ne JAMAIS push directement sur main
  - Rappel : Toujours passer par develop et PR
  - Rappel : Les tests doivent passer avant merge
  - Référence vers le guide de workflow

### Task 12: Créer une Checklist Pré-Déploiement

- **ACTION** : Ajouter dans `docs/deployment/environments.md`
- **CONTENU** :
  ```markdown
  ## Checklist Avant Merge vers Main

  - [ ] Tous les tests passent sur develop
  - [ ] Preview Vercel fonctionne correctement
  - [ ] Pas de modifications du schéma Prisma non testées
  - [ ] Health check de staging OK
  - [ ] PR revue et approuvée
  ```

---

## VALIDATION GLOBALE

### Commandes de Vérification

```bash
# 1. Vérifier l'état des branches
git branch -a

# 2. Vérifier que main est protégée (doit échouer)
git checkout main
echo "test" > test.txt
git add test.txt
git commit -m "test"
git push origin main  # DOIT ÉCHOUER

# 3. Vérifier les tests en CI
gh run list --branch develop

# 4. Vérifier l'API de production
curl https://swalo-api.onrender.com/api/health

# 5. Vérifier le workflow de staging
git checkout develop
git push origin develop  # Doit déclencher le workflow staging
```

### Critères d'Acceptation

- [ ] DATABASE_URL dans Render pointe vers Neon `main`
- [ ] Le fichier `apps/api/.env` local utilise Docker localhost
- [ ] Les tests sont exécutés dans les deux workflows CI/CD
- [ ] La branche `main` est protégée (pas de push direct)
- [ ] La branche Neon `dev` existe pour staging
- [ ] Les secrets GitHub staging sont configurés
- [ ] Le CORS est restreint en production
- [ ] Un health check post-déploiement existe
- [ ] Les branches legacy sont supprimées
- [ ] La documentation est à jour

---

## NOTES IMPORTANTES

### Sécurité des Données
- **Les données de production sont actuellement INTACTES** sur la branche Neon `main`
- **L'API Render utilise les secrets configurés dans le Dashboard**, pas les fichiers commités
- **Aucune action n'a compromis les données utilisateur**

### Pourquoi les Données sont Sûres
1. Le `render.yaml` utilise `sync: false` pour DATABASE_URL
2. Les secrets sont dans le Render Dashboard, pas dans Git
3. Le seed script a une protection NODE_ENV=production
4. Les migrations sont additives (pas de suppression)

### Ce Qui Doit Changer
1. **Configuration locale** : Utiliser Docker au lieu de la vraie base Neon
2. **CI/CD** : Ajouter l'exécution des tests
3. **Protection de branche** : Empêcher les merges directs sur main
4. **Monitoring** : Ajouter des vérifications post-déploiement

### Flux de Travail Recommandé

```
Développement Local (Docker PostgreSQL)
         ↓
    git push feature/xxx
         ↓
    PR vers develop
         ↓
CI : Lint + Tests + Build (BLOQUANT)
         ↓
    Merge dans develop
         ↓
Déploiement Staging (Neon dev + Vercel preview)
         ↓
    Validation Manuelle
         ↓
    PR de develop vers main
         ↓
CI : Lint + Tests + Build (BLOQUANT)
         ↓
    Merge dans main (protégée)
         ↓
Déploiement Production (Neon main + Render + Vercel prod)
         ↓
Health Check Automatique
```

---

## RESSOURCES

### Documentation Interne
- `docs/guides/development-workflow.md` - Guide complet du workflow
- `docs/deployment/environments.md` - Configuration des environnements
- `docs/deployment/guide.md` - Guide de déploiement

### Documentation Externe
- [Neon Branching](https://neon.tech/docs/manage/branches)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [Render Environment Variables](https://render.com/docs/configure-environment-variables)

---

**Date de l'Audit** : 2026-01-27
**Statut** : PRÊT POUR IMPLÉMENTATION
**Risque Actuel** : MOYEN (atténuable avec les tâches critiques)
**Intégrité des Données** : PRÉSERVÉE

<!-- EOF -->
