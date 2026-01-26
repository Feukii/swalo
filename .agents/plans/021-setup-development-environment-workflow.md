# Feature: Configuration d'un Workflow Développement vers Production

Le plan suivant doit être complet, mais il est important de valider la documentation et les patterns du codebase avant de commencer l'implémentation.

Portez une attention particulière aux nommages des utils, types et modèles existants. Importez depuis les bons fichiers, etc.

## Feature Description

Mise en place d'un environnement de développement isolé de la production avec un workflow fluide pour le passage de dev vers prod. Cela inclut la création d'une branche `develop`, la configuration d'une base de données Neon de développement, la mise à jour des configurations d'environnement, et l'établissement de procédures claires pour le déploiement.

## User Story

En tant que développeur de SWALO
Je veux avoir un environnement de développement isolé de la production
Afin de pouvoir tester mes modifications sans risquer d'affecter les données et le fonctionnement de la production

## Problem Statement

L'application SWALO est actuellement en production et stable. Cependant, toutes les modifications se font directement sur la branche `main` qui est déployée en production. Il n'existe pas d'environnement de développement/staging séparé, ce qui présente des risques :
- Modifications non testées pouvant impacter la production
- Pas d'isolation des données entre dev et prod
- Pas de workflow de revue avant mise en production
- Difficulté à tester les migrations de base de données

## Solution Statement

Établir un workflow de développement en trois étapes avec isolation complète :
1. **Environnement local** : Docker PostgreSQL + API locale pour le développement quotidien
2. **Branche develop + Neon dev** : Branche de développement avec sa propre base de données Neon
3. **Branche main (Production)** : Branche protégée déployée automatiquement en production

Le flux sera : développement local → push sur `develop` → tests automatiques → PR vers `main` → déploiement production

## Feature Metadata

**Feature Type**: Enhancement/Infrastructure
**Estimated Complexity**: Medium
**Primary Systems Affected**: Git workflow, CI/CD, Database, Environment configuration, Documentation
**Dependencies**: Neon (branching), GitHub Actions, Render, Vercel, Expo EAS

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `.github/workflows/deploy.yml` (lignes 1-109) - Why: Workflow de déploiement production existant à comprendre
- `.github/workflows/deploy-staging.yml` (lignes 1-119) - Why: Workflow staging existant, déjà configuré pour branche develop
- `turbo.json` (lignes 1-38) - Why: Configuration Turborepo pour comprendre les pipelines existants
- `render.yaml` (lignes 1-55) - Why: Configuration Render pour la production
- `vercel.json` (lignes 1-47) - Why: Configuration Vercel existante
- `apps/mobile/eas.json` (lignes 1-35) - Why: Configuration EAS avec channels existants
- `.env.example` (lignes 1-58) - Why: Template de variables d'environnement principal
- `.env.development.example` (lignes 1-22) - Why: Template existant pour développement avec Neon
- `.env.staging.example` (lignes 1-65) - Why: Template existant pour staging, très détaillé
- `.env.production.example` (lignes 1-36) - Why: Template production avec instructions Render
- `docker-compose.yml` (lignes 1-88) - Why: Configuration Docker existante avec profiles
- `docs/deployment/guide.md` (lignes 1-422) - Why: Documentation de déploiement actuelle à mettre à jour
- `docs/deployment/environments.md` (lignes 1-40) - Why: Documentation des environnements à enrichir
- `apps/mobile/app.config.ts` (lignes 1-55) - Why: Configuration Expo avec gestion d'URL API

### New Files to Create

- `.env.development` - Configuration locale avec PostgreSQL Docker
- `apps/api/.env.development` - Variables API pour environnement de développement
- `apps/mobile/.env.development` - Variables mobile pour développement
- `apps/web/.env.development` - Variables web pour développement
- `docs/guides/development-workflow.md` - Guide du workflow de développement
- `scripts/setup-dev.sh` - Script d'initialisation de l'environnement de développement (optionnel)

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [Neon Branching Documentation](https://neon.tech/docs/manage/branches)
  - Specific section: Creating and managing branches
  - Why: Comprendre comment créer et gérer les branches Neon
- [GitHub Protected Branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
  - Specific section: Managing branch protection rules
  - Why: Protéger la branche main pour éviter les push directs
- [Expo EAS Update Channels](https://docs.expo.dev/eas-update/how-eas-update-works/)
  - Specific section: Channels and deployment
  - Why: Comprendre les channels development/preview/production existants

### Patterns to Follow

**Naming Conventions:**
- Variables d'environnement : MAJUSCULES_AVEC_UNDERSCORES
- Fichiers de config : `.env.{environment}`
- Branches Neon : `dev`, `staging`, `main` (correspondant aux branches Git)
- Reference: `.env.example`, `render.yaml`

**Error Handling:**
- Scripts doivent échouer proprement avec messages explicatifs
- Vérification des prérequis avant exécution
- Reference: `scripts/` existants dans le projet

**Environment Variable Pattern:**
- Chaque app a ses propres variables préfixées (VITE_ pour web, EXPO_PUBLIC_ pour mobile)
- Variables sensibles jamais commitées (.env dans .gitignore)
- Reference: `apps/api/.env.example`, `apps/mobile/.env.example`

**Git Workflow Pattern:**
- Feature branches depuis `develop`
- PRs vers `develop` pour intégration
- PRs depuis `develop` vers `main` pour production
- Reference: `docs/deployment/environments.md`

**Other Relevant Patterns:**
- Profiles Docker pour isolation (`local` profile existant)
- Turborepo pour orchestration des builds
- GitHub Environments pour secrets par environnement
- Reference: `docker-compose.yml`, `turbo.json`

---

## IMPLEMENTATION PLAN

### Phase 1: Configuration Git et Branches

Créer la structure de branches Git et configurer les protections nécessaires pour établir un workflow sécurisé.

**Tasks:**

- Créer la branche `develop` depuis `main`
- Pousser `develop` vers le remote
- Configurer la protection de branche `main` sur GitHub

### Phase 2: Configuration Base de Données Neon

Créer une branche Neon `dev` pour isoler les données de développement de la production.

**Tasks:**

- Créer une branche `dev` sur Neon depuis la branche `main`
- Récupérer les credentials de connexion (pooled et direct)
- Documenter les URLs de connexion

### Phase 3: Configuration Environnement Local

Configurer l'environnement de développement local avec Docker PostgreSQL et les variables d'environnement appropriées.

**Tasks:**

- Créer les fichiers `.env.development` pour chaque app
- Vérifier que Docker PostgreSQL fonctionne avec le profile `local`
- Configurer les URLs API pour le développement local

### Phase 4: Configuration CI/CD Staging

Mettre à jour les workflows GitHub Actions pour le staging et configurer les secrets nécessaires.

**Tasks:**

- Vérifier et ajuster `deploy-staging.yml` si nécessaire
- Configurer les secrets GitHub pour l'environnement staging
- Configurer les variables GitHub pour les URLs staging

### Phase 5: Configuration Mobile (EAS)

Mettre à jour la configuration EAS pour supporter les différents environnements.

**Tasks:**

- Vérifier les build profiles dans `eas.json`
- Ajouter/vérifier le channel `development`
- Documenter les commandes de build par environnement

### Phase 6: Documentation et Procédures

Créer une documentation complète du workflow de développement.

**Tasks:**

- Créer le guide de workflow de développement
- Mettre à jour la documentation des environnements
- Documenter les procédures de déploiement

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task 1: CREATE branche `develop` sur Git

- **IMPLEMENT**: Créer une nouvelle branche Git nommée `develop` à partir de la branche `main` actuelle. Cette branche servira de base pour tout le développement et sera déployée en staging.
- **PATTERN**: Workflow Git standard avec branches `main` et `develop`. Référence: `docs/deployment/environments.md:12-15`
- **DEPENDENCIES**: Git CLI installé, accès au repository
- **GOTCHA**: S'assurer d'être sur la dernière version de `main` avant de créer `develop`
- **RESOURCES**:
  - [Git Branching](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell)
- **VALIDATE**: `git branch -a | grep develop`
- **TEST_REQUIREMENT**: La branche `develop` existe localement et sur le remote

### Task 2: UPDATE GitHub - Protection de branche `main`

- **IMPLEMENT**: Configurer des règles de protection sur la branche `main` pour empêcher les push directs. Exiger des pull requests avec au moins 1 approbation (ou 0 si développeur solo). Exiger que les checks de statut passent avant le merge.
- **PATTERN**: GitHub Branch Protection standard. Référence: documentation GitHub
- **DEPENDENCIES**: Accès admin au repository GitHub
- **GOTCHA**: Pour un développeur solo, ne pas exiger d'approbation obligatoire mais garder les autres protections
- **RESOURCES**:
  - [GitHub Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- **VALIDATE**: Vérifier via GitHub UI que la protection est active
- **TEST_REQUIREMENT**: Impossible de push directement sur `main`

### Task 3: BACKUP production Neon avant modifications

- **IMPLEMENT**: Créer une sauvegarde manuelle de la base de données production Neon AVANT toute modification. Cette sauvegarde servira de point de restauration en cas de problème.
- **PATTERN**: Backup before changes (best practice conservative). Référence: Neon documentation
- **DEPENDENCIES**: Accès à la console Neon
- **GOTCHA**: Neon a un point-in-time recovery automatique, mais un backup manuel explicite est plus rassurant et documenté.
- **RESOURCES**:
  - [Neon Backups](https://neon.tech/docs/manage/backups)
- **VALIDATE**: Vérifier dans Neon Console que le backup apparaît avec label "Pre-dev-environment-setup-[DATE]"
- **TEST_REQUIREMENT**: Backup visible dans la liste des backups Neon

### Task 4: CREATE branche Neon `dev`

- **IMPLEMENT**: Dans la console Neon (console.neon.tech), créer une nouvelle branche nommée `dev` à partir de la branche `main`. Cette branche contiendra une copie des données de production au moment de sa création et évoluera indépendamment.
- **PATTERN**: Neon branching pour isolation des environnements. Référence: `.env.development.example:17-18`
- **DEPENDENCIES**: Compte Neon avec projet SWALO existant, Task 3 (backup) complétée
- **GOTCHA**: La branche `dev` aura ses propres credentials, différents de `main`. Utiliser la connection pooled pour l'application, directe pour les migrations.
- **RESOURCES**:
  - [Neon Branching](https://neon.tech/docs/manage/branches)
  - [Neon Connection Pooling](https://neon.tech/docs/connect/connection-pooling)
- **VALIDATE**: Vérifier dans Neon Console que la branche `dev` apparaît dans la liste
- **TEST_REQUIREMENT**: Branche `dev` visible dans Neon avec ses propres connection strings

### Task 5: CREATE `.env.development` à la racine du projet

- **IMPLEMENT**: Créer un fichier `.env.development` à la racine du projet contenant les variables pour le développement local avec Docker PostgreSQL. Ce fichier sera utilisé pour le développement quotidien en local.
- **PATTERN**: Format de `.env.example` avec variables pour Docker local. Référence: `.env.example`, `.env.docker`
- **DEPENDENCIES**: Fichier `.env.example` existant comme template
- **GOTCHA**: Ne PAS commiter ce fichier (doit être dans .gitignore). Utiliser les valeurs de `.env.docker` pour PostgreSQL local.
- **RESOURCES**:
  - `.env.example` du projet
  - `docker-compose.yml:6-26` pour les valeurs PostgreSQL
- **VALIDATE**: `test -f .env.development && echo "File exists"`
- **TEST_REQUIREMENT**: Le fichier existe et contient les variables DATABASE_URL, JWT_SECRET, etc.

### Task 6: CREATE `apps/api/.env.development`

- **IMPLEMENT**: Créer un fichier de configuration pour l'API en mode développement local. Doit pointer vers la base PostgreSQL Docker locale et utiliser des secrets de développement.
- **PATTERN**: Miroir de `apps/api/.env.example` avec valeurs de développement. Référence: `apps/api/.env.example`
- **DEPENDENCIES**: Task 4 complétée
- **GOTCHA**: Utiliser des JWT secrets différents de la production. NODE_ENV doit être "development".
- **RESOURCES**:
  - `apps/api/.env.example`
- **VALIDATE**: `test -f apps/api/.env.development && echo "File exists"`
- **TEST_REQUIREMENT**: Le fichier existe avec DATABASE_URL pointant vers localhost:5432

### Task 7: UPDATE `apps/mobile/.env.example` et créer `.env.development`

- **IMPLEMENT**: S'assurer que le template mobile et la configuration de développement pointent vers l'API locale pour le développement.
- **PATTERN**: Variables préfixées EXPO_PUBLIC_ pour Expo. Référence: `apps/mobile/.env.example`
- **DEPENDENCIES**: Connaissance de l'IP locale ou utilisation de localhost
- **GOTCHA**: Pour le développement mobile avec appareil physique, utiliser l'IP de la machine de développement (ex: 192.168.x.x). Pour émulateur, localhost fonctionne.
- **RESOURCES**:
  - `apps/mobile/app.config.ts:4-5` pour voir comment l'URL est gérée
  - [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- **VALIDATE**: Vérifier que EXPO_PUBLIC_API_URL est défini
- **TEST_REQUIREMENT**: Configuration mobile pointe vers API locale

### Task 8: CREATE `apps/web/.env.development`

- **IMPLEMENT**: Créer un fichier de configuration pour le web dashboard en mode développement. Doit pointer vers l'API locale.
- **PATTERN**: Variables préfixées VITE_ pour Vite. Référence: `.env.example:37`
- **DEPENDENCIES**: Aucune
- **GOTCHA**: VITE_API_URL doit inclure le chemin `/api` complet.
- **RESOURCES**:
  - [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- **VALIDATE**: `test -f apps/web/.env.development && grep "VITE_API_URL" apps/web/.env.development`
- **TEST_REQUIREMENT**: VITE_API_URL=http://localhost:3000/api

### Task 9: VERIFY Docker PostgreSQL avec profile `local`

- **IMPLEMENT**: Vérifier que Docker Compose démarre correctement PostgreSQL avec le profile `local`. Tester la connexion à la base de données.
- **PATTERN**: Utilisation des profiles Docker Compose. Référence: `docker-compose.yml:26`
- **DEPENDENCIES**: Docker et Docker Compose installés
- **GOTCHA**: Le profile `local` est requis pour démarrer PostgreSQL : `docker compose --profile local up -d postgres`
- **RESOURCES**:
  - `docker-compose.yml`
  - [Docker Compose Profiles](https://docs.docker.com/compose/profiles/)
- **VALIDATE**: `docker compose --profile local up -d postgres && docker compose ps | grep swalo-postgres`
- **TEST_REQUIREMENT**: Container PostgreSQL running et accessible sur port 5432

### Task 10: VERIFY connexion Prisma avec base locale

- **IMPLEMENT**: Vérifier que Prisma peut se connecter à la base PostgreSQL locale et exécuter les migrations.
- **PATTERN**: Commandes Prisma standard. Référence: `apps/api/package.json:23-26`
- **DEPENDENCIES**: Task 8 complétée (PostgreSQL running)
- **GOTCHA**: Charger les variables depuis `.env.development` ou définir DATABASE_URL avant d'exécuter les commandes Prisma.
- **RESOURCES**:
  - [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- **VALIDATE**: `cd apps/api && DATABASE_URL="postgresql://swalo:swalo_password@localhost:5432/swalo_db" npx prisma migrate status`
- **TEST_REQUIREMENT**: Prisma peut se connecter et affiche le statut des migrations

### Task 11: UPDATE GitHub Secrets et Variables pour staging

- **IMPLEMENT**: Configurer les secrets et variables GitHub pour l'environnement staging. Créer l'environment "staging" avec les secrets nécessaires.
- **PATTERN**: GitHub Environments avec secrets. Référence: `.env.staging.example:52-64`
- **DEPENDENCIES**: Credentials Neon de la branche `dev` (Task 3)
- **GOTCHA**: Les JWT secrets du staging doivent être différents de ceux de production pour éviter les cross-auth.
- **RESOURCES**:
  - [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
  - [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- **VALIDATE**: Vérifier via GitHub UI que l'environment "staging" existe avec ses secrets
- **TEST_REQUIREMENT**: Secrets DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET configurés pour staging

### Task 12: UPDATE workflows CI pour rendre les tests bloquants

- **IMPLEMENT**: Modifier les workflows `deploy.yml` et `deploy-staging.yml` pour supprimer le `|| true` sur la commande lint (ligne 47 dans les deux fichiers). Cela rend les tests bloquants - un échec de lint empêchera le déploiement.
- **PATTERN**: GitHub Actions avec gates bloquants. Référence: `.github/workflows/deploy.yml:47`, `.github/workflows/deploy-staging.yml:47`
- **DEPENDENCIES**: Task 10 complétée
- **GOTCHA**: Le `|| true` actuel permet au workflow de continuer même si le lint échoue. En le supprimant, les erreurs de lint bloqueront le déploiement, ce qui est le comportement souhaité pour un workflow de qualité.
- **RESOURCES**:
  - `.github/workflows/deploy.yml` existant
  - `.github/workflows/deploy-staging.yml` existant
  - [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- **VALIDATE**: Vérifier dans les fichiers que `pnpm run lint || true` est devenu `pnpm run lint`
- **TEST_REQUIREMENT**: Les workflows échouent correctement si le lint détecte des erreurs

### Task 13: VERIFY configuration EAS eas.json

- **IMPLEMENT**: Vérifier que les build profiles dans eas.json sont correctement configurés pour les différents environnements (development, preview, production).
- **PATTERN**: EAS build profiles avec channels. Référence: `apps/mobile/eas.json`
- **DEPENDENCIES**: Aucune
- **GOTCHA**: Le profile `preview` devrait pointer vers l'API de staging, pas production. Actuellement il pointe vers production.
- **RESOURCES**:
  - `apps/mobile/eas.json`
  - [EAS Build Configuration](https://docs.expo.dev/build/eas-json/)
- **VALIDATE**: Lire et vérifier les URLs API dans chaque profile
- **TEST_REQUIREMENT**: Chaque profile a la bonne EXPO_PUBLIC_API_URL

### Task 14: UPDATE eas.json pour staging

- **IMPLEMENT**: Modifier le profile `preview` dans eas.json pour utiliser l'URL de staging au lieu de production. Ajouter un profile `staging` si nécessaire pour plus de clarté.
- **PATTERN**: EAS profiles avec variables d'environnement. Référence: `apps/mobile/eas.json:14-22`
- **DEPENDENCIES**: Task 12 complétée
- **GOTCHA**: Si pas de service Render staging séparé, le preview peut continuer à utiliser l'API production. Documenter ce choix.
- **RESOURCES**:
  - [EAS Environment Variables](https://docs.expo.dev/build-reference/variables/)
- **VALIDATE**: `cat apps/mobile/eas.json` et vérifier les URLs
- **TEST_REQUIREMENT**: Configuration documentée et cohérente avec la stratégie choisie

### Task 15: CREATE docs/guides/development-workflow.md

- **IMPLEMENT**: Créer un guide complet du workflow de développement documentant : la structure des branches, les commandes de développement local, le processus de PR, et les procédures de déploiement.
- **PATTERN**: Documentation en français avec sections claires. Référence: `docs/deployment/guide.md` pour le style
- **DEPENDENCIES**: Toutes les tasks précédentes pour avoir les informations complètes
- **GOTCHA**: Adapter le guide au fait que c'est potentiellement un développeur solo (pas d'approbation PR obligatoire mais bonnes pratiques).
- **RESOURCES**:
  - `docs/deployment/guide.md` pour le format
  - CLAUDE.md pour les conventions de documentation
- **VALIDATE**: Le fichier existe et est lisible
- **TEST_REQUIREMENT**: Documentation complète couvrant setup local, branches, déploiement

### Task 16: UPDATE docs/deployment/environments.md

- **IMPLEMENT**: Enrichir la documentation des environnements avec les détails complets : URLs de chaque environnement, processus de passage d'un environnement à l'autre, et checklist de vérification.
- **PATTERN**: Documentation existante à enrichir. Référence: `docs/deployment/environments.md`
- **DEPENDENCIES**: Task 14 complétée
- **GOTCHA**: Garder la cohérence avec le nouveau guide de workflow créé.
- **RESOURCES**:
  - `docs/deployment/environments.md` existant
- **VALIDATE**: Vérifier que le fichier contient les nouvelles sections
- **TEST_REQUIREMENT**: Documentation mise à jour avec détails des 3 environnements

### Task 17: UPDATE CLAUDE.md avec le nouveau workflow

- **IMPLEMENT**: Ajouter une section sur le workflow de développement dans CLAUDE.md pour que Claude Code soit informé de la structure des branches et des procédures.
- **PATTERN**: Format existant de CLAUDE.md. Référence: `CLAUDE.md`
- **DEPENDENCIES**: Task 14 et 15 complétées
- **GOTCHA**: Garder la section concise, renvoyer vers la documentation détaillée.
- **RESOURCES**:
  - `CLAUDE.md` existant
- **VALIDATE**: `grep "develop" CLAUDE.md`
- **TEST_REQUIREMENT**: CLAUDE.md mentionne le workflow de branches

### Task 18: ADD protection NODE_ENV au seed script

- **IMPLEMENT**: Modifier le script de seed Prisma pour refuser de s'exécuter en environnement de production. Ajouter une vérification au début du fichier `apps/api/prisma/seed.ts` qui lève une erreur si NODE_ENV === 'production'.
- **PATTERN**: Protection contre exécution accidentelle en production. Référence: best practice de sécurité
- **DEPENDENCIES**: Aucune
- **GOTCHA**: Cette protection empêche l'exécution accidentelle du seed en production, ce qui pourrait créer des données de test ou corrompre les données existantes.
- **RESOURCES**:
  - `apps/api/prisma/seed.ts`
- **VALIDATE**: `NODE_ENV=production npx prisma db seed` doit échouer avec un message explicite
- **TEST_REQUIREMENT**: Le seed refuse de s'exécuter avec NODE_ENV=production

### Task 19: TEST workflow complet local → develop

- **IMPLEMENT**: Tester le workflow complet en local : démarrer les services Docker, lancer l'API en mode dev, effectuer une modification mineure, commiter et pousser vers develop.
- **PATTERN**: Test d'intégration du workflow
- **DEPENDENCIES**: Toutes les tasks précédentes
- **GOTCHA**: Utiliser les commandes documentées dans le nouveau guide de workflow.
- **RESOURCES**:
  - Documentation créée dans les tasks précédentes
- **VALIDATE**: La modification est visible sur la branche `develop` et le workflow CI se déclenche
- **TEST_REQUIREMENT**: Cycle complet fonctionnel sans erreurs

---

## TESTING STRATEGY

**MANDATORY REQUIREMENT**: All implementation tasks MUST have corresponding tests that validate functionality.

### Unit Tests

**Scope**: Pas de nouveaux tests unitaires requis pour cette feature (configuration d'infrastructure)
**Requirements**:
- Les tests existants doivent continuer à passer
- **VALIDATION COMMAND**: `pnpm run validate`

**Test Categories Required**:
- Tests existants de l'API
- Tests existants du mobile

### Integration Tests

**Scope**: Tests manuels d'intégration du workflow
**Requirements**:
- Workflow Git complet (local → develop → main)
- Déploiement automatique fonctionnel
- **VALIDATION COMMAND**: Push sur `develop` et vérifier GitHub Actions

**Test Scenarios Required**:
- Démarrage de l'environnement Docker local
- Connexion de l'API à la base locale
- Workflow CI sur push vers develop
- Merge de develop vers main déclenche déploiement production

### Edge Cases

**MANDATORY EDGE CASES TO TEST**:
- Tentative de push direct sur `main` (doit être refusée si protection configurée)
- Conflit de merge entre develop et main
- Échec de build - vérifier que le déploiement est bloqué
- Erreur de connexion à la base de données

### Test Resources

**Testing Documentation Links**:
- Guide de workflow créé: `docs/guides/development-workflow.md`
- Documentation CI/CD: `.github/workflows/`
- Documentation Prisma: https://www.prisma.io/docs

---

## VALIDATION COMMANDS

**CRITICAL REQUIREMENT**: Execute EVERY validation command and ALL tests MUST PASS before considering the feature complete.

### Level 1: Syntax & Style

**Required Commands**:
```
pnpm run lint
pnpm run format:check
```

**Expected Result**: Zero errors, zero warnings

### Level 2: Unit Tests

**Required Commands**:
```
pnpm run test
pnpm --filter @swalo/api run test
pnpm --filter @swalo/mobile run test
```

**Expected Result**:
- All unit tests pass
- No test failures or skipped tests

### Level 3: Integration Tests

**Required Commands**:
```
# Test environnement local
docker compose --profile local up -d postgres
cd apps/api && pnpm dev

# Dans un autre terminal
curl http://localhost:3000/api/health
```

**Expected Result**:
- PostgreSQL démarre correctement
- API répond avec `{"status":"ok"}`

### Level 4: Git Workflow Validation

**MANDATORY REQUIREMENT**: Vérifier le workflow Git complet

**Required Validations**:
- Branche `develop` existe : `git branch -a | grep develop`
- Protection de `main` active (vérifier via GitHub UI)
- Push sur develop déclenche CI : vérifier GitHub Actions

### Level 5: Environment Validation

**Required Validations**:
```
# Vérifier les fichiers de configuration existent
test -f .env.development && echo "Root .env.development OK"
test -f apps/api/.env.development && echo "API .env.development OK"
test -f apps/web/.env.development && echo "Web .env.development OK"

# Vérifier la documentation
test -f docs/guides/development-workflow.md && echo "Workflow guide OK"
```

### Level 6: CI/CD Validation

**Required Validations**:
- Push test sur `develop`
- Vérifier que `deploy-staging.yml` se déclenche
- Vérifier que les jobs passent (test, build)

---

## ACCEPTANCE CRITERIA

**MANDATORY REQUIREMENTS - ALL MUST BE MET**:

- [ ] Branche `develop` créée et poussée sur le remote
- [ ] Protection de branche `main` configurée (pas de push direct)
- [ ] Branche Neon `dev` créée avec ses propres credentials
- [ ] Fichiers `.env.development` créés pour root, API, web, mobile
- [ ] Docker PostgreSQL démarre et fonctionne avec le profile `local`
- [ ] API peut se connecter à la base PostgreSQL locale
- [ ] Secrets GitHub configurés pour l'environment staging
- [ ] Workflow `deploy-staging.yml` fonctionne sur push vers `develop`
- [ ] Configuration EAS documentée pour les différents environnements
- [ ] Documentation workflow complète créée
- [ ] Documentation environnements mise à jour
- [ ] CLAUDE.md mis à jour avec le nouveau workflow
- [ ] **ALL validation commands executed and pass with zero errors**
- [ ] Tests existants continuent à passer
- [ ] Cycle complet local → develop testé et fonctionnel

---

## COMPLETION CHECKLIST

**MANDATORY - EVERY ITEM MUST BE CHECKED BEFORE COMPLETION**:

- [ ] Task 1: Branche `develop` créée
- [ ] Task 2: Protection `main` configurée
- [ ] Task 3: Backup Neon production créé
- [ ] Task 4: Branche Neon `dev` créée
- [ ] Task 5: `.env.development` racine créé
- [ ] Task 6: `apps/api/.env.development` créé
- [ ] Task 7: Configuration mobile développement
- [ ] Task 8: `apps/web/.env.development` créé
- [ ] Task 9: Docker PostgreSQL vérifié
- [ ] Task 10: Connexion Prisma vérifiée
- [ ] Task 11: Secrets GitHub staging configurés
- [ ] Task 12: Workflows CI rendus bloquants (|| true supprimé)
- [ ] Task 13: Configuration EAS vérifiée
- [ ] Task 14: EAS mis à jour si nécessaire
- [ ] Task 15: Guide workflow créé
- [ ] Task 16: Doc environnements mise à jour
- [ ] Task 17: CLAUDE.md mis à jour
- [ ] Task 18: Protection NODE_ENV seed script ajoutée
- [ ] Task 19: Workflow complet testé
- [ ] Tous les tests existants passent
- [ ] Documentation complète et cohérente

---

## EXTERNAL RESOURCES AND REFERENCES

**MANDATORY SECTION - Include ALL relevant resources**:

### Official Documentation
- Neon Branching: https://neon.tech/docs/manage/branches
- Neon Connection Pooling: https://neon.tech/docs/connect/connection-pooling
- GitHub Branch Protection: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches
- GitHub Actions: https://docs.github.com/en/actions
- GitHub Environments: https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment

### API References
- Render Deployment: https://render.com/docs/deploys
- Vercel Deployments: https://vercel.com/docs/deployments/overview
- Expo EAS Build: https://docs.expo.dev/build/introduction/

### Framework Documentation
- Prisma Migrate: https://www.prisma.io/docs/concepts/components/prisma-migrate
- Vite Env Variables: https://vitejs.dev/guide/env-and-mode.html
- Expo Env Variables: https://docs.expo.dev/guides/environment-variables/

### Internal Resources
- Documentation déploiement: `docs/deployment/guide.md`
- Documentation environnements: `docs/deployment/environments.md`
- Configuration CI/CD: `.github/workflows/`
- Templates environnement: `.env.*.example`

---

## NOTES

**Choix de conception:**

1. **Pas de service Render staging séparé**: Pour rester dans les limites du free tier, le staging réutilise l'API production mais avec une base de données Neon séparée. C'est un compromis acceptable pour un développeur solo ou une petite équipe.

2. **Protection de branche souple**: Pour un développeur solo, la protection de `main` peut être configurée sans approbation obligatoire, tout en gardant l'exigence des checks CI passants.

3. **Mobile en staging**: Le profile `preview` EAS peut continuer à pointer vers l'API production si pas de service staging séparé, car les données utilisateur sont isolées par shop_id et JWT différents.

4. **Isolation par branches Neon**: L'utilisation des branches Neon permet une isolation complète des données sans coût supplémentaire, ce qui est idéal pour le contexte free tier.

**Important Reminders**:
- Ce plan contient UNIQUEMENT des spécifications fonctionnelles - PAS d'exemples de code
- Tous les fichiers `.env.development` doivent être dans `.gitignore`
- Les JWT secrets doivent être différents entre staging et production
- Toujours utiliser la connection pooled de Neon pour l'application runtime

<!-- EOF -->
