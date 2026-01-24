#!/bin/bash

# Script pour basculer entre les environnements dev et prod
# Usage: ./scripts/switch-env.sh [dev|prod|local]

ENV=$1

if [ -z "$ENV" ]; then
  echo "❌ Usage: ./scripts/switch-env.sh [dev|prod|local]"
  exit 1
fi

case $ENV in
  dev)
    echo "🔧 Basculement vers l'environnement de DÉVELOPPEMENT..."
    if [ ! -f .env.development ]; then
      echo "❌ Fichier .env.development introuvable!"
      echo "💡 Créez-le à partir de .env.development.example"
      exit 1
    fi
    cp .env.development .env
    echo "✅ Environnement DEV activé (Neon branch: development)"
    echo "📊 Database: ep-round-union-agp0ycas (dev branch)"
    ;;

  prod)
    echo "🚀 Basculement vers l'environnement de PRODUCTION..."
    if [ ! -f .env.production ]; then
      echo "❌ Fichier .env.production introuvable!"
      echo "💡 Créez-le à partir de .env.production.example"
      exit 1
    fi
    cp .env.production .env
    echo "✅ Environnement PROD activé (Neon main branch)"
    echo "⚠️  ATTENTION: Vous êtes maintenant connecté à la BASE DE PRODUCTION!"
    echo "📊 Database: ep-shiny-smoke-agjh1g6u (main branch)"
    ;;

  local)
    echo "🏠 Basculement vers l'environnement LOCAL (Docker)..."
    cat > .env << 'EOF'
# Local Development with Docker PostgreSQL

# PostgreSQL Configuration (Docker)
POSTGRES_USER=swalo
POSTGRES_PASSWORD=swalo_secure_password_2025
POSTGRES_DB=swalo_db

# API Configuration
NODE_ENV=development
PORT=3000
JWT_SECRET=local_dev_jwt_secret
JWT_REFRESH_SECRET=local_dev_jwt_refresh_secret
JWT_EXPIRES_IN=7d

# Database URL (Local Docker)
DATABASE_URL=postgresql://swalo:swalo_secure_password_2025@localhost:5432/swalo_db?schema=public

# Frontend Configuration
VITE_API_URL=http://localhost:3000/api
EOF
    echo "✅ Environnement LOCAL activé (Docker PostgreSQL)"
    echo "📊 Database: localhost:5432 (Docker)"
    ;;

  *)
    echo "❌ Environnement invalide: $ENV"
    echo "💡 Options disponibles: dev, prod, local"
    exit 1
    ;;
esac

echo ""
echo "📋 Prochaines étapes:"
echo "  1. Redémarrez votre serveur de développement"
echo "  2. Vérifiez la connexion: cd apps/api && npx prisma db pull"
echo ""
