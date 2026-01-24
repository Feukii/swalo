# Stage 1: Build
FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/core/package.json ./packages/core/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api ./apps/api
COPY packages/core ./packages/core

# Generate Prisma client
WORKDIR /app/apps/api
RUN pnpm exec prisma generate

# Build the application
RUN pnpm run build

# Stage 2: Production
FROM node:22-alpine AS production

# Install pnpm and openssl (required for Prisma)
RUN apk add --no-cache openssl && npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/core/package.json ./packages/core/

# Install all dependencies (including Prisma CLI for migrations)
RUN pnpm install --frozen-lockfile

# Copy built application from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/packages/core ./packages/core

WORKDIR /app/apps/api

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && if [ \"$RUN_DB_SEED\" = \"true\" ]; then pnpm exec ts-node prisma/seed.ts; fi && node dist/main.js"]
