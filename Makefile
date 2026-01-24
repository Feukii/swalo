.PHONY: help dev docker-up docker-down docker-logs docker-build docker-clean mobile-build mobile-preview mobile-download backup restore

# Couleurs pour les messages
GREEN=\033[0;32m
YELLOW=\033[1;33m
NC=\033[0m # No Color

help: ## Affiche l'aide
	@echo "$(GREEN)SWALO - Commandes disponibles:$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

# === Développement ===

dev: ## Lancer en mode développement
	@echo "$(GREEN)Lancement de l'application en mode développement...$(NC)"
	pnpm dev

# === Docker ===

docker-up: ## Démarrer tous les services Docker
	@echo "$(GREEN)Démarrage des services Docker...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Services démarrés! Accès:$(NC)"
	@echo "  Web: http://localhost"
	@echo "  API: http://localhost:3000/api"

docker-down: ## Arrêter tous les services Docker
	@echo "$(YELLOW)Arrêt des services Docker...$(NC)"
	docker-compose down

docker-logs: ## Afficher les logs Docker
	docker-compose logs -f

docker-build: ## Rebuild et redémarrer les services Docker
	@echo "$(GREEN)Rebuild des services Docker...$(NC)"
	docker-compose up -d --build

docker-clean: ## Supprimer tous les conteneurs et volumes Docker (⚠️ SUPPRIME LES DONNÉES!)
	@echo "$(YELLOW)⚠️  ATTENTION: Cette commande va supprimer toutes les données!$(NC)"
	@read -p "Êtes-vous sûr? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v; \
		echo "$(GREEN)Nettoyage terminé!$(NC)"; \
	fi

docker-status: ## Vérifier le statut des services Docker
	@echo "$(GREEN)Statut des services:$(NC)"
	docker-compose ps

# === Mobile (Android APK) ===

mobile-build: ## Builder l'APK Android pour production
	@echo "$(GREEN)Build de l'APK Android en mode production...$(NC)"
	@echo "$(YELLOW)Cela peut prendre 10-20 minutes...$(NC)"
	cd apps/mobile && eas build --profile production --platform android

mobile-preview: ## Builder l'APK Android pour preview/test
	@echo "$(GREEN)Build de l'APK Android en mode preview...$(NC)"
	cd apps/mobile && eas build --profile preview --platform android

mobile-download: ## Télécharger le dernier APK buildé
	@echo "$(GREEN)Téléchargement du dernier APK...$(NC)"
	cd apps/mobile && eas build:download --platform android --latest

mobile-dev: ## Lancer le serveur de développement mobile
	@echo "$(GREEN)Lancement d'Expo...$(NC)"
	cd apps/mobile && npx expo start

# === Base de données ===

backup: ## Créer un backup de la base de données
	@echo "$(GREEN)Création du backup...$(NC)"
	@mkdir -p backups
	docker exec swalo-postgres pg_dump -U swalo swalo_db > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)Backup créé dans ./backups/$(NC)"

restore: ## Restaurer un backup de la base de données
	@echo "$(YELLOW)Restauration d'un backup...$(NC)"
	@echo "Fichiers disponibles:"
	@ls -1 backups/*.sql
	@read -p "Nom du fichier à restaurer: " file; \
	docker exec -i swalo-postgres psql -U swalo swalo_db < backups/$$file
	@echo "$(GREEN)Backup restauré!$(NC)"

# === Utilitaires ===

install: ## Installer toutes les dépendances
	@echo "$(GREEN)Installation des dépendances...$(NC)"
	pnpm install

clean: ## Nettoyer les fichiers de build
	@echo "$(YELLOW)Nettoyage...$(NC)"
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf apps/*/dist
	rm -rf apps/*/.next
	@echo "$(GREEN)Nettoyage terminé!$(NC)"

setup: ## Configuration initiale du projet
	@echo "$(GREEN)Configuration initiale de SWALO...$(NC)"
	@if [ ! -f .env ]; then \
		cp .env.docker .env; \
		echo "$(GREEN).env créé depuis .env.docker$(NC)"; \
		echo "$(YELLOW)⚠️  N'oubliez pas de modifier les valeurs dans .env!$(NC)"; \
	else \
		echo "$(YELLOW).env existe déjà, rien à faire$(NC)"; \
	fi
	pnpm install
	@echo "$(GREEN)Configuration terminée!$(NC)"

# === Déploiement ===

deploy-check: ## Vérifier la configuration avant déploiement
	@echo "$(GREEN)Vérification de la configuration...$(NC)"
	@if [ ! -f .env ]; then \
		echo "$(YELLOW)⚠️  Fichier .env manquant!$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)✓ .env existe$(NC)"
	@if grep -q "change_this" .env; then \
		echo "$(YELLOW)⚠️  Attention: Des secrets par défaut sont encore présents dans .env!$(NC)"; \
	else \
		echo "$(GREEN)✓ Secrets modifiés$(NC)"; \
	fi
	@echo "$(GREEN)Configuration OK!$(NC)"

deploy: deploy-check docker-build ## Déployer l'application
	@echo "$(GREEN)Déploiement terminé!$(NC)"
	@make docker-status
