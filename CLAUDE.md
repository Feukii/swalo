# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SWALO is a mini-ERP retail system for phone accessory shops in Central Africa. It's a Turborepo monorepo with three apps (NestJS API, React Native/Expo mobile, React/Vite web) and a shared core package.

**Language**: French is used for user-facing strings, documentation, and comments. Code identifiers use English.

## Commands

### Development
```bash
pnpm install              # Install all dependencies
pnpm dev                  # Start all apps (API, web, mobile) via Turbo
docker-compose up -d      # Start PostgreSQL locally
```

### Individual Apps
```bash
# API (NestJS)
cd apps/api && pnpm dev              # Start dev server (port 3000)
cd apps/api && pnpm prisma:studio    # Open Prisma Studio
cd apps/api && pnpm prisma:migrate   # Run migrations
cd apps/api && pnpm prisma:seed      # Seed database

# Web (Vite)
cd apps/web && pnpm dev              # Start dev server (port 5173)

# Mobile (Expo)
cd apps/mobile && npx expo start     # Start Expo dev server
```

### Validation & Testing
```bash
pnpm run validate                    # Run lint + test for all packages
pnpm --filter @swalo/api run lint    # Lint API only
pnpm --filter @swalo/api run test    # Run API tests
pnpm --filter @swalo/mobile run lint # Lint mobile only
pnpm --filter @swalo/mobile run test # Run mobile tests
```

### Single Test File
```bash
cd apps/api && pnpm jest path/to/file.spec.ts
cd apps/mobile && pnpm jest path/to/file.test.ts
```

## Architecture

### Monorepo Structure
- `apps/api` - NestJS backend with Prisma ORM (PostgreSQL)
- `apps/mobile` - React Native + Expo mobile app
- `apps/web` - React + Vite + Tailwind admin dashboard
- `packages/core` - Shared Zod schemas, types, and utilities

### Database (Prisma)
- Schema: `apps/api/prisma/schema.prisma`
- All monetary amounts stored as **integers in FCFA** (CFA francs, no decimals needed for this currency)
- Soft delete pattern: `deleted: boolean`, `deleted_at: DateTime?`
- Optimistic concurrency: `version: Int` field on mutable entities
- Idempotency: `[device_id, client_op_id]` unique constraint on operations

### Authentication
Two auth methods:
1. **PIN login** (mobile/employees): Shop code (6 digits) + PIN (4 digits)
2. **Email/password** (web/admin): Standard JWT flow

Tokens: Access (24h) + Refresh (7d). Guards: `JwtAuthGuard`, `RolesGuard`.

### RBAC Roles
`OWNER`, `MANAGER`, `CASHIER`, `ADMIN`, `EMPLOYEE`, `SUPERADMIN`

Use `@Roles(Role.MANAGER, Role.OWNER)` decorator on controllers.

### Multi-tenancy
All data is scoped by `shop_id`. API endpoints automatically filter by the authenticated user's shop from JWT payload.

### API Client Pattern
Both mobile (`apps/mobile/src/lib/api.ts`) and web (`apps/web/src/lib/api.ts`) use Axios with:
- 3 retries with 2s delay for network errors
- 30s timeout (for cold-start handling on free tier)
- Auto-logout on 401 responses
- JWT bearer token from AsyncStorage (mobile) or localStorage (web)

### State Management
- Mobile & Web: Zustand stores
- Mobile local storage: AsyncStorage
- Web local storage: localStorage

### Key Prisma Models
`Shop`, `User`, `UserRole`, `UserDevice`, `Product`, `StockBatch`, `InventoryMovement`, `Customer`, `Supplier`, `Sale`, `SaleItem`, `CashEntry`, `CashSession`, `ClientReceivable`, `SupplierDebt`, `Payment`

## Code Patterns

### NestJS Modules
Each feature has its own module in `apps/api/src/modules/`:
- `auth`, `products`, `sales`, `customers`, `suppliers`, `cash`, `inventory`, `reports`, `receivables`, `debts`, `pin-invites`, `admin`

### Mobile Navigation
- Root stack in `apps/mobile/App.tsx`
- Bottom tabs in `apps/mobile/src/navigation/MainTabNavigator.tsx`
- Screens in `apps/mobile/src/screens/`

### Shared Types
Import from `@swalo/core`:
```typescript
import { SaleSchema, CustomerSchema } from '@swalo/core/schemas';
import type { Sale, Customer } from '@swalo/core/types';
```

## Environment Variables

### API (`apps/api/.env`)
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
```

### Mobile/Web
- Mobile: `EXPO_PUBLIC_API_URL`
- Web: `VITE_API_URL`

## Deployment Targets
- API: Render (free tier)
- Web: Vercel
- Database: Neon (PostgreSQL serverless)
- Mobile: Expo EAS Build

## Development Workflow

### Branches
- `main` - Production (protected, requires PR + status check `test`)
- `develop` - Staging/Integration
- `feature/*`, `fix/*` - Development work

### Mandatory Workflow for ALL Changes

**Claude MUST follow this process for every feature, fix, or change:**

1. **Create feature branch from `develop`**
   ```bash
   git checkout develop && git pull origin develop
   git checkout -b feature/my-feature
   ```

2. **Develop and test locally** (Docker PostgreSQL — never production DB)
   ```bash
   docker compose --profile local up -d postgres
   pnpm dev
   ```

3. **Run validation before committing**
   ```bash
   pnpm run validate   # lint + test for all packages
   ```

4. **Test manually** on Expo Go (mobile) and/or localhost (web) to verify the feature works as expected

5. **Commit on feature branch** (never directly on `develop` or `main`)

6. **Push and create PR to `develop`**
   ```bash
   git push -u origin feature/my-feature
   gh pr create --base develop
   ```

7. **CI runs automatically**: Lint → Tests → Build (all blocking)

8. **After CI passes and merge to `develop`**: staging deployment triggers automatically

9. **When ready for production**: Create PR from `develop` to `main`
   ```bash
   gh pr create --base main --head develop
   ```

10. **CI runs again on `main`**: Lint → Tests → Build → Deploy → Health check

### Local Development
```bash
# Start PostgreSQL
docker compose --profile local up -d postgres

# Start all services
pnpm dev
```

### Important Notes
- `.env.development` files are gitignored (local config)
- Seed script is protected against production execution
- CI lint checks are blocking (no `|| true`)
- Direct push to `main` is blocked by GitHub branch protection
- See `docs/guides/development-workflow.md` for detailed guide

## Production Protection

### Rules
- **NEVER** push directly to `main` — always go through `develop` and PR
- **NEVER** commit directly on `develop` — always use a `feature/*` or `fix/*` branch
- **NEVER** use production database credentials in local `.env` files
- **NEVER** run seed or cleanDatabase against production
- All tests MUST pass before merge to `main`
- CI runs lint + tests + build on both `develop` and `main` workflows

### CORS
Production API restricts origins via `ALLOWED_ORIGINS` environment variable (comma-separated list). In development, all origins are accepted.

### Environment Separation
| Environment | Database | API |
|------------|----------|-----|
| Local | Docker PostgreSQL (localhost) | localhost:3000 |
| Staging | Neon branch `development` | Preview |
| Production | Neon branch `main` | swalo-api.onrender.com |

See `docs/deployment/environments.md` for full details.

## Documentation Structure

Documentation is organized in the `docs/` folder by category:

```
docs/
├── specs/          # Functional and technical specifications
├── guides/         # User and developer guides
├── design/         # UI design, color charts
├── deployment/     # Deployment documentation
├── reference/      # Technical references (PIN codes, etc.)
├── architecture/   # Architecture documentation
├── operations/     # Operational procedures
└── archive/        # Archived documents
    └── sessions/   # Development session logs
```

**Root files**: Only `README.md` and `CLAUDE.md` should remain at the root as markdown files.

## Agent Plans Convention

Plans are stored in `.agents/plans/` with **3-digit numeric prefixes** for chronological ordering:

```
.agents/plans/
├── 001-catalog-stock-import-features.md
├── 002-deployment-infrastructure-setup.md
├── ...
└── 011-reorganize-documentation-structure.md
```

**When creating a new plan:**
1. Check the current highest number: `ls .agents/plans/`
2. Increment by 1 for the new plan
3. Use format: `{NNN}-{kebab-case-description}.md`

**Naming conventions:**
- Use **kebab-case** (lowercase with hyphens)
- Descriptive names in English
- Example: `012-add-user-authentication.md`
