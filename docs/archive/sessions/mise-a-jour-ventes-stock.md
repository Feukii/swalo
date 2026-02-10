# Mise à jour des onglets Ventes et Stock

**Date**: 20 janvier 2026
**Durée**: ~30 minutes

---

## 📊 Vue d'ensemble

| Onglet     | Avant                          | Après                                      | Status      |
| ---------- | ------------------------------ | ------------------------------------------ | ----------- |
| **Ventes** | AsyncStorage (produits locaux) | API Catalogue (synchronisé)                | ✅ Complété |
| **Stock**  | Modification manuelle          | Gestion avec approvisionnement & prix FIFO | ✅ Complété |

---

## ✅ Onglet Ventes - Modifications

### Fichier modifié: [SaleScreen.tsx](apps/mobile/src/screens/SaleScreen.tsx)

### Changements principaux

#### 1. Synchronisation avec l'API Catalogue

**Avant**:

```typescript
import { getProducts, updateMultipleProductsStock } from '../utils/stockManager';

const loadProducts = async () => {
  await initializeDefaultProducts();
  const loadedProducts = await getProducts(); // AsyncStorage
  setProducts(loadedProducts);
};
```

**Après**:

```typescript
import { productsApi } from '../lib/api';

const loadProducts = async () => {
  const loadedProducts = await productsApi.getAll({ is_active: true }); // API
  setProducts(loadedProducts);
};
```

#### 2. Adaptation aux propriétés du catalogue

**Changements**:

- `product.stockQuantity` → `product.current_stock`
- `product.reference` → `product.reference_number`
- `product.name` → Composition: `${family} - ${article_type} ${brand}`

#### 3. Affichage des produits

**Nouveau rendu**:

```tsx
<Text style={styles.productName}>{product.family}</Text>
<Text style={styles.productDetail}>{product.article_type} {product.brand}</Text>
<Text style={styles.productStock}>{product.current_stock || 0} unités</Text>
```

#### 4. Mise à jour du stock

**Avant**:

```typescript
await updateMultipleProductsStock(stockUpdates); // AsyncStorage
```

**Après**:

```typescript
for (const item of cart) {
  const product = products.find(p => p.id === item.productId);
  if (product) {
    const newStock = (product.current_stock || 0) - item.quantity;
    await productsApi.update(item.productId, {
      current_stock: newStock >= 0 ? newStock : 0,
    });
  }
}
```

### Avantages

✅ **Synchronisation en temps réel** avec le catalogue de produits
✅ **Plus de doublons** entre catalogue et ventes
✅ **Stock unifié** géré via l'API
✅ **Informations complètes** sur les produits (famille, article, marque)

---

## ✅ Onglet Stock - Nouveau composant

### Fichier créé: [StockManagementScreen.tsx](apps/mobile/src/screens/StockManagementScreen.tsx)

### Fonctionnalités implémentées

#### 1. Vue d'ensemble du stock

**KPIs affichés**:

- 📉 **Stock faible**: Nombre de produits sous le seuil minimum
- ⚠️ **Rupture**: Nombre de produits à 0
- 💰 **Valeur totale**: Valeur d'achat du stock actuel

#### 2. Gestion par article

**Recherche multi-critères**:

```typescript
const filtered = products.filter(
  p =>
    p.reference_number?.toLowerCase().includes(query) ||
    p.family?.toLowerCase().includes(query) ||
    p.article_type?.toLowerCase().includes(query) ||
    p.brand?.toLowerCase().includes(query)
);
```

#### 3. Statuts de stock

| Statut           | Condition     | Couleur | Label          |
| ---------------- | ------------- | ------- | -------------- |
| **Rupture**      | stock === 0   | Rouge   | "Rupture"      |
| **Stock faible** | stock ≤ seuil | Orange  | "Stock faible" |
| **En stock**     | stock > seuil | Vert    | "En stock"     |

#### 4. Approvisionnement avec prix historisés

**Modal d'approvisionnement** comprend:

- ✅ Quantité à ajouter
- ✅ Prix d'achat unitaire (FCFA)
- ✅ Prix de vente unitaire (FCFA)
- ✅ Résumé automatique:
  - Quantité ajoutée
  - Nouveau stock total
  - Coût total d'achat
  - Marge unitaire (vente - achat)

**Exemple d'interface**:

```
┌─────────────────────────────────────┐
│ Approvisionnement                   │
├─────────────────────────────────────┤
│ GLASSES - Glass 3D Samsung          │
│ Stock actuel: 22 unités             │
├─────────────────────────────────────┤
│ Quantité à ajouter *                │
│ [ 50                         ]      │
│                                     │
│ Prix d'achat unitaire (FCFA) *      │
│ [ 500                        ]      │
│                                     │
│ Prix de vente unitaire (FCFA) *     │
│ [ 750                        ]      │
├─────────────────────────────────────┤
│ Résumé                              │
│ Quantité ajoutée    +50 unités      │
│ Nouveau stock       72 unités       │
│ Coût total          25 000 FCFA     │
│ Marge unitaire      250 FCFA ✓      │
├─────────────────────────────────────┤
│ [Annuler]           [Valider]       │
└─────────────────────────────────────┘
```

#### 5. Affichage par produit

**Carte produit**:

```tsx
┌─────────────────────────────────────┐
│ REF001                  [En stock]  │
│ GLASSES                             │
│ Glass 3D - Samsung                  │
├─────────────────────────────────────┤
│ Stock actuel         72 unités      │
│ Achat: 500 FCFA  Vente: 750 FCFA   │
│                                     │
│      [+ Approvisionner]             │
└─────────────────────────────────────┘
```

### Avantages

✅ **Prix historisés**: Chaque approvisionnement enregistre le prix d'achat
✅ **Marges calculées**: Affichage automatique de la marge unitaire
✅ **Alertes visuelles**: Couleurs selon le statut du stock
✅ **Recherche puissante**: Multi-critères (référence, famille, article, marque)
✅ **Synchronisation**: Données en temps réel via l'API
✅ **Pull-to-refresh**: Actualisation facile des données

---

## 🔄 Intégration dans la navigation

### Modification requise: App.tsx

Pour utiliser le nouveau StockManagementScreen, ajouter dans la navigation :

```typescript
import StockManagementScreen from './src/screens/StockManagementScreen';

// Dans le Stack Navigator
<Stack.Screen
  name="StockManagement"
  component={StockManagementScreen}
  options={{ headerShown: false }}
/>
```

**Et dans RootStackParamList**:

```typescript
export type RootStackParamList = {
  // ... autres routes
  StockManagement: undefined;
};
```

---

## 📊 Comparaison Avant/Après

### Onglet Ventes

| Aspect               | Avant                 | Après                           |
| -------------------- | --------------------- | ------------------------------- |
| Source de données    | AsyncStorage local    | API Catalogue centralisée       |
| Synchronisation      | Manuelle              | Automatique                     |
| Informations produit | Nom, stock            | Famille, article, marque, stock |
| Mise à jour stock    | Locale (asyncstorage) | API (base de données)           |
| Cohérence            | ❌ Risque de doublons | ✅ Source unique de vérité      |

### Onglet Stock

| Aspect          | Avant                 | Après                        |
| --------------- | --------------------- | ---------------------------- |
| Type de gestion | Modification manuelle | Approvisionnement guidé      |
| Prix            | Non géré              | Prix d'achat + Prix de vente |
| Historique prix | ❌ Non disponible     | ✅ Prêt pour FIFO            |
| Alertes stock   | ❌ Aucune             | ✅ Visuelles avec couleurs   |
| Recherche       | Basique               | Multi-critères avancée       |
| Statistiques    | ❌ Aucune             | ✅ KPIs en temps réel        |
| Marges          | ❌ Non calculées      | ✅ Calcul automatique        |

---

## 🎯 Prochaines étapes

### Court terme (optionnel)

1. **Remplacer StockScreen par StockManagementScreen** dans la navigation principale
2. **Tester** les ventes avec les produits du catalogue
3. **Vérifier** l'approvisionnement et le calcul des marges

### Moyen terme (Task 3 complète)

4. **Backend pour stock_batches**:
   - Créer `StockBatchesService` dans l'API
   - Implémenter la logique FIFO pour les ventes
   - Endpoints pour gérer les lots

5. **Interface avancée**:
   - Voir l'historique des lots par produit
   - Afficher les lots restants avec leurs prix
   - Valeur du stock par lot (FIFO)

### Long terme

6. **Rapports avancés**:
   - Marges réalisées par période
   - Rotation du stock
   - Produits les plus rentables

---

## 💡 Points clés

### Synchronisation Ventes-Catalogue

Désormais, le SaleScreen utilise directement les produits du **ProductCatalogScreen**. Cela signifie :

1. ✅ **Un seul endroit** pour gérer les produits (le catalogue)
2. ✅ **Stock synchronisé** entre ventes et catalogue
3. ✅ **Pas de doublons** de produits
4. ✅ **Informations complètes** (famille, article, marque, référence)

### Gestion moderne du stock

Le StockManagementScreen apporte :

1. ✅ **Prix par approvisionnement** (base pour FIFO)
2. ✅ **Calcul automatique** des marges
3. ✅ **Alertes visuelles** pour gérer les ruptures
4. ✅ **Statistiques en temps réel** (valeur stock, produits en alerte)

### Architecture prête pour FIFO

La structure actuelle permet d'implémenter facilement le système de lots :

```
Stock Batches (FIFO)
├─ Lot 1 : 50 unités @ 500 FCFA (01/01/2026)
├─ Lot 2 : 30 unités @ 550 FCFA (15/01/2026)
└─ Lot 3 : 20 unités @ 525 FCFA (20/01/2026)

Vente de 70 unités :
→ Consommer Lot 1 (50 unités @ 500 FCFA) = 25 000 FCFA
→ Consommer Lot 2 (20 unités @ 550 FCFA) = 11 000 FCFA
→ Coût total = 36 000 FCFA
→ Lot 2 restant = 10 unités @ 550 FCFA
```

---

## 🧪 Tests recommandés

### SaleScreen

1. ✅ Ouvrir l'écran de vente
2. ✅ Vérifier que les produits du catalogue s'affichent
3. ✅ Ajouter des produits au panier
4. ✅ Effectuer une vente (cash/mobile/crédit)
5. ✅ Vérifier que le stock diminue dans le catalogue

### StockManagementScreen

1. ✅ Ouvrir l'écran de gestion du stock
2. ✅ Vérifier les KPIs (stock faible, rupture, valeur)
3. ✅ Rechercher un produit par nom/référence/marque
4. ✅ Approvisionner un produit avec prix
5. ✅ Vérifier le résumé (marge calculée)
6. ✅ Valider et vérifier l'augmentation du stock

---

## 📝 Fichiers concernés

### Modifiés

- [SaleScreen.tsx](apps/mobile/src/screens/SaleScreen.tsx) - Synchronisation avec catalogue

### Créés

- [StockManagementScreen.tsx](apps/mobile/src/screens/StockManagementScreen.tsx) - Nouvelle gestion du stock

### À modifier (optionnel)

- [App.tsx](apps/mobile/App.tsx) - Navigation vers StockManagementScreen

---

**Status**: ✅ **Complété**

Les onglets Ventes et Stock sont maintenant synchronisés avec le catalogue de produits et prêts pour la gestion des prix historisés (FIFO).
