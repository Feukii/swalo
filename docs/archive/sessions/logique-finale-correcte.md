# Logique Finale Correcte - Gestion Créances/Dettes

**Date** : 20 janvier 2026
**Status** : ✅ **Logique correcte implémentée**

---

## 📊 Principe de base

### Solde = Somme de toutes les créances/dettes

```
Solde client = Σ (créances)
Solde fournisseur = Σ (dettes)
```

Pour modifier le solde, on crée une **nouvelle créance/dette** (positive ou négative).

---

## 💰 Logique Clients

### Vente à crédit

**Action** : Le client achète à crédit (il doit de l'argent)
**Effet** : +solde

```
Créance créée : +10000 FCFA
Solde avant : 5000 FCFA
Solde après : 5000 + 10000 = 15000 FCFA
```

**Code** :

```typescript
await receivablesApi.create({
  customer_id: selectedCustomerId,
  amount: amountValue, // Montant POSITIF
  description: `Vente à crédit - ${items}`,
});
```

---

### Remboursement client

**Action** : Le client paye (il doit moins)
**Effet** : -solde

```
Créance créée : -5000 FCFA (négative)
Solde avant : 15000 FCFA
Solde après : 15000 + (-5000) = 10000 FCFA
```

**Code** :

```typescript
await receivablesApi.create({
  customer_id: selectedCustomerId,
  amount: -amountValue, // Montant NÉGATIF
  description: `Paiement de ${customerName}`,
});
```

---

### Scénarios possibles

#### Scénario 1 : Remboursement partiel

```
Solde initial : 10000 FCFA
Remboursement : 5000 FCFA
→ Créance : -5000 FCFA
Nouveau solde : 5000 FCFA ✓
```

#### Scénario 2 : Remboursement total

```
Solde initial : 5000 FCFA
Remboursement : 5000 FCFA
→ Créance : -5000 FCFA
Nouveau solde : 0 FCFA ✓
```

#### Scénario 3 : Remboursement excédentaire

```
Solde initial : 5000 FCFA
Remboursement : 10000 FCFA
→ Créance : -10000 FCFA
Nouveau solde : -5000 FCFA ✓ (on doit rendre au client)
```

#### Scénario 4 : Remboursement sans dette

```
Solde initial : 0 FCFA
Remboursement : 3000 FCFA
→ Créance : -3000 FCFA
Nouveau solde : -3000 FCFA ✓ (on doit rendre au client)
```

---

## 🏪 Logique Fournisseurs

### Achat à crédit

**Action** : On achète à crédit (on doit de l'argent)
**Effet** : +solde

```
Dette créée : +8000 FCFA
Solde avant : 3000 FCFA
Solde après : 3000 + 8000 = 11000 FCFA
```

**Code** :

```typescript
await debtsApi.create({
  supplier_id: selectedSupplierId,
  amount: amountValue, // Montant POSITIF
  description: 'Achat à crédit',
});
```

---

### Règlement fournisseur

**Action** : On paye le fournisseur (on doit moins)
**Effet** : -solde

```
Dette créée : -4000 FCFA (négative)
Solde avant : 11000 FCFA
Solde après : 11000 + (-4000) = 7000 FCFA
```

**Code** :

```typescript
await debtsApi.create({
  supplier_id: selectedSupplierId,
  amount: -exitAmount, // Montant NÉGATIF
  description: `Paiement à ${supplierName}`,
});
```

---

### Scénarios possibles

#### Scénario 1 : Règlement partiel

```
Solde initial : 12000 FCFA
Règlement : 7000 FCFA
→ Dette : -7000 FCFA
Nouveau solde : 5000 FCFA ✓
```

#### Scénario 2 : Règlement total

```
Solde initial : 5000 FCFA
Règlement : 5000 FCFA
→ Dette : -5000 FCFA
Nouveau solde : 0 FCFA ✓
```

#### Scénario 3 : Règlement excédentaire

```
Solde initial : 3000 FCFA
Règlement : 5000 FCFA
→ Dette : -5000 FCFA
Nouveau solde : -2000 FCFA ✓ (fournisseur nous doit)
```

#### Scénario 4 : Règlement sans dette

```
Solde initial : 0 FCFA
Règlement : 4000 FCFA
→ Dette : -4000 FCFA
Nouveau solde : -4000 FCFA ✓ (fournisseur nous doit)
```

---

## 📋 Visibilité des transactions

### Page détails client

Toutes les créances s'affichent :

- Créances positives (ventes à crédit) : +10000 F
- Créances négatives (paiements) : -5000 F
- **Total visible = Solde actuel**

### Page détails fournisseur

Toutes les dettes s'affichent :

- Dettes positives (achats à crédit) : +8000 F
- Dettes négatives (paiements) : -4000 F
- **Total visible = Solde actuel**

---

## ✅ Affichage du signe négatif

### Dans les KPIs (déjà implémenté)

#### CustomerDetailsScreen.tsx

```typescript
<KPICard
  label="Solde actuel"
  value={
    (customer.stats?.total_balance || 0) < 0
      ? `-${formatMoney(Math.abs(customer.stats?.total_balance || 0))}`
      : formatMoney(customer.stats?.total_balance || 0)
  }
/>
```

#### SupplierDetailsScreen.tsx

```typescript
<KPICard
  label="Solde actuel"
  value={
    (supplier.stats?.total_balance || 0) < 0
      ? `-${formatMoney(Math.abs(supplier.stats?.total_balance || 0))}`
      : formatMoney(supplier.stats?.total_balance || 0)
  }
/>
```

### Dans les messages

```typescript
// Client avec solde négatif
`Nouveau solde: -${formatMoney(Math.abs(newBalance))}\n⚠️ Vous devez rendre ${formatMoney(Math.abs(newBalance))} au client.`
// Fournisseur avec solde négatif
`Nouveau solde: -${formatMoney(Math.abs(newBalance))}\n⚠️ Le fournisseur doit vous rembourser ${formatMoney(Math.abs(newBalance))}.`;
```

---

## 🎯 Résumé

| Action                       | Type    | Montant créance/dette | Effet sur solde |
| ---------------------------- | ------- | --------------------- | --------------- |
| Vente à crédit (client)      | Créance | **+amountValue**      | +solde          |
| Remboursement client         | Créance | **-amountValue**      | -solde          |
| Achat à crédit (fournisseur) | Dette   | **+amountValue**      | +solde          |
| Règlement fournisseur        | Dette   | **-amountValue**      | -solde          |

### Règles d'or

1. ✅ **Toujours créer une nouvelle créance/dette** (ne jamais modifier une existante)
2. ✅ **Utiliser montant négatif pour réduire le solde**
3. ✅ **Utiliser montant positif pour augmenter le solde**
4. ✅ **Le solde est calculé automatiquement** (somme de toutes les créances/dettes)
5. ✅ **Toutes les transactions sont visibles** dans les pages de détails
6. ✅ **Préserver le signe négatif** dans l'affichage

---

## 📊 Exemple complet - Client

### État initial

```
Solde : 0 FCFA
Créances : []
```

### 1. Vente à crédit : 10000 FCFA

```
Créance créée : +10000 FCFA
Solde : 10000 FCFA
Créances : [+10000]
```

### 2. Remboursement : 5000 FCFA

```
Créance créée : -5000 FCFA
Solde : 5000 FCFA
Créances : [+10000, -5000]
```

### 3. Remboursement : 10000 FCFA

```
Créance créée : -10000 FCFA
Solde : -5000 FCFA (négatif !)
Créances : [+10000, -5000, -10000]
Affichage : "-5 000 F"
```

### 4. Vente à crédit : 8000 FCFA

```
Créance créée : +8000 FCFA
Solde : 3000 FCFA
Créances : [+10000, -5000, -10000, +8000]
Affichage : "3 000 F"
```

---

## 📊 Exemple complet - Fournisseur

### État initial

```
Solde : 0 FCFA
Dettes : []
```

### 1. Achat à crédit : 12000 FCFA

```
Dette créée : +12000 FCFA
Solde : 12000 FCFA
Dettes : [+12000]
```

### 2. Règlement : 7000 FCFA

```
Dette créée : -7000 FCFA
Solde : 5000 FCFA
Dettes : [+12000, -7000]
```

### 3. Règlement : 8000 FCFA

```
Dette créée : -8000 FCFA
Solde : -3000 FCFA (négatif !)
Dettes : [+12000, -7000, -8000]
Affichage : "-3 000 F"
```

### 4. Achat à crédit : 5000 FCFA

```
Dette créée : +5000 FCFA
Solde : 2000 FCFA
Dettes : [+12000, -7000, -8000, +5000]
Affichage : "2 000 F"
```

---

## 🔄 Fichiers modifiés

### CashScreen.tsx

**Fonction `handleSubmitEntry`** (remboursement client) :

```typescript
// Créer une créance négative (réduit le solde)
await receivablesApi.create({
  customer_id: selectedCustomerId,
  amount: -amountValue, // Montant négatif
  description: note || `Paiement de ${customerName}`,
});

// Nouveau solde avec signe
const newBalance = currentBalance - amountValue;
const message =
  newBalance > 0
    ? `Remboursement de ${formatMoney(amountValue)} enregistré.\nNouveau solde: ${formatMoney(newBalance)}`
    : newBalance < 0
      ? `Remboursement de ${formatMoney(amountValue)} enregistré.\nNouveau solde: -${formatMoney(Math.abs(newBalance))}\n⚠️ Vous devez rendre ${formatMoney(Math.abs(newBalance))} au client.`
      : `Remboursement de ${formatMoney(amountValue)} enregistré.\nLa dette est totalement remboursée!`;
```

**Fonction `handleSubmitExit`** (règlement fournisseur) :

```typescript
// Créer une dette négative (réduit le solde)
await debtsApi.create({
  supplier_id: selectedSupplierId,
  amount: -exitAmount, // Montant négatif
  description: note || `Paiement à ${supplierName}`,
});

// Nouveau solde avec signe
const newBalance = currentBalance - exitAmount;
const message =
  newBalance > 0
    ? `Règlement de ${formatMoney(exitAmount)} enregistré.\nNouveau solde: ${formatMoney(newBalance)}`
    : newBalance < 0
      ? `Règlement de ${formatMoney(exitAmount)} enregistré.\nNouveau solde: -${formatMoney(Math.abs(newBalance))}\n⚠️ Le fournisseur ${supplierName} doit vous rembourser ${formatMoney(Math.abs(newBalance))}.`
      : `Règlement de ${formatMoney(exitAmount)} enregistré.\nLa dette est totalement remboursée!`;
```

---

## ✅ Tests de validation

### Test 1 : Client - Vente puis remboursement partiel

1. Solde initial : 0 F
2. Vente à crédit : 10000 F → Solde = 10000 F ✓
3. Remboursement : 5000 F → Solde = 5000 F ✓
4. **Vérifier** : 2 créances visibles (+10000, -5000)

### Test 2 : Client - Remboursement excédentaire

1. Solde initial : 5000 F
2. Remboursement : 8000 F → Solde = -3000 F ✓
3. **Vérifier** : Affichage "-3 000 F"
4. **Vérifier** : Message "Vous devez rendre 3 000 F"

### Test 3 : Fournisseur - Achat puis règlement partiel

1. Solde initial : 0 F
2. Achat à crédit : 12000 F → Solde = 12000 F ✓
3. Règlement : 7000 F → Solde = 5000 F ✓
4. **Vérifier** : 2 dettes visibles (+12000, -7000)

### Test 4 : Fournisseur - Règlement excédentaire

1. Solde initial : 3000 F
2. Règlement : 5000 F → Solde = -2000 F ✓
3. **Vérifier** : Affichage "-2 000 F"
4. **Vérifier** : Message "Le fournisseur doit vous rembourser 2 000 F"

---

**Date de création** : 20 janvier 2026
**Status** : ✅ **Logique correcte et cohérente implémentée**
