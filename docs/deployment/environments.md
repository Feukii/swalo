# SWALO - Environnements

Ce guide decrit la separation dev / test / prod (branches, DB, URLs).

## Environnements cibles

- Dev (local)
- Test / staging
- Production

## Branches recommandees

- main: production
- test: staging
- dev/develop: developpement

## Bases de donnees

Utilisez des projets Neon distincts (ou des branches Neon) pour isoler:

- dev: database dev
- test: database test
- prod: database prod

## Variables d'environnement (exemples)

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
JWT_SECRET=<long_random_secret>
JWT_REFRESH_SECRET=<long_random_secret>
```

## Workflow de release (simple)

1. Developper sur `dev`
2. Merger sur `test`
3. Valider et deployer sur `prod`
