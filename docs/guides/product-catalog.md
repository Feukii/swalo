# Système de Catalogue d'Articles - Guide Complet

## Vue d'ensemble

Le système de catalogue d'articles a été implémenté pour permettre une gestion intelligente et structurée des produits avec une hiérarchie : **Famille > Type d'article > Marque > Référence**.

## Architecture des Données

### Structure hiérarchique

```
Famille (ex: GLASSES, CHARGEURS, KIT BLUETOOTH, CARTES MEMOIRES)
  └─ Type d'article (ex: Glass 3D, Chargeur 1A TC, Casque)
      └─ Marque (ex: Tecno, Samsung, Oraimo)
          └─ Référence/Série (ex: Spark 4, A10E, 2ème choix)
              └─ Code Article/SKU (ex: GLA01TECSpk4)
                  └─ Libellé Article (ex: Glass 3D Tecno Spark 4)
```

### Champs du modèle Product

| Champ | Type | Description | Exemple |
|-------|------|-------------|---------|
| `family` | string | Famille d'article | GLASSES, CHARGEURS |
| `article_type` | string | Type d'article | Glass 3D, Chargeur 1A TC |
| `brand` | string | Marque | Tecno, Samsung, Oraimo |
| `reference` | string | Référence/Série | Spark 4, A10E, 2ème choix |
| `sku` | string | Code Article (unique) | GLA01TECSpk4 |
| `name` | string | Libellé/Désignation | Glass 3D Tecno Spark 4 |
| `barcode` | string | Code-barres (optionnel) | 1234567890123 |
| `cost_price` | number | Prix d'achat (FCFA) | 1000 |
| `sell_price` | number | Prix de vente (FCFA) | 1500 |
| `unit` | string | Unité de mesure | unit, pcs, kg, box |
| `alert_threshold` | number | Seuil d'alerte stock | 5 |
| `is_active` | boolean | Article actif | true/false |

## Démarrage

### 1. Appliquer la migration de base de données

Démarrez d'abord votre base de données PostgreSQL, puis exécutez :

```bash
cd apps/api

# En développement
npx prisma migrate dev

# En production
npx prisma migrate deploy
```

La migration `20260120000000_add_product_fields` ajoutera les colonnes :
- `family` (VARCHAR 100)
- `article_type` (VARCHAR 100)
- `brand` (VARCHAR 100)
- `reference` (VARCHAR 100)

### 2. Générer le client Prisma

```bash
cd apps/api
npx prisma generate
```

### 3. Démarrer l'application

```bash
# Terminal 1 - API
cd apps/api
pnpm dev

# Terminal 2 - Mobile App
cd apps/mobile
pnpm start
```

## Utilisation de l'écran Catalogue Articles

### Accès

Dans l'application mobile :
1. Onglet **Plus** (icône menu)
2. Cliquer sur **Catalogue Articles**

### Fonctionnalités principales

#### 🔍 Recherche
- Recherche globale par SKU, nom, marque, référence
- Mise à jour en temps réel pendant la saisie

#### 🎯 Filtres
- Filtrer par **Famille** (GLASSES, CHARGEURS, etc.)
- Filtrer par **Marque** (Tecno, Samsung, Oraimo, etc.)
- Filtrer par **Type d'article** (Glass 3D, Chargeur 1A TC, etc.)
- Badge indiquant le nombre de filtres actifs
- Bouton "Réinitialiser" pour effacer tous les filtres

#### ➕ Ajouter un article

1. Cliquer sur le bouton **+** (en haut à droite ou bouton flottant)
2. Remplir le formulaire :

   **Champs obligatoires** :
   - Famille *
   - Code Article (SKU) * - peut être généré automatiquement
   - Libellé Article *

   **Champs optionnels** :
   - Type d'article
   - Marque
   - Référence/Série
   - Code-barres
   - Prix d'achat
   - Prix de vente
   - Seuil d'alerte stock
   - Unité (sélection parmi : unit, pcs, kg, g, l, ml, box, pack)

3. **Autocomplétion intelligente** :
   - En tapant dans Famille, Marque ou Type, des suggestions apparaissent
   - Basées sur les valeurs déjà existantes dans la base
   - Accélère la saisie et assure la cohérence

4. **Génération automatique du SKU** :
   - Cliquer sur "Générer" à côté du champ SKU
   - Format : `[FAMILLE][MARQUE][REFERENCE][NUM]`
   - Exemple : `GLATECSpk401` pour Glass Tecno Spark 4

5. Cliquer sur **Ajouter**

#### ✏️ Modifier un article

1. Cliquer sur un article dans la liste
2. Modifier les champs souhaités
3. Note : Le SKU ne peut pas être modifié après création
4. Cliquer sur **Enregistrer**

#### 🗑️ Supprimer un article

1. Ouvrir un article (cliquer dessus)
2. Cliquer sur l'icône Poubelle dans les actions
3. Confirmer la suppression

### Affichage de la liste

Chaque carte produit affiche :
- **Code SKU** (en bleu)
- **Libellé complet**
- **Tags** : Famille (bleu), Marque (vert)
- **Prix de vente** (en gras)
- **Stock actuel** avec badge coloré :
  - 🔴 Rouge : Rupture (stock = 0)
  - 🟡 Orange : Stock faible (≤ seuil d'alerte)
  - 🟢 Vert : Stock OK
- **Type d'article** et **Référence** (en petits caractères)
- **Actions** : Modifier, Supprimer

## API Backend

### Endpoints disponibles

```http
GET    /api/products                    # Liste des produits avec filtres
GET    /api/products/:id                # Détails d'un produit
GET    /api/products/sku/:sku           # Recherche par SKU
GET    /api/products/filters            # Tous les filtres disponibles
GET    /api/products/families           # Liste des familles
GET    /api/products/brands             # Liste des marques
GET    /api/products/article-types      # Liste des types d'article
GET    /api/products/stats              # Statistiques produits
GET    /api/products/low-stock          # Produits en stock faible
POST   /api/products                    # Créer un produit
PUT    /api/products/:id                # Mettre à jour un produit
DELETE /api/products/:id                # Supprimer un produit
```

### Exemples d'utilisation

#### Recherche avec filtres

```http
GET /api/products?family=GLASSES&brand=Tecno&search=Spark
```

#### Créer un produit

```json
POST /api/products
{
  "sku": "GLA01TECSpk4",
  "name": "Glass 3D Tecno Spark 4",
  "family": "GLASSES",
  "article_type": "Glass 3D",
  "brand": "Tecno",
  "reference": "Spark 4",
  "cost_price": 1000,
  "sell_price": 1500,
  "unit": "unit",
  "alert_threshold": 5,
  "is_active": true
}
```

#### Récupérer les filtres

```http
GET /api/products/filters

Response:
{
  "families": ["GLASSES", "CHARGEURS", "KIT BLUETOOTH", "CARTES MEMOIRES"],
  "brands": ["Tecno", "Samsung", "Oraimo", "Generic"],
  "article_types": ["Glass 3D", "Chargeur 1A TC", "Casque", "Carte SD"]
}
```

## Exemple de données

Voici quelques exemples d'articles basés sur votre catalogue :

```javascript
// Glass 3D Tecno Spark 4
{
  family: "GLASSES",
  article_type: "Glass 3D",
  brand: "Tecno",
  reference: "Spark 4",
  sku: "GLA01TECSpk4",
  name: "Glass 3D Tecno Spark 4",
  cost_price: 800,
  sell_price: 1200,
  unit: "unit"
}

// Chargeur Oraimo
{
  family: "CHARGEURS",
  article_type: "Chargeur 1A TC",
  brand: "Oraimo",
  reference: "OCD-01",
  sku: "CHA02ORAOCD-01",
  name: "Chargeur 1A TC Oraimo OCD-01",
  cost_price: 2000,
  sell_price: 3000,
  unit: "unit"
}

// Casque Bluetooth
{
  family: "KIT BLUETOOTH",
  article_type: "Casque",
  brand: "Generic",
  reference: "BT-500",
  sku: "KITGENBT-500",
  name: "Casque Bluetooth Generic BT-500",
  cost_price: 5000,
  sell_price: 7500,
  unit: "unit"
}
```

## Bonnes pratiques

### Conventions de nommage

1. **Familles** : Toujours en MAJUSCULES (ex: GLASSES, CHARGEURS)
2. **SKU** : Format cohérent recommandé `[FAM][MARQUE][REF][NUM]`
3. **Libellé** : Descriptif complet incluant type, marque et référence

### Organisation

- Créer d'abord les familles principales
- Définir les types d'article pour chaque famille
- Ajouter les marques au fur et à mesure
- Utiliser l'autocomplétion pour maintenir la cohérence

### Gestion du stock

- Définir un seuil d'alerte approprié pour chaque type d'article
- Articles critiques : seuil plus élevé
- Articles à rotation lente : seuil plus bas

## Fichiers modifiés

### Backend
- `apps/api/prisma/schema.prisma` - Modèle Product étendu
- `apps/api/src/modules/products/dto/create-product.dto.ts` - DTO création
- `apps/api/src/modules/products/dto/search-product.dto.ts` - DTO recherche
- `apps/api/src/modules/products/products.service.ts` - Logique métier
- `apps/api/src/modules/products/products.controller.ts` - Endpoints
- `apps/api/prisma/migrations/20260120000000_add_product_fields/` - Migration

### Mobile
- `apps/mobile/src/screens/ProductCatalogScreen.tsx` - Écran principal (NOUVEAU)
- `apps/mobile/src/lib/api.ts` - API client produits
- `apps/mobile/App.tsx` - Route ProductCatalog
- `apps/mobile/src/screens/MoreScreen.tsx` - Lien menu

## Support et questions

Pour toute question ou problème, consultez :
- Les logs de l'application mobile
- Les logs de l'API backend
- La documentation Prisma pour les migrations

## Prochaines étapes possibles

- [ ] Import/Export CSV du catalogue
- [ ] Scan de code-barres pour recherche rapide
- [ ] Photos des articles
- [ ] Gestion des variantes (couleurs, tailles)
- [ ] Historique des modifications
- [ ] Statistiques de vente par famille/marque
