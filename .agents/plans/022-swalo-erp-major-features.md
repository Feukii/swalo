# 022 - SWALO ERP Major Features Evolution

> Plan complet pour 6 fonctionnalites majeures, analyse par 8 strategies paralleles (ParaThinker).
> Cree le : 2026-01-29

---

## Table des matieres

1. [Resume executif](#1-resume-executif)
2. [Features demandees](#2-features-demandees)
3. [Analyse de l'existant](#3-analyse-de-lexistant)
4. [Plan de phasing](#4-plan-de-phasing)
5. [Phase 1 - Unites/Conditionnements + Facture PDF](#5-phase-1)
6. [Phase 2 - Stock multi-prix (FIFO)](#6-phase-2)
7. [Phase 3 - Mode hors-ligne](#7-phase-3)
8. [Phase 4 - Notifications email](#8-phase-4)
9. [Phase 5 - Multi-boutique entreprise](#9-phase-5)
10. [Strategie de tests](#10-strategie-de-tests)
11. [Risques et mitigations](#11-risques-et-mitigations)
12. [Criteres d'acceptation globaux](#12-criteres-dacceptation-globaux)

---

## 1. Resume executif

Ce plan couvre l'ajout de 6 fonctionnalites majeures a SWALO, organisees en 5 phases progressives. L'ordre est determine par les dependances techniques, la complexite croissante, et la valeur business immediate.

**Score moyen des analyses**: 80/100 (8 strategies, scores 78-82)

**Consensus fort sur le phasing**:
- Phase 1: Unites/Conditionnements + Facture PDF (valeur immediate, faible risque)
- Phase 2: Stock multi-prix FIFO (s'appuie sur Phase 1)
- Phase 3: Mode hors-ligne (complexe, independant)
- Phase 4: Notifications email (independant, valeur ajoutee)
- Phase 5: Multi-boutique entreprise (le plus complexe, refactoring multi-tenancy)

---

## 2. Features demandees

### F1 - Mode hors-ligne
Travailler sans internet, synchroniser quand la connexion revient.

### F2 - Unites et conditionnements produit
Dropdown configurable : piece, douzaine, carton, paquets. Chaque boutique peut definir ses propres types.

### F3 - Stock multi-prix
Prix d'achat differents par lot. Destockage FIFO base sur le prix choisi au moment de la vente.

### F4 - Facture PDF
Generer et imprimer une facture PDF depuis l'ecran de vente.

### F5 - Notifications email
Notifier les clients des changements de solde + recap mensuel.

### F6 - Multi-boutique entreprise
Boutiques liees sous une meme entreprise. Transferts inter-boutiques (entrepot vers boutique).

---

## 3. Analyse de l'existant

### 3.1 Schema Prisma (fichiers de reference)

| Modele | Fichier | Lignes | Pertinence |
|--------|---------|--------|------------|
| `Product` | `apps/api/prisma/schema.prisma` | 110-148 | F2: champ `unit` existe deja (`@default("unit")`) |
| `StockBatch` | `apps/api/prisma/schema.prisma` | 150-172 | F3: `cost_price`, `sell_price`, `remaining_quantity` existent |
| `PackagingType` | `apps/api/prisma/schema.prisma` | 174-188 | F2: modele deja cree avec `name`, `symbol`, `is_default` |
| `Invoice` | `apps/api/prisma/schema.prisma` | 498-528 | F4: modele complet avec `pdf_url` |
| `InvoiceItem` | `apps/api/prisma/schema.prisma` | 530-551 | F4: lignes de facture existantes |
| `Sale` / `SaleItem` | `apps/api/prisma/schema.prisma` | 441-496 | F3/F4: ventes avec items, prix unitaire |
| `Customer` | `apps/api/prisma/schema.prisma` | 254-279 | F5: champ `email` existe |
| `Shop` | `apps/api/prisma/schema.prisma` | 11-46 | F6: multi-tenancy par `shop_id` |
| `DeviceSyncState` | `apps/api/prisma/schema.prisma` | 652-665 | F1: sync state par device existe |
| `InventoryMovement` | `apps/api/prisma/schema.prisma` | 190-213 | F1/F3: idempotency `client_op_id` |

### 3.2 Architecture existante

- **API**: NestJS modules dans `apps/api/src/modules/` (auth, products, sales, customers, suppliers, cash, inventory, reports, receivables, debts, pin-invites, admin)
- **Mobile**: React Native/Expo avec Zustand + AsyncStorage
- **Web**: React/Vite avec Zustand + localStorage
- **Shared**: `packages/core` (Zod schemas, types)
- **Auth**: JWT (access 24h + refresh 7d), PIN login pour mobile, email/password pour web
- **CORS**: `ALLOWED_ORIGINS` en production (`apps/api/src/main.ts:13-18`)
- **CI/CD**: GitHub Actions (`deploy.yml` pour main, `deploy-staging.yml` pour develop)
- **Idempotency**: `[device_id, client_op_id]` sur operations mutables

### 3.3 Contraintes techniques

- **Render free tier**: 512MB RAM, pas de Puppeteer/Chromium possible
- **Neon serverless**: Connexion pooling, pas de `LISTEN/NOTIFY` persistant
- **FCFA**: Montants entiers, pas de decimales
- **Expo**: Pas d'acces fichier natif direct sans plugin
- **Connectivite Afrique Centrale**: Connexions instables, debit faible, coupures frequentes

---

## 4. Plan de phasing

```
Phase 1 (Faible risque, valeur immediate)
├── F2: Unites/Conditionnements
└── F4: Facture PDF

Phase 2 (Risque moyen, s'appuie sur Phase 1)
└── F3: Stock multi-prix FIFO

Phase 3 (Complexe, independant)
└── F1: Mode hors-ligne

Phase 4 (Independant, valeur ajoutee)
└── F5: Notifications email

Phase 5 (Le plus complexe)
└── F6: Multi-boutique entreprise
```

**Justification**:
- Phase 1 d'abord car PackagingType et Invoice existent deja dans le schema, effort minimal
- Phase 2 apres car le FIFO utilise les StockBatch existants et les unites de Phase 1
- Phase 3 est la plus complexe techniquement mais independante des autres
- Phase 4 est un ajout serveur-side simple, independant
- Phase 5 en dernier car elle impacte le modele de multi-tenancy fondamental

---

## 5. Phase 1 - Unites/Conditionnements + Facture PDF

### 5.1 Feature F2 : Unites et conditionnements

#### User Stories

- **US-F2-1**: En tant que gerant, je veux definir les types de conditionnement de ma boutique (piece, douzaine, carton, paquet) pour categoriser mes produits.
- **US-F2-2**: En tant que caissier, je veux selectionner l'unite de vente d'un produit depuis un dropdown pour enregistrer la bonne quantite.
- **US-F2-3**: En tant que gerant, je veux ajouter/modifier/supprimer des types de conditionnement personnalises.

#### Probleme / Solution

**Probleme**: Les produits sont actuellement en "unite" generique. Les boutiques d'accessoires telephoniques vendent par piece, douzaine, carton, etc. Il faut un systeme flexible par boutique.

**Solution**: Utiliser le modele `PackagingType` existant (schema.prisma:174-188) et le lier au `Product.unit`. Creer un CRUD complet + UI mobile/web + seed des valeurs par defaut.

#### Taches detaillees

**T-F2-1**: API - CRUD PackagingType
- Fichier: `apps/api/src/modules/products/packaging-type.controller.ts` (nouveau)
- Fichier: `apps/api/src/modules/products/packaging-type.service.ts` (nouveau)
- Fichier: `packages/core/src/schemas/packaging-type.schema.ts` (nouveau)
- Endpoints: `GET /api/packaging-types`, `POST /api/packaging-types`, `PATCH /api/packaging-types/:id`, `DELETE /api/packaging-types/:id`
- Scope par `shop_id` (JWT)
- Validation: nom unique par boutique (contrainte `@@unique([shop_id, name])` deja en place)

**T-F2-2**: API - Seed valeurs par defaut
- Fichier: `apps/api/prisma/seed.ts` (modifier)
- Valeurs: `piece` (pce), `douzaine` (dz), `carton` (ctn), `paquet` (pqt)
- Creer pour chaque shop existante lors du seed

**T-F2-3**: API - Migration lier Product.unit a PackagingType
- Fichier: `apps/api/prisma/schema.prisma` (modifier)
- Ajouter `packaging_type_id String?` + relation a `Product`
- Migration Prisma pour ajouter la colonne
- Garder `unit` existant comme fallback pendant la transition

**T-F2-4**: Mobile - Ecran gestion conditionnements
- Fichier: `apps/mobile/src/screens/settings/PackagingTypesScreen.tsx` (nouveau)
- Liste des types avec ajout/modification/suppression
- Accessible depuis les parametres boutique

**T-F2-5**: Mobile - Dropdown unite sur creation/edition produit
- Fichier: `apps/mobile/src/screens/products/` (modifier formulaires existants)
- Remplacer le champ texte `unit` par un Picker/Dropdown avec les PackagingType de la boutique

**T-F2-6**: Web - Interface gestion conditionnements
- Fichier: `apps/web/src/pages/settings/PackagingTypes.tsx` (nouveau)
- Table CRUD avec les memes fonctionnalites que mobile

#### Commandes de validation
```bash
cd apps/api && pnpm jest packaging-type
cd apps/api && pnpm run lint
cd apps/mobile && pnpm run lint && pnpm jest packaging
cd apps/web && pnpm run lint
```

---

### 5.2 Feature F4 : Facture PDF

#### User Stories

- **US-F4-1**: En tant que caissier, je veux generer une facture PDF depuis l'ecran de vente pour la donner au client.
- **US-F4-2**: En tant que gerant, je veux retrouver les factures PDF dans l'historique pour les reimprimer.
- **US-F4-3**: En tant que client, je veux recevoir une facture avec le nom de la boutique, les articles, les prix et le total.

#### Probleme / Solution

**Probleme**: Les ventes n'ont pas de document imprimable. Les clients ont besoin de factures pour la comptabilite et les garanties.

**Solution**: Utiliser `pdfmake` (lightweight, pas de Chromium) cote API pour generer le PDF. Stocker le PDF en base64 ou sur un storage externe. Le modele `Invoice` existe deja (schema.prisma:498-528) avec `pdf_url`.

**Choix technique**: `pdfmake` plutot que Puppeteer car :
- Render free tier n'a que 512MB RAM (Chromium en consomme ~300MB)
- pdfmake est pur JS, ~2MB, generation en <100ms
- Support natif des tables, en-tetes, pieds de page

#### Taches detaillees

**T-F4-1**: API - Installer pdfmake + service de generation
- Fichier: `apps/api/src/modules/invoices/pdf-generator.service.ts` (nouveau)
- Dependance: `pdfmake` + `@types/pdfmake`
- Template facture: en-tete boutique (nom, adresse, tel), tableau produits (nom, qte, prix unitaire, total), sous-total, taxes, total TTC, info client si present
- Montants en FCFA avec formatage (ex: "12 500 FCFA")

**T-F4-2**: API - Endpoint generation PDF
- Fichier: `apps/api/src/modules/invoices/invoices.controller.ts` (modifier ou creer)
- Endpoint: `POST /api/sales/:saleId/invoice/pdf`
- Cree l'Invoice si elle n'existe pas, genere le PDF, retourne le fichier
- Endpoint: `GET /api/invoices/:id/pdf` pour re-telecharger

**T-F4-3**: API - Stockage PDF
- Option A (recommandee pour free tier): Stocker en base64 dans un champ `pdf_data` sur Invoice
- Option B (si taille pose probleme): Upload sur Cloudinary/S3 free tier, stocker URL dans `pdf_url`
- Decision: commencer par Option A, migrer si necessaire

**T-F4-4**: Mobile - Bouton "Facture PDF" sur ecran vente
- Fichier: `apps/mobile/src/screens/sales/SaleDetailScreen.tsx` (modifier)
- Bouton "Generer facture" apres completion de la vente
- Telecharger le PDF et ouvrir avec `expo-sharing` ou `expo-print`
- Afficher un indicateur de chargement pendant la generation

**T-F4-5**: Mobile - Historique factures
- Fichier: `apps/mobile/src/screens/invoices/InvoiceListScreen.tsx` (nouveau)
- Liste des factures avec filtre par date/client
- Bouton re-telecharger/partager pour chaque facture

**T-F4-6**: Web - Generation et affichage PDF
- Fichier: `apps/web/src/pages/invoices/` (nouveau ou modifier)
- Bouton generation depuis detail vente
- Affichage inline du PDF dans un iframe ou nouvel onglet
- Option d'impression directe via `window.print()`

**T-F4-7**: Core - Schema Zod pour Invoice/PDF
- Fichier: `packages/core/src/schemas/invoice.schema.ts` (nouveau ou modifier)
- Validation des donnees de facture

#### Commandes de validation
```bash
cd apps/api && pnpm jest invoice
cd apps/api && pnpm jest pdf
cd apps/api && pnpm run lint
cd apps/mobile && pnpm run lint
cd apps/web && pnpm run lint
```

---

## 6. Phase 2 - Stock multi-prix (FIFO)

### Feature F3 : Stock multi-prix avec destockage FIFO

#### User Stories

- **US-F3-1**: En tant que gerant, je veux enregistrer des lots de stock avec des prix d'achat differents pour refleter les variations de cout fournisseur.
- **US-F3-2**: En tant que caissier, lors d'une vente je veux que le systeme destocke automatiquement en FIFO (premier entre, premier sorti) selon les lots disponibles.
- **US-F3-3**: En tant que gerant, je veux voir le detail des lots en stock pour chaque produit (quantite restante, prix d'achat, prix de vente).
- **US-F3-4**: En tant que caissier, je veux pouvoir choisir a quel prix vendre un produit quand il existe plusieurs prix de vente actifs.

#### Probleme / Solution

**Probleme**: Actuellement, un produit a un seul `cost_price` et `sell_price`. En realite, les fournisseurs changent souvent les prix, et une boutique peut avoir en stock le meme produit achete a des prix differents.

**Solution**: Le modele `StockBatch` (schema.prisma:150-172) existe deja avec `cost_price`, `sell_price`, `remaining_quantity`. Il faut :
1. Modifier la logique de vente pour destocker en FIFO depuis les batches
2. Modifier l'UI pour afficher les prix disponibles
3. Ajouter un choix de prix lors de la vente si plusieurs prix actifs

#### Taches detaillees

**T-F3-1**: API - Service FIFO destock
- Fichier: `apps/api/src/modules/sales/fifo-destock.service.ts` (nouveau)
- Logique: pour chaque SaleItem, trouver les StockBatch du produit avec `remaining_quantity > 0`, tries par `created_at ASC` (FIFO)
- Destocker dans l'ordre jusqu'a atteindre la quantite vendue
- Si un batch ne suffit pas, passer au suivant (split sur plusieurs batches)
- Enregistrer un `InventoryMovement` par batch impacte
- Transaction Prisma pour atomicite

**T-F3-2**: API - Modifier le service de vente
- Fichier: `apps/api/src/modules/sales/sales.service.ts` (modifier)
- Appeler le FIFO destock au lieu du destock simple actuel
- Gerer le cas "stock insuffisant" (tous les batches epuises)
- Calculer le cout moyen pondere pour le reporting

**T-F3-3**: API - Endpoint batches par produit
- Fichier: `apps/api/src/modules/products/products.controller.ts` (modifier)
- Endpoint: `GET /api/products/:id/batches`
- Retourne les batches actifs avec remaining_quantity > 0
- Inclure: cost_price, sell_price, remaining_quantity, created_at

**T-F3-4**: API - Endpoint prix disponibles
- Fichier: `apps/api/src/modules/products/products.controller.ts` (modifier)
- Endpoint: `GET /api/products/:id/prices`
- Retourne les prix de vente uniques des batches actifs
- Permet au caissier de choisir le prix applicable

**T-F3-5**: Mobile - Affichage multi-prix lors de la vente
- Fichier: `apps/mobile/src/screens/sales/` (modifier)
- Quand le produit a plusieurs prix de vente actifs, afficher un selecteur
- Afficher le prix par defaut (batch le plus ancien = FIFO)
- Permettre de selectionner un autre prix si autorise

**T-F3-6**: Mobile - Detail batches par produit
- Fichier: `apps/mobile/src/screens/products/ProductDetailScreen.tsx` (modifier)
- Section "Lots en stock" avec tableau des batches
- Colonnes: date reception, prix achat, prix vente, quantite restante

**T-F3-7**: Web - Dashboard stock multi-prix
- Fichier: `apps/web/src/pages/products/` (modifier)
- Vue detaillee des batches par produit
- Alerte quand un batch est presque epuise
- Rapport cout moyen vs prix de vente (marge)

**T-F3-8**: Core - Types et schemas
- Fichier: `packages/core/src/schemas/stock-batch.schema.ts` (modifier ou creer)
- Zod schemas pour batch, prix disponibles, destock request/response

**T-F3-9**: API - Migration ajout `batch_id` sur SaleItem
- Fichier: `apps/api/prisma/schema.prisma` (modifier)
- Ajouter `batch_id String?` sur `SaleItem` pour tracabilite du lot utilise
- Permet le reporting par lot

#### Commandes de validation
```bash
cd apps/api && pnpm jest fifo
cd apps/api && pnpm jest sales
cd apps/api && pnpm jest products
cd apps/api && pnpm run lint
cd apps/mobile && pnpm run lint
cd apps/web && pnpm run lint
```

---

## 7. Phase 3 - Mode hors-ligne

### Feature F1 : Mode hors-ligne avec synchronisation

#### User Stories

- **US-F1-1**: En tant que caissier, je veux enregistrer des ventes meme sans connexion internet pour ne pas perdre de ventes.
- **US-F1-2**: En tant que gerant, je veux que les donnees se synchronisent automatiquement quand la connexion revient.
- **US-F1-3**: En tant que caissier, je veux voir clairement si je suis en ligne ou hors-ligne.
- **US-F1-4**: En tant que gerant, je veux que les conflits de synchronisation soient resolus automatiquement sans perte de donnees.

#### Probleme / Solution

**Probleme**: En Afrique Centrale, les coupures internet sont frequentes. Actuellement, l'app mobile est inutilisable sans connexion. Les boutiques perdent des ventes.

**Solution**: Architecture offline-first avec base locale SQLite, queue d'operations, et synchronisation delta pull-push.

#### Choix technologiques

| Option | Avantages | Inconvenients | Decision |
|--------|-----------|---------------|----------|
| **expo-sqlite** | Leger, integration Expo native, controle total | Plus de code a ecrire | **Retenu** |
| WatermelonDB | Sync built-in, performant | Complexe, surcharge pour nos besoins | Rejete |
| MMKV + JSON | Ultra rapide lecture/ecriture | Pas de requetes SQL, pas scalable | Rejete |

**Strategie de sync**: Pull-push delta avec curseur timestamp
- **Pull**: `GET /api/sync/pull?since={lastSync}` retourne les entites modifiees
- **Push**: `POST /api/sync/push` envoie les operations locales en batch
- **Conflits**: Last-Writer-Wins (LWW) base sur `updated_at` + regles metier specifiques

#### Taches detaillees

**T-F1-1**: Mobile - Setup expo-sqlite + schema local
- Fichier: `apps/mobile/src/lib/database/` (nouveau dossier)
- `schema.ts`: Mirroir simplifie du schema Prisma (tables: products, customers, sales, sale_items, stock_batches, cash_entries)
- `migrations.ts`: Gestion des versions de schema local
- `db.ts`: Instance SQLite + helpers CRUD

**T-F1-2**: Mobile - Operation Queue (file d'attente)
- Fichier: `apps/mobile/src/lib/sync/operation-queue.ts` (nouveau)
- Table locale `pending_operations`: id, entity_type, entity_id, operation (CREATE/UPDATE/DELETE), payload (JSON), created_at, status (pending/synced/failed), retry_count
- Chaque mutation (vente, ajout client, etc.) cree une operation dans la queue
- Les operations sont executees en ordre (FIFO) lors de la sync

**T-F1-3**: Mobile - Service de synchronisation
- Fichier: `apps/mobile/src/lib/sync/sync-service.ts` (nouveau)
- Pull: telecharger les changements depuis le serveur (delta par curseur)
- Push: envoyer les operations en attente
- Sequence: Pull d'abord (pour avoir les dernieres donnees), puis Push
- Gestion des conflits: comparer `version` et `updated_at`
- Retry automatique avec backoff exponentiel (1s, 2s, 4s, 8s, max 60s)

**T-F1-4**: Mobile - Detection de connectivite
- Fichier: `apps/mobile/src/hooks/useNetworkStatus.ts` (nouveau)
- Utiliser `@react-native-community/netinfo`
- Etat global: ONLINE, OFFLINE, SYNCING
- Banniere visuelle en haut de l'ecran quand hors-ligne
- Sync automatique quand la connexion revient

**T-F1-5**: Mobile - Adapter les stores Zustand
- Fichiers: `apps/mobile/src/stores/` (modifier tous les stores)
- Chaque store doit lire/ecrire depuis SQLite local
- Les mutations passent par la queue d'operations
- Les queries lisent depuis SQLite (pas d'appel API direct)

**T-F1-6**: API - Endpoints de synchronisation
- Fichier: `apps/api/src/modules/sync/sync.controller.ts` (nouveau)
- Fichier: `apps/api/src/modules/sync/sync.service.ts` (nouveau)
- `GET /api/sync/pull?since={timestamp}&entities=products,customers,sales`
- `POST /api/sync/push` avec body: `{ operations: [...] }`
- Utiliser le modele `DeviceSyncState` existant (schema.prisma:652-665)
- Reponse pull: `{ data: {...}, cursor: "2026-01-29T20:00:00Z", hasMore: boolean }`

**T-F1-7**: API - Resolution de conflits cote serveur
- Fichier: `apps/api/src/modules/sync/conflict-resolver.ts` (nouveau)
- Strategie LWW (Last Writer Wins) par defaut
- Regles metier specifiques:
  - Ventes: jamais ecraser une vente COMPLETED, rejeter le conflit
  - Stock: additionner les mouvements plutot que remplacer
  - Clients: merge des champs (telephone du device A + email du device B)
- Retourner les conflits resolus au client pour mise a jour locale

**T-F1-8**: Mobile - UI indicateurs de sync
- Fichier: `apps/mobile/src/components/SyncStatusBar.tsx` (nouveau)
- Barre de statut: "En ligne" (vert), "Hors-ligne" (orange), "Synchronisation..." (bleu avec spinner)
- Badge sur l'icone de sync montrant le nombre d'operations en attente
- Pull-to-refresh pour forcer une sync manuelle

**T-F1-9**: Mobile - Gestion du premier lancement (cold start)
- Fichier: `apps/mobile/src/lib/sync/initial-sync.ts` (nouveau)
- Premier login: telecharger toutes les donnees de la boutique
- Ecran de chargement avec progression
- Gerer le cas ou le download initial echoue (retry, partial sync)

#### Commandes de validation
```bash
cd apps/api && pnpm jest sync
cd apps/mobile && pnpm jest database
cd apps/mobile && pnpm jest sync
cd apps/mobile && pnpm jest operation-queue
cd apps/mobile && pnpm run lint
cd apps/api && pnpm run lint
```

---

## 8. Phase 4 - Notifications email

### Feature F5 : Notifications email

#### User Stories

- **US-F5-1**: En tant que client, je veux recevoir un email quand mon solde change (paiement recu, nouvel achat a credit) pour suivre mes comptes.
- **US-F5-2**: En tant que client, je veux recevoir un recap mensuel de mon compte pour verifier mes transactions.
- **US-F5-3**: En tant que gerant, je veux activer/desactiver les notifications email par client.

#### Probleme / Solution

**Probleme**: Les clients n'ont aucune visibilite sur leur solde et leurs transactions entre deux visites en boutique. Cela genere des litiges et de la mefiance.

**Solution**: Service d'email transactionnel via Brevo (ex-Sendinblue).

#### Choix technologique: Brevo

| Critere | Brevo | SendGrid | Mailgun |
|---------|-------|----------|---------|
| Free tier | 300/jour | 100/jour (30 jours) | 5000/mois (3 mois) |
| Entreprise francaise | Oui | Non | Non |
| Deliverabilite Afrique | Bonne | Moyenne | Moyenne |
| API simplicity | Excellente | Bonne | Bonne |
| Templates | Built-in editor | Oui | Oui |
| **Decision** | **Retenu** | | |

#### Taches detaillees

**T-F5-1**: API - Module email + service Brevo
- Fichier: `apps/api/src/modules/email/email.module.ts` (nouveau)
- Fichier: `apps/api/src/modules/email/email.service.ts` (nouveau)
- Config: `BREVO_API_KEY` dans les secrets Render
- Methodes: `sendBalanceChangeNotification()`, `sendMonthlyRecap()`
- Wrapper generique pour faciliter le changement de provider

**T-F5-2**: API - Templates email
- Fichier: `apps/api/src/modules/email/templates/` (nouveau dossier)
- `balance-change.ts`: "Votre solde chez {shop_name} a change. Nouveau solde: {balance} FCFA"
- `monthly-recap.ts`: Tableau des transactions du mois, solde initial, solde final
- Templates en francais, HTML simple (compatible mobile email clients)

**T-F5-3**: API - Trigger sur changement de solde
- Fichier: `apps/api/src/modules/receivables/receivables.service.ts` (modifier)
- Fichier: `apps/api/src/modules/sales/sales.service.ts` (modifier)
- Apres chaque paiement ou vente a credit, appeler `emailService.sendBalanceChangeNotification()`
- Condition: client a un email ET notifications activees

**T-F5-4**: API - Cron job recap mensuel
- Fichier: `apps/api/src/modules/email/monthly-recap.cron.ts` (nouveau)
- Utiliser `@nestjs/schedule` avec `@Cron('0 8 1 * *')` (1er du mois a 8h)
- Pour chaque client avec email + notifications activees, generer et envoyer le recap
- Batch processing pour respecter la limite Brevo (300/jour)

**T-F5-5**: Schema - Preferences email client
- Fichier: `apps/api/prisma/schema.prisma` (modifier Customer)
- Ajouter: `email_notifications Boolean @default(false)`
- Migration Prisma

**T-F5-6**: Mobile - Toggle notifications email sur fiche client
- Fichier: `apps/mobile/src/screens/customers/` (modifier)
- Switch "Notifications email" sur l'ecran de detail client
- Grise si le client n'a pas d'email

**T-F5-7**: Web - Configuration notifications email
- Fichier: `apps/web/src/pages/customers/` (modifier)
- Meme fonctionnalite que mobile
- Vue d'ensemble: liste des clients avec notifications activees

#### Commandes de validation
```bash
cd apps/api && pnpm jest email
cd apps/api && pnpm jest monthly-recap
cd apps/api && pnpm run lint
cd apps/mobile && pnpm run lint
cd apps/web && pnpm run lint
```

---

## 9. Phase 5 - Multi-boutique entreprise

### Feature F6 : Multi-boutique entreprise

#### User Stories

- **US-F6-1**: En tant que proprietaire d'entreprise, je veux voir le tableau de bord consolide de toutes mes boutiques pour avoir une vue d'ensemble.
- **US-F6-2**: En tant que gerant d'entrepot, je veux creer un transfert de stock vers une boutique pour approvisionner les points de vente.
- **US-F6-3**: En tant que gerant de boutique, je veux recevoir et valider un transfert de stock entrant pour confirmer la reception.
- **US-F6-4**: En tant que proprietaire, je veux gerer les roles et acces de chaque employe sur chaque boutique.

#### Probleme / Solution

**Probleme**: SWALO est actuellement mono-boutique. Les proprietaires de plusieurs boutiques doivent gerer chacune independamment. Pas de transfert de stock possible entre un entrepot et des boutiques.

**Solution**: Nouveau modele `Enterprise` qui regroupe des boutiques. Systeme de transferts inter-boutiques en deux phases (SHIPPED -> RECEIVED). Dashboard consolide.

#### Taches detaillees

**T-F6-1**: Schema - Modeles Enterprise et Transfer
- Fichier: `apps/api/prisma/schema.prisma` (modifier)
- Nouveau modele `Enterprise`:
  ```
  model Enterprise {
    id         String   @id @default(uuid())
    name       String   @db.VarChar(255)
    owner_id   String
    created_at DateTime @default(now())
    updated_at DateTime @updatedAt
    deleted    Boolean  @default(false)
    deleted_at DateTime?
    version    Int      @default(1)
    shops      Shop[]
    owner      User     @relation(fields: [owner_id], references: [id])
    @@map("enterprises")
  }
  ```
- Ajouter `enterprise_id String?` + relation sur `Shop`
- Nouveau modele `StockTransfer`:
  ```
  model StockTransfer {
    id              String              @id @default(uuid())
    enterprise_id   String
    source_shop_id  String
    target_shop_id  String
    status          TransferStatus      // DRAFT, SHIPPED, RECEIVED, CANCELLED
    shipped_at      DateTime?
    received_at     DateTime?
    shipped_by      String?
    received_by     String?
    notes           String?
    created_at      DateTime            @default(now())
    updated_at      DateTime            @updatedAt
    deleted         Boolean             @default(false)
    deleted_at      DateTime?
    version         Int                 @default(1)
    items           StockTransferItem[]
    enterprise      Enterprise          @relation(fields: [enterprise_id], references: [id])
    source_shop     Shop                @relation("transfers_out", fields: [source_shop_id], references: [id])
    target_shop     Shop                @relation("transfers_in", fields: [target_shop_id], references: [id])
    @@map("stock_transfers")
  }
  ```
- Nouveau modele `StockTransferItem`:
  ```
  model StockTransferItem {
    id           String        @id @default(uuid())
    transfer_id  String
    product_id   String
    qty_sent     Int
    qty_received Int?
    cost_price   Int
    notes        String?
    transfer     StockTransfer @relation(fields: [transfer_id], references: [id])
    @@map("stock_transfer_items")
  }
  ```
- Nouveau enum `TransferStatus`: `DRAFT`, `SHIPPED`, `RECEIVED`, `CANCELLED`

**T-F6-2**: API - Module enterprise
- Fichier: `apps/api/src/modules/enterprise/enterprise.module.ts` (nouveau)
- Fichier: `apps/api/src/modules/enterprise/enterprise.service.ts` (nouveau)
- Fichier: `apps/api/src/modules/enterprise/enterprise.controller.ts` (nouveau)
- CRUD Enterprise
- Ajouter/retirer des boutiques d'une entreprise
- Roles: seul le OWNER de l'enterprise peut gerer

**T-F6-3**: API - Module transferts stock
- Fichier: `apps/api/src/modules/transfers/transfers.module.ts` (nouveau)
- Fichier: `apps/api/src/modules/transfers/transfers.service.ts` (nouveau)
- Fichier: `apps/api/src/modules/transfers/transfers.controller.ts` (nouveau)
- Flux en deux phases:
  1. **Expedition (SHIPPED)**: boutique source cree le transfert, selectionne produits et quantites. Le stock est retire de la boutique source (InventoryMovement type TRANSFER_OUT).
  2. **Reception (RECEIVED)**: boutique cible confirme la reception. Le stock est ajoute a la boutique cible (InventoryMovement type TRANSFER_IN). Possibilite d'indiquer des ecarts (casse, manquants).
- Endpoints: `POST /api/transfers`, `PATCH /api/transfers/:id/ship`, `PATCH /api/transfers/:id/receive`, `GET /api/transfers`

**T-F6-4**: API - Dashboard consolide
- Fichier: `apps/api/src/modules/enterprise/enterprise-reports.service.ts` (nouveau)
- `GET /api/enterprise/:id/dashboard`: CA total, stock total, creances totales, dettes totales
- `GET /api/enterprise/:id/shops-comparison`: comparatif entre boutiques
- Aggregation des rapports existants par shop_id

**T-F6-5**: Schema - Ajout TRANSFER_OUT/TRANSFER_IN
- Fichier: `apps/api/prisma/schema.prisma` (modifier enum MovementType)
- Ajouter `TRANSFER_OUT` et `TRANSFER_IN` a l'enum `MovementType`

**T-F6-6**: Mobile - Ecrans transferts
- `apps/mobile/src/screens/transfers/TransferListScreen.tsx` (nouveau)
- `apps/mobile/src/screens/transfers/CreateTransferScreen.tsx` (nouveau)
- `apps/mobile/src/screens/transfers/ReceiveTransferScreen.tsx` (nouveau)
- Workflow: selectionner boutique cible -> choisir produits et quantites -> confirmer expedition
- Cote reception: voir les transferts entrants, scanner/confirmer les quantites recues

**T-F6-7**: Mobile - Selecteur de boutique
- Fichier: `apps/mobile/src/components/ShopSelector.tsx` (nouveau)
- Permettre aux utilisateurs multi-boutique de basculer entre boutiques
- Stocke le `shop_id` actif dans AsyncStorage
- Affiche le nom de la boutique active dans la barre de navigation

**T-F6-8**: Web - Dashboard enterprise
- Fichier: `apps/web/src/pages/enterprise/` (nouveau dossier)
- Vue consolidee de toutes les boutiques
- Graphiques comparatifs (CA, stock, creances)
- Gestion des transferts avec suivi temps reel du statut

**T-F6-9**: Core - Types et schemas enterprise
- Fichier: `packages/core/src/schemas/enterprise.schema.ts` (nouveau)
- Fichier: `packages/core/src/schemas/transfer.schema.ts` (nouveau)
- Zod schemas pour validation

**T-F6-10**: API - Adapter le guard multi-tenancy
- Fichier: `apps/api/src/common/guards/` (modifier)
- Le guard actuel filtre par `shop_id` unique du JWT
- Nouveau: si l'utilisateur a un role sur l'enterprise, autoriser l'acces aux boutiques de l'enterprise
- Ajouter `enterprise_id` au payload JWT si applicable

#### Commandes de validation
```bash
cd apps/api && pnpm jest enterprise
cd apps/api && pnpm jest transfers
cd apps/api && pnpm jest -- --coverage
cd apps/api && pnpm run lint
cd apps/mobile && pnpm run lint && pnpm jest
cd apps/web && pnpm run lint
```

---

## 10. Strategie de tests

### Tests unitaires (par phase)

| Phase | Module | Fichiers de test |
|-------|--------|-----------------|
| 1 | PackagingType CRUD | `packaging-type.service.spec.ts`, `packaging-type.controller.spec.ts` |
| 1 | PDF Generation | `pdf-generator.service.spec.ts`, `invoices.controller.spec.ts` |
| 2 | FIFO Destock | `fifo-destock.service.spec.ts` |
| 2 | Sales + batches | `sales.service.spec.ts` (mise a jour) |
| 3 | Operation Queue | `operation-queue.test.ts` |
| 3 | Sync Service | `sync.service.spec.ts`, `sync-service.test.ts` |
| 3 | Conflict Resolver | `conflict-resolver.spec.ts` |
| 4 | Email Service | `email.service.spec.ts` |
| 4 | Monthly Cron | `monthly-recap.cron.spec.ts` |
| 5 | Enterprise CRUD | `enterprise.service.spec.ts` |
| 5 | Transfers | `transfers.service.spec.ts` |

### Tests d'integration

- **Phase 2**: Vente complete avec destock FIFO multi-batches en transaction
- **Phase 3**: Cycle complet offline -> queue -> sync -> verification serveur
- **Phase 5**: Transfert complet: creation -> expedition -> reception -> verification stock

### Tests manuels obligatoires (selon CLAUDE.md workflow)

Chaque phase doit etre testee sur:
- Expo Go (mobile Android/iOS)
- Web dashboard (http://localhost:5173)
- Scenarios utilisateur en francais

---

## 11. Risques et mitigations

| # | Risque | Probabilite | Impact | Mitigation |
|---|--------|-------------|--------|------------|
| R1 | Conflits de sync offline complexes | Haute | Elevee | LWW + regles metier specifiques + UI de resolution manuelle en dernier recours |
| R2 | Performance SQLite avec gros volumes | Moyenne | Moyenne | Index sur les colonnes filtrees, pagination, purge des donnees anciennes |
| R3 | Depassement quota Brevo (300/jour) | Moyenne | Faible | Batch processing, queue d'envoi, monitoring du quota |
| R4 | Migration multi-tenancy cassante | Haute | Elevee | `enterprise_id` nullable, migration progressive, backward compatible |
| R5 | PDF generation lente sur Render free | Faible | Moyenne | pdfmake est rapide (~100ms), mais monitorer les cold starts |
| R6 | Ecarts de stock sur transferts | Moyenne | Elevee | Deux phases (ship/receive), champ `qty_received` vs `qty_sent`, notification des ecarts |
| R7 | Taille base SQLite locale | Faible | Moyenne | Sync selective (dernieres 30 jours par defaut), purge automatique |
| R8 | Complexite croissante du schema | Haute | Moyenne | Tests de regression, migrations incrementales, backward compatibility |

---

## 12. Criteres d'acceptation globaux

### Par feature

**F1 - Mode hors-ligne**:
- [ ] Vente enregistree hors-ligne et synchronisee a la reconnexion
- [ ] Indicateur visuel online/offline/syncing
- [ ] Conflits resolus automatiquement sans perte de donnees
- [ ] Premier lancement telecharge toutes les donnees boutique
- [ ] Operations en attente visibles et comptees

**F2 - Unites/Conditionnements**:
- [ ] CRUD complet des types de conditionnement par boutique
- [ ] Dropdown fonctionnel sur creation/edition produit
- [ ] Valeurs par defaut seedees (piece, douzaine, carton, paquet)
- [ ] Filtre/affichage de l'unite dans les listes produits

**F3 - Stock multi-prix**:
- [ ] Destockage FIFO correct lors d'une vente
- [ ] Choix du prix de vente quand plusieurs prix actifs
- [ ] Detail des lots visible par produit
- [ ] Tracabilite lot -> vente (batch_id sur SaleItem)
- [ ] Gestion du stock insuffisant (alerte)

**F4 - Facture PDF**:
- [ ] PDF genere en <2s depuis l'ecran de vente
- [ ] Contenu: en-tete boutique, tableau articles, totaux, info client
- [ ] Montants en FCFA formates
- [ ] Telechargeable et partageable sur mobile
- [ ] Re-impression depuis l'historique

**F5 - Notifications email**:
- [ ] Email envoye automatiquement sur changement de solde
- [ ] Recap mensuel envoye le 1er du mois
- [ ] Toggle activation par client
- [ ] Email en francais avec template propre
- [ ] Gestion du quota Brevo (pas de depassement)

**F6 - Multi-boutique**:
- [ ] Entreprise creee avec boutiques liees
- [ ] Transfert stock: expedition + reception en deux phases
- [ ] Gestion des ecarts (quantite recue vs envoyee)
- [ ] Dashboard consolide multi-boutique
- [ ] Bascule entre boutiques sur mobile
- [ ] Roles et acces par boutique dans l'enterprise

### Criteres transversaux

- [ ] Tous les tests passent (`pnpm run validate`)
- [ ] Lint propre sur les 3 apps
- [ ] Pas de regression sur les fonctionnalites existantes
- [ ] Documentation mise a jour dans CLAUDE.md si necessaire
- [ ] Migration Prisma propre et reversible
- [ ] UI en francais pour tous les textes utilisateur
