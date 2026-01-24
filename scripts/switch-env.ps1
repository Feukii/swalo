# Script PowerShell pour basculer entre les environnements dev et prod
# Usage: .\scripts\switch-env.ps1 dev|prod|local

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('dev','prod','local')]
    [string]$Environment
)

switch ($Environment) {
    'dev' {
        Write-Host "🔧 Basculement vers l'environnement de DÉVELOPPEMENT..." -ForegroundColor Cyan
        if (-not (Test-Path ".env.development")) {
            Write-Host "❌ Fichier .env.development introuvable!" -ForegroundColor Red
            Write-Host "💡 Créez-le à partir de .env.development.example" -ForegroundColor Yellow
            exit 1
        }
        Copy-Item .env.development .env -Force
        Write-Host "✅ Environnement DEV activé (Neon branch: development)" -ForegroundColor Green
        Write-Host "📊 Database: ep-round-union-agp0ycas (dev branch)" -ForegroundColor Gray
    }

    'prod' {
        Write-Host "🚀 Basculement vers l'environnement de PRODUCTION..." -ForegroundColor Cyan
        if (-not (Test-Path ".env.production")) {
            Write-Host "❌ Fichier .env.production introuvable!" -ForegroundColor Red
            Write-Host "💡 Créez-le à partir de .env.production.example" -ForegroundColor Yellow
            exit 1
        }
        Copy-Item .env.production .env -Force
        Write-Host "✅ Environnement PROD activé (Neon main branch)" -ForegroundColor Green
        Write-Host "⚠️  ATTENTION: Vous êtes maintenant connecté à la BASE DE PRODUCTION!" -ForegroundColor Red
        Write-Host "📊 Database: ep-shiny-smoke-agjh1g6u (main branch)" -ForegroundColor Gray
    }

    'local' {
        Write-Host "🏠 Basculement vers l'environnement LOCAL (Docker)..." -ForegroundColor Cyan
        @"
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
"@ | Out-File -FilePath .env -Encoding UTF8
        Write-Host "✅ Environnement LOCAL activé (Docker PostgreSQL)" -ForegroundColor Green
        Write-Host "📊 Database: localhost:5432 (Docker)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "📋 Prochaines étapes:" -ForegroundColor Yellow
Write-Host "  1. Redémarrez votre serveur de développement"
Write-Host "  2. Vérifiez la connexion: cd apps/api && npx prisma db pull"
Write-Host ""
