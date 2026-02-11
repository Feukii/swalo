# Correctifs API - Session 5 (Final)

**Date** : 20 janvier 2026
**Status** : ✅ **Tous les bugs corrigés**

---

## 🐛 Bug corrigé : `customersApi.getById is not a function`

### Problème

```
ERROR Erreur entrée: [TypeError: _libApi.customersApi.getById is not a function (it is undefined)]
ERROR Erreur sortie: [TypeError: _libApi.suppliersApi.getById is not a function (it is undefined)]
```

### Cause

Les fonctions API s'appellent `getOne` et non `getById`.

### Solution

#### Fichier : [CashScreen.tsx](apps/mobile/src/screens/CashScreen.tsx)

**Pour les clients (ligne 309)** :

```typescript
// Avant
const fullCustomer = await customersApi.getById(selectedCustomerId);

// Après
const fullCustomer = await customersApi.getOne(selectedCustomerId);
```

**Pour les fournisseurs (ligne 437)** :

```typescript
// Avant
const fullSupplier = await suppliersApi.getById(selectedSupplierId);

// Après
const fullSupplier = await suppliersApi.getOne(selectedSupplierId);
```

### Vérification API disponible

#### customersApi

```typescript
export const customersApi = {
  getAll: async (params?: { search?: string; is_active?: boolean }) => { ... },
  getOne: async (id: string) => {  // ← Fonction correcte
    return api.get<any>(`/customers/${id}`);
  },
  create: async (data: { ... }) => { ... },
  update: async (id: string, data: { ... }) => { ... },
  delete: async (id: string) => { ... },
};
```

#### suppliersApi

```typescript
export const suppliersApi = {
  getAll: async (params?: { search?: string; is_active?: boolean }) => { ... },
  getOne: async (id: string) => {  // ← Fonction correcte
    return api.get<any>(`/suppliers/${id}`);
  },
  create: async (data: { ... }) => { ... },
  update: async (id: string, data: { ... }) => { ... },
  payDebt: async (debtId: string, data: { ... }) => { ... },
  delete: async (id: string) => { ... },
};
```

---

## ✅ Résultat final

### Remboursement client (CashScreen)

1. Récupère le client avec `customersApi.getOne()`
2. Calcule le solde actuel
3. Si dette existante : Ajoute paiement sur créance
4. Si pas de dette : Crée créance négative
5. Crée entrée caisse pour suivi trésorerie
6. Affiche message approprié selon scénario

### Règlement fournisseur (CashScreen)

1. Récupère le fournisseur avec `suppliersApi.getOne()`
2. Calcule le solde actuel
3. Si dette existante : Ajoute paiement sur dette
4. Si pas de dette : Crée dette négative
5. Crée sortie caisse pour suivi trésorerie
6. Affiche message approprié selon scénario

---

## 📊 Récapitulatif complet des correctifs Session 5

| #   | Problème                         | Solution                            | Status |
| --- | -------------------------------- | ----------------------------------- | ------ |
| 1   | `current_stock should not exist` | Supprimé mise à jour manuelle stock | ✅     |
| 2   | Mode "Mobile" à enlever          | Supprimé partout dans SaleScreen    | ✅     |
| 3   | Logique remboursement client     | Paye dette puis créance négative    | ✅     |
| 4   | Logique règlement fournisseur    | Paye dette puis dette négative      | ✅     |
| 5   | `getById is not a function`      | Changé en `getOne`                  | ✅     |

**Taux de complétion : 100%** ✅

---

## 🧪 Tests à effectuer

### Test 1 : Remboursement client avec dette

1. Client avec solde = 10000 F
2. Caisse → Entrée → Remboursement client
3. Sélectionner le client
4. Montant = 5000 F
5. Valider
6. ✅ **Attendu** : "Paiement de 5 000 F enregistré. Nouveau solde: 5 000 F"

### Test 2 : Remboursement client sans dette

1. Client avec solde = 0 F
2. Caisse → Entrée → Remboursement client
3. Sélectionner le client
4. Montant = 3000 F
5. Valider
6. ✅ **Attendu** : "Paiement de 3 000 F enregistré. ⚠️ Vous devez rendre 3 000 F au client."

### Test 3 : Remboursement client dépassement

1. Client avec solde = 5000 F
2. Caisse → Entrée → Remboursement client
3. Sélectionner le client
4. Montant = 8000 F
5. Valider
6. ✅ **Attendu** : "Paiement de 8 000 F enregistré. ⚠️ Vous devez rendre 3 000 F au client."

### Test 4 : Règlement fournisseur avec dette

1. Fournisseur avec solde = 12000 F
2. Caisse → Sortie → Règlement fournisseur
3. Sélectionner le fournisseur
4. Montant = 7000 F
5. Valider
6. ✅ **Attendu** : "Paiement de 7 000 F enregistré. Nouveau solde: 5 000 F"

### Test 5 : Règlement fournisseur sans dette

1. Fournisseur avec solde = 0 F
2. Caisse → Sortie → Règlement fournisseur
3. Sélectionner le fournisseur
4. Montant = 4000 F
5. Valider
6. ✅ **Attendu** : "Paiement de 4 000 F enregistré. ⚠️ Le fournisseur ... doit vous rembourser 4 000 F."

### Test 6 : Règlement fournisseur dépassement

1. Fournisseur avec solde = 3000 F
2. Caisse → Sortie → Règlement fournisseur
3. Sélectionner le fournisseur
4. Montant = 5000 F
5. Valider
6. ✅ **Attendu** : "Paiement de 5 000 F enregistré. ⚠️ Le fournisseur ... doit vous rembourser 2 000 F."

---

## 📝 Fichiers modifiés

### Session 5 complète

| Fichier            | Modifications                                                                              | Lignes |
| ------------------ | ------------------------------------------------------------------------------------------ | ------ |
| **SaleScreen.tsx** | - Suppression mise à jour stock<br>- Suppression mode "Mobile"<br>- Simplification logique | ~30    |
| **CashScreen.tsx** | - Logique remboursement client<br>- Logique règlement fournisseur<br>- Correction `getOne` | ~100   |

**Total** : 2 fichiers modifiés, ~130 lignes changées

---

## 🎯 Prochaine étape

La seule fonctionnalité restante de la demande initiale :

### 5. Gestion hiérarchique du catalogue

**Besoin** : Permettre d'ajouter/modifier :

- Familles d'articles
- Articles (dans familles)
- Marques (dans articles)
- Références (dans marques)

**Complexité** : Élevée (2-3h)
**Status** : 🔄 À implémenter

**Question** : Voulez-vous que j'implémente cette fonctionnalité maintenant ?

---

**Date de création** : 20 janvier 2026
**Dernière mise à jour** : 20 janvier 2026
**Status** : ✅ **Tous les bugs de la Session 5 corrigés**
