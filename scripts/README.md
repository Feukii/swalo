# Scripts utilitaires SWALO

Scripts pour faciliter le développement et la gestion des environnements.

## Structure

```
scripts/
├── swalo.ps1              # Commandes Windows (setup, docker, backup)
├── switch-env.sh          # Basculer entre environnements (Linux/Mac)
├── switch-env.ps1         # Basculer entre environnements (Windows)
├── health-check.sh        # Vérification de santé des services
├── keep-alive.js          # Script keep-alive pour Render
├── generate-pin-codes.sql # Génération des codes PIN
└── tests/                 # Scripts de test API
    ├── test-api.sh
    ├── test-comprehensive.sh
    ├── test-debts.sh
    ├── test-full-application.sh
    ├── test-product-api.sh
    └── test-receivables.sh
```

## swalo.ps1 - Commandes Windows

Script PowerShell avec commandes pratiques pour Windows:

```powershell
.\scripts\swalo.ps1 help          # Afficher l'aide
.\scripts\swalo.ps1 setup         # Configuration initiale
.\scripts\swalo.ps1 docker-up     # Démarrer Docker
.\scripts\swalo.ps1 docker-down   # Arrêter Docker
.\scripts\swalo.ps1 docker-logs   # Voir les logs
.\scripts\swalo.ps1 docker-status # Statut des services
.\scripts\swalo.ps1 backup        # Backup base de données
.\scripts\swalo.ps1 dev           # Lancer en mode développement
```

## 🔄 switch-env - Basculer entre les environnements

Permet de basculer rapidement entre les environnements de développement, production et local.

### Usage

**Windows (PowerShell)** :
```powershell
.\scripts\switch-env.ps1 dev     # Environnement de développement (Neon dev branch)
.\scripts\switch-env.ps1 prod    # Environnement de production (Neon main branch)
.\scripts\switch-env.ps1 local   # Environnement local (Docker PostgreSQL)
```

**Linux/Mac (Bash)** :
```bash
chmod +x scripts/switch-env.sh   # Première fois seulement
./scripts/switch-env.sh dev      # Environnement de développement
./scripts/switch-env.sh prod     # Environnement de production
./scripts/switch-env.sh local    # Environnement local
```

### Environnements disponibles

| Environnement | Base de données | Usage |
|---------------|-----------------|-------|
| `dev` | Neon branch `development` | Développement de nouvelles fonctionnalités |
| `prod` | Neon branch `main` | ⚠️ Production - données réelles |
| `local` | Docker PostgreSQL (localhost:5432) | Développement 100% local sans internet |

### Ce que fait le script

1. ✅ Copie le fichier `.env.{environment}` vers `.env`
2. ✅ Affiche l'environnement actif
3. ✅ Donne les prochaines étapes

### Après le basculement

```bash
# 1. Vérifier la connexion
cd apps/api
npx prisma db pull

# 2. Redémarrer le serveur de dev
npm run dev

# 3. (Optionnel) Ouvrir Prisma Studio
npx prisma studio
```

## 📋 Workflow recommandé

### Développement quotidien
```bash
# Matin: Basculer en dev
.\scripts\switch-env.ps1 dev

# Développer...
cd apps/api
npm run dev

# Soir: Commit et push
git add .
git commit -m "Feature: ..."
git push origin dev
```

### Tests en local (offline)
```bash
# Basculer en local
.\scripts\switch-env.ps1 local

# Démarrer Docker
docker-compose up -d

# Développer sans internet
npm run dev
```

### Déploiement en production
```bash
# ⚠️ ATTENTION: Vérifier que tout est testé en dev d'abord!

# Basculer en prod
.\scripts\switch-env.ps1 prod

# Appliquer les migrations
cd apps/api
npx prisma migrate deploy

# Vérifier que tout fonctionne
npx prisma studio

# Revenir en dev
cd ../..
.\scripts\switch-env.ps1 dev
```

## ⚠️ Avertissements

1. **Ne jamais développer directement en prod** - Utilisez toujours `dev`
2. **Toujours tester en dev avant prod** - Les migrations sont irréversibles
3. **Faire des backups réguliers** - Surtout avant les migrations
4. **Ne jamais commit les fichiers .env** - Ils sont dans .gitignore

## 🆘 Dépannage

### Le script ne fonctionne pas (PowerShell)

```powershell
# Autoriser l'exécution de scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Le script ne fonctionne pas (Bash)

```bash
# Rendre le script exécutable
chmod +x scripts/switch-env.sh

# Si problème de fin de ligne (Windows)
dos2unix scripts/switch-env.sh
```

### Fichier .env.{environment} introuvable

```bash
# Créer à partir de l'example
cp .env.development.example .env.development

# Éditer avec vos vraies valeurs
code .env.development
```

## 📚 Documentation complète

Voir [docs/deployment/environments.md](../docs/deployment/environments.md) pour plus de détails sur la configuration des environnements.
