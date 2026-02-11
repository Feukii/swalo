# Système de Prix Historisés pour le Stock

## Problématique

Actuellement, un produit a un seul prix (`sell_price` et `cost_price`). Mais dans la réalité :

- Le prix d'achat peut évoluer dans le temps
- Le prix de vente peut évoluer dans le temps
- Il faut savoir à quel prix a été acheté le stock actuel

## Solution proposée

### 1. Nouvelle table : `stock_batches`

Chaque fois qu'on ajoute du stock, on crée un nouveau "lot" (batch) avec :

- Le produit concerné
- La quantité ajoutée
- Le prix d'achat à ce moment
- Le prix de vente applicable à ce moment
- La date d'ajout

```sql
CREATE TABLE stock_batches (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  cost_price INTEGER NOT NULL,  -- Prix d'achat au moment de l'ajout
  sell_price INTEGER NOT NULL,  -- Prix de vente au moment de l'ajout
  remaining_quantity INTEGER NOT NULL, -- Quantité restante (après ventes)
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### 2. Logique FIFO (First In, First Out)

Quand on vend un produit :

1. On prend d'abord dans le lot le plus ancien
2. Si ce lot est épuisé, on passe au lot suivant
3. On enregistre le prix de vente du lot dans la transaction

### 3. Modifications nécessaires

#### Base de données

- ✅ Créer table `stock_batches`
- ✅ Ajouter `batch_id` dans `inventory_movements`
- ✅ Modifier les mouvements de stock pour lier aux lots

#### API Backend

- ✅ Nouveau service `StockBatchesService`
- ✅ Modifier `InventoryService` pour gérer les lots
- ✅ Endpoint `POST /api/inventory/add-stock` avec prix
- ✅ Endpoint `GET /api/products/:id/batches` pour voir les lots

#### Application Mobile

- ✅ Écran "Ajouter Stock" avec champs :
  - Quantité
  - Prix d'achat unitaire
  - Prix de vente unitaire (optionnel, sinon reprend le prix actuel)
- ✅ Afficher dans la page produit les lots de stock :
  ```
  Lot 1 : 10 unités - Acheté à 1000 FCFA - Vendu à 1500 FCFA - 15/01/2026
  Lot 2 : 15 unités - Acheté à 1200 FCFA - Vendu à 1800 FCFA - 18/01/2026
  Total: 25 unités
  ```

### 4. Exemple de flux

#### Ajout de stock

```
Produit: Glass 3D Samsung A10E
Action: Ajouter 20 unités
Prix d'achat: 1000 FCFA/unité
Prix de vente: 1500 FCFA/unité
Date: 20/01/2026

→ Créer stock_batch:
  - quantity: 20
  - remaining_quantity: 20
  - cost_price: 1000
  - sell_price: 1500
```

#### Vente (FIFO)

```
Vente de 5 Glass 3D Samsung A10E

Lots disponibles:
- Lot A: 3 unités @ 1500 FCFA (reste de 20/12/2025)
- Lot B: 25 unités @ 1800 FCFA (ajouté 15/01/2026)

Traitement:
1. Prendre 3 unités du Lot A @ 1500 FCFA
   → Lot A: remaining_quantity = 0
2. Prendre 2 unités du Lot B @ 1800 FCFA
   → Lot B: remaining_quantity = 23

Total vente: (3 × 1500) + (2 × 1800) = 8100 FCFA
```

### 5. Migration de données existantes

Pour le stock actuel sans lot :

```sql
-- Créer un lot "initial" pour chaque produit ayant du stock
INSERT INTO stock_batches (shop_id, product_id, quantity, remaining_quantity, cost_price, sell_price, created_at)
SELECT
  p.shop_id,
  p.id,
  COALESCE((SELECT SUM(CASE WHEN type = 'PURCHASE' THEN quantity ELSE -quantity END)
            FROM inventory_movements
            WHERE product_id = p.id), 0) as quantity,
  COALESCE((SELECT SUM(CASE WHEN type = 'PURCHASE' THEN quantity ELSE -quantity END)
            FROM inventory_movements
            WHERE product_id = p.id), 0) as remaining_quantity,
  p.cost_price,
  p.sell_price,
  NOW() - INTERVAL '1 day' -- Créé "hier" pour être plus ancien
FROM products p
WHERE EXISTS (
  SELECT 1 FROM inventory_movements
  WHERE product_id = p.id
);
```

### 6. Avantages

✅ **Traçabilité** : On sait exactement quel stock a été acheté à quel prix
✅ **Marge réelle** : Calcul précis de la marge par vente
✅ **Évolution des prix** : Historique complet des variations de prix
✅ **Valorisation du stock** : Valeur réelle du stock = somme des (remaining_quantity × cost_price) de chaque lot
✅ **Analyse** : Identifier les périodes d'achat avantageuses

### 7. Affichage dans l'app

#### Page Produit (onglet Stock)

```
┌─────────────────────────────────────┐
│ Glass 3D Samsung A10E               │
│ Stock total: 47 unités              │
│ Valeur du stock: 58,600 FCFA       │
├─────────────────────────────────────┤
│ Lots en stock:                      │
│                                     │
│ 📦 Lot du 15/12/2025                │
│    12 unités @ 1200 FCFA            │
│    Valeur: 14,400 FCFA              │
│                                     │
│ 📦 Lot du 18/01/2026                │
│    35 unités @ 1263 FCFA            │
│    Valeur: 44,200 FCFA              │
│                                     │
│ [+ Ajouter du stock]                │
└─────────────────────────────────────┘
```

#### Modal "Ajouter du stock"

```
┌─────────────────────────────────────┐
│ Ajouter du stock                    │
├─────────────────────────────────────┤
│ Produit: Glass 3D Samsung A10E      │
│ Prix actuel: 1500 FCFA              │
│                                     │
│ Quantité à ajouter: [____]          │
│                                     │
│ Prix d'achat unitaire: [____] FCFA │
│                                     │
│ Nouveau prix de vente (optionnel):  │
│ [1500] FCFA                         │
│ ☐ Modifier le prix de vente         │
│                                     │
│ Coût total: 0 FCFA                  │
│                                     │
│ [Annuler]  [Ajouter]                │
└─────────────────────────────────────┘
```

## Ordre d'implémentation

1. **Migration DB** : Créer table `stock_batches`
2. **Backend** : Service de gestion des lots
3. **Backend** : Modifier inventaire pour FIFO
4. **Mobile** : UI "Ajouter stock" avec prix
5. **Mobile** : Affichage des lots par produit
6. **Migration de données** : Créer lots initiaux

## Compatibilité

- Le système actuel reste fonctionnel
- Les nouveaux mouvements de stock créeront des lots
- L'ancien stock sera migré en un lot unique "initial"
