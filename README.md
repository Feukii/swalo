# 🏪 SWALO - Système de Gestion pour Commerce de Détail

> **Gérez votre commerce en toute simplicité**

Application mobile et web complète pour la gestion de points de vente en Afrique centrale. Spécialement conçue pour les boutiques d'accessoires téléphoniques.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-green.svg)](https://nodejs.org)
[![Expo](https://img.shields.io/badge/expo-~54.0.23-000020.svg)](https://expo.dev)

---

## ✨ Fonctionnalités

### 📱 Mobile & Web

- ✅ **Gestion de Caisse** - Entrées/sorties avec catégories personnalisées
- ✅ **Créances Clients** - Suivi des dettes clients avec historique de paiements
- ✅ **Dettes Fournisseurs** - Gestion des achats et règlements
- ✅ **Rapports d'Activité** - Bilans financiers par période (jour/semaine/mois/année)
- ✅ **Autocomplete Intelligent** - Recherche rapide clients/fournisseurs
- ✅ **Multi-rôles** - EMPLOYEE, ADMIN, MANAGER, OWNER, SUPERADMIN
- ✅ **Authentification** - PIN (4 chiffres) ou Email/Password + JWT

### 🛡️ Administration (SUPERADMIN)

- ✅ **Panneau d'Administration Complet** - Vue globale de la plateforme
- ✅ **Statistiques Système** - Boutiques, utilisateurs, ventes, produits
- ✅ **Gestion des Boutiques** - Visualisation, suppression (soft delete)
- ✅ **Gestion des Utilisateurs** - Révocation d'accès, déconnexion d'appareils
- ✅ **Sécurité Renforcée** - Confirmations, transactions, logs

### 🚀 En développement

- 🔄 Gestion des Stocks
- 🔄 Facturation PDF
- 🔄 Mode Offline
- 🔄 Inventaire physique

---

## 📚 Documentation

La documentation est organisée dans le dossier `docs/` par catégorie. Voir [docs/README.md](docs/README.md) pour l'index complet.

### Guides essentiels

| Guide                                                                                  | Description                        |
| -------------------------------------------------------------------------------------- | ---------------------------------- |
| **[docs/guides/getting-started.md](docs/guides/getting-started.md)**                   | Demarrage local                    |
| **[docs/deployment/guide.md](docs/deployment/guide.md)**                               | Deploiement (Render/Vercel/Docker) |
| **[docs/guides/admin-features.md](docs/guides/admin-features.md)**                     | Admin panel                        |
| **[docs/guides/testing.md](docs/guides/testing.md)**                                   | Tests et smoke checks              |
| **[docs/specs/cahier-des-charges-unifie.md](docs/specs/cahier-des-charges-unifie.md)** | Specifications techniques          |

### Structure documentation

```
docs/
├── specs/          # Cahiers des charges, specifications
├── guides/         # Guides utilisateur et developpeur
├── design/         # Chartes graphiques, design system
├── deployment/     # Documentation deploiement
├── reference/      # References techniques
├── architecture/   # Architecture du projet
├── operations/     # Procedures operationnelles
└── archive/        # Documents archives
```

---

## 🚀 Déploiement (100% Gratuit)

### Stack Recommandée (0€/mois)

```
Mobile    →  Expo EAS Build (Gratuit)
Web       →  Vercel (Gratuit - 100 GB/mois)
API       →  Render (Gratuit - 750h/mois)
Database  →  Neon (Gratuit - 512 MB) ⭐ PostgreSQL Serverless
CI/CD     →  GitHub Actions (Gratuit - 2000 min/mois)
```

### Démarrage Rapide

```bash
# 1. Clone le projet
git clone https://github.com/votre-username/swalo.git
cd swalo

# 2. Suivre le guide docs/DEPLOYMENT.md
# 3. Déployer en 30 minutes !
```

📖 **[Voir docs/deployment/guide.md pour les instructions détaillées](docs/deployment/guide.md)**

---

## 💻 Développement Local

### Prérequis

- Node.js 22+
- pnpm 8+
- Docker Desktop (pour backend)
- Expo Go (pour mobile)

### Installation

```bash
# Installer les dépendances
pnpm install

# Démarrer tous les services (Docker)
docker-compose up -d

# Démarrer le frontend web
cd apps/web
pnpm dev

# Démarrer l'app mobile
cd apps/mobile
npx expo start
```

### Services Locaux

| Service       | URL                         | Port |
| ------------- | --------------------------- | ---- |
| Web Frontend  | http://localhost:5173       | 5173 |
| API Backend   | http://localhost:3000       | 3000 |
| PostgreSQL    | postgresql://localhost:5432 | 5432 |
| Mobile (Expo) | exp://localhost:8081        | 8081 |

---

## 🏗️ Architecture

```
swalo/
├── apps/
│   ├── mobile/          # React Native + Expo
│   ├── web/             # React + Vite + Tailwind
│   └── api/             # NestJS + Prisma + PostgreSQL
├── packages/
│   └── core/            # Types, utils, constants partagés
├── .github/
│   └── workflows/       # CI/CD automatique
└── docs/                # Documentation
```

### Technologies

| Couche       | Stack                                   |
| ------------ | --------------------------------------- |
| **Mobile**   | React Native + Expo 54 + AsyncStorage   |
| **Web**      | React 19 + Vite + Tailwind CSS          |
| **API**      | NestJS 10 + Prisma 5 + JWT              |
| **Database** | PostgreSQL 16                           |
| **Shared**   | TypeScript + Monorepo (pnpm workspaces) |

---

## 🔐 Sécurité

- ✅ Authentification JWT (7 jours)
- ✅ Passwords hashés (bcrypt 12 rounds)
- ✅ PIN hashés (bcrypt)
- ✅ RBAC (Role-Based Access Control)
- ✅ CORS configuré
- ✅ Rate limiting
- ✅ Variables d'environnement sécurisées

---

## 📈 Roadmap

### Q1 2026 - Gestion des Stocks

- [ ] Module produits complet
- [ ] Suivi mouvements de stock
- [ ] Alertes rupture de stock
- [ ] Inventaire physique vs théorique

### Q2 2026 - Facturation

- [ ] Génération factures PDF
- [ ] Numérotation automatique
- [ ] Export et envoi email/WhatsApp

### Q3 2026 - Mode Offline

- [ ] SQLite local (WatermelonDB)
- [ ] Synchronisation bidirectionnelle
- [ ] Résolution de conflits

### Q4 2026 - Fonctionnalités Avancées

- [ ] Multi-boutiques
- [ ] Analytics avancés
- [ ] Import/Export CSV
- [ ] Imprimante Bluetooth

---

## 🤝 Contribution

Les contributions sont les bienvenues !

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

---

## 📝 License

MIT License - voir [LICENSE](LICENSE) pour plus de détails.

---

## 🆘 Support

- 📧 Email: support@swalo.app
- 📖 Documentation: [docs/](docs/README.md)
- 🐛 Issues: [GitHub Issues](https://github.com/votre-username/swalo/issues)

---

## 🌍 Déployé avec

- [Vercel](https://vercel.com) - Web hosting
- [Render](https://render.com) - API hosting
- [Neon](https://neon.tech) - PostgreSQL Serverless ⭐
- [Expo EAS](https://expo.dev) - Mobile builds

---

**Fait avec ❤️ pour les commerçants d'Afrique centrale**
