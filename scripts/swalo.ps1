# SWALO PowerShell Script - Commandes utiles pour Windows

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

function Show-Help {
    Write-Host "`n=== SWALO - Commandes Disponibles ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "  .\swalo.ps1 help              " -ForegroundColor Yellow -NoNewline
    Write-Host "- Afficher cette aide"
    Write-Host "  .\swalo.ps1 setup             " -ForegroundColor Yellow -NoNewline
    Write-Host "- Configuration initiale"
    Write-Host "  .\swalo.ps1 docker-up         " -ForegroundColor Yellow -NoNewline
    Write-Host "- Démarrer Docker"
    Write-Host "  .\swalo.ps1 docker-down       " -ForegroundColor Yellow -NoNewline
    Write-Host "- Arrêter Docker"
    Write-Host "  .\swalo.ps1 docker-logs       " -ForegroundColor Yellow -NoNewline
    Write-Host "- Voir les logs"
    Write-Host "  .\swalo.ps1 docker-status     " -ForegroundColor Yellow -NoNewline
    Write-Host "- Statut des services"
    Write-Host "  .\swalo.ps1 docker-build      " -ForegroundColor Yellow -NoNewline
    Write-Host "- Rebuild Docker"
    Write-Host "  .\swalo.ps1 docker-clean      " -ForegroundColor Yellow -NoNewline
    Write-Host "- Nettoyer Docker (⚠️ supprime données)"
    Write-Host "  .\swalo.ps1 backup            " -ForegroundColor Yellow -NoNewline
    Write-Host "- Backup de la base de données"
    Write-Host "  .\swalo.ps1 dev               " -ForegroundColor Yellow -NoNewline
    Write-Host "- Lancer en mode développement"
    Write-Host ""
}

function Setup {
    Write-Host "`n[Setup] Configuration initiale..." -ForegroundColor Green

    if (Test-Path .env) {
        Write-Host "⚠️  Le fichier .env existe déjà!" -ForegroundColor Yellow
    } else {
        Copy-Item .env.docker .env
        Write-Host "✓ Fichier .env créé depuis .env.docker" -ForegroundColor Green
        Write-Host "⚠️  N'oubliez pas de modifier les valeurs dans .env!" -ForegroundColor Yellow
    }

    Write-Host "`n[Setup] Installation des dépendances..." -ForegroundColor Green
    pnpm install

    Write-Host "`n✓ Configuration terminée!" -ForegroundColor Green
}

function Docker-Up {
    Write-Host "`n[Docker] Démarrage des services..." -ForegroundColor Green
    docker-compose up -d

    Write-Host "`n✓ Services démarrés!" -ForegroundColor Green
    Write-Host "`nAccès:" -ForegroundColor Cyan
    Write-Host "  Web:  http://localhost"
    Write-Host "  API:  http://localhost:3000/api"
    Write-Host ""
}

function Docker-Down {
    Write-Host "`n[Docker] Arrêt des services..." -ForegroundColor Yellow
    docker-compose down
    Write-Host "✓ Services arrêtés!" -ForegroundColor Green
}

function Docker-Logs {
    Write-Host "`n[Docker] Affichage des logs (Ctrl+C pour quitter)..." -ForegroundColor Cyan
    docker-compose logs -f
}

function Docker-Status {
    Write-Host "`n[Docker] Statut des services:" -ForegroundColor Cyan
    docker-compose ps
}

function Docker-Build {
    Write-Host "`n[Docker] Rebuild des services..." -ForegroundColor Green
    docker-compose up -d --build
    Write-Host "✓ Rebuild terminé!" -ForegroundColor Green
}

function Docker-Clean {
    Write-Host "`n⚠️  ATTENTION: Cette commande va supprimer toutes les données!" -ForegroundColor Red
    $confirmation = Read-Host "Êtes-vous sûr? (oui/non)"

    if ($confirmation -eq "oui") {
        Write-Host "`n[Docker] Nettoyage complet..." -ForegroundColor Yellow
        docker-compose down -v
        Write-Host "✓ Nettoyage terminé!" -ForegroundColor Green
    } else {
        Write-Host "Opération annulée." -ForegroundColor Yellow
    }
}

function Backup-Database {
    Write-Host "`n[Backup] Création du backup..." -ForegroundColor Green

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = "backups"

    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }

    $backupFile = "$backupDir\backup_$timestamp.sql"

    docker exec swalo-postgres pg_dump -U swalo swalo_db | Out-File -FilePath $backupFile -Encoding utf8

    Write-Host "✓ Backup créé: $backupFile" -ForegroundColor Green
}

function Start-Dev {
    Write-Host "`n[Dev] Lancement en mode développement..." -ForegroundColor Green
    pnpm dev
}

# Exécution de la commande
switch ($Command.ToLower()) {
    "help" { Show-Help }
    "setup" { Setup }
    "docker-up" { Docker-Up }
    "docker-down" { Docker-Down }
    "docker-logs" { Docker-Logs }
    "docker-status" { Docker-Status }
    "docker-build" { Docker-Build }
    "docker-clean" { Docker-Clean }
    "backup" { Backup-Database }
    "dev" { Start-Dev }
    default {
        Write-Host "Commande inconnue: $Command" -ForegroundColor Red
        Show-Help
    }
}
