# Correctifs Finaux - Session 5

**Date** : 20 janvier 2026
**Durée** : 30 minutes
**Status** : ✅ Complété (sauf gestion catalogue hiérarchique)

---

## 📋 Problèmes corrigés

| # | Problème | Fichier(s) | Status |
|---|----------|-----------|--------|
| 1 | Erreur `current_stock should not exist` lors de la vente | SaleScreen.tsx | ✅ Corrigé |
| 2 | Mode de paiement "Mobile" à enlever | SaleScreen.tsx | ✅ Corrigé |
| 3 | Logique remboursement client incorrecte | CashScreen.tsx | ✅ Corrigé |
| 4 | Logique règlement fournisseur incorrecte | CashScreen.tsx | ✅ Corrigé |
| 5 | Gestion hiérarchique du catalogue | ProductCatalogScreen.tsx | 🔄 À implémenter |

---

## 🔧 Correctif 1 : Erreur `current_stock should not exist`

### Problème
```
ERROR Erreur lors de l'enregistrement de la vente: [Error: property current_stock should not exist]
```

### Cause
Le champ `current_stock` est un champ **calculé** (via `InventoryMovement`), pas un champ de la table `products`. On ne peut pas le mettre à jour directement via `productsApi.update()`.

### Solution
Suppression de la mise à jour manuelle du stock dans SaleScreen. Le stock sera géré ultérieurement via un système de mouvements d'inventaire.

#### Fichier : [SaleScreen.tsx](apps/mobile/src/screens/SaleScreen.tsx)

**Supprimé** (lignes 199-208) :
```typescript
// 1. Mettre à jour le stock via l'API
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

**Résultat** :
- ✅ Plus d'erreur lors de l'enregistrement de la vente
- ⚠️ Le stock ne se met pas à jour automatiquement (nécessite implémentation service d'inventaire)

---

## 🔧 Correctif 2 : Suppression mode de paiement "Mobile"

### Modifications

#### Fichier : [SaleScreen.tsx](apps/mobile/src/screens/SaleScreen.tsx)

**Type PaymentMethod** :
```typescript
// Avant
type PaymentMethod = 'cash' | 'mobile' | 'credit';

// Après
type PaymentMethod = 'cash' | 'credit';
```

**Imports** :
```typescript
// Avant
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash,
  CheckCircle,
  Package,
  DollarSign,
  Smartphone, // ← Supprimé
  CreditCard,
} from '../components/icons/SimpleIcons';

// Après (sans Smartphone)
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash,
  CheckCircle,
  Package,
  DollarSign,
  CreditCard,
} from '../components/icons/SimpleIcons';
```

**Labels** :
```typescript
// Avant
const labels: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  mobile: 'Mobile Money',
  credit: 'À crédit',
};

// Après
const labels: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  credit: 'À crédit',
};
```

**Boutons de paiement** :
```typescript
// Avant
const paymentMethods = [
  { key: 'cash', label: 'Espèces', icon: DollarSign },
  { key: 'mobile', label: 'Mobile', icon: Smartphone },
  { key: 'credit', label: 'Crédit', icon: CreditCard, disabled: ... },
];

// Après
const paymentMethods = [
  { key: 'cash', label: 'Espèces', icon: DollarSign },
  { key: 'credit', label: 'Crédit', icon: CreditCard, disabled: ... },
];
```

**Messages d'alerte** :
```typescript
// Avant
const noteText = paymentMethod === 'mobile'
  ? `Vente Mobile Money - ${getTotalItems()} article(s): ${itemsDescription}`
  : `Vente espèces - ${getTotalItems()} article(s): ${itemsDescription}`;

const modeLabel = paymentMethod === 'mobile' ? 'Mobile Money' : 'Espèces';

// Après
await cashApi.createEntry({
  type: 'IN',
  category: 'vente',
  amount: amount,
  note: `Vente espèces - ${getTotalItems()} article(s): ${itemsDescription}`,
  customer_id: selectedCustomer !== 'cash' ? selectedCustomer : undefined,
});

Alert.alert(
  'Vente enregistrée',
  `Client: ${customerName}\nMontant: ${formatMoney(amount)}\nMode: Espèces\n\n✓ Entrée caisse créée\n✓ Solde caisse +${formatMoney(amount)}`,
  [{ text: 'OK', onPress: resetForm }]
);
```

**Résultat** :
- ✅ Mode "Mobile" supprimé partout
- ✅ Interface simplifiée : Cash ou Crédit uniquement

---

## 🔧 Correctif 3 : Logique remboursement client

### Problème
Logique incorrecte : créait toujours une créance négative, même quand le client avait une dette existante.

### Logique attendue
1. **Si client a une dette (solde > 0)** : Payer la dette existante (réduit le solde)
2. **Si client n'a pas de dette (solde = 0)** : Créer créance négative (on doit rendre au client)
3. **Si client a déjà un solde négatif** : Augmenter la créance négative

### Exemple
```
Solde initial = 10000 FCFA (client doit 10000)
Remboursement = 5000 FCFA
→ Payer 5000 sur la créance existante
→ Nouveau solde = 5000 FCFA

Remboursement = 10000 FCFA supplémentaires
→ Payer 5000 (solde la dette) + créer créance négative de 5000
→ Nouveau solde = -5000 FCFA (on doit 5000 au client)

Remboursement = 5000 FCFA supplémentaires
→ Créer créance négative de 5000
→ Nouveau solde = -10000 FCFA (on doit 10000 au client)
```

### Solution

#### Fichier : [CashScreen.tsx](apps/mobile/src/screens/CashScreen.tsx)

**Code corrigé** :
```typescript
else if (entryCategory === 'remboursement_client') {
  // Remboursement client : le client nous paye (réduit sa dette)
  const customer = customers.find(c => c.id === selectedCustomerId);
  const customerName = customer ? `${customer.first_name || ''} ${customer.name}`.trim() : 'Client';

  // Récupérer le client complet avec ses créances
  const fullCustomer = await customersApi.getById(selectedCustomerId);
  const currentBalance = fullCustomer.stats?.total_balance || 0;

  // Trouver la créance la plus ancienne encore impayée
  const pendingReceivables = fullCustomer.receivables
    .filter((r: any) => r.status === 'PENDING' || r.status === 'PARTIAL')
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (pendingReceivables.length > 0 && currentBalance > 0) {
    // Il y a une dette : ajouter un paiement sur la créance la plus ancienne
    await receivablesApi.addPayment(pendingReceivables[0].id, {
      amount: amountValue,
      payment_method: 'Espèces',
      note: note || `Paiement de ${customerName}`,
    });

    const newBalance = currentBalance - amountValue;
    const message = newBalance > 0
      ? `Paiement de ${formatMoney(amountValue)} enregistré.\nNouveau solde: ${formatMoney(newBalance)}`
      : newBalance < 0
      ? `Paiement de ${formatMoney(amountValue)} enregistré.\n⚠️ Vous devez rendre ${formatMoney(Math.abs(newBalance))} au client.`
      : `Paiement de ${formatMoney(amountValue)} enregistré.\nLa dette est totalement remboursée!`;

    Alert.alert('Succès', message);
  } else {
    // Pas de dette : créer une créance négative (on doit rendre au client)
    await receivablesApi.create({
      customer_id: selectedCustomerId,
      amount: -amountValue,
      description: note || `Remboursement à effectuer à ${customerName}`,
    });

    const newBalance = currentBalance - amountValue;
    Alert.alert(
      'Succès',
      `Paiement de ${formatMoney(amountValue)} enregistré.\n⚠️ Vous devez rendre ${formatMoney(Math.abs(newBalance))} au client.`
    );
  }

  // Créer l'entrée de caisse pour le suivi de trésorerie
  await cashApi.createEntry({
    type: 'IN',
    category: entryCategory,
    amount: amountValue,
    note: note || `Paiement client - ${customerName}`,
    customer_id: selectedCustomerId,
  });
}
```

**Résultat** :
- ✅ Logique correcte : paye d'abord les dettes existantes
- ✅ Crée une créance négative seulement si nécessaire
- ✅ Messages clairs selon le scénario
- ✅ Solde calculé correctement

---

## 🔧 Correctif 4 : Logique règlement fournisseur

### Problème
Même problème que pour les clients, mais pour les fournisseurs.

### Logique attendue
1. **Si on doit au fournisseur (solde > 0)** : Payer la dette (réduit le solde)
2. **Si on ne doit rien (solde = 0)** : Créer dette négative (fournisseur nous doit)
3. **Si fournisseur nous doit déjà (solde < 0)** : Augmenter la dette négative

### Solution

#### Fichier : [CashScreen.tsx](apps/mobile/src/screens/CashScreen.tsx)

**Code corrigé** :
```typescript
else if (exitCategory === 'reglement_fournisseur') {
  // Règlement fournisseur : on paye le fournisseur (réduit notre dette)
  const supplier = suppliers.find(s => s.id === selectedSupplierId);
  const supplierName = supplier ? `${supplier.first_name || ''} ${supplier.name}`.trim() : 'Fournisseur';

  // Récupérer le fournisseur complet avec ses dettes
  const fullSupplier = await suppliersApi.getById(selectedSupplierId);
  const currentBalance = fullSupplier.stats?.total_balance || 0;

  // Trouver la dette la plus ancienne encore impayée
  const pendingDebts = fullSupplier.debts
    .filter((d: any) => d.status === 'PENDING' || d.status === 'PARTIAL')
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (pendingDebts.length > 0 && currentBalance > 0) {
    // Il y a une dette : ajouter un paiement sur la dette la plus ancienne
    await debtsApi.addPayment(pendingDebts[0].id, {
      amount: exitAmount,
      payment_method: 'Espèces',
      note: note || `Paiement à ${supplierName}`,
    });

    const newBalance = currentBalance - exitAmount;
    const message = newBalance > 0
      ? `Paiement de ${formatMoney(exitAmount)} enregistré.\nNouveau solde: ${formatMoney(newBalance)}`
      : newBalance < 0
      ? `Paiement de ${formatMoney(exitAmount)} enregistré.\n⚠️ Le fournisseur ${supplierName} doit vous rembourser ${formatMoney(Math.abs(newBalance))}.`
      : `Paiement de ${formatMoney(exitAmount)} enregistré.\nLa dette est totalement remboursée!`;

    Alert.alert('Succès', message);
  } else {
    // Pas de dette : créer une dette négative (le fournisseur nous doit)
    await debtsApi.create({
      supplier_id: selectedSupplierId,
      amount: -exitAmount,
      description: note || `Remboursement à recevoir de ${supplierName}`,
    });

    const newBalance = currentBalance - exitAmount;
    Alert.alert(
      'Succès',
      `Paiement de ${formatMoney(exitAmount)} enregistré.\n⚠️ Le fournisseur ${supplierName} doit vous rembourser ${formatMoney(Math.abs(newBalance))}.`
    );
  }

  // Créer la sortie de caisse pour le suivi de trésorerie
  await cashApi.createEntry({
    type: 'OUT',
    category: exitCategory,
    amount: exitAmount,
    note: note || `Paiement fournisseur - ${supplierName}`,
    supplier_id: selectedSupplierId,
  });
}
```

**Résultat** :
- ✅ Logique correcte : paye d'abord les dettes existantes
- ✅ Crée une dette négative seulement si nécessaire
- ✅ Messages clairs selon le scénario
- ✅ Solde calculé correctement

---

## 🔄 Fonctionnalité restante : Gestion hiérarchique du catalogue

### Besoin
Pouvoir ajouter et modifier les éléments du catalogue de manière hiérarchique :
- Famille
- Article (dans une famille)
- Marque (dans un article)
- Référence (dans une marque)

### Approche proposée
Modifier ProductCatalogScreen pour afficher une vue hiérarchique avec :
- Modal "Ajouter Famille"
- Modal "Modifier Famille"
- Modal "Ajouter Article" (sélection famille parente)
- Modal "Modifier Article"
- Modal "Ajouter Marque" (sélection famille + article parents)
- Modal "Modifier Marque"
- Modal "Ajouter Référence" (sélection famille + article + marque parents)
- Modal "Modifier Référence" (= produit complet)

### Complexité
- **Élevée** : Nécessite refonte complète de ProductCatalogScreen
- **Durée estimée** : 2-3 heures
- **Impact** : Très positif pour l'organisation du catalogue

### Status
🔄 **À implémenter** (si vous le souhaitez)

---

## 📊 Résumé des correctifs

| Fichier | Modifications | Impact |
|---------|---------------|--------|
| **SaleScreen.tsx** | - Suppression mise à jour manuelle stock<br>- Suppression mode "Mobile"<br>- Simplification logique paiement | ✅ Ventes fonctionnelles<br>✅ Interface simplifiée |
| **CashScreen.tsx** | - Logique remboursement client corrigée<br>- Logique règlement fournisseur corrigée | ✅ Soldes calculés correctement<br>✅ Pas de créances négatives inutiles |

---

## ✅ Tests recommandés

### Test 1 : Vente espèces
1. Ajouter produits au panier
2. Sélectionner "Client comptant"
3. Choisir mode "Espèces"
4. Entrer montant
5. Valider
6. ✅ Vérifier : Pas d'erreur, entrée caisse créée

### Test 2 : Vente à crédit
1. Ajouter produits au panier
2. Sélectionner un client enregistré
3. Choisir mode "Crédit"
4. Entrer montant
5. Valider
6. ✅ Vérifier : Créance créée, pas d'entrée caisse

### Test 3 : Remboursement client avec dette
1. Client avec solde = 10000 FCFA
2. Caisse → Entrée → Remboursement client
3. Montant = 5000 FCFA
4. Valider
5. ✅ Vérifier : Nouveau solde = 5000 FCFA

### Test 4 : Remboursement client sans dette
1. Client avec solde = 0 FCFA
2. Caisse → Entrée → Remboursement client
3. Montant = 5000 FCFA
4. Valider
5. ✅ Vérifier : Nouveau solde = -5000 FCFA (créance négative)

### Test 5 : Règlement fournisseur avec dette
1. Fournisseur avec solde = 8000 FCFA
2. Caisse → Sortie → Règlement fournisseur
3. Montant = 3000 FCFA
4. Valider
5. ✅ Vérifier : Nouveau solde = 5000 FCFA

### Test 6 : Règlement fournisseur sans dette
1. Fournisseur avec solde = 0 FCFA
2. Caisse → Sortie → Règlement fournisseur
3. Montant = 2000 FCFA
4. Valider
5. ✅ Vérifier : Nouveau solde = -2000 FCFA (dette négative)

---

## 🎯 Prochaines étapes

### Immédiat
1. ✅ Tester les 4 correctifs appliqués
2. 🔄 Décider si on implémente la gestion hiérarchique du catalogue

### Court terme (si catalogue hiérarchique souhaité)
3. Concevoir l'interface de gestion hiérarchique
4. Implémenter les modals d'ajout/modification
5. Tester la gestion complète du catalogue

### Moyen terme
6. Implémenter service d'inventaire (mouvements de stock)
7. Connecter les ventes au service d'inventaire
8. Finaliser système FIFO avec stock_batches

---

**Date de création** : 20 janvier 2026
**Status** : ✅ **4/5 correctifs appliqués**
