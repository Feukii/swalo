# SWALO - Demarrage local

Ce guide couvre l'installation et le lancement en local (web, API, mobile).

## Prerequis

- Node.js 22+
- pnpm 8+
- Git
- Docker Desktop (optionnel, pour PostgreSQL/Redis)

## Installation

```bash
git clone <repository-url>
cd swalo
pnpm install
```

## Configuration base de donnees

### Option A - Docker (recommande)

```bash
cp .env.docker .env
```

Modifiez ensuite les valeurs sensibles dans `.env` (JWT secrets, mots de passe).

### Option B - PostgreSQL local ou Neon/Supabase

```bash
cd apps/api
cp .env.example .env
```

Mettez a jour `DATABASE_URL` et les secrets JWT dans `apps/api/.env`.

## Lancer en local

### Option rapide (tout)

```bash
pnpm dev
```

### Option detaillee

```bash
cd apps/api
pnpm dev
```

```bash
cd apps/web
pnpm dev
```

```bash
cd apps/mobile
npx expo start
```

## URLs locales

- Web: http://localhost:5173
- API: http://localhost:3000/api
- Expo: QR code via `expo start`

## Notes

- Pour l'admin panel, voir `docs/ADMIN_FEATURES.md`.
- Pour le deploiement, voir `docs/DEPLOYMENT.md`.
