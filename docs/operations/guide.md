# SWALO - Operations

Ce guide regroupe les sujets "run" (spin down, keep-alive, diagnostics).

## Spin down (hebergeurs gratuits)

Sur Render free, l'API peut s'endormir apres ~15 min d'inactivite.
Impact: premiere requete lente (10-30s).

### Solutions gratuites

- Cron ping sur `/api/health` (toutes les 5-10 min)
- GitHub Actions schedule
- UptimeRobot (monitor HTTP)

### Solutions payantes

- Render paid
- Railway
- Fly.io

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
