# SWALO - Operations

Ce guide regroupe les sujets "run" (spin down, keep-alive, diagnostics).

## Spin down (hebergeurs gratuits)

Sur Render free, l'API s'endort apres ~15 min d'inactivite. **Et la base Neon
(serverless) se met aussi en veille apres ~5 min.** Impact cumule: premiere
requete tres lente (10-30s), parfois timeout cote client => "l'app rame / tombe".

### Endpoints de sante

| Endpoint            | DB ? | Usage                                                            |
| ------------------- | ---- | ---------------------------------------------------------------- |
| `/api/health`       | Non  | Liveness. C'est le `healthCheckPath` de Render. Doit rester sans |
|                     |      | DB pour qu'un hoquet Neon ne fasse pas redemarrer l'instance.    |
| `/api/health/ready` | Oui  | Readiness. Fait un `SELECT 1` => **reveille API + DB ensemble**. |
|                     |      | C'est l'endpoint a pinger depuis le moniteur externe.            |

### Keep-alive recommande : moniteur externe (cron-job.org)

Plus fiable que le cron GitHub Actions (qui peut avoir 10-30 min de retard) et
ne consomme pas de minutes CI. Etapes :

1. Creer un compte gratuit sur https://cron-job.org
2. "Create cronjob" :
   - **URL** : `https://swalo-api.onrender.com/api/health/ready`
   - **Schedule** : toutes les **5 minutes**
   - **Custom schedule (heures ouvrees)** : Hours = `5-21` UTC (soit 6h-22h
     UTC+1, Afrique Centrale), Minutes = `*/5`, tous les jours.
   - (Onglet "Advanced") Timeout 30s, "Treat redirects as success" ok.
3. Sauvegarder. Verifier dans l'historique que les pings renvoient **200**.

> Alternative UptimeRobot : interval 5 min, mais le free tier ne permet pas de
> restreindre aux heures ouvrees (il pingue 24/7 => l'API reste eveillee la nuit
> et consomme plus d'heures Render). cron-job.org est prefere ici.

### Filet de secours : GitHub Actions

`.github/workflows/keep-alive.yml` pingue deja `/api/health/ready` aux heures
ouvrees. A garder comme backup ; ce n'est pas le mecanisme principal.

### Solutions payantes (si besoin de 24/7 garanti)

- Render paid (pas de spin down)
- Railway / Fly.io

## Warm-up et retries cote client

Le web et le mobile ont un retry/backoff pour eviter les erreurs lors du wake-up.

## Crash diagnostics (resume)

1. Reproduire avec un scenario minimal
2. Recuperer les logs (API, web, mobile)
3. Verifier la DB (migrations, contraintes, data)
4. Ouvrir un ticket avec:
   - contexte (role, shop, device)
   - pas a pas
   - erreurs logs

## Changelog correctifs

Historique des correctifs: utiliser l'historique Git + PRs.
