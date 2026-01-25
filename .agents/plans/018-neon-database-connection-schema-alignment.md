# Feature: Neon Database Connection & Schema Alignment

The following plan should be complete, but it's important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files etc.

## Feature Description

Ensure the SWALO application is connected to the Neon PostgreSQL production database and that the local Prisma schema is aligned with the production database schema. After alignment verification, commit all pending changes, push to the remote repository, and trigger a rebuild on Render to make changes effective in production.

## User Story

As a **developer/administrator**
I want to **ensure database connection and schema alignment between local code and production**
So that **deployments work correctly and the application runs without schema mismatches**

## Problem Statement

The application needs to be verified as correctly connected to the Neon PostgreSQL production database:
- `postgresql://neondb_owner:npg_bloOD45QdnFR@ep-shiny-smoke-agjh1g6u-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

The local Prisma schema must be synchronized with the production database to prevent deployment failures and runtime errors due to schema mismatches.

## Solution Statement

1. Configure the local `.env` file with the production Neon database connection string
2. Verify the Prisma schema alignment by introspecting the production database
3. If misaligned, deploy any pending migrations to production using `prisma migrate deploy`
4. Regenerate the Prisma client
5. Commit all pending changes and push to trigger automatic Render deployment

## Feature Metadata

**Feature Type**: Infrastructure/Deployment
**Estimated Complexity**: Low
**Primary Systems Affected**: API (apps/api), Prisma ORM, Neon PostgreSQL
**Dependencies**: Prisma CLI, Git, Render deployment service

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `apps/api/prisma/schema.prisma` (full file) - Why: Current Prisma schema defining all models
- `apps/api/.env.example` (full file) - Why: Template for environment variables including DATABASE_URL format
- `render.yaml` (lines 26-29) - Why: Defines DATABASE_URL environment variable configuration for production
- `apps/api/package.json` (lines 22-27) - Why: Prisma-related scripts (generate, migrate, etc.)

### Files to Modify

- `apps/api/.env` - Create if not exists, configure with production DATABASE_URL (NOT committed to git)

### Migration Files Location

- `apps/api/prisma/migrations/` - Contains all migration history, verify all are applied to production

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [Prisma Migrate Deploy Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate/migrate-development-production#production-and-testing-environments)
  - Specific section: Production migrations with `prisma migrate deploy`
  - Why: Safe migration strategy for production databases
- [Neon PostgreSQL Connection Guide](https://neon.tech/docs/connect/connect-from-any-app)
  - Specific section: Connection pooling with PgBouncer
  - Why: Neon uses connection pooling, requires specific connection string format
- [Prisma DB Pull Documentation](https://www.prisma.io/docs/concepts/components/introspection)
  - Specific section: Introspecting an existing database
  - Why: Useful for verifying schema alignment

### Patterns to Follow

**Environment Configuration:**
- The `.env` file is gitignored and should never be committed
- Only `.env.example` serves as documentation template
- Production environment variables are configured in Render Dashboard

**Migration Safety:**
- NEVER use `prisma migrate dev` on production (creates new migrations and resets data)
- ALWAYS use `prisma migrate deploy` for production (applies pending migrations only)
- Verify migration status before deploying

**Deployment Flow:**
- Git push to `main` branch triggers automatic Render deployment
- Render executes buildCommand from `render.yaml`
- Build includes `prisma generate` to ensure client matches schema

---

## IMPLEMENTATION PLAN

### Phase 1: Environment Configuration

Configure local development environment to connect to the Neon production database for verification purposes.

**Tasks:**
- Create or update the local `.env` file with production DATABASE_URL
- Verify the connection string format is compatible with Neon pooler

### Phase 2: Schema Alignment Verification

Verify that the local Prisma schema matches the production database schema.

**Tasks:**
- Check Prisma migration status against production database
- Identify any pending migrations that need to be deployed
- If schema drift exists, determine the appropriate resolution

### Phase 3: Migration Deployment (if needed)

Apply any pending migrations to the production database.

**Tasks:**
- Run `prisma migrate deploy` to apply pending migrations
- Verify all migrations are now applied
- Regenerate Prisma client

### Phase 4: Commit, Push, and Rebuild

Commit all pending changes and trigger production deployment.

**Tasks:**
- Stage all relevant changes
- Create descriptive commit
- Push to remote repository
- Verify Render deployment is triggered

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task 1: CREATE `apps/api/.env` with production DATABASE_URL

- **IMPLEMENT**: Create or update the `.env` file in the API directory with the Neon production database connection string
- **PATTERN**: Follow the format in `apps/api/.env.example`
- **DEPENDENCIES**: None
- **GOTCHA**:
  - The `.env` file must NOT be committed to git (it's in `.gitignore`)
  - The connection string uses the pooler endpoint (contains `-pooler` in hostname)
  - `channel_binding=require` may cause issues with some Prisma versions - monitor for connection errors
- **RESOURCES**:
  - [Neon Connection Strings](https://neon.tech/docs/connect/connection-string)
  - [Prisma PostgreSQL Connection](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- **VALIDATE**: `cd apps/api && npx prisma db execute --stdin <<< "SELECT 1"`
- **TEST_REQUIREMENT**: Connection test returns successfully without authentication errors

**Environment Variables to Set:**
```
DATABASE_URL="postgresql://neondb_owner:npg_bloOD45QdnFR@ep-shiny-smoke-agjh1g6u-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

### Task 2: CHECK Prisma migration status

- **IMPLEMENT**: Run Prisma migration status to see which migrations are applied to production and which are pending
- **PATTERN**: Use `prisma migrate status` command
- **DEPENDENCIES**: Task 1 (DATABASE_URL must be configured)
- **GOTCHA**:
  - If database is empty, all migrations will be pending
  - If database was created manually without Prisma, there will be no `_prisma_migrations` table
- **RESOURCES**: [Prisma Migrate Status](https://www.prisma.io/docs/reference/api-reference/command-reference#migrate-status)
- **VALIDATE**: `cd apps/api && npx prisma migrate status`
- **TEST_REQUIREMENT**: Command executes successfully and shows clear status of migrations

### Task 3: DEPLOY pending migrations to production

- **IMPLEMENT**: Apply any pending migrations to the production database using the safe `migrate deploy` command
- **PATTERN**: Use `prisma migrate deploy` (NOT `migrate dev`)
- **DEPENDENCIES**: Task 2 (know which migrations need deployment)
- **GOTCHA**:
  - `migrate deploy` only applies pending migrations, it never creates new ones
  - `migrate deploy` never prompts interactively, safe for CI/CD
  - If no pending migrations, command exits successfully with no changes
- **RESOURCES**: [Prisma Migrate Deploy](https://www.prisma.io/docs/concepts/components/prisma-migrate/migrate-development-production)
- **VALIDATE**: `cd apps/api && npx prisma migrate deploy`
- **TEST_REQUIREMENT**: All migrations applied successfully, no errors

### Task 4: GENERATE Prisma client

- **IMPLEMENT**: Regenerate the Prisma client to ensure it matches the current schema
- **PATTERN**: Use `prisma generate` command
- **DEPENDENCIES**: Task 3 (migrations deployed)
- **GOTCHA**: The generated client goes to `node_modules/@prisma/client` - this is gitignored and regenerated on each build
- **RESOURCES**: [Prisma Generate](https://www.prisma.io/docs/reference/api-reference/command-reference#generate)
- **VALIDATE**: `cd apps/api && npx prisma generate`
- **TEST_REQUIREMENT**: Prisma client generated successfully

### Task 5: VERIFY database connection with application

- **IMPLEMENT**: Run a quick verification that the API can connect to the database
- **PATTERN**: Use the health check endpoint or run a basic query
- **DEPENDENCIES**: Task 4 (Prisma client generated)
- **GOTCHA**: Cold start on Neon serverless may take a few seconds
- **RESOURCES**: Health endpoint at `/api/health`
- **VALIDATE**: `cd apps/api && npx ts-node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.\$connect().then(() => { console.log('Connected!'); p.\$disconnect(); })"`
- **TEST_REQUIREMENT**: Connection successful without timeout or authentication errors

### Task 6: REVIEW pending git changes

- **IMPLEMENT**: Review all pending changes in the git working directory before committing
- **PATTERN**: Use `git status` and `git diff` to review changes
- **DEPENDENCIES**: None
- **GOTCHA**:
  - Do NOT commit `.env` file (it should be gitignored)
  - Review `.claude/settings.local.json` changes - may contain user-specific settings
  - Review `CashScreen.tsx` changes - ensure they are intentional
  - Review the new plan file `017-definitive-balance-logic-customer-supplier.md`
- **RESOURCES**: N/A
- **VALIDATE**: `git status --short && git diff --stat`
- **TEST_REQUIREMENT**: All changes are intentional and appropriate for commit

### Task 7: CREATE git commit with all pending changes

- **IMPLEMENT**: Stage all appropriate changes and create a descriptive commit
- **PATTERN**: Follow existing commit message patterns (see recent commits)
- **DEPENDENCIES**: Task 6 (changes reviewed)
- **GOTCHA**:
  - Stage specific files, avoid `git add -A` to prevent accidental inclusion of sensitive files
  - Commit message should describe all changes being committed
  - Include Co-Authored-By footer as per project conventions
- **RESOURCES**: N/A
- **VALIDATE**: `git log -1 --oneline`
- **TEST_REQUIREMENT**: Commit created successfully with clear message

### Task 8: PUSH to remote repository

- **IMPLEMENT**: Push the commit to the origin remote on the main branch
- **PATTERN**: Standard `git push origin main`
- **DEPENDENCIES**: Task 7 (commit created)
- **GOTCHA**: Ensure you have push permissions to the repository
- **RESOURCES**: N/A
- **VALIDATE**: `git push origin main`
- **TEST_REQUIREMENT**: Push successful, remote updated

### Task 9: VERIFY Render deployment triggered

- **IMPLEMENT**: Verify that the push triggered an automatic deployment on Render
- **PATTERN**: Render auto-deploys on push to main branch as configured in `render.yaml`
- **DEPENDENCIES**: Task 8 (push completed)
- **GOTCHA**:
  - Render free tier may take time to wake up and build
  - Build includes `prisma generate` automatically
  - Watch for build failures related to database connection
- **RESOURCES**:
  - Render Dashboard: Check deployment logs
  - [Render Auto Deploy](https://render.com/docs/deploys#automatic-git-deploys)
- **VALIDATE**: Check Render dashboard or wait for build webhook/notification
- **TEST_REQUIREMENT**: Render deployment started and completes successfully

---

## TESTING STRATEGY

**MANDATORY REQUIREMENT**: All implementation tasks MUST have corresponding tests that validate functionality.

### Database Connection Tests

**Scope**: Verify database connectivity from local environment to Neon production
**Requirements**:
- Prisma client can connect to database
- Queries execute successfully
- SSL/TLS connection is working
- **VALIDATION COMMAND**: `cd apps/api && npx prisma db execute --stdin <<< "SELECT 1"`

**Test Scenarios Required**:
- Basic SELECT query executes
- No authentication errors
- No SSL/TLS errors
- Connection pooling works

### Schema Alignment Tests

**Scope**: Verify local Prisma schema matches production database
**Requirements**:
- All migrations are applied
- No schema drift
- Prisma client type-checks correctly
- **VALIDATION COMMAND**: `cd apps/api && npx prisma migrate status`

**Test Scenarios Required**:
- Migration status shows all applied
- `prisma db pull --force` would produce identical schema
- No pending migrations after deployment

### Application Health Tests

**Scope**: Verify application can start and serve requests
**Requirements**:
- Health endpoint responds
- No startup errors related to database
- **VALIDATION COMMAND**: `cd apps/api && pnpm run build && timeout 10 pnpm run start:prod || true`

### Edge Cases

**MANDATORY EDGE CASES TO TEST**:
- Connection string with special characters in password (already URL-encoded in provided string)
- Neon cold start latency (serverless may take 500ms-2s on first request)
- Connection pooler endpoint vs direct endpoint behavior
- `channel_binding=require` parameter compatibility

### Test Resources

**Testing Documentation Links**:
- Prisma testing: [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- Neon connection testing: [Neon Quickstart](https://neon.tech/docs/get-started-with-neon/quickstart)

---

## VALIDATION COMMANDS

**CRITICAL REQUIREMENT**: Execute EVERY validation command and ALL tests MUST PASS before considering the feature complete.

### Level 1: Database Connection

**Required Commands**:
```bash
cd apps/api && npx prisma db execute --stdin <<< "SELECT 1 as connection_test"
```

**Expected Result**: Query executes successfully, returns `1`

### Level 2: Migration Status

**Required Commands**:
```bash
cd apps/api && npx prisma migrate status
```

**Expected Result**:
- Shows database connection successful
- Lists all migrations as applied
- No pending migrations message

### Level 3: Prisma Client Generation

**Required Commands**:
```bash
cd apps/api && npx prisma generate
```

**Expected Result**:
- Client generated successfully
- No type errors

### Level 4: Application Build

**Required Commands**:
```bash
cd apps/api && pnpm run build
```

**Expected Result**:
- Build completes successfully
- No TypeScript errors
- No Prisma-related errors

### Level 5: Git Status Verification

**Required Commands**:
```bash
git status --porcelain
git log origin/main..HEAD --oneline
```

**Expected Result**:
- Working directory clean after commit
- New commits visible compared to origin

### Level 6: Post-Push Verification

**Feature-specific manual testing steps**:
1. Check Render dashboard for deployment status
2. Verify build logs show successful `prisma generate`
3. Verify health endpoint responds at production URL
4. Test a basic API endpoint to confirm database connectivity in production

---

## ACCEPTANCE CRITERIA

**MANDATORY REQUIREMENTS - ALL MUST BE MET**:

- [ ] Local `.env` file configured with correct Neon DATABASE_URL (not committed to git)
- [ ] **Database connection verified** - can execute queries against Neon production database
- [ ] **All Prisma migrations applied** - `prisma migrate status` shows no pending migrations
- [ ] **Prisma client generated** - matches current schema without errors
- [ ] **Application builds successfully** - `pnpm run build` completes without errors
- [ ] **Git commit created** - all pending changes committed with descriptive message
- [ ] **Push to remote completed** - changes pushed to origin/main
- [ ] **Render deployment triggered** - automatic deployment started after push
- [ ] No sensitive data committed (`.env` file remains gitignored)
- [ ] No regressions in existing functionality

---

## COMPLETION CHECKLIST

**MANDATORY - EVERY ITEM MUST BE CHECKED BEFORE COMPLETION**:

- [ ] `.env` file created with production DATABASE_URL
- [ ] Database connection test passed
- [ ] Migration status verified - all migrations applied
- [ ] `prisma migrate deploy` executed (if pending migrations existed)
- [ ] `prisma generate` executed successfully
- [ ] Application builds without errors
- [ ] Git changes reviewed
- [ ] Git commit created with appropriate message
- [ ] Git push to origin/main completed
- [ ] Render deployment triggered/verified

---

## EXTERNAL RESOURCES AND REFERENCES

**MANDATORY SECTION - Include ALL relevant resources**:

### Official Documentation
- Prisma CLI Reference: https://www.prisma.io/docs/reference/api-reference/command-reference
- Prisma Migration Guide: https://www.prisma.io/docs/concepts/components/prisma-migrate
- Neon Documentation: https://neon.tech/docs
- Render Deployment: https://render.com/docs/deploys

### API References
- Neon Connection Pooling: https://neon.tech/docs/connect/connection-pooling
- Prisma PostgreSQL Connector: https://www.prisma.io/docs/concepts/database-connectors/postgresql

### Internal Resources
- Render configuration: `render.yaml`
- Prisma schema: `apps/api/prisma/schema.prisma`
- Environment template: `apps/api/.env.example`
- Migration history: `apps/api/prisma/migrations/`

### Connection String Details
```
Host: ep-shiny-smoke-agjh1g6u-pooler.c-2.eu-central-1.aws.neon.tech
Database: neondb
User: neondb_owner
SSL Mode: require
Channel Binding: require
```

## NOTES

**Important Reminders:**
- This plan contains ONLY functional specifications
- The `.env` file with production credentials must NEVER be committed to git
- Always use `prisma migrate deploy` for production, never `prisma migrate dev`
- Neon uses a pooler endpoint - ensure connection string uses the `-pooler` variant
- Free tier Neon databases have cold start latency - first request may be slow
- Render free tier spins down after inactivity - health checks may timeout initially

**Security Consideration:**
The database credentials are provided for this specific authorized task. In production operations, credentials should be managed through secure environment variable services (Render Dashboard, secrets managers) and never stored in source code.

**Rollback Plan:**
If schema alignment fails or deployment breaks production:
1. Check Render deployment logs for specific error
2. If migration issue: use `prisma migrate resolve` to mark migrations as applied/rolled-back
3. If connection issue: verify DATABASE_URL in Render Dashboard environment variables
4. Render allows quick rollback to previous deployments from dashboard

<!-- EOF -->
